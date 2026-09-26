import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { requireOrg, tryOrg } from "./lib/auth";

/*
  Rendering a project into finished files.

  A Convex action cannot run a browser, and every pixel this product ships is
  painted by the studio's own React tree — so the finished artwork comes out of
  a real Chrome. This file is the half of that which lives in Convex:

  - a queue (`renderJobs`) the worker in `workers/render/` claims from;
  - short-lived tokens that let that worker open `/render/<projectId>` with no
    Clerk session, since it is a server with no user to sign in as;
  - `document`, the only read that token unlocks: one project, with its media
    ids already turned into URLs.

  Two secrets, both deployment env vars (`npx convex env set`):

  - `RENDER_TOKEN_SECRET` signs the render tokens. Rotating it invalidates every
    token in flight, which is at most one render.
  - `RENDER_WORKER_SECRET` is what a worker presents to claim and finish jobs.
    It stands in for a user: a holder can render anything any organisation owns,
    so it belongs to the worker and nothing else.

  Both are required. A deployment missing either refuses to render rather than
  falling back to an unauthenticated path.
*/

/* A claim is allowed to hold a job for this long; after that the job is
   considered lost — the pod was recycled, the browser hung — and goes back on
   the queue. Matches the worker's own per-job deadline. */
const JOB_TIMEOUT_MS = 5 * 60 * 1000;

/* Enough for a whole render plus the page load that precedes it, and short
   enough that a token found in a log is worthless by the time it is read. */
const TOKEN_TTL_MS = 10 * 60 * 1000;

/* One retry. A job that fails the same way twice is failing for a reason a
   third attempt will not fix, and the caller is waiting. */
const MAX_ATTEMPTS = 2;

export type RenderFormat = "png" | "carousel-zip" | "mp4";

const format = v.union(v.literal("png"), v.literal("carousel-zip"), v.literal("mp4"));

export type RenderDenial = {
  kind: "render";
  code: "missing" | "invalid" | "forbidden" | "unconfigured";
  message: string;
};

/* As in `projects.ts`: a `ConvexError` so the reason survives to the client on a
   production deployment, where a plain throw is flattened to "Server Error". */
function fail(code: RenderDenial["code"], message: string): never {
  throw new ConvexError({ kind: "render", code, message } satisfies RenderDenial);
}

/* ─────────────────────────────────────────────────────────────── tokens ─── */

const bytes = new TextEncoder();

