import { v } from "convex/values";

import { applyReplacements, type Media, type Replacement } from "../../lib/api/content";
import { durationOf, type Doc as ViewDoc } from "../../lib/api/view";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, internalQuery, type QueryCtx } from "../_generated/server";
import { withResolvedMedia, type DocumentLike } from "../lib/documentMedia";

import { apiFail } from "./errors";
import { visible } from "./templates";

/*
  Projects through the public API, for the organisation a key belongs to.
  A project from another organisation is "not found", never "forbidden":
  which ids exist elsewhere is not something a key should be able to map.
*/

function summary(row: Doc<"projects">) {
  const document = { ...(row.document as ViewDoc), kind: row.kind as ViewDoc["kind"] };
  const slides = document.slides ?? [];
  return {
    id: row._id,
    name: row.name,
    kind: row.kind,
    aspect: row.aspect,
    width: row.width,
    height: row.height,
    sceneCount: slides.length,
    duration: durationOf({ ...document, slides }),
    updatedAt: row.updatedAt,
    createdAt: row._creationTime,
  };
}

async function owned(ctx: QueryCtx, orgId: Id<"organizations">, id: string) {
  const projectId = ctx.db.normalizeId("projects", id);
  const row = projectId ? await ctx.db.get(projectId) : null;
  return row && row.orgId === orgId ? row : null;
}

/* Newest edit first, a page at a time. */
export const list = internalQuery({
  args: { orgId: v.id("organizations"), limit: v.number(), cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { orgId, limit, cursor }) => {
    const page = await ctx.db
      .query("projects")
      .withIndex("by_org_updatedAt", (q) => q.eq("orgId", orgId))
      .order("desc")
      .paginate({ numItems: limit, cursor });
    return { data: page.page.map(summary), nextCursor: page.isDone ? null : page.continueCursor };
  },
});

export const get = internalQuery({
  args: { orgId: v.id("organizations"), id: v.string() },
  handler: async (ctx, { orgId, id }) => {
    const row = await owned(ctx, orgId, id);
    return row ? { ...summary(row), document: row.document } : null;
  },
});

/*
  A new project from a template, in the key's organisation: every scene, or
  the ones asked for, in the order asked. Block and scene ids are kept, so
  the ids a caller read from `GET /templates/:id` address the same blocks in
  the project. Media comes across as URLs: the files belong to the template's
  organisation, which this one cannot resolve ids against.
*/
export const createFromTemplate = internalMutation({
  args: {
    orgId: v.id("organizations"),
    userId: v.id("users"),
    templateId: v.string(),
    name: v.optional(v.string()),
    scenes: v.optional(v.array(v.number())),
  },
  handler: async (ctx, { orgId, userId, templateId, name, scenes }) => {
    const tid = ctx.db.normalizeId("templates", templateId);
    const template = tid ? await ctx.db.get(tid) : null;
    if (!template || !visible(template, orgId)) apiFail("not_found", `No template ${templateId}`);

    const source = (template.orgId ? await withResolvedMedia(ctx, template.orgId, template.document) : template.document) as DocumentLike & Record<string, unknown>;
    const all = source.slides ?? [];
    if (scenes) {
      const bad = scenes.filter((i) => !Number.isInteger(i) || i < 0 || i >= all.length);
      if (!scenes.length) apiFail("invalid_request", "scenes: pick at least one scene, or leave it out for all of them");
      if (bad.length) apiFail("invalid_request", `scenes: this template has scenes 0–${all.length - 1}; no scene ${bad.join(", ")}`);
      if (new Set(scenes).size !== scenes.length) apiFail("invalid_request", "scenes: each scene at most once");
    }
    const slides = scenes ? scenes.map((i) => all[i]) : all;

    const now = Date.now();
    const title = name?.trim() || template.name;
    const document = { ...source, id: "", name: title, kind: template.kind, aspect: template.aspect, slides, audio: (source.audio as unknown[] | undefined) ?? [], createdAt: now, updatedAt: now };
    const width = typeof source.width === "number" ? source.width : 1080;
    const height = typeof source.height === "number" ? source.height : 1080;

    const id = await ctx.db.insert("projects", { orgId, createdBy: userId, name: title, kind: template.kind, aspect: template.aspect, width, height, document, updatedAt: now });
    await ctx.db.patch(id, { document: { ...document, id } });
    return id;
  },
});

/*
  The media a batch places, resolved: ids the organisation may use (its own
  uploads and stock), and URLs the action has already imported, by URL.
*/
async function mediaLookup(ctx: QueryCtx, orgId: Id<"organizations">, replacements: Replacement[], imported: { url: string; mediaId: string }[]) {
  const byId = new Map<string, Media>();
  const ids = [...new Set([...replacements.flatMap((r) => (r.mediaId ? [r.mediaId] : [])), ...imported.map((i) => i.mediaId)])];
  for (const raw of ids) {
    const id = ctx.db.normalizeId("media", raw);
    const row = id ? await ctx.db.get(id) : null;
    if (!row || (row.orgId && row.orgId !== orgId)) continue;
    const url = await ctx.storage.getUrl(row.storageId);
    if (url) byId.set(raw, { id: row._id, kind: row.kind, url });
  }
  const byUrl = new Map(imported.map((i) => [i.url, i.mediaId]));
  return (r: Replacement): Media | undefined => {
    if (r.mediaId) return byId.get(r.mediaId);
    if (!r.mediaUrl) return undefined;
    const id = byUrl.get(r.mediaUrl);
    /* Planning: the URL has not been fetched, so its kind is not known yet. */
    return id ? byId.get(id) : imported.length ? undefined : { id: null, kind: null, url: r.mediaUrl };
  };
}

/*
  Would this batch apply? Run before any URL is fetched, so a request that
  was going to fail anyway imports nothing.
*/
export const planContent = internalQuery({
  args: { orgId: v.id("organizations"), id: v.string(), replacements: v.any() },
  handler: async (ctx, { orgId, id, replacements }) => {
    const row = await owned(ctx, orgId, id);
    if (!row) return null;
    const outcome = applyReplacements(row.document as DocumentLike as never, replacements as Replacement[], await mediaLookup(ctx, orgId, replacements, []));
    return { problems: outcome.problems };
  },
});

/* Apply the batch, all of it or none of it. */
export const applyContent = internalMutation({
  args: { orgId: v.id("organizations"), id: v.string(), replacements: v.any(), imported: v.array(v.object({ url: v.string(), mediaId: v.string() })) },
  handler: async (ctx, { orgId, id, replacements, imported }) => {
    const row = await owned(ctx, orgId, id);
    if (!row) apiFail("not_found", `No project ${id}`);
    const reps = replacements as Replacement[];
    const document = row.document as Record<string, unknown> & DocumentLike;
    const outcome = applyReplacements(document as never, reps, await mediaLookup(ctx, orgId, reps, imported));
    if (outcome.problems.length) apiFail("invalid_request", "Some replacements cannot be applied; nothing was changed", outcome.problems);

    if (outcome.changed.length) {
      const now = Date.now();
      await ctx.db.patch(row._id, { document: { ...document, slides: outcome.document.slides, updatedAt: now }, updatedAt: now });
    }
    const { changed, unmatched, skipped, warnings } = outcome;
    return { changed, unmatched, skipped, warnings };
  },
});
