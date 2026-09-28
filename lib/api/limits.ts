/*
  What the public API lets one organisation do: how many renders, and which
  media it may import. One config, here, so there is one place to change a
  number and, later, one place to hang per-plan limits (`limitsFor`).

  Pure functions over numbers, so they are unit-tested (`limits.test.ts`);
  `convex/api/render.ts` and `convex/api/router.ts` apply them.
*/

import type { Sniffed } from "./sniff";

const MB = 1024 * 1024;

export type RenderQuota = {
  /* Renders an organisation may ask the API for per UTC day. */
  perDay: number;
  /* Its render jobs queued or running at once, studio exports included: the
     render worker is shared, and one organisation should not fill its queue. */
  concurrent: number;
};

export type MediaLimit = {
  maxBytes: number;
  /* MIME types `sniff` may report for this kind. */
  types: readonly string[];
  /* Video: the sample-entry codes (`avc1`, …) of the codecs every browser the
     studio supports can decode. */
  codecs?: readonly string[];
};

export type Limits = {
  render: RenderQuota;
  media: { image: MediaLimit; video: MediaLimit };
};

/*
  Everyone's limits until there are plans. A video import is held whole in a
  Convex action's memory to be read, which is what bounds it; images are
  smaller than that in practice, and a 20 MB still is a camera original that
  should be resized before it goes into a 1080 px post.
*/
export const DEFAULT_LIMITS: Limits = {
  render: { perDay: 100, concurrent: 3 },
  media: {
    image: { maxBytes: 20 * MB, types: ["image/png", "image/jpeg", "image/gif", "image/webp"] },
    video: { maxBytes: 40 * MB, types: ["video/mp4", "video/quicktime"], codecs: ["avc1", "avc3"] },
  },
};

/* The limits for an organisation. One set for now; with plans, this takes the organisation's. */
export function limitsFor(): Limits {
  return DEFAULT_LIMITS;
}

/* The largest file any kind accepts: what can be refused before a download starts. */
export const maxImportBytes = (limits: Limits = DEFAULT_LIMITS) => Math.max(limits.media.image.maxBytes, limits.media.video.maxBytes);

/* ── Render quota ─────────────────────────────────────────────────── */

/* The UTC day a render is counted against, `2026-09-28`. */
export const dayKey = (now: number) => new Date(now).toISOString().slice(0, 10);

/* Whole seconds from `now` until the next UTC midnight, when the day's count starts again. */
export function secondsUntilNextDay(now: number) {
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  return Math.max(1, Math.ceil((next.getTime() - now) / 1000));
}

/* How long to suggest waiting while the organisation's renders are all busy.
   An MP4 takes about as long as the video, and most are under a minute. */
export const CONCURRENT_RETRY_S = 30;

export type QuotaDecision = { ok: true } | { ok: false; reason: "daily" | "concurrent"; retryAfter: number; message: string };

export function checkRenderQuota({ usedToday, inFlight, now, quota = DEFAULT_LIMITS.render }: { usedToday: number; inFlight: number; now: number; quota?: RenderQuota }): QuotaDecision {
  if (usedToday >= quota.perDay) {
    return { ok: false, reason: "daily", retryAfter: secondsUntilNextDay(now), message: `This organisation has used its ${quota.perDay} API renders for today (UTC); the count starts again at midnight UTC` };
  }
  if (inFlight >= quota.concurrent) {
    return {
      ok: false,
      reason: "concurrent",
      retryAfter: CONCURRENT_RETRY_S,
      message: `This organisation already has ${inFlight} render${inFlight === 1 ? "" : "s"} queued or running, the most it may have at once (${quota.concurrent}); retry when one finishes`,
    };
  }
  return { ok: true };
}

/* ── Media import ─────────────────────────────────────────────────── */

export type MediaProblem = { status: 413 | 415; code: "payload_too_large" | "unsupported_media"; message: string };

const size = (bytes: number) => `${(bytes / MB).toFixed(bytes < 10 * MB ? 1 : 0)} MB`;

const CODEC_NAMES: Record<string, string> = { avc1: "H.264", avc3: "H.264", hvc1: "HEVC (H.265)", hev1: "HEVC (H.265)", av01: "AV1", vp09: "VP9", vp08: "VP8", apch: "ProRes", apcn: "ProRes", apcs: "ProRes", apco: "ProRes", ap4h: "ProRes", mp4v: "MPEG-4 Part 2" };
export const codecName = (code: string) => CODEC_NAMES[code] ?? `"${code}"`;

/*
  Whether a file that `sniff` read may be imported: its size against its
  kind's limit, its type, and a video's codec. Null when it may. A video
  whose codec could not be read is let through: `sniff` found its size and
  length, and the studio will say so if it cannot play it.
*/
export function checkMedia(found: Sniffed, bytes: number, limits: Limits = DEFAULT_LIMITS): MediaProblem | null {
  const limit = limits.media[found.kind];
  const noun = found.kind === "image" ? "Images" : "Videos";
  if (bytes > limit.maxBytes) {
    return {
      status: 413,
      code: "payload_too_large",
      message: `${noun} can be up to ${size(limit.maxBytes)}; this one is ${size(bytes)}.${found.kind === "image" ? " Resize it to about 2000 px on the long edge first." : " Shorten or re-encode it (H.264, 1080p) first."}`,
    };
  }
  if (!limit.types.includes(found.mime)) {
    return { status: 415, code: "unsupported_media", message: `${found.mime} is not accepted; ${noun.toLowerCase()} can be ${limit.types.join(", ")}` };
  }
  if (found.kind === "video" && limit.codecs && found.codec && !limit.codecs.includes(found.codec)) {
    return {
      status: 415,
      code: "unsupported_media",
      message: `This video is ${codecName(found.codec)}, which not every browser can play; re-encode it as H.264 (for example: ffmpeg -i in.mov -c:v libx264 -pix_fmt yuv420p -c:a aac out.mp4) and import that`,
    };
  }
  return null;
}
