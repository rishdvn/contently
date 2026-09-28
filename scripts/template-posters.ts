#!/usr/bin/env node
/*
  Render a poster per scene, and one for the whole template, into Convex.

      npm run template-posters                         # every template whose document changed
      npm run template-posters -- --id <templateId>    # some templates (comma-separated)
      npm run template-posters -- --force              # ignore the hashes
      npm run template-posters -- --out /tmp/posters   # keep a local copy of each file
      npm run template-posters -- -- --prod            # flags after the second -- go to `npx convex run`

  Same needs and same machinery as `scripts/block-previews.ts` (see
  `docs/blocks.md` → "Previews"): the app's `/render/stage` page in a headless
  Chrome, the studio's exporter, the worker's `drain`. The document comes from
  `templates:forPosters` with its media already turned into URLs, is put on the
  stage at 1:1 (`load`), and each scene is taken as a PNG `POSTER_WIDTH` wide.

  Which frame of a video scene: `posterTime` (`lib/editor/posterTime.ts`),
  shared with the studio's Save as template. Image and carousel slides are
  stills already.

  The template's own poster is its first scene's: the one the scene picker and
  the Templates page lead with.

  Re-runnable: a template whose stored document hashes to its `postersHash` is
  skipped. Editing the template (`createFromProject` with `templateId`) changes
  the hash, so the next run redraws it.
*/

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { POSTER_WIDTH, posterTime } from "../lib/editor/posterTime";

import { convex, loadDocument, openStage, parseArgs, repoRoot, still, upload } from "./lib/stage.js";

const { option, flag, passthrough } = parseArgs();
const run = convex(passthrough);
const ids = option("id")?.split(",").map((id) => id.trim()).filter(Boolean);
const out = option("out");
const force = flag("force");

type Block = { start?: number; end?: number; hidden?: boolean };
type Scene = { id: string; name: string; duration: number; blocks: Block[] };
type Doc = { kind: string; width: number; height: number; slides: Scene[] };
type Row = { id: string; name: string; postersHash: string | null; stored: Doc; document: Doc };

/* The stage page decides what a still looks like, so a change to it is a change to every poster. */
const STAGE = readFileSync(join(repoRoot, "components/render/Stage.tsx"));

const hashOf = (doc: Doc) => createHash("sha256").update(JSON.stringify({ doc, POSTER_WIDTH })).update(STAGE).digest("hex");

async function main() {
  const rows = run<Row[]>("templates:forPosters", ids ? { ids } : {});
  if (ids && rows.length < ids.length) console.warn(`${ids.length - rows.length} of the ids given are not templates`);
  const todo = rows.filter((row) => force || row.postersHash !== hashOf(row.stored));
  for (const row of rows) if (!todo.includes(row)) console.log(`${row.name}: unchanged, skipped`);
  if (!todo.length) {
    console.log(`\n0 rendered, ${rows.length} unchanged`);
    return;
  }

  if (out) mkdirSync(out, { recursive: true });
  const stage = await openStage({ width: 1080, height: 1080 });
  let rendered = 0;
  const failed: string[] = [];
  try {
    for (const row of todo) {
      const started = Date.now();
      try {
        const doc = row.document;
        await stage.page.setViewportSize({ width: Math.min(2400, doc.width), height: Math.min(2400, doc.height) });
        await loadDocument(stage.page, doc);
        const scale = POSTER_WIDTH / doc.width;

        const storageIds: string[] = [];
        for (const [index, scene] of doc.slides.entries()) {
          const time = doc.kind === "video" ? posterTime(scene) : 0;
          const bytes = await still(stage.page, index, time, scale);
          if (out) writeFileSync(join(out, `${row.id}-${String(index + 1).padStart(2, "0")}.png`), bytes);
          storageIds.push(await upload(run<string>("templates:uploadUrl"), bytes, "image/png"));
        }
        run("templates:setPosters", { id: row.id, scenePosters: storageIds, poster: storageIds[0], postersHash: hashOf(row.stored) });
        console.log(`${row.name}: ${storageIds.length} scene poster(s) in ${((Date.now() - started) / 1000).toFixed(1)}s`);
        rendered++;
      } catch (error) {
        console.error(`${row.name} (${row.id}): failed — ${error instanceof Error ? error.message : error}`);
        failed.push(row.id);
      }
    }
  } finally {
    await stage.close();
  }

  console.log(`\n${rendered} rendered, ${rows.length - todo.length} unchanged${failed.length ? `, ${failed.length} failed (${failed.join(", ")})` : ""}`);
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
