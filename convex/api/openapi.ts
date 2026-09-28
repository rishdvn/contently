import { CONTENT_ROLES } from "../../lib/editor/types";

/*
  The API described for machines, served at `GET /v1/openapi.json` (no key
  needed). `docs/api.md` is the same thing for people, with examples; when an
  endpoint changes, both change.
*/

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const ok = (description: string, schema: object) => ({ description, content: { "application/json": { schema } } });
const errors = (...codes: number[]) =>
  Object.fromEntries(codes.map((c) => [String(c), { description: { 400: "Malformed request", 401: "Missing, invalid or revoked API key", 404: "Not found in this organisation", 413: "File too large for its kind (images 20 MB, videos 40 MB)", 415: "Not an accepted type or codec (PNG, JPEG, GIF, WebP; H.264 MP4/MOV)", 429: "Rate limited (60 requests a minute per key), or over the organisation's render quota; see Retry-After" }[c], content: { "application/json": { schema: ref("Error") } } }]));
const idParam = (name: string, description: string) => ({ name, in: "path", required: true, schema: { type: "string" }, description });
const query = (name: string, schema: object, description: string) => ({ name, in: "query", required: false, schema, description });
const jsonBody = (schema: object) => ({ required: true, content: { "application/json": { schema } } });

export function openapi(server: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Contently API",
      version: "1.0.0",
      description:
        "Take a template, read its content slots, replace them with a brand's words and pictures, and render. Every request is scoped to the organisation that owns the API key. Guide with examples: docs/api.md.",
    },
    servers: [{ url: server }],
    security: [{ apiKey: [] }],
    paths: {
      "/v1/templates": {
        get: {
          summary: "List templates",
          description: "Published templates, plus this organisation's own unpublished ones, newest first.",
          parameters: [query("kind", { enum: ["image", "carousel", "video"] }, "One kind"), query("category", { type: "string" }, "One category chip"), query("q", { type: "string" }, "Words to match in the name, categories and tags")],
          responses: { 200: ok("Templates", { type: "object", properties: { data: { type: "array", items: ref("TemplateSummary") } } }), ...errors(400, 401, 429) },
        },
      },
      "/v1/templates/{id}": {
        get: {
          summary: "Read a template's content slots",
          description: "Scenes → blocks, with each block's role, current text and room, media slot, or catalog block schema and fields. Read this before writing.",
          parameters: [idParam("id", "Template id")],
          responses: { 200: ok("The template", ref("Template")), ...errors(401, 404, 429) },
        },
      },
      "/v1/projects": {
        post: {
          summary: "Make a project from a template",
          description: "Block ids are kept from the template, so ids read from GET /v1/templates/{id} address the same blocks.",
          requestBody: jsonBody({
            type: "object",
            required: ["templateId"],
            properties: { templateId: { type: "string" }, name: { type: "string" }, scenes: { type: "array", items: { type: "integer", minimum: 0 }, description: "Scene indexes to keep, in order. All when absent." } },
          }),
          responses: { 201: ok("The new project", ref("Project")), ...errors(400, 401, 404, 429) },
        },
        get: {
          summary: "List projects",
          parameters: [query("limit", { type: "integer", minimum: 1, maximum: 100, default: 20 }, "Page size"), query("cursor", { type: "string" }, "nextCursor from the previous page")],
          responses: { 200: ok("A page of projects, newest edit first", { type: "object", properties: { data: { type: "array", items: ref("ProjectSummary") }, nextCursor: { type: ["string", "null"] } } }), ...errors(400, 401, 429) },
        },
      },
      "/v1/projects/{id}": {
        get: { summary: "Read a project's content", parameters: [idParam("id", "Project id")], responses: { 200: ok("The project", ref("Project")), ...errors(401, 404, 429) } },
      },
      "/v1/projects/{id}/content": {
        patch: {
          summary: "Replace content",
          description:
            "A batch of replacements, applied all together or not at all. Each names where (blockId, or role — optionally with sceneIndex and index) and what (text, mediaId, mediaUrl or props). Roles reach inside catalog blocks: the Product card's image is image:product. A target that does not exist is reported in `unmatched`, not an error.",
          parameters: [idParam("id", "Project id")],
          requestBody: jsonBody({ type: "object", required: ["replacements"], properties: { replacements: { type: "array", minItems: 1, maxItems: 100, items: ref("Replacement") } } }),
          responses: {
            200: ok("What changed", {
              type: "object",
              properties: {
                changed: { type: "array", items: { type: "object" } },
                unmatched: { type: "array", items: { type: "object", properties: { replacement: { type: "integer" }, reason: { type: "string" } } } },
                skipped: { type: "array", items: { type: "object" }, description: "Role matches that could not take this kind of value; the rest were replaced" },
                warnings: { type: "array", items: { type: "object" }, description: "Applied, but text is longer than the slot's room" },
                project: ref("Project"),
              },
            }),
            ...errors(400, 401, 404, 429),
          },
        },
      },
      "/v1/media": {
        get: {
          summary: "List media",
          parameters: [query("kind", { enum: ["image", "video"] }, "One kind"), query("q", { type: "string" }, "Words to match"), query("source", { enum: ["org", "stock", "all"], default: "org" }, "The organisation's uploads, the shared stock library, or both (own first)"), query("limit", { type: "integer", minimum: 1, maximum: 100, default: 50 }, "At most this many")],
          responses: { 200: ok("Media", { type: "object", properties: { data: { type: "array", items: ref("Media") } } }), ...errors(400, 401, 429) },
        },
        post: {
          summary: "Add media from a URL or an upload",
          requestBody: jsonBody({
            type: "object",
            properties: { url: { type: "string", format: "uri", description: "Fetched server-side: images up to 20 MB, H.264 videos up to 40 MB" }, storageId: { type: "string", description: "From POST /v1/media/upload-url" }, name: { type: "string" }, tags: { type: "array", items: { type: "string" } } },
            description: "Exactly one of url or storageId.",
          }),
          responses: { 201: ok("The media", ref("Media")), ...errors(400, 401, 413, 415, 429) },
        },
      },
      "/v1/media/upload-url": {
        post: { summary: "Get a one-hour upload URL", description: "POST the bytes there with their Content-Type; the answer is { storageId }. Then POST /v1/media { storageId }.", responses: { 200: ok("Where to upload", { type: "object", properties: { uploadUrl: { type: "string" } } }), ...errors(401, 429) } },
      },
      "/v1/projects/{id}/render": {
        post: {
          summary: "Render a project",
          parameters: [idParam("id", "Project id")],
          requestBody: jsonBody({
            type: "object",
            required: ["format"],
            properties: { format: { enum: ["png", "carousel-zip", "mp4"], description: "png: one PNG per scene (or `scene`); carousel-zip: carousels; mp4: videos" }, scene: { type: "integer", minimum: 0 }, scale: { enum: [1, 2] }, fps: { enum: [24, 25, 30, 60] } },
          }),
          description: "Each organisation may ask for 100 renders a UTC day and have 3 of its jobs queued or running at once; past either, 429 quota_exceeded with Retry-After.",
          responses: { 202: ok("The queued job", ref("RenderJob")), ...errors(400, 401, 404, 429) },
        },
      },
      "/v1/render-jobs/{id}": {
        get: { summary: "A render job's status and files", parameters: [idParam("id", "Render job id")], responses: { 200: ok("The job", ref("RenderJob")), ...errors(401, 404, 429) } },
      },
    },
    components: {
      securitySchemes: { apiKey: { type: "http", scheme: "bearer", bearerFormat: "ctly_…", description: "An organisation's API key (Contently → API keys)" } },
      schemas: {
        Error: { type: "object", properties: { error: { type: "object", required: ["code", "message"], properties: { code: { enum: ["invalid_request", "unauthorized", "not_found", "payload_too_large", "unsupported_media", "rate_limited", "quota_exceeded", "unavailable", "internal"] }, message: { type: "string" }, details: { type: "array", items: { type: "object", properties: { at: { type: "string" }, message: { type: "string" } } } } } } } },
        Role: { enum: [...CONTENT_ROLES] },
        TemplateSummary: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            kind: { enum: ["image", "carousel", "video"] },
            aspect: { type: "string" },
            width: { type: "number" },
            height: { type: "number" },
            sceneCount: { type: "integer" },
            duration: { type: ["number", "null"], description: "Seconds; null for stills" },
            poster: { type: ["string", "null"] },
            scenePosters: { type: "array", items: { type: ["string", "null"] } },
            roles: { type: "object", additionalProperties: { type: "integer" }, description: "How many of each role, catalog block fields included" },
            categories: { type: "array", items: { type: "string" } },
            tags: { type: "array", items: { type: "string" } },
          },
        },
        Template: { allOf: [ref("TemplateSummary"), { type: "object", properties: { scenes: { type: "array", items: ref("Scene") } } }] },
        ProjectSummary: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, kind: { type: "string" }, aspect: { type: "string" }, width: { type: "number" }, height: { type: "number" }, sceneCount: { type: "integer" }, duration: { type: ["number", "null"] }, updatedAt: { type: "number" }, poster: { type: ["string", "null"] } } },
        Project: { allOf: [ref("ProjectSummary"), { type: "object", properties: { scenes: { type: "array", items: ref("Scene") } } }] },
        Scene: { type: "object", properties: { index: { type: "integer" }, id: { type: "string" }, name: { type: "string" }, duration: { type: "number" }, poster: { type: ["string", "null"] }, blocks: { type: "array", items: ref("Block") } } },
        Block: {
          type: "object",
          required: ["id", "type"],
          properties: {
            id: { type: "string" },
            type: { enum: ["text", "image", "video", "component"] },
            role: ref("Role"),
            name: { type: "string" },
            box: { type: "object", properties: { x: { type: "number" }, y: { type: "number" }, w: { type: "number" }, h: { type: "number" } } },
            text: { type: "string", description: "Text blocks: the current wording" },
            textConstraints: { type: "object", properties: { maxChars: { type: "integer", description: "Current length + 30%" }, lines: { type: "integer", description: "Lines of this size the box holds" } } },
            mediaSlot: { type: "object", properties: { kind: { enum: ["image", "video"] }, aspect: { type: "number", description: "Width / height of the slot" }, src: { type: ["string", "null"] } } },
            component: {
              type: "object",
              description: "Catalog blocks",
              properties: {
                id: { type: "string", description: "Catalog block id, e.g. product-card" },
                name: { type: "string" },
                schema: { type: "object", description: "The block's inputs (docs/blocks.md)" },
                props: { type: "object" },
                fields: { type: "array", items: { type: "object", properties: { path: { type: "string", description: "e.g. messages[2].text" }, role: ref("Role"), kind: { type: "string" }, current: { type: "string" }, constraints: { type: "object" } } } },
              },
            },
          },
        },
        Replacement: {
          type: "object",
          description: "Where: exactly one of blockId or role. What: exactly one of text, mediaId, mediaUrl or props.",
          properties: {
            blockId: { type: "string" },
            role: ref("Role"),
            sceneIndex: { type: "integer", minimum: 0, description: "Only this scene" },
            index: { type: "integer", minimum: 0, description: "With role: only the nth match (document order). All matches when absent." },
            field: { type: "string", description: "With blockId: one field of a catalog block, e.g. price or messages[2].text" },
            text: { type: "string" },
            mediaId: { type: "string" },
            mediaUrl: { type: "string", format: "uri", description: "Fetched server-side into the organisation's media" },
            props: { type: "object", description: "Catalog blocks: inputs to merge, validated against the block's schema" },
          },
        },
        Media: { type: "object", properties: { id: { type: "string" }, kind: { enum: ["image", "video"] }, source: { enum: ["org", "stock"] }, name: { type: "string" }, width: { type: "number" }, height: { type: "number" }, duration: { type: "number" }, url: { type: ["string", "null"] }, posterUrl: { type: ["string", "null"] }, tags: { type: "array", items: { type: "string" } } } },
        RenderJob: {
          type: "object",
          properties: {
            id: { type: "string" },
            projectId: { type: "string" },
            format: { enum: ["png", "carousel-zip", "mp4"] },
            status: { enum: ["queued", "running", "done", "failed"] },
            queuePosition: { type: "integer", description: "While queued: jobs ahead of this one" },
            error: { type: "string" },
            outputs: { type: "array", items: { type: "object", properties: { name: { type: "string" }, url: { type: ["string", "null"] } } } },
          },
        },
      },
    },
  };
}
