import { readFileSync } from "node:fs";

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ContentBlock } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import type { ContentlyClient, RenderJob, Replacement } from "./client.js";
import { guarded } from "./errors.js";

/*
  The Contently MCP server: tools over the public REST API, the template
  posters as image resources, and the on-brand content skill as a resource
  and a prompt. Transport-agnostic — `index.ts` connects it to stdio or to
  Streamable HTTP.
*/

export const VERSION = "0.1.0";

export const ROLES = [
  "heading",
  "subheading",
  "body",
  "benefit",
  "cta",
  "price",
  "brand",
  "quote",
  "author",
  "hook",
  "logo",
  "image:product",
  "image:lifestyle",
  "image:background",
  "video:background",
] as const;

const SKILL_URI = "contently://skills/on-brand-content";

export function readSkill(): string {
  return readFileSync(new URL("../skills/on-brand-content.md", import.meta.url), "utf8");
}

/* ── Arguments ─────────────────────────────────────────────────────── */

const id = (what: string) => z.string().min(1, `${what} is required`).describe(what);

export const replacementSchema = z
  .object({
    blockId: z.string().min(1).optional().describe("Where: one block, by the id get_template gave it"),
    role: z.enum(ROLES).optional().describe("Where: every block, and every catalog-block field, with this role"),
    sceneIndex: z.number().int().min(0).optional().describe("Only in this scene (0-based)"),
    index: z.number().int().min(0).optional().describe("With role: only the nth match in document order (0-based). Without it, every match gets the same value"),
    field: z.string().min(1).optional().describe('With blockId: one field of a catalog block, e.g. "price" or "messages[2].text"'),
    text: z.string().max(5000).optional().describe("What: new text"),
    mediaId: z.string().min(1).optional().describe("What: a media id from list_media or upload_media"),
    mediaUrl: z.string().url().optional().describe("What: a public image/video URL; Contently imports it"),
    props: z.record(z.unknown()).optional().describe("What: inputs to merge into a catalog block (see its component.schema)"),
  })
  .describe("One replacement: exactly one of blockId/role, and exactly one of text/mediaId/mediaUrl/props");

/* The rules zod cannot say in a JSON schema the model reads: exactly one
   target and exactly one value. Checked before calling the API, so a
   malformed batch costs no request. */
export function replacementProblems(replacements: Replacement[]): string[] {
  const problems: string[] = [];
  replacements.forEach((r, i) => {
    const where = [r.blockId !== undefined, r.role !== undefined].filter(Boolean).length;
    const what = [r.text, r.mediaId, r.mediaUrl, r.props].filter((v) => v !== undefined).length;
    if (where !== 1) problems.push(`replacements[${i}]: give exactly one of blockId or role`);
    if (what !== 1) problems.push(`replacements[${i}]: give exactly one of text, mediaId, mediaUrl or props`);
    if (r.field !== undefined && r.blockId === undefined) problems.push(`replacements[${i}].field: only with blockId (a role already says which field)`);
    if (r.index !== undefined && r.role === undefined) problems.push(`replacements[${i}].index: only with role`);
  });
  return problems;
}

