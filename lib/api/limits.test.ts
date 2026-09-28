/*
  The API's render quota and media import limits: `npm test`.
*/
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { checkMedia, checkRenderQuota, dayKey, DEFAULT_LIMITS, maxImportBytes, secondsUntilNextDay } from "./limits";
import { sniff } from "./sniff";

const MB = 1024 * 1024;
/* 2026-09-28 23:59:30 UTC: half a minute before the day's count starts again. */
const lateNight = Date.UTC(2026, 8, 28, 23, 59, 30);
const quota = { perDay: 5, concurrent: 2 };

describe("render quota", () => {
  it("lets a render through under both limits", () => {
    assert.deepEqual(checkRenderQuota({ usedToday: 4, inFlight: 1, now: lateNight, quota }), { ok: true });
  });

  it("refuses the day's last-plus-one render until midnight UTC", () => {
    const decision = checkRenderQuota({ usedToday: 5, inFlight: 0, now: lateNight, quota });
    assert.equal(decision.ok, false);
    if (decision.ok) return;
    assert.equal(decision.reason, "daily");
    assert.equal(decision.retryAfter, 30);
    assert.match(decision.message, /5 API renders for today/);
  });

  it("refuses while the organisation's renders are all busy, and says for how long to wait", () => {
    const decision = checkRenderQuota({ usedToday: 0, inFlight: 2, now: lateNight, quota });
    assert.equal(decision.ok, false);
    if (decision.ok) return;
    assert.equal(decision.reason, "concurrent");
    assert.ok(decision.retryAfter > 0);
    assert.match(decision.message, /2 renders queued or running/);
  });

  it("names the daily limit first when both are hit: waiting for a slot would not help", () => {
    const decision = checkRenderQuota({ usedToday: 5, inFlight: 2, now: lateNight, quota });
    assert.equal(!decision.ok && decision.reason, "daily");
  });

  it("counts days in UTC", () => {
    assert.equal(dayKey(lateNight), "2026-09-28");
    assert.equal(dayKey(lateNight + 31_000), "2026-09-29");
    assert.equal(secondsUntilNextDay(Date.UTC(2026, 8, 28, 0, 0, 0)), 24 * 60 * 60);
    assert.equal(secondsUntilNextDay(lateNight), 30);
  });

  it("has sane defaults", () => {
    assert.ok(DEFAULT_LIMITS.render.perDay > DEFAULT_LIMITS.render.concurrent);
    assert.equal(maxImportBytes(), DEFAULT_LIMITS.media.video.maxBytes);
  });
});

describe("media limits", () => {
  const image = { kind: "image" as const, mime: "image/jpeg", width: 4000, height: 3000 };
  const video = { kind: "video" as const, mime: "video/mp4", width: 1080, height: 1920, duration: 12, codec: "avc1" };

  it("accepts files within their kind's limit", () => {
    assert.equal(checkMedia(image, 5 * MB), null);
    assert.equal(checkMedia(video, 39 * MB), null);
  });

  it("answers 413 with the limit and the file's size, per kind", () => {
    const big = checkMedia(image, 27.3 * MB);
    assert.equal(big?.status, 413);
    assert.equal(big?.code, "payload_too_large");
    assert.match(big!.message, /Images can be up to 20 MB; this one is 27 MB/);
    /* 30 MB is a fine video and too big a photo. */
    assert.equal(checkMedia(video, 30 * MB), null);
    assert.equal(checkMedia(image, 30 * MB)?.status, 413);
    assert.match(checkMedia(video, 41 * MB)!.message, /Videos can be up to 40 MB/);
  });

  it("refuses HEVC and other codecs browsers can't all play, naming the codec and the fix", () => {
    const hevc = checkMedia({ ...video, codec: "hvc1" }, 10 * MB);
    assert.equal(hevc?.status, 415);
    assert.equal(hevc?.code, "unsupported_media");
    assert.match(hevc!.message, /HEVC \(H\.265\).*re-encode it as H\.264/);
    assert.equal(checkMedia({ ...video, codec: "hev1" }, MB)?.status, 415);
    assert.match(checkMedia({ ...video, codec: "apcn" }, MB)!.message, /ProRes/);
    /* A codec the header didn't name is let through. */
    assert.equal(checkMedia({ ...video, codec: undefined }, MB), null);
  });
});

describe("sniff: video codec", () => {
  const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
  const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const box = (type: string, ...content: number[][]) => {
    const body = content.flat();
    return [...be32(8 + body.length), ...ascii(type), ...body];
  };
  const tkhd = (w: number, h: number) => box("tkhd", [0, 0, 0, 0, ...new Array(72).fill(0), ...be32(w * 65536), ...be32(h * 65536)]);
  const hdlr = (handler: string) => box("hdlr", [0, 0, 0, 0], be32(0), ascii(handler), new Array(12).fill(0), [0]);
  /* One sample entry; only its size and code matter here. */
  const stsd = (format: string) => box("stsd", [0, 0, 0, 0], be32(1), be32(16), ascii(format), new Array(8).fill(0));
  const trak = (w: number, h: number, handler: string, format: string) => box("trak", tkhd(w, h), box("mdia", hdlr(handler), box("minf", box("stbl", stsd(format)))));
  const mvhd = box("mvhd", [0, 0, 0, 0], be32(0), be32(0), be32(1000), be32(4000), new Array(80).fill(0));
  const file = (...traks: number[][]) => new Uint8Array([...box("ftyp", ascii("isom"), be32(0)), ...box("moov", mvhd, ...traks)]);

  it("reads the video track's codec, not the audio track's", () => {
    const found = sniff(file(trak(0, 0, "soun", "mp4a"), trak(1080, 1920, "vide", "hvc1")));
    assert.deepEqual(found, { kind: "video", mime: "video/mp4", width: 1080, height: 1920, duration: 4, codec: "hvc1" });
    assert.equal(sniff(file(trak(1920, 1080, "vide", "avc1")))?.codec, "avc1");
  });

  it("leaves the codec out when there is no sample description", () => {
    const found = sniff(new Uint8Array([...box("ftyp", ascii("isom"), be32(0)), ...box("moov", mvhd, box("trak", tkhd(640, 360)))]));
    assert.equal(found?.codec, undefined);
    assert.equal(found?.width, 640);
  });
});
