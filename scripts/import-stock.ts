#!/usr/bin/env node
/*
  Import the stock library into Convex, then make every video an H.264 master
  with a hover preview and a poster.

      node scripts/import-stock.ts                                # the trial set
      node scripts/import-stock.ts --categories cafe,gym --photos 10 --videos 3
      node scripts/import-stock.ts --transcode                    # videos only, no import
      node scripts/import-stock.ts --transcode --categories cafe --limit 3
      node scripts/import-stock.ts --transcode --recheck <mediaId>,<mediaId>  # finished rows, decided again
      node scripts/import-stock.ts -- --prod                      # flags after -- go to `npx convex run`

  Which deployment it writes to is whatever `npx convex run` would pick: the
  dev deployment from CONVEX_DEPLOYMENT, or CONVEX_DEPLOY_KEY if set.

  The functions it calls are in `convex/stock/import.ts`; this file is only the
  loop. It is safe to stop at any point and safe to re-run: every step checks
  what is already there, so a second run of the same command imports nothing and
  says so. If the provider answers 429 or 5xx the run stops, prints how far it
  got, and exits non-zero — run it again later and it carries on.

  The video pass needs ffmpeg (with libx264 and zscale) and ffprobe on PATH;
  `.conductor/setup.sh` installs a static build into ~/.local/bin. It downloads
  each video from its Convex URL, so the provider is not contacted again, and
  it runs one video at a time: a pending video is one not yet H.264, or missing
  its preview or poster, so a stopped run carries on where it left off and a
  finished library is a no-op. `--transcode` skips the import; `--skip-videos`
  skips the pass.
*/

import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

type Kind = "image" | "video";

type Counts = {
  total: number;
  images: number;
  videos: number;
  videosWithoutPoster: number;
  videosNotH264: number;
  videosWithoutPreview: number;
  byCategory: Record<string, { image: number; video: number }>;
  byLicense: Record<string, number>;
};

type PageResult = {
  imported: number;
  linked: number;
  skipped: number;
  rejected: number;
  failed: number;
  hasMore: boolean;
  stopped?: string;
};

/* ── Arguments ─────────────────────────────────────────────────────────── */

const argv = process.argv.slice(2);
const split = argv.indexOf("--");
const own = split === -1 ? argv : argv.slice(0, split);
const passthrough = split === -1 ? [] : argv.slice(split + 1);

function option(name: string): string | undefined {
  const index = own.indexOf(`--${name}`);
  return index === -1 ? undefined : own[index + 1];
}
const flag = (name: string) => own.includes(`--${name}`);

function count(name: string, fallback: number) {
  const raw = option(name);
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < 0) throw new Error(`--${name} wants a whole number, got "${raw}"`);
  return value;
}

/* The trial's shape: about 40 photos and 15 videos in each of 14 categories. */
const targets: Record<Kind, number> = { image: count("photos", 40), video: count("videos", 15) };
/* Searches rank rather than filter, so deep pages are mostly off-topic; past
   this many a category is as full as the provider can make it. */
const maxPages = count("max-pages", 10);
const provider = option("provider") ?? "dupe";
const videosOnly = flag("transcode");
const skipVideos = flag("skip-videos");
/* At most this many videos in the pass, for a trial on a handful. */
const limit = option("limit") === undefined ? undefined : count("limit", 0);

/* ── Convex ────────────────────────────────────────────────────────────── */

function run<T>(fn: string, args: Record<string, unknown> = {}): T {
  const result = spawnSync("npx", ["convex", "run", fn, JSON.stringify(args), ...passthrough], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`npx convex run ${fn} failed:\n${result.stderr || result.stdout}`);
  }
  /* A function that returns nothing prints nothing. */
  const output = result.stdout.trim();
  return (output ? JSON.parse(output) : null) as T;
}

/* ── Import ────────────────────────────────────────────────────────────── */

