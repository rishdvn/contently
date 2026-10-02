/*
  A small client for Contently's public REST API (`docs/api.md` in the app's
  repository). The MCP tools are thin wrappers over these calls; everything the
  API decides — validation, roles, rendering — stays on the server.
*/

export const DEFAULT_BASE_URL = "https://chatty-giraffe-3.convex.site";

export type Problem = { at: string; message: string };

/* What the API answered when it said no: `{ error: { code, message, details } }`. */
export class ContentlyError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: Problem[] = [],
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "ContentlyError";
  }
}

/* The API could not be reached at all: DNS, TLS, a timeout. */
export class NetworkError extends Error {
  constructor(
    readonly baseUrl: string,
    cause: unknown,
  ) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = "NetworkError";
  }
}

export type ClientOptions = { apiKey: string; baseUrl?: string; fetch?: typeof fetch };

export type TemplateKind = "image" | "carousel" | "video";
export type RenderFormat = "png" | "carousel-zip" | "mp4";

export type Replacement = {
  blockId?: string;
  role?: string;
  sceneIndex?: number;
  index?: number;
  field?: string;
  text?: string;
  mediaId?: string;
  mediaUrl?: string;
  props?: Record<string, unknown>;
};

export type RenderJob = {
  id: string;
  projectId: string;
  format: RenderFormat;
  status: "queued" | "running" | "done" | "failed";
  queuePosition?: number;
  error?: string;
  outputs: { name: string; url: string | null }[];
};

type Json = Record<string, unknown>;

export class ContentlyClient {
  readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetch: typeof fetch;

  constructor({ apiKey, baseUrl = DEFAULT_BASE_URL, fetch: fetchImpl = globalThis.fetch }: ClientOptions) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.fetch = fetchImpl;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await this.fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.apiKey}`, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (error) {
      throw new NetworkError(this.baseUrl, error);
    }
    const text = await response.text();
    let json: unknown = undefined;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      /* Not JSON: reported below with the status. */
    }
    if (!response.ok) {
      const error = (json as { error?: { code?: string; message?: string; details?: Problem[] } } | undefined)?.error;
      const retry = Number(response.headers.get("retry-after"));
      throw new ContentlyError(response.status, error?.code ?? `http_${response.status}`, error?.message ?? (text.slice(0, 300) || response.statusText), error?.details ?? [], Number.isFinite(retry) && retry > 0 ? retry : undefined);
    }
    return json as T;
  }

  private query(params: Record<string, string | number | undefined>) {
    const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== "") as [string, string | number][];
    return entries.length ? `?${new URLSearchParams(entries.map(([k, v]): [string, string] => [k, String(v)]))}` : "";
  }

  listTemplates(filters: { kind?: TemplateKind; category?: string; q?: string } = {}) {
    return this.request<{ data: Json[] }>("GET", `/v1/templates${this.query(filters)}`);
  }

  getTemplate(id: string) {
    return this.request<Json & { poster: string | null; scenePosters: (string | null)[]; scenes: Json[] }>("GET", `/v1/templates/${encodeURIComponent(id)}`);
  }

  createProject(body: { templateId: string; name?: string; scenes?: number[] }) {
    return this.request<Json & { id: string }>("POST", "/v1/projects", body);
  }

  getProject(id: string) {
    return this.request<Json>("GET", `/v1/projects/${encodeURIComponent(id)}`);
  }

  listProjects(params: { limit?: number; cursor?: string } = {}) {
    return this.request<{ data: Json[]; nextCursor: string | null }>("GET", `/v1/projects${this.query(params)}`);
  }

  replaceContent(projectId: string, replacements: Replacement[]) {
    return this.request<Json & { changed: Json[]; unmatched: Json[]; skipped: Json[]; warnings: Json[]; project: Json }>("PATCH", `/v1/projects/${encodeURIComponent(projectId)}/content`, { replacements });
  }

  listMedia(params: { kind?: "image" | "video"; q?: string; source?: "org" | "stock" | "all"; limit?: number } = {}) {
    return this.request<{ data: Json[] }>("GET", `/v1/media${this.query(params)}`);
  }

  importMedia(body: { url: string; name?: string; tags?: string[] }) {
    return this.request<Json & { id: string }>("POST", "/v1/media", body);
  }

  /* Bytes the caller holds: a one-hour upload URL, the bytes, then the row. */
  async uploadMedia(bytes: Uint8Array, contentType: string, body: { name?: string; tags?: string[] }) {
    const { uploadUrl } = await this.request<{ uploadUrl: string }>("POST", "/v1/media/upload-url");
    let uploaded: Response;
    try {
      uploaded = await this.fetch(uploadUrl, { method: "POST", headers: { "Content-Type": contentType }, body: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: contentType }) });
    } catch (error) {
      throw new NetworkError(new URL(uploadUrl).origin, error);
    }
    if (!uploaded.ok) throw new ContentlyError(uploaded.status, "upload_failed", `Uploading the file failed: ${(await uploaded.text()).slice(0, 200) || uploaded.statusText}`);
    const { storageId } = (await uploaded.json()) as { storageId: string };
    return this.request<Json & { id: string }>("POST", "/v1/media", { storageId, ...body });
  }

  renderProject(projectId: string, body: { format: RenderFormat; scene?: number; scale?: number; fps?: number }) {
    return this.request<RenderJob>("POST", `/v1/projects/${encodeURIComponent(projectId)}/render`, body);
  }

  getRender(jobId: string) {
    return this.request<RenderJob>("GET", `/v1/render-jobs/${encodeURIComponent(jobId)}`);
  }

  cancelRender(jobId: string) {
    return this.request<RenderJob>("POST", `/v1/render-jobs/${encodeURIComponent(jobId)}/cancel`);
  }

  /* A file the API pointed at (a poster, a render): public URLs, no key. */
  async download(url: string): Promise<{ bytes: Uint8Array; mimeType: string }> {
    let response: Response;
    try {
      response = await this.fetch(url);
    } catch (error) {
      throw new NetworkError(new URL(url).origin, error);
    }
    if (!response.ok) throw new ContentlyError(response.status, "download_failed", `Downloading ${url} answered ${response.status}`);
    return { bytes: new Uint8Array(await response.arrayBuffer()), mimeType: response.headers.get("content-type")?.split(";")[0] ?? "application/octet-stream" };
  }
}
