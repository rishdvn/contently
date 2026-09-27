import type { HttpRouter } from "convex/server";
import { ConvexError, type Value } from "convex/values";

import { mediaUrlsIn, parseReplacements, type Problem } from "../../lib/api/content";
import { sniff } from "../../lib/api/sniff";
import { durationOf, sceneViews, type Doc as ViewDoc } from "../../lib/api/view";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { httpAction, type ActionCtx } from "../_generated/server";
import { hashKey, KEY_PREFIX } from "../apiKeys";

import { apiFail, STATUS, type ApiErrorCode, type ApiErrorData } from "./errors";
import { openapi } from "./openapi";

/*
  The public REST API: `https://<deployment>.convex.site/v1/…`, JSON in and
  out, one organisation per API key (`Authorization: Bearer ctly_…`). What each
  endpoint does is `docs/api.md`; the machine-readable version is
  `GET /v1/openapi.json`.

  One HTTP action serves every path under `/v1/`: Convex's router matches
  exact paths or prefixes, not `/templates/:id`, so the table below does the
  matching. Every request is authenticated and counted against its key's rate
  limit (`apiKeys.authenticate`) before its handler runs; the handlers call
  internal functions (`convex/api/*`) that take the key's organisation as an
  argument and trust nothing else from the request.

  Errors are always `{ "error": { "code", "message", "details"? } }` with the
  matching status, whichever layer raised them.
*/

type Auth = { orgId: Id<"organizations">; userId: Id<"users">; limit: number; remaining: number; reset: number };
type Params = Record<string, string>;
type Handler = (ctx: ActionCtx, input: { request: Request; url: URL; params: Params; auth: Auth }) => Promise<Response>;
type Route = { method: string; path: string; handler: Handler };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Expose-Headers": "X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After",
};

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body, null, 2), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...CORS, ...headers } });

const errorResponse = (code: ApiErrorCode, message: string, details?: Problem[], headers?: Record<string, string>) =>
  json(STATUS[code], { error: { code, message, ...(details?.length ? { details } : {}) } }, headers);

/* The internal functions' own denials (`render.ts`, `projects.ts`, …) share a
   `{ kind, code }` shape; their codes map onto HTTP the same way everywhere. */
function fromConvexError(error: ConvexError<Value>): Response | null {
  const data = error.data as { kind?: string; code?: string; message?: string; details?: ApiErrorData["details"] } | null;
  if (!data || typeof data !== "object") return null;
  if (data.kind === "api" && data.code && data.code in STATUS) return errorResponse(data.code as ApiErrorCode, data.message ?? "", data.details);
  const code: ApiErrorCode | null = data.code === "missing" || data.code === "forbidden" ? "not_found" : data.code === "invalid" ? "invalid_request" : data.code === "unconfigured" ? "unavailable" : null;
  return code ? errorResponse(code, data.message ?? "") : null;
}

/* ── Input helpers ─────────────────────────────────────────────────── */

async function body(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (!text.trim()) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    apiFail("invalid_request", "The body must be JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) apiFail("invalid_request", "The body must be a JSON object");
  return parsed as Record<string, unknown>;
}

function oneOf<T extends string>(url: URL, name: string, allowed: readonly T[]): T | undefined {
  const value = url.searchParams.get(name);
  if (value === null || value === "") return undefined;
  if (!(allowed as readonly string[]).includes(value)) apiFail("invalid_request", `${name}: expected one of ${allowed.join(", ")}`);
  return value as T;
}

function intParam(url: URL, name: string, { min, max, fallback }: { min: number; max: number; fallback: number }) {
  const value = url.searchParams.get(name);
  if (value === null || value === "") return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) apiFail("invalid_request", `${name}: expected a whole number from ${min} to ${max}`);
  return n;
}

const optionalString = (value: unknown, name: string, max = 200) => {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > max) apiFail("invalid_request", `${name}: expected text of at most ${max} characters`);
  return value;
};

const optionalTags = (value: unknown) => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 20 || !value.every((t) => typeof t === "string" && t.length <= 40)) apiFail("invalid_request", "tags: expected up to 20 short strings");
  return value as string[];
};

const KINDS = ["image", "carousel", "video"] as const;
const FORMATS = ["png", "carousel-zip", "mp4"] as const;

/* ── Media import ──────────────────────────────────────────────────── */

/* A Convex action holds the whole file in memory; larger files go through
   `POST /v1/media/upload-url`, which streams straight to storage. */
const MAX_IMPORT_BYTES = 40 * 1024 * 1024;

/* Refuse the obvious ways to point a server-side fetch back inside a network. */
function publicUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) return null;
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || host.startsWith("[")) return null;
  return url;
}

const nameFrom = (url: URL, kind: string) => {
  const last = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() ?? "").trim();
  return (last || `Imported ${kind}`).slice(0, 120);
};

