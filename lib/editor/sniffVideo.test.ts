/*
  Reading a video's codec and size from its container: `npm test`.
*/
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readMovie, sniffVideo } from "./sniffVideo";

const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));
const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const box = (type: string, ...parts: number[][]) => {
  const body = parts.flat();
  return [...u32(8 + body.length), ...ascii(type), ...body];
};
const zeros = (n: number) => Array.from({ length: n }, () => 0);

/* A version-0 track header: 20 bytes of ids and times, 16 of layer and
   volume, the 3×3 matrix, then width and height in 16.16. */
const ONE = 0x10000;
const tkhd = (width: number, height: number, quarterTurn = false) =>
  box(
    "tkhd",
    zeros(4 + 20 + 16),
    ...(quarterTurn ? [u32(0), u32(ONE), u32(0), u32(0xffff0000), u32(0), u32(0)] : [u32(ONE), u32(0), u32(0), u32(0), u32(ONE), u32(0)]),
    u32(0), u32(0), u32(0x40000000),
    u32(width * ONE),
    u32(height * ONE),
  );

/* A track as an MP4 muxer writes one: the handler in `mdia`, the sample
   description four levels down. */
const track = (handler: string, entry: string, header = tkhd(0, 0)) =>
  box(
    "trak",
    header,
    box(
      "mdia",
      box("mdhd", zeros(24)),
      box("hdlr", zeros(4), ascii(handler === "vide" ? "mhlr" : "\0\0\0\0"), ascii(handler), zeros(12)),
      box("minf", box("vmhd", zeros(12)), box("stbl", box("stsd", zeros(4), u32(1), box(entry, zeros(78))), box("stts", zeros(8)))),
    ),
  );

const movie = (...tracks: number[][]) => new Uint8Array(box("moov", box("mvhd", zeros(100)), ...tracks));

describe("readMovie", () => {
  it("names HEVC the way an iPhone tags it", () => {
    assert.equal(readMovie(movie(track("vide", "hvc1")))?.codec, "hevc");
    assert.equal(readMovie(movie(track("vide", "hev1")))?.codec, "hevc");
    assert.equal(readMovie(movie(track("vide", "dvh1")))?.codec, "hevc");
  });

  it("names H.264", () => {
    assert.equal(readMovie(movie(track("vide", "avc1")))?.codec, "h264");
  });

  it("skips the audio track to find the video one", () => {
    assert.deepEqual(readMovie(movie(track("soun", "mp4a"), track("vide", "hvc1", tkhd(1920, 1080)))), { codec: "hevc", width: 1920, height: 1080 });
  });

  it("paints a phone held upright as portrait", () => {
    assert.deepEqual(readMovie(movie(track("vide", "hvc1", tkhd(3840, 2160, true)))), { codec: "hevc", width: 2160, height: 3840 });
  });

  it("passes an unknown code through, lower case", () => {
    assert.equal(readMovie(movie(track("vide", "apcn")))?.codec, "apcn");
  });

  it("answers undefined without a video track or a moov", () => {
    assert.equal(readMovie(movie(track("soun", "mp4a"))), undefined);
    assert.equal(readMovie(new Uint8Array(box("free", zeros(8)))), undefined);
    assert.equal(readMovie(new Uint8Array(0)), undefined);
  });
});

describe("sniffVideo", () => {
  const ftyp = new Uint8Array(box("ftyp", ascii("qt  "), zeros(4), ascii("qt  ")));

  it("finds moov after a large mdat without reading it", async () => {
    const file = new Blob([ftyp, new Uint8Array(box("mdat", zeros(4096))), movie(track("vide", "hvc1"))]);
    assert.equal((await sniffVideo(file))?.codec, "hevc");
  });

  it("finds moov at the front (faststart)", async () => {
    const file = new Blob([ftyp, movie(track("vide", "avc1")), new Uint8Array(box("mdat", zeros(64)))]);
    assert.equal((await sniffVideo(file))?.codec, "h264");
  });

  it("answers undefined for anything that is not ISO media", async () => {
    assert.equal(await sniffVideo(new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0])])), undefined);
    assert.equal(await sniffVideo(new Blob([])), undefined);
  });
});
