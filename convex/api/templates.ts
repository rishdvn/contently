import { v } from "convex/values";

import { durationOf, roleCounts, type Doc as ViewDoc } from "../../lib/api/view";
import type { Doc, Id } from "../_generated/dataModel";
import { internalQuery, type QueryCtx } from "../_generated/server";
import { withResolvedMedia } from "../lib/documentMedia";

/*
  Templates, as the public API reads them for one organisation: every
  published template, plus that organisation's own unpublished ones — the
  same rule `templates.ts` applies to a signed-in member. The HTTP action
  shapes the answer (`lib/api/view.ts`); these return data.
*/

const visible = (row: Doc<"templates">, orgId: Id<"organizations">) => row.published || row.orgId === orgId;

async function url(ctx: QueryCtx, id: Id<"_storage"> | undefined) {
  return id ? await ctx.storage.getUrl(id) : null;
}

async function summary(ctx: QueryCtx, row: Doc<"templates">) {
  const document = { ...(row.document as ViewDoc), kind: row.kind as ViewDoc["kind"] };
  const slides = document?.slides ?? [];
  return {
    id: row._id,
    name: row.name,
    kind: row.kind,
    aspect: row.aspect,
    width: document?.width,
    height: document?.height,
    sceneCount: slides.length,
    duration: durationOf({ ...document, slides }),
    categories: row.categories,
    tags: row.tags,
    published: row.published,
    poster: await url(ctx, row.poster),
    scenePosters: await Promise.all(row.scenePosters.map((id) => url(ctx, id))),
    roles: roleCounts({ slides }),
    updatedAt: row.updatedAt ?? row._creationTime,
  };
}

const fold = (text: string) => text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

export const list = internalQuery({
  args: { orgId: v.id("organizations"), kind: v.optional(v.string()), category: v.optional(v.string()), q: v.optional(v.string()) },
  handler: async (ctx, { orgId, kind, category, q }) => {
    const published = await ctx.db
      .query("templates")
      .withIndex("by_published_kind", (i) => (kind ? i.eq("published", true).eq("kind", kind) : i.eq("published", true)))
      .collect();
    const own = (await ctx.db.query("templates").withIndex("by_org", (i) => i.eq("orgId", orgId)).collect()).filter((row) => !row.published && (!kind || row.kind === kind));
    const terms = fold(q ?? "").split(/\s+/).filter(Boolean);
    const rows = [...published, ...own].filter((row) => {
      if (category && !row.categories.includes(category)) return false;
      const haystack = fold([row.name, ...row.categories, ...row.tags].join(" "));
      return terms.every((t) => haystack.includes(t));
    });
    rows.sort((a, b) => (b.updatedAt ?? b._creationTime) - (a.updatedAt ?? a._creationTime));
    return await Promise.all(rows.map((row) => summary(ctx, row)));
  },
});

/* One template with its document, media as URLs. Null when it does not exist
   or this organisation cannot see it: the two are one answer, 404. */
export const get = internalQuery({
  args: { orgId: v.id("organizations"), id: v.string() },
  handler: async (ctx, { orgId, id }) => {
    const templateId = ctx.db.normalizeId("templates", id);
    const row = templateId ? await ctx.db.get(templateId) : null;
    if (!row || !visible(row, orgId)) return null;
    const document = row.orgId ? await withResolvedMedia(ctx, row.orgId, row.document) : row.document;
    return { ...(await summary(ctx, row)), document };
  },
});

export { visible };
