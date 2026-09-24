import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { requireOrg, requireUser, tryOrg, tryUser } from "./lib/auth";

/*
  The organisation's media library: files in Convex storage with one `media` row
  each. A document never stores a file URL as the truth — it stores the `media`
  id and resolves it through `resolve` below — so a project reloaded tomorrow
  still has its media, which `blob:` URLs could never promise.

  Storage ids are not URLs. `ctx.storage.getUrl` mints one per call, and it is
  the only way a browser can fetch the bytes, so every read path here returns
  rows with their URLs already attached rather than making the client ask twice.
*/

const mediaKind = v.union(v.literal("image"), v.literal("video"));

/* What the client sees. `url` is null when the file is gone from storage but the
   row survived — a broken row rather than an unresolved one, which is the
   difference between showing a placeholder and waiting. */
export type MediaItem = {
  id: string;
  kind: "image" | "video";
  name: string;
  width: number;
  height: number;
  duration?: number;
  url: string | null;
  posterUrl: string | null;
  tags: string[];
  source: "upload" | "stock";
  createdAt: number;
};

async function withUrls(ctx: QueryCtx, row: Doc<"media">): Promise<MediaItem> {
  const [url, posterUrl] = await Promise.all([
    ctx.storage.getUrl(row.storageId),
    row.posterStorageId ? ctx.storage.getUrl(row.posterStorageId) : null,
  ]);
  return {
    id: row._id,
    kind: row.kind,
    name: row.name,
    width: row.width,
    height: row.height,
    duration: row.duration,
    url,
    posterUrl,
    tags: row.tags,
    source: row.source,
    createdAt: row._creationTime,
  };
}

/* ------------------------------------------------------------- upload --- */

/*
  Step one of an upload: a short-lived URL the browser POSTs the file to, which
  answers with a storage id. The bytes never pass through a Convex function, so
  a 200 MB video costs us nothing but this mutation.

  Org membership is checked here even though the URL itself is not org-scoped:
  it is the only gate before storage, and an upload that cannot become a `media`
  row is just litter.
*/
export const generateUploadUrl = mutation({
  args: { orgId: v.string() },
  handler: async (ctx, { orgId }) => {
    await requireOrg(ctx, orgId);
    return await ctx.storage.generateUploadUrl();
  },
});

/*
  Step two: the row. Dimensions, duration and the poster come from the client,
  which has just decoded the file in an <img>/<video> — a Convex function cannot
  decode media, and asking the render worker to would put a queue between
  picking a file and seeing it in the panel.
*/
export const create = mutation({
  args: {
    orgId: v.string(),
    kind: mediaKind,
    storageId: v.id("_storage"),
    width: v.number(),
    height: v.number(),
    duration: v.optional(v.number()),
    posterStorageId: v.optional(v.id("_storage")),
    name: v.string(),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { orgId, tags, ...fields }) => {
    const { org, user } = await requireOrg(ctx, orgId);
    const id = await ctx.db.insert("media", {
      ...fields,
      orgId: org._id,
      tags: tags ?? [],
      source: "upload",
      createdBy: user._id,
    });
    const row = await ctx.db.get(id);
    return await withUrls(ctx, row!);
  },
});

/* -------------------------------------------------------------- reads --- */

/*
  The org's own uploads, newest first. Stock rows carry no `orgId` and are a
  separate library ("Our media"), so they are not listed here.

  Reads use `tryOrg`: the panel renders while Clerk is still switching orgs, and
  an empty grid for a moment beats an error boundary.
*/
export const list = query({
  args: { orgId: v.string(), kind: v.optional(mediaKind) },
  handler: async (ctx, { orgId, kind }) => {
    const context = await tryOrg(ctx, orgId);
    if (!context) return [];

    const rows = await (kind
      ? ctx.db.query("media").withIndex("by_org_kind", (q) => q.eq("orgId", context.org._id).eq("kind", kind))
      : ctx.db.query("media").withIndex("by_org", (q) => q.eq("orgId", context.org._id))
    )
      .order("desc")
      .collect();

    return await Promise.all(rows.map((row) => withUrls(ctx, row)));
  },
});

/*
  The batched resolver behind `useMediaUrl`: one subscription per page resolves
  every id the rendered documents mention. Per-id queries would mean a
  subscription per block, and a carousel of stock photos is a lot of blocks.

  Ids arrive as plain strings because `lib/editor/types.ts` knows nothing about
  Convex; anything that is not a live id this caller may see comes back with
  `url: null` so the canvas can draw its "media not available" state instead of
  waiting forever for an answer that will not come.
*/
export const resolve = query({
  args: { ids: v.array(v.string()) },
  handler: async (ctx, { ids }): Promise<MediaItem[]> => {
    const user = await tryUser(ctx);
    if (!user) return [];

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const orgIds = new Set(memberships.map((m) => m.orgId));

    const missing = (id: string): MediaItem => ({
      id,
      kind: "image",
      name: "",
      width: 0,
      height: 0,
      url: null,
      posterUrl: null,
      tags: [],
      source: "upload",
      createdAt: 0,
    });

    return await Promise.all(
      [...new Set(ids)].map(async (raw) => {
        const id = ctx.db.normalizeId("media", raw);
        if (!id) return missing(raw);
        const row = await ctx.db.get(id);
        /* Stock (no `orgId`) is readable by every member of every org. */
        if (!row || (row.orgId && !orgIds.has(row.orgId))) return missing(raw);
        return await withUrls(ctx, row);
      }),
    );
  },
});

/*
  One storage id to a URL, for callers holding a storage id rather than a `media`
  id — project and template posters. Signed in is the only check there can be:
  a storage id is not owned by anything, and the URL it mints is as public as
  the id itself.
*/
export const getUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    await requireUser(ctx);
    return await ctx.storage.getUrl(storageId);
  },
});

/* ------------------------------------------------------------- delete --- */

/*
  Removing media leaves documents that used it pointing at a dead id, which is
  why `resolve` answers `url: null` rather than nothing: the block keeps its
  geometry and asks to be replaced. The files go too — an unreferenced blob in
  storage is billed the same as a referenced one.
*/
export const remove = mutation({
  args: { orgId: v.string(), mediaId: v.id("media") },
  handler: async (ctx, { orgId, mediaId }) => {
    const { org } = await requireOrg(ctx, orgId);
    const row = await ctx.db.get(mediaId);
    if (!row || row.orgId !== org._id) return;

    await ctx.storage.delete(row.storageId);
    if (row.posterStorageId) await ctx.storage.delete(row.posterStorageId);
    await ctx.db.delete(mediaId);
  },
});