function importAll(): boolean {
  const before = run<Counts>("stock/import:counts");
  const known = Object.keys(before.byCategory);
  const categories = option("categories")?.split(",").map((slug) => slug.trim()) ?? known;
  const unknown = categories.filter((slug) => !known.includes(slug));
  if (unknown.length) throw new Error(`Unknown categories: ${unknown.join(", ")}. Known: ${known.join(", ")}`);

  for (const category of categories) {
    for (const kind of ["image", "video"] as const) {
      let have = before.byCategory[category][kind];
      const target = targets[kind];
      const label = `${category} ${kind === "image" ? "photos" : "videos"}`;
      if (have >= target) {
        console.log(`${label}: ${have}/${target}, nothing to do`);
        continue;
      }

      for (let page = 1; page <= maxPages && have < target; page += 1) {
        const result = run<PageResult>("stock/import:importPage", {
          provider,
          category,
          kind,
          page,
          want: target - have,
        });
        have += result.imported + result.linked;
        console.log(
          `${label} p${page}: +${result.imported} new, +${result.linked} linked, ${result.skipped} had, ` +
            `${result.rejected} off-topic, ${result.failed} failed → ${have}/${target}`,
        );
        if (result.stopped) {
          console.error(`\nStopped: ${result.stopped}.\nNothing is lost. Run the same command later to carry on.`);
          return false;
        }
        if (!result.hasMore) break;
      }
      if (have < target) console.warn(`${label}: only ${have} of ${target} after ${maxPages} pages`);
    }
  }
  return true;
}

/* ── Videos ────────────────────────────────────────────────────────────── */

/*
  Every stock video ends up as three files on its own row:

  - The master: H.264 High, yuv420p, +faststart. Chrome plays H.264 everywhere;
    HEVC it plays only with hardware support, which Linux, many Windows
    machines and the render worker's headless Chrome lack. Sized to just cover
    a 1080×1920 frame (`masterSize`), because that is the largest thing we
    export. HDR (the HLG an iPhone records) is tone-mapped to SDR, or it comes
    out washed out.
  - The hover preview: 360 px on the short edge, ~800 kbps, muted, six seconds
    at most. Library grids play it instead of streaming the master.
  - The poster, cut from the master.

  A master that is already H.264, SDR, no larger than the rule allows and not
  far over the bitrate ceiling is kept as it is and only gains what it lacks.
*/

const FRAME = { width: 1080, height: 1920 };
/* CRF 20 is the target, but grainy footage (sand, water, low light) can take it
   past 20 Mbps at 1080×1920. The ceiling scales with pixel count, so a
   landscape master's middle crop gets what a portrait frame would. An H.264
   source well over it is encoded again even when it is the right size;
   one a little over is kept rather than lose a generation for a few percent. */
const MAX_BITRATE_AT_FRAME = 10e6;
const REENCODE_OVER_CEILING = 1.25;
const ceiling = (size: { width: number; height: number }) =>
  Math.round((MAX_BITRATE_AT_FRAME * size.width * size.height) / (FRAME.width * FRAME.height));
const PREVIEW = { shortEdge: 360, seconds: 6, bitrate: "800k", maxrate: "1000k", bufsize: "1600k", fps: 30 };
const PLAYABLE_PIXELS = ["yuv420p", "yuvj420p"];
const HDR_TRANSFERS = ["arib-std-b67", "smpte2084"];

type Pending = {
  id: string;
  name: string;
  storageId: string;
  codec: string | null;
  hasPoster: boolean;
  hasPreview: boolean;
  url: string | null;
};

type Stream = {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  pix_fmt?: string;
  color_transfer?: string;
  side_data_list?: { rotation?: number }[];
};

type Probe = { streams?: Stream[]; format?: { duration?: string } };

const hasTool = (tool: string) => spawnSync(tool, ["-version"], { stdio: "ignore" }).status === 0;

/* The codec, the duration and the dimensions a browser will paint, which differ
   from the coded ones when a phone recorded the video sideways. */
function probe(file: string) {
  const json = execFileSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height,pix_fmt,color_transfer:stream_side_data=rotation:format=duration", "-of", "json", file],
    { encoding: "utf8" },
  );
  const info = JSON.parse(json) as Probe;
  const video = info.streams?.find((stream) => stream.codec_type === "video");
  if (!video?.width || !video.height) throw new Error("no video stream");
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

/* Even, because yuv420p is; rounded up so the cover is never a pixel short. */
const even = (n: number) => 2 * Math.ceil(n / 2 - 1e-6);

/*
  Just big enough to fill a 1080×1920 frame at 1:1: scale by
  max(1080 / w, 1920 / h) when that is below 1, never up. Landscape keeps its
  width (3840×2160 → 3414×1920) because a 16:9 clip filling a 9:16 artboard is
  cropped to its middle, and a flat long-edge cap would make that crop soft.
*/
function masterSize(width: number, height: number) {
  const scale = Math.min(1, Math.max(FRAME.width / width, FRAME.height / height));
  return { width: even(width * scale), height: even(height * scale) };
}

const mb = (bytes: number) => `${(bytes / 1e6).toFixed(1)} MB`;

