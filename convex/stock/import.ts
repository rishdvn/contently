import { v } from "convex/values";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { dupe } from "./dupe";
import { STOCK_CATEGORIES, sourceRefOf, stockCategory, StockProviderError, type StockProvider } from "./provider";

/*
  The one-off stock import: provider files into Convex storage, one `media` row
  each with `source: "stock"`. Run from the CLI, never on a schedule and never
  on a request:

      node scripts/import-stock.ts                       # the trial set, then videos
      node scripts/import-stock.ts --categories cafe,gym --photos 10 --videos 3

  The script is the loop and these functions are its steps, each run through
  `npx convex run`. That keeps the requests to the provider strictly one after
  another, lets a person watch it happen, and means a stop — the provider
  answering 429, a laptop closing — costs at most the page in flight.

  Resumable and idempotent on `sourceRef`: every candidate is looked up before
  anything is downloaded, so a re-run only fetches what is missing. An asset a
  second category also surfaces gains that category rather than a second row.

  Video processing is the script's job, not this file's. The Convex runtime
  cannot decode video, so a video is stored as the provider made it and the
  script then downloads it, transcodes it to an H.264 master sized for a
  1080×1920 frame, cuts a hover preview and a poster, uploads all three and
  swaps them onto the same row (`pendingVideos` → `uploadUrls` →
  `media:replaceFiles`). Rows the script has finished carry `codec: "h264"`, a
  preview and a poster; anything else is still pending.

  Photos go the same way (`pendingPhotos`): a camera original larger than a
  1080×1920 frame needs is scaled down by the script and swapped onto its row.
  A finished photo is simply one whose size no longer exceeds the frame.
*/

const PROVIDERS: Record<string, StockProvider> = { dupe };

const KIND = v.union(v.literal("image"), v.literal("video"));

/* Nothing on Dupe comes near this (the largest videos seen are ~55 MB of 4K),
   but an action holds the whole file in memory before storing it, so a file
   that would not fit is skipped rather than allowed to take the action down. */
const MAX_BYTES = 200 * 1024 * 1024;

function providerOf(id: string | undefined) {
  const provider = PROVIDERS[id ?? "dupe"];
  if (!provider) throw new Error(`No stock provider "${id}". Known: ${Object.keys(PROVIDERS).join(", ")}`);
  return provider;
}

function categoryOf(slug: string) {
  const category = stockCategory(slug);
  if (!category) {
    throw new Error(`No stock category "${slug}". Known: ${STOCK_CATEGORIES.map((entry) => entry.slug).join(", ")}`);
  }
  return category;
}

/* ── Reads ─────────────────────────────────────────────────────────────── */

export const bySourceRef = internalQuery({
  args: { sourceRef: v.string() },
  handler: async (ctx, { sourceRef }) => {
    const row = await ctx.db
      .query("media")
      .withIndex("by_sourceRef", (q) => q.eq("sourceRef", sourceRef))
      .first();
    if (!row) return null;
    return { id: row._id, categories: row.categories ?? [], labels: row.tags, aesthetics: row.aesthetics ?? [] };
  },
});

/*
  What the library holds, per category and kind — the script's starting point
  on every run, and its report at the end. A scan of the stock rows, which the
  trial keeps under a thousand.
*/
export const counts = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("media")
      .withIndex("by_source_kind", (q) => q.eq("source", "stock"))
      .collect();

    const byCategory: Record<string, { image: number; video: number }> = {};
    for (const { slug } of STOCK_CATEGORIES) byCategory[slug] = { image: 0, video: 0 };
    const byLicense: Record<string, number> = {};
    let videosWithoutPoster = 0;
    let videosNotH264 = 0;
    let videosWithoutPreview = 0;
    let photosOverFrame = 0;

    for (const row of rows) {
      for (const slug of row.categories ?? []) {
        byCategory[slug] ??= { image: 0, video: 0 };
        byCategory[slug][row.kind] += 1;
      }
      const license = row.license ?? "(none)";
      byLicense[license] = (byLicense[license] ?? 0) + 1;
      if (row.kind === "video" && !row.posterStorageId) videosWithoutPoster += 1;
      if (row.kind === "video" && row.codec !== "h264") videosNotH264 += 1;
      if (row.kind === "video" && !row.previewStorageId) videosWithoutPreview += 1;
      if (row.kind === "image" && overFrame(row)) photosOverFrame += 1;
    }

    return {
      total: rows.length,
      images: rows.filter((row) => row.kind === "image").length,
      videos: rows.filter((row) => row.kind === "video").length,
      videosWithoutPoster,
      videosNotH264,
      videosWithoutPreview,
      photosOverFrame,
      byCategory,
      byLicense,
    };
  },
});