async function register(ctx: ActionCtx, auth: Auth, storageId: Id<"_storage">, bytes: Uint8Array, fields: { name?: string; tags?: string[]; fallbackName: (kind: string) => string }) {
  const found = sniff(bytes);
  if (!found) {
    await ctx.storage.delete(storageId);
    apiFail("invalid_request", "Not an image or video we can read (PNG, JPEG, GIF, WebP, MP4 or MOV)");
  }
  const media = await ctx.runMutation(internal.api.media.create, {
    orgId: auth.orgId,
    userId: auth.userId,
    storageId,
    kind: found.kind,
    width: found.width,
    height: found.height,
    ...(found.duration !== undefined ? { duration: found.duration } : {}),
    name: fields.name?.trim() || fields.fallbackName(found.kind),
    tags: fields.tags ?? ["api"],
  });
  if (!media) apiFail("invalid_request", "That file is already in a media library");
  return media;
}

async function importUrl(ctx: ActionCtx, auth: Auth, raw: string, fields: { name?: string; tags?: string[] } = {}) {
  const url = publicUrl(raw);
  if (!url) apiFail("invalid_request", `Cannot fetch ${raw}: only public http(s) URLs`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  let bytes: Uint8Array;
  try {
    const response = await fetch(url, { redirect: "follow", signal: controller.signal, headers: { Accept: "image/*,video/*" } });
    if (!response.ok) apiFail("invalid_request", `Fetching ${raw} answered ${response.status}`);
    if (Number(response.headers.get("content-length") ?? 0) > MAX_IMPORT_BYTES) apiFail("payload_too_large", `${raw} is larger than ${MAX_IMPORT_BYTES / 1024 / 1024} MB; upload it with POST /v1/media/upload-url instead`);
    bytes = new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    if (error instanceof ConvexError) throw error;
    apiFail("invalid_request", `Could not fetch ${raw}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(timer);
  }
  if (bytes.byteLength > MAX_IMPORT_BYTES) apiFail("payload_too_large", `${raw} is larger than ${MAX_IMPORT_BYTES / 1024 / 1024} MB; upload it with POST /v1/media/upload-url instead`);
  const found = sniff(bytes);
  const storageId = await ctx.storage.store(new Blob([bytes as BlobPart], { type: found?.mime ?? "application/octet-stream" }));
  return await register(ctx, auth, storageId, bytes, { ...fields, fallbackName: (kind) => nameFrom(url, kind) });
}

/* ── Views ─────────────────────────────────────────────────────────── */

type TemplateRow = NonNullable<Awaited<ReturnType<typeof getTemplate>>>;
const getTemplate = (ctx: ActionCtx, orgId: Id<"organizations">, id: string) => ctx.runQuery(internal.api.templates.get, { orgId, id });

function templateView(t: TemplateRow) {
  const { document, ...summary } = t;
  return { ...summary, scenes: sceneViews({ ...(document as ViewDoc), kind: t.kind as ViewDoc["kind"] }, t.scenePosters) };
}

async function projectView(ctx: ActionCtx, orgId: Id<"organizations">, id: string) {
  const project = await ctx.runQuery(internal.api.projects.get, { orgId, id });
  if (!project) apiFail("not_found", `No project ${id}`);
  const { document, ...summary } = project;
  const doc = { ...(document as ViewDoc), kind: project.kind as ViewDoc["kind"] };
  return { ...summary, duration: durationOf(doc), scenes: sceneViews(doc) };
}

/* ── Routes ────────────────────────────────────────────────────────── */

const routes: Route[] = [
  {
    method: "GET",
    path: "/v1/templates",
    handler: async (ctx, { url, auth }) => {
      const data = await ctx.runQuery(internal.api.templates.list, {
        orgId: auth.orgId,
        kind: oneOf(url, "kind", KINDS),
        category: url.searchParams.get("category") || undefined,
        q: url.searchParams.get("q") || undefined,
      });
      return json(200, { data });
    },
  },
  {
    method: "GET",
    path: "/v1/templates/:id",
    handler: async (ctx, { params, auth }) => {
      const t = await getTemplate(ctx, auth.orgId, params.id!);
      if (!t) apiFail("not_found", `No template ${params.id}`);
      return json(200, templateView(t));
    },
  },
  {
    method: "POST",
    path: "/v1/projects",
    handler: async (ctx, { request, auth }) => {
      const b = await body(request);
      if (typeof b.templateId !== "string" || !b.templateId) apiFail("invalid_request", "templateId: required (GET /v1/templates)");
      const name = optionalString(b.name, "name", 120);
      if (b.scenes !== undefined && !(Array.isArray(b.scenes) && b.scenes.every((i) => Number.isInteger(i)))) apiFail("invalid_request", "scenes: expected scene indexes, e.g. [0, 2]");
      const id = await ctx.runMutation(internal.api.projects.createFromTemplate, {
        orgId: auth.orgId,
        userId: auth.userId,
        templateId: b.templateId,
        ...(name !== undefined ? { name } : {}),
        ...(b.scenes !== undefined ? { scenes: b.scenes as number[] } : {}),
      });
      return json(201, await projectView(ctx, auth.orgId, id));
    },
  },
  {
    method: "GET",
    path: "/v1/projects",
    handler: async (ctx, { url, auth }) => {
      const page = await ctx.runQuery(internal.api.projects.list, { orgId: auth.orgId, limit: intParam(url, "limit", { min: 1, max: 100, fallback: 20 }), cursor: url.searchParams.get("cursor") || null });
      return json(200, page);
    },
  },
  {
    method: "GET",
    path: "/v1/projects/:id",
    handler: async (ctx, { params, auth }) => json(200, await projectView(ctx, auth.orgId, params.id!)),
  },
  {
    method: "PATCH",
    path: "/v1/projects/:id/content",
    handler: async (ctx, { request, params, auth }) => {
      const { replacements, problems } = parseReplacements(await body(request));
      if (problems.length) apiFail("invalid_request", "The replacements are malformed; nothing was changed", problems);

      /* Everything that can be checked without the network, first: a batch
         that was going to fail imports nothing. */
      const plan = await ctx.runQuery(internal.api.projects.planContent, { orgId: auth.orgId, id: params.id!, replacements });
      if (!plan) apiFail("not_found", `No project ${params.id}`);
      if (plan.problems.length) apiFail("invalid_request", "Some replacements cannot be applied; nothing was changed", plan.problems);

      const imported: { url: string; mediaId: string }[] = [];
      for (const url of mediaUrlsIn(replacements)) {
        try {
          imported.push({ url, mediaId: (await importUrl(ctx, auth, url)).id });
        } catch (error) {
          const message = error instanceof ConvexError ? ((error.data as ApiErrorData).message ?? String(error)) : String(error);
          apiFail("invalid_request", "A mediaUrl could not be imported; nothing was changed", [{ at: `replacements[${replacements.findIndex((r) => r.mediaUrl === url)}].mediaUrl`, message }]);
        }
      }

      const outcome = await ctx.runMutation(internal.api.projects.applyContent, { orgId: auth.orgId, id: params.id!, replacements, imported });
      return json(200, { ...outcome, project: await projectView(ctx, auth.orgId, params.id!) });
    },
  },
  {
    method: "GET",
    path: "/v1/media",
    handler: async (ctx, { url, auth }) => {
      const data = await ctx.runQuery(internal.api.media.list, {
        orgId: auth.orgId,
        kind: oneOf(url, "kind", ["image", "video"] as const),
        q: url.searchParams.get("q") || undefined,
        source: oneOf(url, "source", ["org", "stock", "all"] as const) ?? "org",
        limit: intParam(url, "limit", { min: 1, max: 100, fallback: 50 }),
      });
      return json(200, { data });
    },
  },
  {
    method: "POST",
    path: "/v1/media/upload-url",
    handler: async (ctx) => json(200, { uploadUrl: await ctx.runMutation(internal.api.media.uploadUrl, {}), method: "POST", expiresIn: 3600, next: "POST the file's bytes with its Content-Type; the answer is { storageId }. Then POST /v1/media { storageId, name? }." }),
  },
  {
    method: "POST",
    path: "/v1/media",
    handler: async (ctx, { request, auth }) => {
      const b = await body(request);
      const name = optionalString(b.name, "name", 120);
      const tags = optionalTags(b.tags);
      if ((b.url === undefined) === (b.storageId === undefined)) apiFail("invalid_request", "Give exactly one of url (import from the web) or storageId (from POST /v1/media/upload-url)");
      if (b.url !== undefined) {
        if (typeof b.url !== "string") apiFail("invalid_request", "url: expected an http(s) URL");
        return json(201, await importUrl(ctx, auth, b.url, { name, tags }));
      }
      const info = typeof b.storageId === "string" ? await ctx.runQuery(internal.api.media.storageInfo, { storageId: b.storageId }) : null;
      if (!info) apiFail("invalid_request", "storageId: no such upload");
      if (info.size > MAX_IMPORT_BYTES) apiFail("payload_too_large", `Files over ${MAX_IMPORT_BYTES / 1024 / 1024} MB cannot be registered through the API yet`);
      const blob = await ctx.storage.get(info.id);
      if (!blob) apiFail("invalid_request", "storageId: no such upload");
      const bytes = new Uint8Array(await blob.arrayBuffer());
      return json(201, await register(ctx, auth, info.id, bytes, { name, tags, fallbackName: (kind) => `Uploaded ${kind}` }));
    },
  },
  {
    method: "POST",
    path: "/v1/projects/:id/render",
    handler: async (ctx, { request, params, auth }) => {
      const b = await body(request);
      if (!(FORMATS as readonly unknown[]).includes(b.format)) apiFail("invalid_request", `format: expected one of ${FORMATS.join(", ")}`);
      for (const key of ["scene", "scale", "fps"] as const) if (b[key] !== undefined && typeof b[key] !== "number") apiFail("invalid_request", `${key}: expected a number`);
      if (b.scale !== undefined && ![1, 2].includes(b.scale as number)) apiFail("invalid_request", "scale: 1 or 2");
      if (b.fps !== undefined && ![24, 25, 30, 60].includes(b.fps as number)) apiFail("invalid_request", "fps: 24, 25, 30 or 60");
      const job = await ctx.runMutation(internal.api.render.enqueue, {
        orgId: auth.orgId,
        userId: auth.userId,
        projectId: params.id!,
        format: b.format as (typeof FORMATS)[number],
        ...(b.scene !== undefined ? { scene: b.scene as number } : {}),
        ...(b.scale !== undefined ? { scale: b.scale as number } : {}),
        ...(b.fps !== undefined ? { fps: b.fps as number } : {}),
      });
      return json(202, job);
    },
  },
  {
    method: "GET",
    path: "/v1/render-jobs/:id",
    handler: async (ctx, { params, auth }) => {
      const job = await ctx.runQuery(internal.api.render.job, { orgId: auth.orgId, id: params.id! });
      if (!job) apiFail("not_found", `No render job ${params.id}`);
      return json(200, job);
    },
  },
];

function match(path: string, pattern: string): Params | null {
  const a = path.replace(/\/+$/, "").split("/");
  const b = pattern.split("/");
  if (a.length !== b.length) return null;
  const params: Params = {};
  for (let i = 0; i < b.length; i++) {
    if (b[i]!.startsWith(":")) params[b[i]!.slice(1)] = decodeURIComponent(a[i]!);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

async function authenticate(ctx: ActionCtx, request: Request): Promise<Auth | Response> {
  const header = request.headers.get("authorization") ?? "";
  const key = /^Bearer\s+(\S+)$/i.exec(header)?.[1];
  if (!key || !key.startsWith(KEY_PREFIX)) return errorResponse("unauthorized", "Send an API key: Authorization: Bearer ctly_… (make one in Contently → API keys)");
  const result = await ctx.runMutation(internal.apiKeys.authenticate, { hash: await hashKey(key) });
  if (!result.ok) {
    if (result.code === "rate_limited") {
      const retry = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
      return errorResponse("rate_limited", result.message, undefined, { "Retry-After": String(retry), "X-RateLimit-Limit": String(result.limit), "X-RateLimit-Remaining": "0", "X-RateLimit-Reset": String(Math.ceil(result.reset / 1000)) });
    }
    return errorResponse("unauthorized", result.message);
  }
  return result;
}

const serve = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...CORS, "Access-Control-Max-Age": "86400" } });
  if (request.method === "GET" && url.pathname.replace(/\/+$/, "") === "/v1/openapi.json") return json(200, openapi(process.env.CONVEX_SITE_URL ?? url.origin));

  const candidates = routes.map((route) => ({ route, params: match(url.pathname, route.path) })).filter((c) => c.params);
  if (!candidates.length) return errorResponse("not_found", `No endpoint ${url.pathname}; see /v1/openapi.json`);
  const found = candidates.find((c) => c.route.method === request.method);
  if (!found) return json(405, { error: { code: "method_not_allowed", message: `${request.method} is not allowed on ${url.pathname}; try ${candidates.map((c) => c.route.method).join(", ")}` } }, { Allow: candidates.map((c) => c.route.method).join(", ") });

  const auth = await authenticate(ctx, request);
  if (auth instanceof Response) return auth;
  const rate = { "X-RateLimit-Limit": String(auth.limit), "X-RateLimit-Remaining": String(auth.remaining), "X-RateLimit-Reset": String(Math.ceil(auth.reset / 1000)) };

  try {
    const response = await found.route.handler(ctx, { request, url, params: found.params!, auth });
    for (const [k, v] of Object.entries(rate)) response.headers.set(k, v);
    return response;
  } catch (error) {
    const mapped = error instanceof ConvexError ? fromConvexError(error) : null;
    if (mapped) {
      for (const [k, v] of Object.entries(rate)) mapped.headers.set(k, v);
      return mapped;
    }
    console.error(`API ${request.method} ${url.pathname} failed`, error);
    return errorResponse("internal", "Something went wrong on our side; the request may be retried");
  }
});

/* Every `/v1/…` path, each method the API answers. */
export function registerApi(http: HttpRouter) {
  for (const method of ["GET", "POST", "PATCH", "OPTIONS"] as const) http.route({ pathPrefix: "/v1/", method, handler: serve });
}