function ffmpeg(args: string[]) {
  execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: ["ignore", "ignore", "pipe"] });
}

function encodeMaster(source: string, out: string, info: ReturnType<typeof probe>, size: { width: number; height: number }) {
  const maxrate = ceiling(size);
  const filters = [];
  /* ffmpeg rotates sideways phone footage before these run, so the size is in
     painted dimensions. */
  if (size.width !== info.width || size.height !== info.height) filters.push(`scale=${size.width}:${size.height}:flags=lanczos`);
  if (info.hdr) {
    filters.push(
      "zscale=t=linear:npl=100",
      "format=gbrpf32le",
      "zscale=p=bt709",
      "tonemap=mobius:desat=0",
      "zscale=t=bt709:m=bt709:r=tv",
    );
  }
  filters.push("format=yuv420p");
  ffmpeg([
    "-i", source,
    "-map", "0:v:0", "-map", "0:a:0?",
    "-vf", filters.join(","),
    "-c:v", "libx264", "-profile:v", "high", "-preset", "medium", "-crf", "20",
    "-maxrate", String(maxrate), "-bufsize", String(maxrate * 2),
    ...(info.hdr ? ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709"] : []),
    ...(info.audio ? ["-c:a", "aac", "-b:a", "128k"] : []),
    /* Camera metadata (location among it) has no business in a stock file. */
    "-map_metadata", "-1",
    "-movflags", "+faststart",
    out,
  ]);
}

function encodePreview(master: string, out: string, info: ReturnType<typeof probe>) {
  const scale = Math.min(1, PREVIEW.shortEdge / Math.min(info.width, info.height));
  ffmpeg([
    "-t", String(PREVIEW.seconds),
    "-i", master,
    "-map", "0:v:0", "-an",
    "-vf", `scale=${even(info.width * scale)}:${even(info.height * scale)},format=yuv420p`,
    "-fpsmax", String(PREVIEW.fps),
    "-c:v", "libx264", "-profile:v", "high", "-preset", "medium",
    "-b:v", PREVIEW.bitrate, "-maxrate", PREVIEW.maxrate, "-bufsize", PREVIEW.bufsize,
    "-map_metadata", "-1",
    "-movflags", "+faststart",
    out,
  ]);
}

/* A second in, or a quarter of the way through a shorter clip: the first frame
   is often black or mid-fade. Long edge capped at 1920, which is as large as
   any artboard paints it. */
function cutPoster(master: string, out: string, duration: number | undefined) {
  const at = duration ? Math.min(1, duration / 4) : 0;
  ffmpeg([
    "-ss", String(at),
    "-i", master,
    "-frames:v", "1",
    "-vf", "scale='if(gt(iw,ih),min(1920,iw),-2)':'if(gt(iw,ih),-2,min(1920,ih))'",
    "-q:v", "3",
    out,
  ]);
}

async function download(url: string, file: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`download answered ${response.status}`);
  writeFileSync(file, Buffer.from(await response.arrayBuffer()));
}

async function upload(url: string, file: string, type: string) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": type }, body: readFileSync(file) });
  if (!response.ok) throw new Error(`upload answered ${response.status}`);
  return ((await response.json()) as { storageId: string }).storageId;
}

type Totals = { processed: number; transcoded: number; before: number; after: number; previews: number };

