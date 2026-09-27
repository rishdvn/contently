import { ConvexError, v } from "convex/values";

import { rolesIn, slotsOf } from "../lib/editor/roles";
import type { Project } from "../lib/editor/types";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import { requireOrg, tryUser } from "./lib/auth";
import { withResolvedMedia } from "./lib/documentMedia";

/*
  Templates: a project document frozen as a starting point, shared by every
  organisation. What a template is and how to author one is `docs/templates.md`;
  this file is the storage and the rules.

  - Anyone signed in reads published templates (`list`, `get`).
  - A template is made from a project (`createFromProject`) by an admin of the
    project's organisation, and only that organisation's admins update it.
    Unpublished, it is visible to that organisation alone: any organisation
    can keep private templates.
  - Publishing puts a template in front of every customer, so only admins of
    the publisher organisation (Contently's own, `TEMPLATE_PUBLISHER_ORG`)
    can publish. Any template's own admins can take it back.
  - Media in the document is resolved against the source organisation on every
    read, so a template's photos show for everyone without anyone else being
    let into that organisation's library.
  - Posters are rendered by `scripts/template-posters.ts` through the internal
    functions at the bottom.
*/

export type TemplateDenial = { kind: "template"; code: "missing" | "forbidden" | "invalid"; message: string };

function fail(code: TemplateDenial["code"], message: string): never {
  throw new ConvexError({ kind: "template", code, message } satisfies TemplateDenial);
}

/* Clerk's key for an organisation admin, as mirrored into `memberships`. */
const ADMIN = "org:admin";

const KINDS = ["image", "carousel", "video"] as const;
const kindArg = v.union(v.literal("image"), v.literal("carousel"), v.literal("video"));

type TemplateDocument = Pick<Project, "slides" | "width" | "height">;

async function url(ctx: QueryCtx, id: Id<"_storage"> | undefined) {
  return id ? await ctx.storage.getUrl(id) : null;
}

/* What a list shows: enough to draw a card and choose, not the document. */
async function summary(ctx: QueryCtx, row: Doc<"templates">) {
  const document = row.document as TemplateDocument;
  const slides = document?.slides ?? [];
  return {
    id: row._id,
    name: row.name,
    kind: row.kind,
    aspect: row.aspect,
    width: document?.width,
    height: document?.height,
    categories: row.categories,
    tags: row.tags,
    published: row.published,
    poster: await url(ctx, row.poster),
    scenePosters: await Promise.all(row.scenePosters.map((id) => url(ctx, id))),
    scenes: slides.map((s) => ({ id: s.id, name: s.name, duration: s.duration })),
    roles: rolesIn({ slides }),
    updatedAt: row.updatedAt ?? row._creationTime,
  };
}

/*
  Who may see an unpublished template: members of the organisation it came
  from. Resolved once per request rather than per row.
*/
async function memberOrgIds(ctx: QueryCtx): Promise<Set<Id<"organizations">>> {
  const user = await tryUser(ctx);
  if (!user) return new Set();
  const rows = await ctx.db
    .query("memberships")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .collect();
  return new Set(rows.map((m) => m.orgId));
}

const visible = (row: Doc<"templates">, orgs: Set<Id<"organizations">>) => row.published || (row.orgId !== undefined && orgs.has(row.orgId));

/*
  Published templates, newest first, optionally one kind and one category.
  With `drafts`, the caller's own organisations' unpublished templates come
  too — what an author needs to check one before publishing it.
*/
export const list = query({
  args: { kind: v.optional(kindArg), category: v.optional(v.string()), drafts: v.optional(v.boolean()) },
  handler: async (ctx, { kind, category, drafts }) => {
    const user = await tryUser(ctx);
    if (!user) return [];

    const published = await ctx.db
      .query("templates")
      .withIndex("by_published_kind", (q) => (kind ? q.eq("published", true).eq("kind", kind) : q.eq("published", true)))
      .collect();

    let rows = published;
    if (drafts) {
      const orgs = await memberOrgIds(ctx);
      const own = (await Promise.all([...orgs].map((orgId) => ctx.db.query("templates").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect()))).flat();
      rows = [...published, ...own.filter((row) => !row.published && (!kind || row.kind === kind))];
    }

    const matching = category ? rows.filter((row) => row.categories.includes(category)) : rows;
    matching.sort((a, b) => (b.updatedAt ?? b._creationTime) - (a.updatedAt ?? a._creationTime));
    return await Promise.all(matching.map((row) => summary(ctx, row)));
  },
});

/*
  One template with its document and its slots: every block that carries a
  role or holds media, scene by scene (`slotsOf` in `lib/editor/roles.ts`).
  The document's media ids are already URLs.
*/
export const get = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    if (!(await tryUser(ctx))) return null;
    const templateId = ctx.db.normalizeId("templates", id);
    const row = templateId ? await ctx.db.get(templateId) : null;
    if (!row || !visible(row, await memberOrgIds(ctx))) return null;

    const document = (row.orgId ? await withResolvedMedia(ctx, row.orgId, row.document) : row.document) as Project;
    return { ...(await summary(ctx, row)), document, slots: slotsOf(document) };
  },
});