function base64url(raw: Uint8Array): string {
  let binary = "";
  for (const byte of raw) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(text: string): Uint8Array {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(text.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/* Length-independent so a mismatch costs the same time whatever it is. */
function sameSecret(a: string, b: string): boolean {
  const left = bytes.encode(a);
  const right = bytes.encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    fail("unconfigured", `${name} is not set on this Convex deployment; rendering is disabled until it is`);
  }
  return value;
}

async function signingKey(): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    bytes.encode(requireEnv("RENDER_TOKEN_SECRET")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

type TokenClaims = { p: string; exp: number };

/*
  `<payload>.<signature>`, both base64url. Stateless on purpose: a worker that
  reloads the render page mid-job, or opens it twice for a two-pass render, must
  not depend on a row somebody has to remember to delete.
*/
async function issueToken(projectId: string, now: number): Promise<string> {
  const payload = base64url(bytes.encode(JSON.stringify({ p: projectId, exp: now + TOKEN_TTL_MS } satisfies TokenClaims)));
  const signature = await crypto.subtle.sign("HMAC", await signingKey(), bytes.encode(payload));
  return `${payload}.${base64url(new Uint8Array(signature))}`;
}

/* The project the token is good for, or null: expired, tampered with, or signed
   by a secret this deployment no longer uses. */
async function tokenSubject(token: string, now: number): Promise<string | null> {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = await crypto.subtle.sign("HMAC", await signingKey(), bytes.encode(payload));
  if (!sameSecret(base64url(new Uint8Array(expected)), signature)) return null;

  let claims: TokenClaims;
  try {
    claims = JSON.parse(new TextDecoder().decode(fromBase64url(payload))) as TokenClaims;
  } catch {
    return null;
  }
  if (typeof claims.p !== "string" || typeof claims.exp !== "number" || claims.exp < now) return null;
  return claims.p;
}

/* Callers that are the worker rather than a person. */
function requireWorker(secret: string) {
  if (!sameSecret(secret, requireEnv("RENDER_WORKER_SECRET"))) fail("forbidden", "Not a render worker");
}

/* ──────────────────────────────────────────────────── the render's input ─── */

type MediaRef = { kind: "block"; slide: number; block: number } | { kind: "background"; slide: number };

type DocumentLike = {
  slides?: {
    background?: { type?: string; mediaId?: string; src?: string };
    blocks?: { type?: string; mediaId?: string; src?: string }[];
  }[];
};

/* Every `media` id a document mentions, with where it sits, so the URLs can be
   written back in one pass. Mirrors `mediaIdsIn` in `lib/editor/media.tsx`,
   which cannot be imported here: it is a client module. */
function mediaRefs(document: unknown): Map<string, MediaRef[]> {
  const found = new Map<string, MediaRef[]>();
  const add = (id: string | undefined, at: MediaRef) => {
    if (!id) return;
    const list = found.get(id);
    if (list) list.push(at);
    else found.set(id, [at]);
  };

  const slides = (document as DocumentLike)?.slides ?? [];
  slides.forEach((slide, s) => {
    if (slide?.background?.type === "image") add(slide.background.mediaId, { kind: "background", slide: s });
    (slide?.blocks ?? []).forEach((block, b) => {
      if (block?.type === "image" || block?.type === "video") add(block.mediaId, { kind: "block", slide: s, block: b });
    });
  });
  return found;
}

/*
  The document as the render page wants it: media ids replaced by the URLs they
  resolve to right now.

  The page could resolve them itself — the studio does, through `media.resolve`
  — but that read is authorised by Clerk membership and the worker has no
  session. Rewriting here is also what makes the render deterministic: the
  artboard paints from `src` alone, with no subscription that could answer late
  and repaint half way through a frame.
*/
async function withResolvedMedia(ctx: QueryCtx, project: Doc<"projects">) {
  const refs = mediaRefs(project.document);
  const urls = new Map<string, string>();

  for (const id of refs.keys()) {
    const mediaId = ctx.db.normalizeId("media", id);
    const row = mediaId ? await ctx.db.get(mediaId) : null;
    /* Stock is shared (no `orgId`); anything owned is owned by this project's
       org or it is not ours to hand out. */
    if (!row || (row.orgId && row.orgId !== project.orgId)) continue;
    const url = await ctx.storage.getUrl(row.storageId);
    if (url) urls.set(id, url);
  }

  const document = JSON.parse(JSON.stringify(project.document)) as DocumentLike;
  for (const [id, places] of refs) {
    const url = urls.get(id) ?? "";
    for (const place of places) {
      const slide = document.slides?.[place.slide];
      if (!slide) continue;
      /* The id goes with the URL. Left in place it would be looked up again in
         the page, by a resolver that has no session, and the answer — "no such
         media" — would paint over a photo that is already on screen. */
      const target = place.kind === "background" ? slide.background : slide.blocks?.[place.block];
      if (!target) continue;
      target.src = url;
      delete target.mediaId;
    }
  }
  return document;
}

/*
  One project, for the render route. The token is the authorisation: it names a
  project and expires, so a leaked one is worth one document for a few minutes.

  Answers with a reason rather than null — the page shows it and the worker
  copies it onto the job, which is how "the project was deleted while it was
  queued" reaches whoever asked for the render.
*/
export const document = query({
  args: { projectId: v.string(), token: v.string() },
  handler: async (ctx, { projectId, token }) => {
    const subject = await tokenSubject(token, Date.now());
    if (!subject || subject !== projectId) fail("forbidden", "The render token does not cover this project, or it has expired");

    const id = ctx.db.normalizeId("projects", projectId);
    const project = id ? await ctx.db.get(id) : null;
    if (!project) fail("missing", "No such project");

    return {
      id: project._id,
      name: project.name,
      kind: project.kind,
      width: project.width,
      height: project.height,
      document: await withResolvedMedia(ctx, project),
    };
  },
});

/* ──────────────────────────────────────────────────────────────── queue ─── */

function jobView(job: Doc<"renderJobs">, urls: (string | null)[]) {
  return {
    id: job._id,
    projectId: job.projectId,
    format: job.format as RenderFormat,
    status: job.status,
    scene: job.scene,
    error: job.error,
    createdAt: job._creationTime,
    finishedAt: job.finishedAt,
    outputs: job.outputStorageIds.map((storageId, i) => ({
      storageId,
      name: job.outputNames?.[i] ?? `${i + 1}`,
      url: urls[i],
    })),
  };
}

async function viewWithUrls(ctx: QueryCtx, job: Doc<"renderJobs">) {
  const urls = await Promise.all(job.outputStorageIds.map((id) => ctx.storage.getUrl(id)));
  return jobView(job, urls);
}

/*
  Ask for a render. The project has to be one the caller's org owns and the
  format has to make sense for it — a still project has no MP4 in it, and
  finding that out five minutes later from a failed job helps nobody.
*/
export const enqueue = mutation({
  args: {
    orgId: v.string(),
    projectId: v.string(),
    format,
    scene: v.optional(v.number()),
    scale: v.optional(v.number()),
    fps: v.optional(v.number()),
  },
  handler: async (ctx, { orgId, projectId, format: wanted, scene, scale, fps }) => {
    const { org, user } = await requireOrg(ctx, orgId);

    const id = ctx.db.normalizeId("projects", projectId);
    const project = id ? await ctx.db.get(id) : null;
    if (!project || project.orgId !== org._id) fail("missing", "No such project in this organisation");

    if (wanted === "mp4" && project.kind !== "video") fail("invalid", `A ${project.kind} project cannot be rendered as MP4`);
    if (wanted === "carousel-zip" && project.kind !== "carousel") fail("invalid", `A ${project.kind} project cannot be rendered as a carousel zip`);

    const slides = ((project.document as DocumentLike)?.slides ?? []).length;
    if (scene !== undefined && (!Number.isInteger(scene) || scene < 0 || scene >= slides)) {
      fail("invalid", `This project has no scene ${scene}`);
    }

    return await ctx.db.insert("renderJobs", {
      orgId: org._id,
      projectId: project._id,
      format: wanted,
      status: "queued",
      scene,
      scale,
      fps,
      outputStorageIds: [],
      attempts: 0,
      requestedBy: user._id,
    });
  },
});

/* One job, for whoever is waiting on it. Outputs come with URLs because there
   is nothing a caller can do with a storage id on its own. */
export const job = query({
  args: { orgId: v.string(), jobId: v.string() },
  handler: async (ctx, { orgId, jobId }) => {
    const context = await tryOrg(ctx, orgId);
    if (!context) return null;
    const id = ctx.db.normalizeId("renderJobs", jobId);
    const row = id ? await ctx.db.get(id) : null;
    if (!row || row.orgId !== context.org._id) return null;
    return await viewWithUrls(ctx, row);
  },
});

/* Every render asked for on one project, newest first. */
export const jobsForProject = query({
  args: { orgId: v.string(), projectId: v.string() },
  handler: async (ctx, { orgId, projectId }) => {
    const context = await tryOrg(ctx, orgId);
    if (!context) return [];
    const id = ctx.db.normalizeId("projects", projectId);
    if (!id) return [];
    const rows = await ctx.db
      .query("renderJobs")
      .withIndex("by_project", (q) => q.eq("projectId", id))
      .order("desc")
      .collect();
    return await Promise.all(rows.filter((row) => row.orgId === context.org._id).map((row) => viewWithUrls(ctx, row)));
  },
});

/* ─────────────────────────────────────────────────────────────── worker ─── */

/*
  Jobs whose claim has expired. A worker that died mid-render leaves a row in
  `running` that nothing will ever finish, so it is put back — once. This runs
  both on a schedule and at the top of every claim, because the schedule is the
  only thing that moves when no worker is polling, and the claim is what makes
  a queue recover the moment one comes back.
*/
async function sweepTimedOut(ctx: MutationCtx, now: number) {
  const running = await ctx.db
    .query("renderJobs")
    .withIndex("by_status", (q) => q.eq("status", "running"))
    .collect();

  for (const row of running) {
    if (now - (row.claimedAt ?? row._creationTime) < JOB_TIMEOUT_MS) continue;
    const attempts = row.attempts ?? 1;
    if (attempts < MAX_ATTEMPTS) {
      await ctx.db.patch(row._id, { status: "queued", claimedAt: undefined });
    } else {
      await ctx.db.patch(row._id, {
        status: "failed",
        error: `Render timed out after ${JOB_TIMEOUT_MS / 1000}s`,
        finishedAt: now,
      });
    }
  }
}

export const sweep = internalMutation({
  args: {},
  handler: async (ctx) => {
    await sweepTimedOut(ctx, Date.now());
  },
});

/*
  The worker's turn of the loop: take the oldest queued job, if there is one,
  and hand back everything needed to render it — including a token for the
  route, minted here so it is as young as the job is old.
*/
export const claim = mutation({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    requireWorker(secret);
    const now = Date.now();
    await sweepTimedOut(ctx, now);

    const next = await ctx.db
      .query("renderJobs")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .order("asc")
      .first();
    if (!next) return null;

    await ctx.db.patch(next._id, {
      status: "running",
      claimedAt: now,
      attempts: (next.attempts ?? 0) + 1,
      error: undefined,
    });

    return {
      jobId: next._id,
      projectId: next.projectId,
      format: next.format as RenderFormat,
      scene: next.scene,
      scale: next.scale,
      fps: next.fps,
      token: await issueToken(next.projectId, now),
      timeoutMs: JOB_TIMEOUT_MS,
    };
  },
});

/* Where the worker PUTs a finished file. Gated on the worker secret for the
   same reason `media.generateUploadUrl` is gated on membership: it is the only
   door to storage, and bytes nothing will ever point at are litter. */
export const uploadUrl = mutation({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    requireWorker(secret);
    return await ctx.storage.generateUploadUrl();
  },
});

async function claimed(ctx: MutationCtx, jobId: Id<"renderJobs">) {
  const row = await ctx.db.get(jobId);
  if (!row) fail("missing", "No such render job");
  /* A worker finishing a job the sweep already took away would overwrite the
     outcome of the attempt that replaced it. */
  if (row.status !== "running") fail("invalid", `Render job is ${row.status}, not running`);
  return row;
}

export const complete = mutation({
  args: {
    secret: v.string(),
    jobId: v.id("renderJobs"),
    outputs: v.array(v.object({ storageId: v.id("_storage"), name: v.string() })),
  },
  handler: async (ctx, { secret, jobId, outputs }) => {
    requireWorker(secret);
    const row = await claimed(ctx, jobId);
    if (!outputs.length) fail("invalid", "A finished render has at least one file");
    await ctx.db.patch(row._id, {
      status: "done",
      outputStorageIds: outputs.map((o) => o.storageId),
      outputNames: outputs.map((o) => o.name),
      error: undefined,
      finishedAt: Date.now(),
    });
  },
});

/*
  The worker could not produce the files. `retry` is its judgement of whether
  another attempt might do better: a browser that crashed, yes; a project that
  no longer exists, no.
*/
export const failJob = mutation({
  args: { secret: v.string(), jobId: v.id("renderJobs"), error: v.string(), retry: v.optional(v.boolean()) },
  handler: async (ctx, { secret, jobId, error, retry }) => {
    requireWorker(secret);
    const row = await claimed(ctx, jobId);
    const again = retry === true && (row.attempts ?? 1) < MAX_ATTEMPTS;
    await ctx.db.patch(row._id, {
      status: again ? "queued" : "failed",
      claimedAt: undefined,
      error: error.slice(0, 2000),
      finishedAt: again ? undefined : Date.now(),
    });
    return { requeued: again };
  },
});