export const inputs = {
  listTemplates: {
    kind: z.enum(["image", "carousel", "video"]).optional().describe("Only this kind"),
    category: z.string().optional().describe("Only this category (see a template's categories)"),
    q: z.string().optional().describe("Words to match in the name, categories and tags"),
  },
  getTemplate: {
    id: id("Template id, from list_templates"),
    include_posters: z.boolean().optional().describe("Also return each scene's poster as an image, to see the hierarchy (default false; the posters are also resources)"),
  },
  createProject: {
    templateId: id("Template id, from list_templates"),
    name: z.string().max(120).optional().describe("Project name (default: the template's)"),
    scenes: z.array(z.number().int().min(0)).min(1).optional().describe("Scene indexes to keep, in order (default: all)"),
  },
  replaceContent: {
    projectId: id("Project id, from create_project_from_template"),
    replacements: z.array(replacementSchema).min(1).max(100).describe("Applied together or not at all"),
  },
  listMedia: {
    kind: z.enum(["image", "video"]).optional(),
    q: z.string().optional().describe("Words to match in names and tags"),
    source: z.enum(["org", "stock", "all"]).optional().describe("The organisation's own media (default), stock, or both (own first)"),
    limit: z.number().int().min(1).max(100).optional(),
  },
  uploadMedia: {
    url: z.string().url().optional().describe("A public image/video URL to import"),
    base64: z.string().min(1).optional().describe("The file itself, base64-encoded"),
    mimeType: z.string().optional().describe("With base64: e.g. image/png, image/jpeg, video/mp4"),
    name: z.string().min(1).max(120).describe("A name for the organisation's library"),
    tags: z.array(z.string().max(40)).max(20).optional(),
  },
  renderProject: {
    projectId: id("Project id"),
    format: z.enum(["png", "carousel-zip", "mp4"]).describe("png: stills (one per scene); carousel-zip: carousels; mp4: videos"),
    scene: z.number().int().min(0).optional().describe("png only: just this scene"),
  },
  cancelRender: {
    jobId: id("Render job id, from render_project"),
  },
  getRender: {
    jobId: id("Render job id, from render_project"),
    waitSeconds: z.number().int().min(0).max(600).optional().describe("Poll until done or this many seconds pass (default 50). 0: answer at once"),
  },
};

/* ── Helpers ───────────────────────────────────────────────────────── */

const json = (value: unknown): ContentBlock => ({ type: "text", text: JSON.stringify(value, null, 2) });
const ok = (...content: ContentBlock[]): CallToolResult => ({ content });

const posterUri = (templateId: string, scene?: number) => `contently://templates/${templateId}${scene === undefined ? "" : `/scenes/${scene}`}/poster`;

const toBase64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

/* A render's outcome in words the model can pass on. */
function renderSummary(job: RenderJob) {
  switch (job.status) {
    case "done":
      return `Done. ${job.outputs.length === 1 ? "File" : "Files"}:\n${job.outputs.map((o) => `- ${o.name}: ${o.url}`).join("\n")}`;
    case "failed":
      return `The render failed: ${job.error ?? "no reason given"}. Check the project with get_template/replace_content and render again.`;
    default:
      return `Still ${job.status}${job.queuePosition !== undefined ? ` (${job.queuePosition} ahead in the queue)` : ""}. Call get_render again with this jobId.`;
  }
}

type Sleep = (ms: number) => Promise<void>;
const realSleep: Sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── The server ────────────────────────────────────────────────────── */