async function processVideo(video: Pending & { url: string }, dir: string, totals: Totals) {
  const source = join(dir, `${video.id}.source`);
  await download(video.url, source);
  const info = probe(source);
  const size = masterSize(info.width, info.height);
  const bitrate = info.duration ? (statSync(source).size * 8) / info.duration : 0;
  const transcode =
    bitrate > ceiling(size) * REENCODE_OVER_CEILING ||
    info.codec !== "h264" || !PLAYABLE_PIXELS.includes(info.pixels) || info.hdr || size.width !== info.width || size.height !== info.height;

  let master = source;
  if (transcode) {
    master = join(dir, `${video.id}.mp4`);
    encodeMaster(source, master, info, size);
  }
  const final = transcode ? probe(master) : info;
  /* A new master wants a new preview and poster; otherwise only what is missing. */
  const preview = transcode || !video.hasPreview ? join(dir, `${video.id}.preview.mp4`) : undefined;
  const poster = transcode || !video.hasPoster ? join(dir, `${video.id}.jpg`) : undefined;
  if (preview) encodePreview(master, preview, final);
  if (poster) cutPoster(master, poster, final.duration);

  /* Upload last and swap straight after, so a stop between the two leaves as
     little behind as possible. */
  const files = [transcode ? master : undefined, poster, preview];
  const count = files.filter(Boolean).length;
  const urls = count ? run<string[]>("stock/import:uploadUrls", { count }) : [];
  const [storageId, posterStorageId, previewStorageId] = await Promise.all(
    files.map((file, index) =>
      file ? upload(urls.shift()!, file, index === 1 ? "image/jpeg" : "video/mp4") : Promise.resolve(undefined),
    ),
  );
  const swapped = run<boolean>("media:replaceFiles", {
    id: video.id,
    from: video.storageId,
    storageId,
    posterStorageId,
    previewStorageId,
    codec: final.codec,
    width: final.width,
    height: final.height,
    duration: final.duration,
  });

  const before = statSync(source).size;
  const after = statSync(master).size;
  const previewBytes = preview ? statSync(preview).size : 0;
  for (const file of new Set([source, master, preview, poster])) if (file) rmSync(file, { force: true });
  if (!swapped) return "changed while it was processed; left for the next run";

  totals.processed += 1;
  if (transcode) totals.transcoded += 1;
  totals.before += before;
  totals.after += after;
  totals.previews += previewBytes;
  const from = `${info.codec} ${info.width}×${info.height} ${mb(before)}`;
  const to = transcode ? `h264 ${final.width}×${final.height} ${mb(after)}` : "kept";
  return `${from} → ${to}${preview ? `, preview ${mb(previewBytes)}` : ""}${info.hdr ? " (HDR tone-mapped)" : ""}`;
}

async function videos() {
  if (!hasTool("ffmpeg") || !hasTool("ffprobe")) {
    console.warn("Skipping videos: ffmpeg and ffprobe are not on PATH. Install them and run with --transcode.");
    return true;
  }

  const categories = option("categories")?.split(",").map((slug) => slug.trim());
  const recheck = option("recheck")?.split(",").map((id) => id.trim());
  const all = run<Pending[]>("stock/import:pendingVideos", recheck ? { ids: recheck } : categories ? { categories } : {});
  const pending = limit === undefined ? all : all.slice(0, limit);
  if (pending.length === 0) {
    console.log("videos: every one is H.264 with a preview and a poster");
    return true;
  }

  const dir = mkdtempSync(join(tmpdir(), "stock-videos-"));
  const totals: Totals = { processed: 0, transcoded: 0, before: 0, after: 0, previews: 0 };
  let failed = 0;
  try {
    for (const [index, video] of pending.entries()) {
      const progress = `video ${index + 1}/${pending.length} ${video.id} ${video.name}`;
      if (!video.url) {
        console.warn(`${progress}: file missing from storage, skipped`);
        failed += 1;
        continue;
      }
      try {
        console.log(`${progress}: ${await processVideo({ ...video, url: video.url }, dir, totals)}`);
      } catch (error) {
        /* One bad file should not cost the rest; the next run retries it. */
        failed += 1;
        const message = error instanceof Error ? (error as Error & { stderr?: Buffer }).stderr?.toString() || error.message : String(error);
        console.warn(`${progress}: ${message.trim().split("\n")[0]}`);
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  console.log(
    `videos: ${totals.processed} of ${pending.length} done (${totals.transcoded} transcoded), ` +
      `masters ${mb(totals.before)} → ${mb(totals.after)}, previews ${mb(totals.previews)}` +
      (all.length > pending.length ? `; ${all.length - pending.length} more pending` : ""),
  );
  return failed === 0;
}

/* ── Report ────────────────────────────────────────────────────────────── */

function report() {
  const counts = run<Counts>("stock/import:counts");
  console.log(`\nStock library: ${counts.total} rows (${counts.images} photos, ${counts.videos} videos)`);
  console.table(
    Object.fromEntries(
      Object.entries(counts.byCategory).map(([slug, { image, video }]) => [slug, { photos: image, videos: video }]),
    ),
  );
  console.log("by licence:", counts.byLicense);
  if (counts.videosWithoutPoster) console.log(`videos still without a poster: ${counts.videosWithoutPoster}`);
  if (counts.videosNotH264) console.log(`videos not yet H.264: ${counts.videosNotH264}`);
  if (counts.videosWithoutPreview) console.log(`videos still without a preview: ${counts.videosWithoutPreview}`);
}

const imported = videosOnly ? true : importAll();
const processed = skipVideos ? true : await videos();
report();
if (!imported) process.exit(2);
if (!processed) process.exit(1);
