import { execFile, spawnSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";

import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

import type { Config } from "./config.js";
import { errorMessage } from "./queue.js";

/*
  The worker's second job, beside rendering: re-encode uploaded videos that not
  every browser can decode (an iPhone's HEVC) to H.264, keeping their media ids.
  The queue and the swap live in `convex/transcode.ts`; this is the loop and
  ffmpeg.

  One clip at a time on its own lane, polled slowly: uploads are rare, a 4K
  phone clip takes a while to encode, and none of it should hold up a render.
  If ffmpeg is not installed the lane never starts, so running the worker
  locally for renders needs nothing new. A clip interrupted by a shutdown is
  claimed again once its lease runs out.

  The encode is the stock import's (`scripts/import-stock.ts`): H.264 High,
  yuv420p, CRF 20 under a bitrate ceiling, +faststart, HLG/PQ tone-mapped to
  SDR, sized to just cover a 1080×1920 frame and never upscaled. The worker
  image carries this directory and not the repo, so the settings are repeated
  here; keep the two in step.

  Environment, beside the render worker's own:
    TRANSCODE_POLL_MS   idle poll interval, default 30000; 0 turns the lane off
    TRANSCODE_ORG_ID    only this organisation's uploads (a Convex id), for a
                        worker run by hand against a shared deployment
*/

const run = promisify(execFile);

type Claimed = { id: string; storageId: string; name: string; codec: string | null; attempts: number; url: string };

const claim = makeFunctionReference<"mutation", { secret: string; orgId?: string }, Claimed | null>("transcode:claim");
const uploadUrl = makeFunctionReference<"mutation", { secret: string }, string>("transcode:uploadUrl");
const finish = makeFunctionReference<
  "mutation",
  { secret: string; id: string; from: string; storageId?: string; posterStorageId?: string; codec: string; width?: number; height?: number; duration?: number },
  boolean
>("transcode:finish");
const fail = makeFunctionReference<"mutation", { secret: string; id: string; error: string }, null>("transcode:fail");

const FRAME = { width: 1080, height: 1920 };
/* CRF 20 is the target; the ceiling scales with pixel count, so grainy footage
   cannot run away with the bitrate. */
const MAX_BITRATE_AT_FRAME = 10e6;
const ceiling = (size: { width: number; height: number }) => Math.round((MAX_BITRATE_AT_FRAME * size.width * size.height) / (FRAME.width * FRAME.height));
const PLAYABLE_PIXELS = ["yuv420p", "yuvj420p"];
const HDR_TRANSFERS = ["arib-std-b67", "smpte2084"];
/* An hour of 4K is not a phone clip anyone meant to put in a video. */
const ENCODE_TIMEOUT_MS = 30 * 60 * 1000;

type Probe = {
  streams?: { codec_type?: string; codec_name?: string; width?: number; height?: number; pix_fmt?: string; color_transfer?: string; side_data_list?: { rotation?: number }[] }[];
  format?: { duration?: string };
};

/* The codec, and the dimensions a browser paints, which differ from the coded
   ones when a phone recorded sideways. */
async function probe(file: string) {
  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-show_entries", "stream=codec_type,codec_name,width,height,pix_fmt,color_transfer:stream_side_data=rotation:format=duration",
    "-of", "json",
    file,
  ]);
  const info = JSON.parse(stdout) as Probe;
  const video = info.streams?.find((stream) => stream.codec_type === "video");
  if (!video?.width || !video.height) throw new Error("No video stream");
  const rotation = Math.abs(video.side_data_list?.find((entry) => entry.rotation !== undefined)?.rotation ?? 0);
  const sideways = rotation === 90 || rotation === 270;
  const duration = Number(info.format?.duration);
  return {
    codec: video.codec_name ?? "unknown",
    pixels: video.pix_fmt ?? "unknown",
    hdr: HDR_TRANSFERS.includes(video.color_transfer ?? ""),
    audio: Boolean(info.streams?.some((stream) => stream.codec_type === "audio")),
    duration: Number.isFinite(duration) && duration > 0 ? Math.round(duration * 1000) / 1000 : undefined,
    width: sideways ? video.height : video.width,
    height: sideways ? video.width : video.height,
  };
}

const even = (n: number) => 2 * Math.ceil(n / 2 - 1e-6);

function masterSize(width: number, height: number) {
  const scale = Math.min(1, Math.max(FRAME.width / width, FRAME.height / height));
  return { width: even(width * scale), height: even(height * scale) };
}

async function ffmpeg(args: string[]) {
  await run("ffmpeg", ["-v", "error", "-y", ...args], { timeout: ENCODE_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 });
}

