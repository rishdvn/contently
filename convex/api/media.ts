import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, internalQuery, type QueryCtx } from "../_generated/server";

/*
  Media through the public API: the organisation's uploads and the shared
  stock library, and the two ways in — a signed upload URL for bytes the
  caller has, and an import from a URL (`router.ts` fetches it; `create`
  records it). Rows are the same `media` rows the studio's Uploads panel and
  the Media page show.
*/

const kindArg = v.union(v.literal("image"), v.literal("video"));

async function view(ctx: QueryCtx, row: Doc<"media">) {
  const [url, posterUrl] = await Promise.all([ctx.storage.getUrl(row.storageId), row.posterStorageId ? ctx.storage.getUrl(row.posterStorageId) : null]);
  return {
    id: row._id,
    kind: row.kind,
    source: row.orgId ? ("org" as const) : ("stock" as const),
    name: row.name,
    width: row.width,
    height: row.height,
    ...(row.duration !== undefined ? { duration: row.duration } : {}),
    url,
    posterUrl,
    tags: row.tags,
    ...(row.categories?.length ? { categories: row.categories } : {}),
    createdAt: row._creationTime,
  };
}

const fold = (text: string) => text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

/*
  The organisation's own media, newest first, then — with `source: "all"` or
  `"stock"` — the shared stock library. `q` matches every word against the
  name, tags and categories.
*/
export const list = internalQuery({
  args: {
    orgId: v.id("organizations"),
    kind: v.optional(kindArg),
    q: v.optional(v.string()),
    source: v.union(v.literal("org"), v.literal("stock"), v.literal("all")),
    limit: v.number(),
  },
  handler: async (ctx, { orgId, kind, q, source, limit }) => {
    const terms = fold(q ?? "").split(/\s+/).filter(Boolean);
    const matches = (row: Doc<"media">) => {
      const haystack = fold([row.name, ...row.tags, ...(row.categories ?? []), ...(row.aesthetics ?? [])].join(" "));
      return terms.every((t) => haystack.includes(t));
    };
    const rows: Doc<"media">[] = [];
    if (source !== "stock") {
      const own = await (kind ? ctx.db.query("media").withIndex("by_org_kind", (i) => i.eq("orgId", orgId).eq("kind", kind)) : ctx.db.query("media").withIndex("by_org", (i) => i.eq("orgId", orgId)))
        .order("desc")
        .collect();
      rows.push(...own.filter(matches));
    }
    if (source !== "org" && rows.length < limit) {
      const stock = await ctx.db
        .query("media")
        .withIndex("by_source_kind", (i) => (kind ? i.eq("source", "stock").eq("kind", kind) : i.eq("source", "stock")))
        .order("desc")
        .collect();
      rows.push(...stock.filter(matches));
    }
    return await Promise.all(rows.slice(0, limit).map((row) => view(ctx, row)));
  },
});

export const uploadUrl = internalMutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

/* What storage knows about a file: whether it exists, and its size. */
export const storageInfo = internalQuery({
  args: { storageId: v.string() },
  handler: async (ctx, { storageId }) => {
    const id = ctx.db.system.normalizeId("_storage", storageId);
    const row = id ? await ctx.db.system.get(id) : null;
    return row ? { id: row._id, size: row.size, contentType: row.contentType ?? null } : null;
  },
});

/* A file already in storage becomes a row in the organisation's library. A
   file some other row already points at is refused: storage ids are not a
   way into another organisation's media. */
export const create = internalMutation({
  args: {
    orgId: v.id("organizations"),
    userId: v.id("users"),
    storageId: v.id("_storage"),
    kind: kindArg,
    width: v.number(),
    height: v.number(),
    duration: v.optional(v.number()),
    name: v.string(),
    tags: v.array(v.string()),
  },
  handler: async (ctx, { orgId, userId, ...fields }) => {
    const taken = await ctx.db
      .query("media")
      .withIndex("by_storageId", (q) => q.eq("storageId", fields.storageId))
      .first();
    if (taken) return null;
    const id: Id<"media"> = await ctx.db.insert("media", { ...fields, orgId, source: "upload", createdBy: userId });
    return await view(ctx, (await ctx.db.get(id))!);
  },
});
