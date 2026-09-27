#!/usr/bin/env node
/*
  Import the stock library into Convex, then give every video a poster.

      node scripts/import-stock.ts                                # the trial set
      node scripts/import-stock.ts --categories cafe,gym --photos 10 --videos 3
      node scripts/import-stock.ts --posters-only
      node scripts/import-stock.ts -- --prod                      # flags after -- go to `npx convex run`

  Which deployment it writes to is whatever `npx convex run` would pick: the
  dev deployment from CONVEX_DEPLOYMENT, or CONVEX_DEPLOY_KEY if set.

  The functions it calls are in `convex/stock/import.ts`; this file is only the
  loop. It is safe to stop at any point and safe to re-run: every step checks
  what is already there, so a second run of the same command imports nothing and
  says so. If the provider answers 429 or 5xx the run stops, prints how far it
  got, and exits non-zero — run it again later and it carries on.

  Posters need ffmpeg and ffprobe on PATH (`.conductor/setup.sh` installs them
  into ~/.local/bin). They read each video straight from its Convex URL, so the
  provider is not contacted again.
*/

import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

type Kind = "image" | "video";

type Counts = {
  total: number;
  images: number;
  videos: number;
  videosWithoutPoster: number;
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
const postersOnly = flag("posters-only");
const skipPosters = flag("skip-posters");

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

/* ── Posters ───────────────────────────────────────────────────────────── */

type Probe = {
  streams?: { width?: number; height?: number; side_data_list?: { rotation?: number }[] }[];
  format?: { duration?: string };
};

const hasTool = (tool: string) => spawnSync(tool, ["-version"], { stdio: "ignore" }).status === 0;

/* Duration and the dimensions a browser will paint, which differ from the
   stored ones when a phone recorded the video sideways. */
function probe(url: string) {
  const json = execFileSync(
    "ffprobe",
    ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:stream_side_data=rotation:format=duration", "-of", "json", url],
    { encoding: "utf8" },
  );
  const info = JSON.parse(json) as Probe;
  const stream = info.streams?.[0];
  const rotation = Math.abs(stream?.side_data_list?.find((entry) => entry.rotation !== undefined)?.rotation ?? 0);
  const sideways = rotation === 90 || rotation === 270;
  const duration = Number(info.format?.duration);
  return {
    duration: Number.isFinite(duration) && duration > 0 ? Math.round(duration * 1000) / 1000 : undefined,
    width: sideways ? stream?.height : stream?.width,
    height: sideways ? stream?.width : stream?.height,
  };
}

async function posters() {
  if (!hasTool("ffmpeg") || !hasTool("ffprobe")) {
    console.warn("Skipping posters: ffmpeg and ffprobe are not on PATH. Install them and run with --posters-only.");
    return;
  }

  const pending = run<{ id: string; name: string; url: string | null }[]>("stock/import:pendingPosters");
  if (pending.length === 0) {
    console.log("posters: every video has one");
    return;
  }

  const dir = mkdtempSync(join(tmpdir(), "stock-posters-"));
  let made = 0;
  try {
    for (const [index, video] of pending.entries()) {
      const progress = `poster ${index + 1}/${pending.length} ${video.name}`;
      if (!video.url) {
        console.warn(`${progress}: file missing from storage, skipped`);
        continue;
      }
      try {
        const { duration, width, height } = probe(video.url);
        const file = join(dir, `${video.id}.jpg`);
        /* A second in, or a quarter of the way through a shorter clip: the
           first frame is often black or mid-fade. Long edge capped at 1920,
           which is as large as any artboard paints it. */
        const at = duration ? Math.min(1, duration / 4) : 0;
        execFileSync("ffmpeg", [
          "-v", "error", "-y",
          "-ss", String(at),
          "-i", video.url,
          "-frames:v", "1",
          "-vf", "scale='if(gt(iw,ih),min(1920,iw),-2)':'if(gt(iw,ih),-2,min(1920,ih))'",
          "-q:v", "3",
          file,
        ]);

        const uploadUrl = run<string>("stock/import:posterUploadUrl");
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": "image/jpeg" },
          body: readFileSync(file),
        });
        if (!response.ok) throw new Error(`upload answered ${response.status}`);
        const { storageId } = (await response.json()) as { storageId: string };

        run("stock/import:setPoster", { id: video.id, posterStorageId: storageId, duration, width, height });
        made += 1;
        console.log(`${progress}: ${duration ?? "?"}s, ${width}×${height}`);
      } catch (error) {
        /* One bad file should not cost the rest; the next run retries it. */
        console.warn(`${progress}: ${error instanceof Error ? error.message.split("\n")[0] : error}`);
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  console.log(`posters: ${made} of ${pending.length} made`);
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
}

const finished = postersOnly ? true : importAll();
if (!skipPosters) await posters();
report();
if (!finished) process.exit(2);