export function createServer(client: ContentlyClient, { sleep = realSleep, pollMs = 3000 }: { sleep?: Sleep; pollMs?: number } = {}) {
  const server = new McpServer(
    { name: "contently", version: VERSION },
    {
      instructions: `Make on-brand images, carousels and videos from Contently templates. Read the skill first (resource ${SKILL_URI}, or the on_brand_variations prompt): read a template with get_template before writing, fill each slot for its role and within its textConstraints, then render and return the URLs.`,
    },
  );

  server.registerTool(
    "list_templates",
    {
      title: "List templates",
      description: "Templates this organisation can use: name, kind (image/carousel/video), aspect, scene count, duration, posters, and how many slots of each role it has.",
      inputSchema: inputs.listTemplates,
      annotations: { readOnlyHint: true },
    },
    (args) => guarded(async () => ok(json((await client.listTemplates(args)).data))),
  );

  server.registerTool(
    "get_template",
    {
      title: "Read a template's content slots",
      description:
        "Scenes → blocks with ids, roles, current text and textConstraints (maxChars, lines), media slots (kind, aspect), and catalog blocks' schema, props and role-carrying fields. Plus poster URLs. Read this before writing any content.",
      inputSchema: inputs.getTemplate,
      annotations: { readOnlyHint: true },
    },
    ({ id: templateId, include_posters }) =>
      guarded(async () => {
        const template = await client.getTemplate(templateId);
        const content: ContentBlock[] = [json(template)];
        template.scenePosters.forEach((url, n) => {
          if (url) content.push({ type: "resource_link", uri: posterUri(templateId, n), name: `Scene ${n} poster`, mimeType: "image/png" });
        });
        if (include_posters) {
          for (const [n, url] of template.scenePosters.entries()) {
            if (!url) continue;
            const { bytes, mimeType } = await client.download(url);
            content.push({ type: "text", text: `Scene ${n} poster:` }, { type: "image", data: toBase64(bytes), mimeType });
          }
        }
        return ok(...content);
      }),
  );

  server.registerTool(
    "create_project_from_template",
    {
      title: "Make a project from a template",
      description: "A new project in the organisation, with all of the template's scenes or the ones picked. Block ids stay the same as in get_template.",
      inputSchema: inputs.createProject,
    },
    (args) => guarded(async () => ok(json(await client.createProject(args)))),
  );

  server.registerTool(
    "replace_content",
    {
      title: "Replace a project's content",
      description:
        "Fill slots by role (reaches into catalog blocks: image:product fills the Product card's photo) or by blockId (+ field for one catalog-block field). Values: text, mediaId, mediaUrl (imported) or props. The batch applies together or not at all; answers what changed, what did not match, and warnings for text longer than its slot.",
      inputSchema: inputs.replaceContent,
    },
    ({ projectId, replacements }) =>
      guarded(async () => {
        const problems = replacementProblems(replacements as Replacement[]);
        if (problems.length) return { isError: true, content: [{ type: "text", text: `The replacements are malformed; nothing was sent:\n${problems.map((p) => `- ${p}`).join("\n")}` }] };
        const result = await client.replaceContent(projectId, replacements as Replacement[]);
        const { project, ...outcome } = result;
        /* The project comes back in full; the outcome is what the model needs
           first, and the scenes are there to check against. */
        return ok(json(outcome), json({ project }));
      }),
  );

  server.registerTool(
    "list_media",
    {
      title: "List media",
      description: "The organisation's own images and videos (default), or stock. Prefer the organisation's own media for image:product and logo slots.",
      inputSchema: inputs.listMedia,
      annotations: { readOnlyHint: true },
    },
    (args) => guarded(async () => ok(json((await client.listMedia(args)).data))),
  );

  server.registerTool(
    "upload_media",
    {
      title: "Add media",
      description: "Add an image or video to the organisation's library from a URL or base64 bytes. Answers its media id, for replace_content.",
      inputSchema: inputs.uploadMedia,
    },
    ({ url, base64, mimeType, name, tags }) =>
      guarded(async () => {
        if ((url === undefined) === (base64 === undefined)) return { isError: true, content: [{ type: "text", text: "Give exactly one of url or base64." }] };
        if (url) return ok(json(await client.importMedia({ url, name, tags })));
        const bytes = new Uint8Array(Buffer.from(base64!, "base64"));
        if (!bytes.length) return { isError: true, content: [{ type: "text", text: "base64 decoded to an empty file." }] };
        return ok(json(await client.uploadMedia(bytes, mimeType ?? "application/octet-stream", { name, tags })));
      }),
  );

  server.registerTool(
    "render_project",
    {
      title: "Render a project",
      description: "Queue a render: mp4 for videos, png for stills (one per scene, or one scene), carousel-zip for carousels. Answers a jobId for get_render.",
      inputSchema: inputs.renderProject,
    },
    (args) =>
      guarded(async () => {
        const job = await client.renderProject(args.projectId, { format: args.format, ...(args.scene !== undefined ? { scene: args.scene } : {}) });
        return ok({ type: "text", text: `Queued render ${job.id}. Call get_render with this jobId to wait for the files.` }, json(job));
      }),
  );

  server.registerTool(
    "get_render",
    {
      title: "Wait for a render",
      description: "A render's status; waits (default 50 s) until it is done and answers the download URLs. An MP4 takes roughly its own length plus a minute; call again if it is still running.",
      inputSchema: inputs.getRender,
      annotations: { readOnlyHint: true },
    },
    ({ jobId, waitSeconds = 50 }, extra) =>
      guarded(async () => {
        const deadline = Date.now() + waitSeconds * 1000;
        const progressToken = extra._meta?.progressToken;
        let job = await client.getRender(jobId);
        let ticks = 0;
        while ((job.status === "queued" || job.status === "running") && Date.now() < deadline) {
          if (progressToken !== undefined) {
            await extra.sendNotification({ method: "notifications/progress", params: { progressToken, progress: ++ticks, message: `${job.status}${job.queuePosition ? `, ${job.queuePosition} ahead` : ""}` } }).catch(() => {});
          }
          await sleep(pollMs);
          job = await client.getRender(jobId);
        }
        return ok({ type: "text", text: renderSummary(job) }, json(job));
      }),
  );

  server.registerTool(
    "cancel_render",
    {
      title: "Cancel a render",
      description: "Take back a render that is still queued, freeing its place in the organisation's limit of 3 renders at once. A render that has started cannot be cancelled.",
      inputSchema: inputs.cancelRender,
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    ({ jobId }) =>
      guarded(async () => {
        const job = await client.cancelRender(jobId);
        return ok({ type: "text", text: `Cancelled render ${job.id}.` }, json(job));
      }),
  );

  /* ── Resources ─────────────────────────────────────────────────── */

  server.registerResource(
    "on-brand-content-skill",
    SKILL_URI,
    { title: "Skill: on-brand content from templates", description: "How to use these tools well: roles, length limits, media, variations.", mimeType: "text/markdown" },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: readSkill() }] }),
  );

  const poster = async (uri: URL, templateId: string, scene?: number) => {
    const template = await client.getTemplate(templateId);
    const url = scene === undefined ? template.poster : template.scenePosters[scene];
    if (!url) throw new Error(scene === undefined ? `Template ${templateId} has no poster yet` : `Template ${templateId} has no poster for scene ${scene}`);
    const { bytes, mimeType } = await client.download(url);
    return { contents: [{ uri: uri.href, mimeType, blob: toBase64(bytes) }] };
  };

  server.registerResource(
    "template-poster",
    new ResourceTemplate("contently://templates/{id}/poster", {
      list: async () => ({
        resources: (await client.listTemplates()).data.filter((t) => t.poster).map((t) => ({ uri: posterUri(String(t.id)), name: `${t.name} — poster`, mimeType: "image/png" })),
      }),
    }),
    { title: "Template poster", description: "The first scene of a template, as a PNG", mimeType: "image/png" },
    async (uri, { id: templateId }) => poster(uri, String(templateId)),
  );

  server.registerResource(
    "template-scene-poster",
    new ResourceTemplate("contently://templates/{id}/scenes/{n}/poster", { list: undefined }),
    { title: "Template scene poster", description: "One scene of a template, as a PNG: see what is big and what is small before writing", mimeType: "image/png" },
    async (uri, { id: templateId, n }) => poster(uri, String(templateId), Number(n)),
  );

  /* ── Prompt ────────────────────────────────────────────────────── */

  server.registerPrompt(
    "on_brand_variations",
    {
      title: "Make on-brand variations of a template",
      description: "Loads the skill and asks for N rendered variations of a template for a brand.",
      argsSchema: {
        brand: z.string().describe("The brand: name, what it sells, tone, benefits, product image URLs"),
        template: z.string().optional().describe("A template id or name (default: pick one that fits)"),
        count: z.string().optional().describe("How many variations (default 3)"),
      },
    },
    ({ brand, template, count }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `${readSkill()}\n\n---\n\nMake ${count || "3"} on-brand variations${template ? ` of the template "${template}"` : ""} for this brand, following the skill above. Render each one and give me the download URLs.\n\nBrand:\n${brand}`,
          },
        },
      ],
    }),
  );

  return server;
}
