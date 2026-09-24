import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { requireOrg, tryOrg } from "./lib/auth";

/*
  Projects. One row per document the studio can open, owned by an organisation.

  The editor's `Project` JSON is stored whole in `document` — the block union in
  `lib/editor/types.ts` changes with every block ticket and a validator here
  would have to change in lockstep, rejecting documents written by the previous
  deployment mid-rollout. The columns beside it (`name`, `kind`, `aspect`,
  `width`, `height`, `updatedAt`) are a projection of that JSON, kept so the hub
  can sort and later tickets can answer questions without parsing every
  document.

  There is one id, not two: `create` writes the row id back into `document.id`,
  so the URL, `project.id` in the store and the row all agree.
*/

/* Wide enough to hold any document the editor writes; see above. */
const documentArg = v.any();

/* The parts of the document this table projects into columns. Everything else
   in there is the editor's business. */
type DocumentColumns = {
  name: string;
  kind: string;
  aspect: string;
  width: number;
  height: number;
  updatedAt: number;
};

/*
  `ConvexError`s with a code, as in `lib/auth.ts`: their data reaches the client
  on a production deployment, where a plain throw is flattened to "Server
  Error", and the studio routes on "no such project" rather than showing it.
*/
export type ProjectDenial = { kind: "project"; code: "missing" | "invalid"; message: string };

function fail(code: ProjectDenial["code"], message: string): never {
  throw new ConvexError({ kind: "project", code, message } satisfies ProjectDenial);
}

function columnsOf(document: unknown): DocumentColumns {
  if (typeof document !== "object" || document === null) fail("invalid", "A project document must be an object");
  const d = document as Record<string, unknown>;
  const string = (field: string) => {
    const value = d[field];
    if (typeof value !== "string" || value === "") fail("invalid", `Project document is missing "${field}"`);
    return value as string;
  };
  const number = (field: string) => {
    const value = d[field];
    if (typeof value !== "number" || !Number.isFinite(value)) fail("invalid", `Project document is missing "${field}"`);
    return value as number;
  };
  if (!Array.isArray(d.slides)) fail("invalid", 'Project document is missing "slides"');
  return {
    name: string("name"),
    kind: string("kind"),
    aspect: string("aspect"),
    width: number("width"),
    height: number("height"),
    updatedAt: typeof d.updatedAt === "number" ? d.updatedAt : Date.now(),
  };
}

/*
  What every read hands back. The document comes with it because the hub draws
  its cards and its enlarged preview from the real document — a stored poster
  would be a second source of truth for something the browser already renders.
*/
function view(project: Doc<"projects">) {
  return {
    id: project._id,
    name: project.name,
    kind: project.kind,
    aspect: project.aspect,
    width: project.width,
    height: project.height,
    updatedAt: project.updatedAt,
    document: project.document,
  };
}

/*
  Resolve an id the way a mutation needs it: the caller is in the org, the row
  exists, and the row belongs to that org. A project from another organisation
  is reported missing rather than forbidden — which org owns which id is not
  something a non-member should be able to map out.
*/
async function owned(ctx: MutationCtx, clerkOrgId: string, id: Id<"projects">) {
  const { org, user } = await requireOrg(ctx, clerkOrgId);
  const project = await ctx.db.get(id);
  if (!project || project.orgId !== org._id) fail("missing", "No such project in this organisation");
  return { org, user, project };
}

/* Insert, then write the row id into the document so the two agree. */
async function insertProject(
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  createdBy: Id<"users">,
  document: unknown,
  overrides: Partial<DocumentColumns> = {},
) {
  const columns = { ...columnsOf(document), ...overrides };
  const id = await ctx.db.insert("projects", { orgId, createdBy, document, ...columns });
  await ctx.db.patch(id, {
    document: { ...(document as object), id, name: columns.name, updatedAt: columns.updatedAt },
  });
  return id;
}

/* Everything the org owns, newest edit first. */
export const list = query({
  args: { orgId: v.string() },
  handler: async (ctx, { orgId }) => {
    const context = await tryOrg(ctx, orgId);
    if (!context) return [];

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_org_updatedAt", (q) => q.eq("orgId", context.org._id))
      .order("desc")
      .collect();
    return projects.map(view);
  },
});