/* ── Writes ────────────────────────────────────────────────────────────── */

export const insertStock = internalMutation({
  args: {
    sourceRef: v.string(),
    kind: KIND,
    storageId: v.id("_storage"),
    width: v.number(),
    height: v.number(),
    name: v.string(),
    tags: v.array(v.string()),
    aesthetics: v.array(v.string()),
    categories: v.array(v.string()),
    credit: v.object({ name: v.optional(v.string()), handle: v.optional(v.string()), url: v.optional(v.string()) }),
    sourceUrl: v.optional(v.string()),
    license: v.string(),
  },
  handler: async (ctx, row) => {
    const existing = await ctx.db
      .query("media")
      .withIndex("by_sourceRef", (q) => q.eq("sourceRef", row.sourceRef))
      .first();

    /* Two runs raced to the same asset. Keep the first row, and do not leave
       the second file billed and unreferenced. */
    if (existing) {
      await ctx.storage.delete(row.storageId);
      const categories = [...new Set([...(existing.categories ?? []), ...row.categories])];
      await ctx.db.patch(existing._id, { categories });
      return existing._id;
    }
    return await ctx.db.insert("media", { ...row, source: "stock" });
  },
});

export const addCategory = internalMutation({
  args: { id: v.id("media"), category: v.string() },
  handler: async (ctx, { id, category }) => {
    const row = await ctx.db.get(id);
    if (!row) return;
    const categories = row.categories ?? [];
    if (!categories.includes(category)) await ctx.db.patch(id, { categories: [...categories, category] });
  },
});

/*
  Credit links for rows imported before the import stored them: the author's
  page (`credit.url`) and the asset's (`sourceUrl`). Built from what each row
  already holds, its `sourceRef` and the handle the provider gave, so the
  provider is not asked again. Idempotent; the script calls it until `cursor`
  comes back null (`node scripts/import-stock.ts --credit-links`).
*/
export const backfillCreditLinks = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())), batch: v.optional(v.number()) },
  handler: async (ctx, { cursor = null, batch = 200 }) => {
    const page = await ctx.db
      .query("media")
      .withIndex("by_source_kind", (q) => q.eq("source", "stock"))
      .paginate({ cursor, numItems: batch });
    let updated = 0;
    for (const row of page.page) {
      const [providerId, ...rest] = (row.sourceRef ?? "").split(":");
      const provider = PROVIDERS[providerId];
      const externalId = rest.join(":");
      if (!provider || !externalId) continue;
      const pages = provider.links(externalId, row.credit?.handle);
      if (row.sourceUrl === pages.asset && row.credit?.url === pages.author) continue;
      await ctx.db.patch(row._id, { sourceUrl: pages.asset, credit: { ...row.credit, url: pages.author } });
      updated += 1;
    }
    return { scanned: page.page.length, updated, cursor: page.isDone ? null : page.continueCursor };
  },
});

/* ── The import step ───────────────────────────────────────────────────── */

const pageResult = v.object({
  /* New rows, with a file stored. */
  imported: v.number(),
  /* Rows another category had already imported, now in this one too. */
  linked: v.number(),
  /* Already in this category. */
  skipped: v.number(),
  /* Surfaced by the search but not about this category. */
  rejected: v.number(),
  /* Gone upstream, too large, or a download that failed. */
  failed: v.number(),
  hasMore: v.boolean(),
  /* Set when the provider asked us to stop (429/5xx). Nothing is retried: the
     script reports it and exits, and a later run carries on from here. */
  stopped: v.optional(v.string()),
});

