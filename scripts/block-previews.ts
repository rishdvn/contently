#!/usr/bin/env node
/*
  Render every registered block's picker preview and poster into Convex.

      npm run block-previews                          # every block that changed
      npm run block-previews -- --only imessage       # one block (comma-separate for more)
      npm run block-previews -- --force               # ignore the hashes, render everything
      npm run block-previews -- --prune               # also drop rows for blocks no longer registered
      npm run block-previews -- --out /tmp/previews   # keep a local copy of each file
      npm run block-previews -- -- --prod             # flags after the second -- go to `npx convex run`

  Needs, once: `npm --prefix workers/render install` (the script runs on the
  render worker's Playwright), a running app (`APP_URL`, default
  `http://localhost:$CONDUCTOR_PORT` or 3000), and a Google Chrome (`CHROME_PATH`
  if it is not in a usual place). How it fits with the rest is in
  `docs/blocks.md` → "Previews".

  For each block, the app's `/render/stage` page lays it out as
  `BLOCK_PREVIEW` says, then the studio's own exporter takes a PNG in static
  mode (the poster) and an MP4 in video mode (the preview). Both are uploaded
  to Convex storage and recorded in `blockAssets`, which the Blocks panel reads.

  Re-runnable: a block whose hash matches its row is skipped. The hash covers
  the block's source folder, the shared input and media code, the stage page and
  the definition's data (which includes `BLOCK_PREVIEW`). A change anywhere else
  that alters how blocks paint — `BlockView`, the exporter — needs `--force`.
*/

import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import { convex, loadBlock, mp4, openStage, parseArgs, png, repoRoot, upload } from "./lib/stage.js";

const { option, flag, passthrough } = parseArgs();
const run = convex(passthrough);
const only = option("only")?.split(",").map((id) => id.trim()).filter(Boolean);
const out = option("out");
const force = flag("force");
const prune = flag("prune");

/* ── Hashing ───────────────────────────────────────────────────────────── */

const BLOCKS_DIR = join(repoRoot, "lib", "blocks");

/* Read by every block's render: a change to any of them can change every preview. */
const SHARED = ["lib/blocks/inputs.ts", "lib/blocks/media.tsx", "components/render/Stage.tsx"];

function walk(dir: string): string[] {
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? walk(path) : /\.(tsx?|css|json|svg|png|jpe?g|webp|woff2?)$/.test(name) ? [path] : [];
    });
}

/*
  Where each block's code lives: the folder of the file that registers it
  (`registerBlock({ id: "…"`). Blocks follow `lib/blocks/<id>/` or
  `lib/blocks/text/<id>/`, but reading the registration rather than assuming
  the folder name means a block filed somewhere else still hashes correctly.
*/
function sourceFolders(): Map<string, string> {
  const folders = new Map<string, string>();
  for (const file of walk(BLOCKS_DIR)) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/registerBlock\s*(?:<[^>]*>)?\s*\(\s*\{[\s\S]*?\bid\s*:\s*["'`]([^"'`]+)["'`]/g)) {
      folders.set(match[1]!, dirname(file));
    }
  }
  return folders;
}

function hashOf(fingerprint: string, folder: string | undefined): string {
  const hash = createHash("sha256");
  hash.update(fingerprint);
  /* A block registered straight from `lib/blocks/` would otherwise hash the whole catalog. */
  const files = folder && folder !== BLOCKS_DIR ? walk(folder) : [];
  for (const path of [...files, ...SHARED.map((p) => join(repoRoot, p))]) {
    hash.update(`\0${relative(repoRoot, path)}\0`);
    hash.update(readFileSync(path));
  }
  return hash.digest("hex");
}

/* ── Run ───────────────────────────────────────────────────────────────── */

async function main() {
  const folders = sourceFolders();
  const existing = run<Record<string, string>>("blocks:hashes");

  const stage = await openStage({ width: 1080, height: 1080 });
  const { blocks, spec } = stage.info;
  const size = Math.round(spec.artboard * spec.scale);
  await stage.page.setViewportSize({ width: spec.artboard, height: spec.artboard });

  const unknown = only?.filter((id) => !blocks.some((b) => b.id === id)) ?? [];
  if (unknown.length) throw new Error(`Not registered: ${unknown.join(", ")}. Registered: ${blocks.map((b) => b.id).join(", ")}`);
  const wanted = only ? blocks.filter((b) => only.includes(b.id)) : blocks;
  if (out) mkdirSync(out, { recursive: true });

  let rendered = 0;
  let skipped = 0;
  const failed: string[] = [];
  try {
    for (const block of wanted) {
      const folder = folders.get(block.id);
      if (!folder) console.warn(`${block.id}: could not find where it is registered; hashing its definition only`);
      const hash = hashOf(block.fingerprint, folder);
      if (!force && existing[block.id] === hash) {
        console.log(`${block.id}: unchanged, skipped`);
        skipped++;
        continue;
      }

      const started = Date.now();
      try {
        await loadBlock(stage.page, block.id, "static");
        const poster = await png(stage.page, 0, spec.scale);
        await loadBlock(stage.page, block.id, "video");
        const preview = await mp4(stage.page, { fps: spec.fps, scale: spec.scale });

        if (out) {
          writeFileSync(join(out, `${block.id}.png`), poster);
          writeFileSync(join(out, `${block.id}.mp4`), preview);
        }

        const posterStorageId = await upload(run<string>("blocks:uploadUrl"), poster, "image/png");
        const previewStorageId = await upload(run<string>("blocks:uploadUrl"), preview, "video/mp4");
        run("blocks:save", { blockId: block.id, hash, previewStorageId, posterStorageId, width: size, height: size, duration: spec.duration });

        const kb = (n: number) => `${Math.round(n / 1024)} KB`;
        console.log(`${block.id}: poster ${kb(poster.length)}, preview ${kb(preview.length)} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
        rendered++;
      } catch (error) {
        /* One broken block should not cost the rest of the catalog its previews. */
        console.error(`${block.id}: failed — ${error instanceof Error ? error.message : error}`);
        failed.push(block.id);
      }
    }
  } finally {
    await stage.close();
  }

  if (prune) {
    for (const id of Object.keys(existing)) {
      if (blocks.some((b) => b.id === id)) continue;
      run("blocks:remove", { blockId: id });
      console.log(`${id}: no longer registered, removed`);
    }
  }

  console.log(`\n${rendered} rendered, ${skipped} unchanged${failed.length ? `, ${failed.length} failed (${failed.join(", ")})` : ""}`);
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