async function encodeMaster(source: string, out: string, info: Awaited<ReturnType<typeof probe>>) {
  const size = masterSize(info.width, info.height);
  const maxrate = ceiling(size);
  const filters = [];
  if (size.width !== info.width || size.height !== info.height) filters.push(`scale=${size.width}:${size.height}:flags=lanczos`);
  if (info.hdr) filters.push("zscale=t=linear:npl=100", "format=gbrpf32le", "zscale=p=bt709", "tonemap=mobius:desat=0", "zscale=t=bt709:m=bt709:r=tv");
  filters.push("format=yuv420p");
  await ffmpeg([
    "-i", source,
    "-map", "0:v:0", "-map", "0:a:0?",
    "-vf", filters.join(","),
    "-c:v", "libx264", "-profile:v", "high", "-preset", "medium", "-crf", "20",
    "-maxrate", String(maxrate), "-bufsize", String(maxrate * 2),
    ...(info.hdr ? ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709"] : []),
    ...(info.audio ? ["-c:a", "aac", "-b:a", "128k"] : []),
    /* Location among the camera metadata; it has no business in a shared file. */
    "-map_metadata", "-1",
    "-movflags", "+faststart",
    out,
  ]);
}

/* A little way in, as the upload's own poster is: the first frame of a phone
   recording is often black. Cut from the new master, so it is SDR too. */
async function cutPoster(master: string, out: string, duration: number | undefined) {
  await ffmpeg(["-ss", String(duration ? Math.min(0.1, duration / 2) : 0), "-i", master, "-frames:v", "1", "-q:v", "3", out]);
}

export function transcoder(cfg: Config, log: (line: string) => void) {
  const pollMs = Number(process.env.TRANSCODE_POLL_MS ?? 30_000);
  const orgId = process.env.TRANSCODE_ORG_ID || undefined;
  const client = new ConvexHttpClient(cfg.convexUrl);
  const secret = cfg.secret;
  const say = (line: string) => log(`transcode: ${line}`);
  const available = () => ["ffmpeg", "ffprobe"].every((tool) => spawnSync(tool, ["-version"], { stdio: "ignore" }).status === 0);

  async function upload(file: string, contentType: string) {
    const url = await client.mutation(uploadUrl, { secret });
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": contentType }, body: (await readFile(file)) as unknown as BodyInit });
    if (!response.ok) throw new Error(`Upload failed: ${response.status} ${await response.text()}`);
    return ((await response.json()) as { storageId: string }).storageId;
  }

  async function convert(clip: Claimed) {
    const dir = await mkdtemp(join(tmpdir(), "transcode-"));
    try {
      const source = join(dir, "source");
      const response = await fetch(clip.url);
      if (!response.ok || !response.body) throw new Error(`Download answered ${response.status}`);
      await pipeline(Readable.fromWeb(response.body as import("node:stream/web").ReadableStream), createWriteStream(source));
      const info = await probe(source);

      if (info.codec === "h264" && PLAYABLE_PIXELS.includes(info.pixels) && !info.hdr) {
        await client.mutation(finish, { secret, id: clip.id, from: clip.storageId, codec: "h264", width: info.width, height: info.height, duration: info.duration });
        return `already h264 ${info.width}×${info.height}; codec recorded`;
      }

      const master = join(dir, "master.mp4");
      const poster = join(dir, "poster.jpg");
      const started = Date.now();
      await encodeMaster(source, master, info);
      const final = await probe(master);
      await cutPoster(master, poster, final.duration);
      const storageId = await upload(master, "video/mp4");
      const posterStorageId = await upload(poster, "image/jpeg");
      const swapped = await client.mutation(finish, {
        secret,
        id: clip.id,
        from: clip.storageId,
        storageId,
        posterStorageId,
        codec: final.codec,
        width: final.width,
        height: final.height,
        duration: final.duration,
      });
      const mb = (bytes: number) => `${(bytes / 1e6).toFixed(1)} MB`;
      const summary =
        `${info.codec} ${info.width}×${info.height} ${mb((await stat(source)).size)}${info.hdr ? " HDR" : ""} → ` +
        `${final.codec} ${final.width}×${final.height} ${mb((await stat(master)).size)} in ${Math.round((Date.now() - started) / 1000)}s`;
      return swapped ? summary : `${summary}, but the clip changed meanwhile; discarded`;
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  /* One clip if there is one; false when the queue is empty. */
  async function turn(): Promise<boolean> {
    const clip = await client.mutation(claim, { secret, ...(orgId ? { orgId } : {}) });
    if (!clip) return false;
    say(`${clip.id} "${clip.name}" (${clip.codec ?? "codec unknown"}, attempt ${clip.attempts})`);
    try {
      say(`${clip.id}: ${await convert(clip)}`);
    } catch (error) {
      const message = (error as { stderr?: string }).stderr?.trim().split("\n")[0] || errorMessage(error);
      say(`${clip.id}: failed, ${message}`);
      await client.mutation(fail, { secret, id: clip.id, error: message }).catch(() => {});
    }
    return true;
  }

  return {
    /* Poll until `stopped` says so. */
    async loop(stopped: () => boolean) {
      if (!pollMs) return;
      if (!available()) {
        say("ffmpeg/ffprobe not found; uploads will not be transcoded");
        return;
      }
      say(`polling every ${Math.round(pollMs / 1000)}s${orgId ? ` for ${orgId}` : ""}`);
      while (!stopped()) {
        try {
          if (await turn()) continue;
        } catch (error) {
          say(errorMessage(error));
        }
        await new Promise((resolve) => setTimeout(resolve, pollMs));
      }
    },
    /* Everything waiting, then return: `--transcode-once`. */
    async drain() {
      if (!available()) throw new Error("ffmpeg and ffprobe must be on PATH");
      let done = 0;
      while (await turn()) done++;
      say(`${done} clip(s)`);
    },
  };
}