/*
  One search page for one category and kind: look up, curate, download, store,
  write. Stops early once `want` assets have joined the category, so the last
  page of a category does not download files nobody asked for.
*/
export const importPage = internalAction({
  args: {
    provider: v.optional(v.string()),
    category: v.string(),
    kind: KIND,
    page: v.number(),
    want: v.number(),
  },
  returns: pageResult,
  handler: async (ctx, args) => {
    const provider = providerOf(args.provider);
    const category = categoryOf(args.category);
    const result = { imported: 0, linked: 0, skipped: 0, rejected: 0, failed: 0, hasMore: false };

    try {
      const page = await provider.search(category, args.kind, args.page);
      result.hasMore = page.hasMore;

      for (const candidate of page.items) {
        if (result.imported + result.linked >= args.want) break;
        /* Search honours the kind filter, but the file layout depends on it. */
        if (candidate.kind !== args.kind) continue;

        const sourceRef = sourceRefOf(provider, candidate.externalId);
        const existing = await ctx.runQuery(internal.stock.import.bySourceRef, { sourceRef });
        if (existing) {
          if (existing.categories.includes(category.slug)) {
            result.skipped += 1;
          } else if (provider.belongsTo(existing, category)) {
            await ctx.runMutation(internal.stock.import.addCategory, { id: existing.id, category: category.slug });
            result.linked += 1;
          } else {
            result.rejected += 1;
          }
          continue;
        }

        let asset, storageId;
        try {
          asset = await provider.fetchAsset(candidate.externalId);
          if (!asset) {
            result.failed += 1;
            continue;
          }
          if (!provider.belongsTo(asset, category)) {
            result.rejected += 1;
            continue;
          }

          const response = await provider.download(asset);
          const length = Number(response.headers.get("content-length"));
          if (length > MAX_BYTES) {
            await response.body?.cancel();
            console.warn(`${sourceRef}: ${Math.round(length / 1e6)} MB is over the limit; skipped`);
            result.failed += 1;
            continue;
          }
          const blob = await response.blob();
          /* The type is what storage serves the file as; the CDN names it, but
             not every CDN does. */
          storageId = await ctx.storage.store(blob.type ? blob : new Blob([blob], { type: asset.mimeType }));
        } catch (error) {
          /* A stop is for the whole run; anything else is this one asset. */
          if (error instanceof StockProviderError && error.shouldStop) throw error;
          console.warn(`${sourceRef}: ${error instanceof Error ? error.message : error}; skipped`);
          result.failed += 1;
          continue;
        }

        const noun = asset.kind === "video" ? "video" : "photo";
        await ctx.runMutation(internal.stock.import.insertStock, {
          sourceRef,
          kind: asset.kind,
          storageId,
          width: asset.width,
          height: asset.height,
          name: asset.credit.name ? `${category.name} ${noun} by ${asset.credit.name}` : `${category.name} ${noun}`,
          tags: asset.labels,
          aesthetics: asset.aesthetics,
          categories: [category.slug],
          credit: asset.credit,
          sourceUrl: asset.sourceUrl,
          license: provider.license,
        });
        result.imported += 1;
      }
    } catch (error) {
      if (!(error instanceof StockProviderError) || !error.shouldStop) throw error;
      console.warn(`Stock import stopped: ${error.message}`);
      return { ...result, stopped: error.message };
    }

    console.info(
      `${provider.id} ${category.slug} ${args.kind} p${args.page}: ` +
        `+${result.imported} new, +${result.linked} linked, ${result.skipped} had, ${result.rejected} off-topic, ${result.failed} failed`,
    );
    return result;
  },
});

/* ── Video processing ──────────────────────────────────────────────────── */

/*
  Stock videos the script has not finished — not yet H.264 (or never probed),
  or missing a preview or a poster — with a URL to download the master from.
  `storageId` goes back to `media:replaceFiles` as `from`, so a row another run
  has already swapped is left alone. `categories` narrows it for a trial run;
  `ids` asks for those rows whatever their state, so a finished row can be
  decided again after the rules change.
*/
export const pendingVideos = internalQuery({
  args: { categories: v.optional(v.array(v.string())), ids: v.optional(v.array(v.id("media"))) },
  handler: async (ctx, { categories, ids }) => {
    const videos = await ctx.db
      .query("media")
      .withIndex("by_source_kind", (q) => q.eq("source", "stock").eq("kind", "video"))
      .collect();
    const pending = videos.filter((row) =>
      ids
        ? ids.includes(row._id)
        : (!categories || categories.some((slug) => row.categories?.includes(slug))) &&
          (row.codec !== "h264" || !row.previewStorageId || !row.posterStorageId),
    );
    return await Promise.all(
      pending.map(async (row) => ({
        id: row._id,
        name: row.name,
        storageId: row.storageId,
        codec: row.codec ?? null,
        hasPoster: Boolean(row.posterStorageId),
        hasPreview: Boolean(row.previewStorageId),
        url: await ctx.storage.getUrl(row.storageId),
      })),
    );
  },
});

