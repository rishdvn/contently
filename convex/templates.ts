import { ConvexError, v } from "convex/values";

import { rolesIn, slotsOf } from "../lib/editor/roles";
import type { Project } from "../lib/editor/types";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import { requireOrg, tryOrg, tryUser } from "./lib/auth";
import { withResolvedMedia } from "./lib/documentMedia";
import { insertProject } from "./projects";
import type { MutationCtx } from "./_generated/server";

/*
  Templates: a project document frozen as a starting point, shared by every
  organisation. What a template is and how to author one is `docs/templates.md`;
  this file is the storage and the rules.

  - Anyone signed in reads published templates (`list`, `get`), and makes a
    project from one in their organisation (`createProjectFrom`). The API's
    `POST /v1/projects` makes it the same way: both call `projectFromTemplate`.
  - A template is made from a project (`createFromProject`) by an admin of the
    project's organisation, and only that organisation's admins update it.
    Unpublished, it is visible to that organisation alone: any organisation
    can keep private templates.
  - Publishing puts a template in front of every customer, so only admins of
    the publisher organisation (Contently's own, `TEMPLATE_PUBLISHER_ORG`)
    can publish. Any template's own admins can take it back, or delete it
    (`deleteTemplate`).
  - Media in the document is resolved against the source organisation on every
    read, so a template's photos show for everyone without anyone else being
    let into that organisation's library.
  - Posters are rendered by `scripts/template-posters.ts` through the internal
    functions at the bottom, or by the studio as it saves a template
    (`templatePosters.savePosters`).
*/

export type TemplateDenial = { kind: "template"; code: "missing" | "forbidden" | "invalid"; message: string };

