import { v } from "convex/values";

import { internalMutation, internalQuery, query } from "./_generated/server";
import { tryUser } from "./lib/auth";

/*
  Pictures of the block catalog, for the Blocks panel.

  A block is code: its definition lives in `lib/blocks/<id>/` and ships in the
  app bundle. What it looks like playing, and as a still, cannot be computed
  cheaply in a panel full of tiles, so `scripts/block-previews.ts` renders both
  once — through the studio's own exporter, in a headless Chrome — and stores
  them here. The panel reads `assets`; everything else is the script's.

  Shared by every organisation, like stock: there is one catalog.
*/

/* Every block that has been rendered, with URLs. Keyed by block id on the
   client (`useBlockPreview`); a block with no row just has no preview yet. */
export const assets = query({
  args: {},
  handler: async (ctx) => {
    if (!(await tryUser(ctx))) return [];
    const rows = await ctx.db.query("blockAssets").collect();
    return await Promise.all(
      rows.map(async (row) => ({
        blockId: row.blockId,
        preview: await ctx.storage.getUrl(row.previewStorageId),
        poster: await ctx.storage.getUrl(row.posterStorageId),
        width: row.width,
        height: row.height,
        duration: row.duration,
        updatedAt: row.updatedAt,
      })),
    );
  },
});

/* ── The script's steps, run through `npx convex run` ─────────────────── */

/* What is already rendered, so a re-run can skip it: block id → hash. */
export const hashes = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("blockAssets").collect();
    return Object.fromEntries(rows.map((row) => [row.blockId, row.hash]));
  },
});

export const uploadUrl = internalMutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

/*
  Record a block's fresh preview and poster. The files they replace are
  deleted: nothing else points at them, and a catalog re-rendered a few dozen
  times would otherwise leave hundreds of orphaned videos in storage.
*/
export const save = internalMutation({
  args: {
    blockId: v.string(),
    hash: v.string(),
    previewStorageId: v.id("_storage"),
    posterStorageId: v.id("_storage"),
    width: v.number(),
    height: v.number(),
    duration: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("blockAssets")
      .withIndex("by_blockId", (q) => q.eq("blockId", args.blockId))
      .unique();
    const row = { ...args, updatedAt: Date.now() };
    if (!existing) return await ctx.db.insert("blockAssets", row);

    for (const old of [existing.previewStorageId, existing.posterStorageId]) {
      if (old !== args.previewStorageId && old !== args.posterStorageId) await ctx.storage.delete(old);
    }
    await ctx.db.replace(existing._id, row);
    return existing._id;
  },
});

/* A block that left the catalog takes its pictures with it (`--prune`). */
export const remove = internalMutation({
  args: { blockId: v.string() },
  handler: async (ctx, { blockId }) => {
    const existing = await ctx.db
      .query("blockAssets")
      .withIndex("by_blockId", (q) => q.eq("blockId", blockId))
      .unique();
    if (!existing) return false;
    await ctx.storage.delete(existing.previewStorageId);
    await ctx.storage.delete(existing.posterStorageId);
    await ctx.db.delete(existing._id);
    return true;
  },
});