/*
  One project. `id` is a plain string because it arrives from the URL: a
  `v.id()` argument fails the whole request on a typo, and the studio wants
  "there is no such project" as an answer it can route on. A stale bookmark,
  another org's project and junk all come back `null`.
*/
export const get = query({
  args: { orgId: v.string(), id: v.string() },
  handler: async (ctx, { orgId, id }) => {
    const context = await tryOrg(ctx, orgId);
    if (!context) return null;

    const projectId = ctx.db.normalizeId("projects", id);
    if (!projectId) return null;
    const project = await ctx.db.get(projectId);
    if (!project || project.orgId !== context.org._id) return null;
    return view(project);
  },
});

export const create = mutation({
  args: { orgId: v.string(), document: documentArg },
  handler: async (ctx, { orgId, document }) => {
    const { org, user } = await requireOrg(ctx, orgId);
    return await insertProject(ctx, org._id, user._id, document, { updatedAt: Date.now() });
  },
});

/*
  The whole document, as the studio's autosave has it. A full write rather than
  a patch: the editor holds the document in memory and undo can change any part
  of it, so there is no smaller unit that is always correct.
*/
export const save = mutation({
  args: { orgId: v.string(), id: v.id("projects"), document: documentArg },
  handler: async (ctx, { orgId, id, document }) => {
    const { project } = await owned(ctx, orgId, id);
    await ctx.db.patch(project._id, {
      ...columnsOf(document),
      document: { ...(document as object), id: project._id },
    });
  },
});

/* Renaming from the hub, where the document is not open in the studio. The name
   lives in the row and in the document, so both move. */
export const rename = mutation({
  args: { orgId: v.string(), id: v.id("projects"), name: v.string() },
  handler: async (ctx, { orgId, id, name }) => {
    const { project } = await owned(ctx, orgId, id);
    const trimmed = name.trim();
    if (!trimmed) fail("invalid", "A project needs a name");
    const updatedAt = Date.now();
    await ctx.db.patch(project._id, {
      name: trimmed,
      updatedAt,
      document: { ...(project.document as object), name: trimmed, updatedAt },
    });
  },
});

/* Ids inside the document (slides, blocks) are scoped to it, so a copy keeps
   them; only the project's own identity is new. */
export const duplicate = mutation({
  args: { orgId: v.string(), id: v.id("projects") },
  handler: async (ctx, { orgId, id }) => {
    const { org, user, project } = await owned(ctx, orgId, id);
    return await insertProject(ctx, org._id, user._id, project.document, {
      name: `${project.name} copy`,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { orgId: v.string(), id: v.id("projects") },
  handler: async (ctx, { orgId, id }) => {
    const { project } = await owned(ctx, orgId, id);
    /* The poster belongs to this row alone, so it goes with it rather than
       being left in storage with nothing pointing at it. */
    if (project.posterStorageId) await ctx.storage.delete(project.posterStorageId);
    await ctx.db.delete(project._id);
  },
});

/*
  The one-time move of a browser's localStorage projects into an organisation,
  offered by the hub on first signed-in load. One mutation so the import is all
  or nothing: a browser that cleared its storage after a half-finished import
  would have lost the rest.

  The cap keeps that transaction inside Convex's limits. It is far above what a
  browser accumulated while the studio was local-only.
*/
const MAX_IMPORT = 100;

export const importLocal = mutation({
  args: { orgId: v.string(), documents: v.array(documentArg) },
  handler: async (ctx, { orgId, documents }) => {
    const { org, user } = await requireOrg(ctx, orgId);
    if (documents.length > MAX_IMPORT) fail("invalid", `Import is limited to ${MAX_IMPORT} projects at a time`);

    const ids: Id<"projects">[] = [];
    for (const document of documents) {
      /* No `updatedAt` override: an import is a move, and the hub sorts by last
         edit, so the documents keep the times they were last edited. */
      ids.push(await insertProject(ctx, org._id, user._id, document));
    }
    return ids;
  },
});