async function requireAdmin(ctx: QueryCtx, clerkOrgId: string) {
  const context = await requireOrg(ctx, clerkOrgId);
  if (context.membership.role !== ADMIN) fail("forbidden", "Only an organisation admin can make, change or publish templates");
  return context;
}

/*
  Freeze a project as a template, or — with `templateId` — refresh a template
  from the project it was made from, keeping its id, published state and
  anything not passed. A new template starts unpublished.
*/
export const createFromProject = mutation({
  args: {
    orgId: v.string(),
    projectId: v.string(),
    templateId: v.optional(v.string()),
    name: v.optional(v.string()),
    categories: v.optional(v.array(v.string())),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { orgId, projectId, templateId, name, categories, tags }) => {
    const { org, user } = await requireAdmin(ctx, orgId);

    const pid = ctx.db.normalizeId("projects", projectId);
    const project = pid ? await ctx.db.get(pid) : null;
    if (!project || project.orgId !== org._id) fail("missing", "No such project in this organisation");
    if (!(KINDS as readonly string[]).includes(project.kind)) fail("invalid", `A template is an image, carousel or video; this project is ${project.kind}`);
    const slides = (project.document as TemplateDocument)?.slides ?? [];
    if (!slides.length) fail("invalid", "The project has no scenes");

    const fields = {
      kind: project.kind,
      aspect: project.aspect,
      document: project.document,
      sourceProjectId: project._id,
      updatedAt: Date.now(),
    };

    if (templateId) {
      const tid = ctx.db.normalizeId("templates", templateId);
      const existing = tid ? await ctx.db.get(tid) : null;
      if (!existing || existing.orgId !== org._id) fail("missing", "No such template in this organisation");
      await ctx.db.patch(existing._id, {
        ...fields,
        name: name?.trim() || existing.name,
        ...(categories ? { categories } : {}),
        ...(tags ? { tags } : {}),
      });
      return existing._id;
    }

    return await ctx.db.insert("templates", {
      ...fields,
      name: name?.trim() || project.name,
      categories: categories ?? [],
      tags: tags ?? [],
      scenePosters: [],
      published: false,
      orgId: org._id,
      createdBy: user._id,
    });
  },
});

/*
  The Clerk id of the organisation that publishes the shared library, set with
  `npx convex env set TEMPLATE_PUBLISHER_ORG org_…`. Unset, nobody can publish.
*/
const publisherOrg = () => process.env.TEMPLATE_PUBLISHER_ORG?.trim() || undefined;

/*
  Show it to every organisation, or take it back. Publishing is for the
  publisher organisation's admins only; unpublishing, for the template's own.
*/
export const publish = mutation({
  args: { orgId: v.string(), id: v.string(), published: v.optional(v.boolean()) },
  handler: async (ctx, { orgId, id, published = true }) => {
    const { org } = await requireAdmin(ctx, orgId);
    if (published) {
      const publisher = publisherOrg();
      if (!publisher) fail("forbidden", "Publishing is switched off: TEMPLATE_PUBLISHER_ORG is not set on this deployment");
      if (orgId !== publisher) fail("forbidden", "Only Contently publishes to the shared template library. Your organisation's templates stay private to it");
    }
    const tid = ctx.db.normalizeId("templates", id);
    const row = tid ? await ctx.db.get(tid) : null;
    if (!row || row.orgId !== org._id) fail("missing", "No such template in this organisation");
    await ctx.db.patch(row._id, { published, updatedAt: Date.now() });
  },
});

/* ── The poster script's steps, run through `npx convex run` ──────────── */

/* Templates to render posters for, with media resolved so the stage page can
   paint them without a session. All of them, or the ones named. */
export const forPosters = internalQuery({
  args: { ids: v.optional(v.array(v.string())) },
  handler: async (ctx, { ids }) => {
    const rows = ids
      ? (await Promise.all(ids.map((id) => ctx.db.normalizeId("templates", id)).map((id) => (id ? ctx.db.get(id) : null)))).filter((r) => r !== null)
      : await ctx.db.query("templates").collect();
    return await Promise.all(
      rows.map(async (row) => ({
        id: row._id,
        name: row.name,
        postersHash: row.postersHash ?? null,
        /* Hashed as stored, so a new URL for the same file is not a change. */
        stored: row.document,
        document: row.orgId ? await withResolvedMedia(ctx, row.orgId, row.document) : row.document,
      })),
    );
  },
});

export const uploadUrl = internalMutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

/* A fresh set of posters. The files they replace are deleted. */
export const setPosters = internalMutation({
  args: { id: v.id("templates"), scenePosters: v.array(v.id("_storage")), poster: v.id("_storage"), postersHash: v.string() },
  handler: async (ctx, { id, scenePosters, poster, postersHash }) => {
    const row = await ctx.db.get(id);
    if (!row) fail("missing", "No such template");
    const keep = new Set<Id<"_storage">>([...scenePosters, poster]);
    for (const old of new Set([...row.scenePosters, ...(row.poster ? [row.poster] : [])])) {
      if (!keep.has(old)) await ctx.storage.delete(old);
    }
    await ctx.db.patch(id, { scenePosters, poster, postersHash });
  },
});