export function fail(code: TemplateDenial["code"], message: string): never {
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
  Whose unpublished templates a reader sees: the organisation they are working
  in (`orgId`, the Clerk id), if they are a member of it. Without `orgId`, the
  answer from before it existed: every organisation they are in. Resolved once
  per request rather than per row.
*/
async function memberOrgIds(ctx: QueryCtx, orgId?: string): Promise<Set<Id<"organizations">>> {
  if (orgId !== undefined) {
    const context = await tryOrg(ctx, orgId);
    return new Set(context ? [context.org._id] : []);
  }
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
  With `drafts`, the active organisation's (`orgId`) unpublished templates
  come too — what an author needs to check one before publishing it, and an
  organisation's private library. Switching organisation is a new `orgId`, so
  the list follows it.
*/
export const list = query({
  args: { kind: v.optional(kindArg), category: v.optional(v.string()), drafts: v.optional(v.boolean()), orgId: v.optional(v.string()) },
  handler: async (ctx, { kind, category, drafts, orgId }) => {
    const user = await tryUser(ctx);
    if (!user) return [];

    const published = await ctx.db
      .query("templates")
      .withIndex("by_published_kind", (q) => (kind ? q.eq("published", true).eq("kind", kind) : q.eq("published", true)))
      .collect();

    let rows = published;
    if (drafts) {
      const orgs = await memberOrgIds(ctx, orgId);
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
  The document's media ids are already URLs. `orgId` as for `list`: an
  unpublished template is there only for its own organisation.
*/
export const get = query({
  args: { id: v.string(), orgId: v.optional(v.string()) },
  handler: async (ctx, { id, orgId }) => {
    if (!(await tryUser(ctx))) return null;
    const templateId = ctx.db.normalizeId("templates", id);
    const row = templateId ? await ctx.db.get(templateId) : null;
    if (!row || !visible(row, await memberOrgIds(ctx, orgId))) return null;

    const document = (row.orgId ? await withResolvedMedia(ctx, row.orgId, row.document) : row.document) as Project;
    return { ...(await summary(ctx, row)), document, slots: slotsOf(document) };
  },
});

/* Published templates, and the given organisation's own. */
export const visibleTo = (row: Doc<"templates">, orgId: Id<"organizations">) => row.published || row.orgId === orgId;

type AudioLike = { start?: unknown; duration?: unknown };

/*
  The one way a project is made from a template. The Templates page's Create
  (`createProjectFrom`) and the API's `POST /v1/projects`
  (`api/projects.createFromTemplate`) both come here, so the two cannot drift.
  `docs/templates.md` → "Making a project from a template" says the same to
  callers.

  - Scene and block ids are kept. The API replaces content by `blockId`, with
    ids read from `GET /v1/templates/:id`, so they have to address the same
    blocks in the copy; ids only need to be unique within one document.
  - Media: stock and the new project's own organisation's media keep their
    ids, so the project's library, "Used in" and the render worker know them.
    Media the template's organisation owns, which the new one cannot resolve,
    comes as the URL it resolves to now (`withResolvedMedia`).
  - Audio: library tracks (`audioTracks`) are shared by every organisation, so
    each keeps its `trackId`, which the studio and the render worker turn into
    a live URL, and its `src` as the fallback. With `scenes`, the lane is cut
    to the length of the scenes kept.
  - `scenes`: some scenes by index, in the order given; all of them when absent.

  The template has to be published or the new project's organisation's own.
*/
export async function projectFromTemplate(
  ctx: MutationCtx,
  { orgId, userId, templateId, name, scenes }: { orgId: Id<"organizations">; userId: Id<"users">; templateId: string; name?: string; scenes?: number[] },
): Promise<Id<"projects">> {
  const tid = ctx.db.normalizeId("templates", templateId);
  const template = tid ? await ctx.db.get(tid) : null;
  if (!template || !visibleTo(template, orgId)) fail("missing", `No template ${templateId}`);

  const source = (
    template.orgId ? await withResolvedMedia(ctx, template.orgId, template.document, (media) => !media.orgId || media.orgId === orgId) : template.document
  ) as TemplateDocument & Record<string, unknown>;

  const all = source.slides ?? [];
  if (scenes) {
    const bad = scenes.filter((i) => !Number.isInteger(i) || i < 0 || i >= all.length);
    if (!scenes.length) fail("invalid", "scenes: pick at least one scene, or leave it out for all of them");
    if (bad.length) fail("invalid", `scenes: this template has scenes 0–${all.length - 1}; no scene ${bad.join(", ")}`);
    if (new Set(scenes).size !== scenes.length) fail("invalid", "scenes: each scene at most once");
  }
  const slides = scenes ? scenes.map((i) => all[i]!) : all;

  const tracks = (Array.isArray(source.audio) ? source.audio : []) as AudioLike[];
  const length = slides.reduce((sum, s) => sum + (Number.isFinite(s.duration) ? s.duration : 0), 0);
  const audio =
    scenes && template.kind === "video"
      ? tracks
          .filter((t) => typeof t.start === "number" && t.start < length)
          .map((t) => ({ ...t, duration: Math.min(Number(t.duration) || 0, length - (t.start as number)) }))
      : tracks;

  const now = Date.now();
  const title = name?.trim() || template.name;
  const document = {
    ...source,
    id: "",
    name: title,
    kind: template.kind,
    aspect: template.aspect,
    width: typeof source.width === "number" ? source.width : 1080,
    height: typeof source.height === "number" ? source.height : 1080,
    slides,
    audio,
    createdAt: now,
    updatedAt: now,
  };
  return await insertProject(ctx, orgId, userId, document, { updatedAt: now });
}

/*
  A new project in the caller's organisation from a template, roles included:
  the Templates page's Create. Any member may, of any template their
  organisation can see.
*/
export const createProjectFrom = mutation({
  args: { orgId: v.string(), id: v.string() },
  handler: async (ctx, { orgId, id }) => {
    const { org, user } = await requireOrg(ctx, orgId);
    return await projectFromTemplate(ctx, { orgId: org._id, userId: user._id, templateId: id });
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

/* A template and its posters. Projects made from it are copies and are untouched. */
async function deleteRow(ctx: MutationCtx, row: Doc<"templates">) {
  for (const file of new Set([...row.scenePosters, ...(row.poster ? [row.poster] : [])])) await ctx.storage.delete(file);
  await ctx.db.delete(row._id);
}

/*
  Delete one of the organisation's templates, from the Templates page or the
  flyout. The same people who may take a template back from the shared
  library (`publish` with `published: false`): admins of the organisation it
  belongs to. So an unpublished template, or the organisation's own published
  one, which deleting takes away from everyone as unpublishing would.

  Another organisation's template is `forbidden` rather than `missing`: it is
  one the caller has seen, or they would not have its id.
*/
export const deleteTemplate = mutation({
  args: { orgId: v.string(), id: v.string() },
  handler: async (ctx, { orgId, id }) => {
    const { org } = await requireAdmin(ctx, orgId);
    const tid = ctx.db.normalizeId("templates", id);
    const row = tid ? await ctx.db.get(tid) : null;
    if (!row) fail("missing", "No such template");
    if (row.orgId !== org._id) fail("forbidden", "Only the organisation that made a template can delete it");
    await deleteRow(ctx, row);
  },
});

/*
  The templates the caller may delete while working in `orgId`: none unless
  they are an admin there, otherwise every template the organisation made.
  The Templates page and the flyout offer Delete on these.
*/
export const deletable = query({
  args: { orgId: v.string() },
  handler: async (ctx, { orgId }) => {
    const context = await tryOrg(ctx, orgId);
    if (!context || context.membership.role !== ADMIN) return [];
    const rows = await ctx.db.query("templates").withIndex("by_org", (q) => q.eq("orgId", context.org._id)).collect();
    return rows.map((row) => row._id);
  },
});

/*
  Delete a template and its posters, for whoever runs the deployment
  (`npx convex run templates:remove '{"id":"k57…"}'`): clearing out test
  templates.
*/
export const remove = internalMutation({
  args: { id: v.id("templates") },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id);
    if (!row) fail("missing", "No such template");
    await deleteRow(ctx, row);
  },
});

/* ── The studio's Save as template ─────────────────────────────────── */

/*
  What the studio's Save as template dialog needs to know about a project:
  whether the caller may make templates here (an admin) and publish them (an
  admin of the publisher organisation); the template already made from this
  project, if there is one, since saving again refreshes that one rather than
  making a second; and the categories the library already uses, most used
  first, to pick from.
*/
export const forProject = query({
  args: { orgId: v.string(), projectId: v.string() },
  handler: async (ctx, { orgId, projectId }) => {
    const context = await tryOrg(ctx, orgId);
    if (!context) return null;
    const admin = context.membership.role === ADMIN;
    const own = await ctx.db.query("templates").withIndex("by_org", (q) => q.eq("orgId", context.org._id)).collect();
    const made = own.filter((row) => row.sourceProjectId === projectId).sort((a, b) => (b.updatedAt ?? b._creationTime) - (a.updatedAt ?? a._creationTime))[0];
    const published = await ctx.db.query("templates").withIndex("by_published", (q) => q.eq("published", true)).collect();

    const counts = new Map<string, number>();
    for (const row of [...published, ...own.filter((r) => !r.published)]) for (const c of row.categories) counts.set(c, (counts.get(c) ?? 0) + 1);
    return {
      admin,
      canPublish: admin && publisherOrg() === orgId,
      template: made ? { id: made._id, name: made.name, categories: made.categories, tags: made.tags, published: made.published } : null,
      categories: [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => c),
    };
  },
});

/* The template the studio may put posters on, for `templatePosters.savePosters`: the caller's own organisation's, as an admin. */
export const posterTarget = internalQuery({
  args: { orgId: v.string(), id: v.string() },
  handler: async (ctx, { orgId, id }): Promise<{ id: Id<"templates">; scenes: number }> => {
    const { org } = await requireAdmin(ctx, orgId);
    const tid = ctx.db.normalizeId("templates", id);
    const row = tid ? await ctx.db.get(tid) : null;
    if (!row || row.orgId !== org._id) fail("missing", "No such template in this organisation");
    return { id: row._id, scenes: ((row.document as TemplateDocument)?.slides ?? []).length };
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