/* ── Photo masters ─────────────────────────────────────────────────────── */

/*
  The largest frame we export. A stock photo is scaled down until it just
  covers it, like a stock video master, so one that covers it with room to
  spare in both directions is still a camera original waiting for the script.
*/
const FRAME = { width: 1080, height: 1920 };
const overFrame = (row: { width: number; height: number }) => row.width > FRAME.width && row.height > FRAME.height;

/*
  Stock photos still larger than the frame needs, with a URL to download each
  from. As with `pendingVideos`, `storageId` goes back to `media:replaceFiles`
  as `from`, `categories` narrows it for a trial and `ids` asks for rows
  whatever their state.
*/
export const pendingPhotos = internalQuery({
  args: { categories: v.optional(v.array(v.string())), ids: v.optional(v.array(v.id("media"))) },
  handler: async (ctx, { categories, ids }) => {
    const photos = await ctx.db
      .query("media")
      .withIndex("by_source_kind", (q) => q.eq("source", "stock").eq("kind", "image"))
      .collect();
    const pending = photos.filter((row) =>
      ids ? ids.includes(row._id) : (!categories || categories.some((slug) => row.categories?.includes(slug))) && overFrame(row),
    );
    return await Promise.all(
      pending.map(async (row) => ({
        id: row._id,
        name: row.name,
        storageId: row.storageId,
        width: row.width,
        height: row.height,
        url: await ctx.storage.getUrl(row.storageId),
      })),
    );
  },
});

/*
  What the stock library's files take in storage, for the script to report
  before and after a pass. `categories` narrows it the same way the passes do.
*/
export const storage = internalQuery({
  args: { categories: v.optional(v.array(v.string())) },
  handler: async (ctx, { categories }) => {
    const rows = await ctx.db
      .query("media")
      .withIndex("by_source_kind", (q) => q.eq("source", "stock"))
      .collect();
    const totals = {
      photos: { files: 0, bytes: 0 },
      videos: { files: 0, bytes: 0 },
      posters: { files: 0, bytes: 0 },
      previews: { files: 0, bytes: 0 },
    };
    const add = async (bucket: { files: number; bytes: number }, id: Id<"_storage"> | undefined) => {
      const file = id ? await ctx.db.system.get(id) : null;
      if (!file) return;
      bucket.files += 1;
      bucket.bytes += file.size;
    };
    await Promise.all(
      rows
        .filter((row) => !categories || categories.some((slug) => row.categories?.includes(slug)))
        .flatMap((row) => [
          add(row.kind === "image" ? totals.photos : totals.videos, row.storageId),
          add(totals.posters, row.posterStorageId),
          add(totals.previews, row.previewStorageId),
        ]),
    );
    return totals;
  },
});

/* Upload URLs for one asset's new files, minted together to save the script a
   round trip per file. */
export const uploadUrls = internalMutation({
  args: { count: v.number() },
  handler: async (ctx, { count }) =>
    await Promise.all(Array.from({ length: Math.min(Math.max(count, 1), 5) }, () => ctx.storage.generateUploadUrl())),
});

/* ── Purge ─────────────────────────────────────────────────────────────── */

/*
  Every row under one licence, and its files, in batches small enough for one
  transaction. Call until `remaining` is false:

      npx convex run stock/import:purge '{"license":"dupe-internal-trial"}'

  This is the "before any external release" switch the trial licence asks for.
*/
export const purge = internalMutation({
  args: { license: v.string(), batch: v.optional(v.number()) },
  handler: async (ctx, { license, batch = 100 }) => {
    const rows = await ctx.db
      .query("media")
      .withIndex("by_license", (q) => q.eq("license", license))
      .take(batch + 1);
    for (const row of rows.slice(0, batch)) {
      await ctx.storage.delete(row.storageId);
      if (row.posterStorageId) await ctx.storage.delete(row.posterStorageId);
      if (row.previewStorageId) await ctx.storage.delete(row.previewStorageId);
      await ctx.db.delete(row._id);
    }
    return { deleted: Math.min(rows.length, batch), remaining: rows.length > batch };
  },
});
