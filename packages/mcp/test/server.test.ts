/*
  The MCP server as a client sees it: a real MCP client over an in-memory
  transport, against a scripted fake of the REST API. `npm test`.
*/
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { ContentlyClient } from "../src/client.js";
import { describeError } from "../src/errors.js";
import { createServer, replacementProblems } from "../src/server.js";

type Call = { method: string; url: string; body?: unknown; auth?: string | null };
type Route = (call: Call) => Response | Promise<Response>;

const jsonResponse = (status: number, body: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
const apiError = (status: number, code: string, message: string, details?: { at: string; message: string }[]) => jsonResponse(status, { error: { code, message, ...(details ? { details } : {}) } });

async function connect(route: Route) {
  const calls: Call[] = [];
  const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    const raw = init?.body;
    const body = typeof raw === "string" ? JSON.parse(raw) : raw instanceof Blob ? `<${raw.size} bytes ${raw.type}>` : undefined;
    const call = { method: init?.method ?? "GET", url, body, auth: headers.get("authorization") };
    calls.push(call);
    return route(call);
  }) as typeof fetch;
  const api = new ContentlyClient({ apiKey: "ctly_test", baseUrl: "https://api.test", fetch: fakeFetch });
  const server = createServer(api, { sleep: async () => {}, pollMs: 0 });
  const client = new Client({ name: "test", version: "0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  const call = async (name: string, args: Record<string, unknown>) => (await client.callTool({ name, arguments: args })) as CallToolResult;
  return { client, calls, call };
}

const text = (result: CallToolResult) => result.content.map((c) => (c.type === "text" ? c.text : `[${c.type}]`)).join("\n");

const template = {
  id: "t1",
  name: "Hook → demo → CTA",
  kind: "video",
  poster: "https://files.test/p0.png",
  scenePosters: ["https://files.test/p0.png", "https://files.test/p1.png"],
  scenes: [{ index: 0, blocks: [{ id: "hook1", type: "text", role: "hook", text: "Old hook", textConstraints: { maxChars: 10, lines: 2 } }] }],
};

describe("tools", () => {
  it("lists the nine tools with their input schemas", async () => {
    const { client } = await connect(() => jsonResponse(200, {}));
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), ["cancel_render", "create_project_from_template", "get_render", "get_template", "list_media", "list_templates", "render_project", "replace_content", "upload_media"]);
    const replace = tools.find((t) => t.name === "replace_content")!;
    assert.deepEqual(replace.inputSchema.required, ["projectId", "replacements"]);
  });

  it("sends the key and the filters, and returns the API's answer", async () => {
    const { calls, call } = await connect(() => jsonResponse(200, { data: [{ id: "t1", name: "Hook" }] }));
    const result = await call("list_templates", { kind: "video", q: "coffee" });
    assert.equal(result.isError, undefined);
    assert.match(text(result), /"id": "t1"/);
    assert.equal(calls[0]!.url, "https://api.test/v1/templates?kind=video&q=coffee");
    assert.equal(calls[0]!.auth, "Bearer ctly_test");
  });

  it("links each scene poster, and inlines them on request", async () => {
    const { call } = await connect(({ url }) => (url.endsWith("/v1/templates/t1") ? jsonResponse(200, template) : new Response(new Uint8Array([137, 80, 78, 71]), { headers: { "Content-Type": "image/png" } })));
    const plain = await call("get_template", { id: "t1" });
    assert.deepEqual(plain.content.filter((c) => c.type === "resource_link").map((c) => (c as { uri: string }).uri), ["contently://templates/t1/scenes/0/poster", "contently://templates/t1/scenes/1/poster"]);
    const withPosters = await call("get_template", { id: "t1", include_posters: true });
    const images = withPosters.content.filter((c) => c.type === "image");
    assert.equal(images.length, 2);
    assert.equal((images[0] as { data: string }).data, Buffer.from([137, 80, 78, 71]).toString("base64"));
  });

  it("passes replacements through and puts the outcome first", async () => {
    const { calls, call } = await connect(() => jsonResponse(200, { changed: [{ blockId: "hook1" }], unmatched: [], skipped: [], warnings: [], project: { id: "p1" } }));
    const result = await call("replace_content", { projectId: "p1", replacements: [{ role: "hook", text: "New" }, { blockId: "card", field: "price", text: "$9" }] });
    assert.equal(result.isError, undefined);
    assert.equal(calls[0]!.method, "PATCH");
    assert.deepEqual(calls[0]!.body, { replacements: [{ role: "hook", text: "New" }, { blockId: "card", field: "price", text: "$9" }] });
    assert.match((result.content[0] as { text: string }).text, /"changed"/);
  });

  it("uploads base64 bytes through an upload URL, then registers them", async () => {
    const { calls, call } = await connect(({ url }) =>
      url.endsWith("/v1/media/upload-url") ? jsonResponse(200, { uploadUrl: "https://upload.test/u" }) : url === "https://upload.test/u" ? jsonResponse(200, { storageId: "s1" }) : jsonResponse(201, { id: "m1", kind: "image" }),
    );
    const result = await call("upload_media", { base64: Buffer.from("fake png").toString("base64"), mimeType: "image/png", name: "Logo" });
    assert.equal(result.isError, undefined);
    assert.deepEqual(
      calls.map((c) => [c.method, c.url, c.body]),
      [
        ["POST", "https://api.test/v1/media/upload-url", undefined],
        ["POST", "https://upload.test/u", "<8 bytes image/png>"],
        ["POST", "https://api.test/v1/media", { storageId: "s1", name: "Logo" }],
      ],
    );
  });

  it("waits for a render and answers its files", async () => {
    const states = ["queued", "running", "done"];
    const { call } = await connect(() => {
      const status = states.shift() ?? "done";
      return jsonResponse(200, { id: "j1", status, outputs: status === "done" ? [{ name: "out.mp4", url: "https://files.test/out.mp4" }] : [] });
    });
    const result = await call("get_render", { jobId: "j1" });
    assert.match(text(result), /Done\. File:\n- out\.mp4: https:\/\/files\.test\/out\.mp4/);
  });

  it("cancels a queued render", async () => {
    const { calls, call } = await connect(() => jsonResponse(200, { id: "j1", status: "failed", error: "Cancelled", outputs: [] }));
    assert.match(text(await call("cancel_render", { jobId: "j1" })), /^Cancelled render j1\./);
    assert.deepEqual(calls.map((c) => [c.method, c.url]), [["POST", "https://api.test/v1/render-jobs/j1/cancel"]]);
  });

  it("stops waiting when asked not to", async () => {
    const { call } = await connect(() => jsonResponse(200, { id: "j1", status: "queued", queuePosition: 2, outputs: [] }));
    const result = await call("get_render", { jobId: "j1", waitSeconds: 0 });
    assert.match(text(result), /Still queued \(2 ahead in the queue\)\. Call get_render again/);
  });
});

describe("argument validation", () => {
  it("rejects arguments that do not fit the schema before calling the API", async () => {
    const { calls, call } = await connect(() => jsonResponse(200, {}));
    for (const [name, args] of [
      ["replace_content", { projectId: "p1", replacements: [{ role: "headline", text: "x" }] }],
      ["replace_content", { projectId: "p1", replacements: [] }],
      ["render_project", { projectId: "p1", format: "gif" }],
      ["get_template", {}],
      ["create_project_from_template", { templateId: "t1", scenes: [-1] }],
    ] as const) {
      const result = await call(name, args);
      assert.equal(result.isError, true, `${name} ${JSON.stringify(args)}`);
    }
    assert.equal(calls.length, 0);
  });

  it("says which replacement breaks the one-target, one-value rule", async () => {
    assert.deepEqual(replacementProblems([{ role: "hook", blockId: "a", text: "x" }, { role: "cta" }, { role: "cta", field: "x", text: "y" }, { blockId: "b", index: 1, text: "z" }]), [
      "replacements[0]: give exactly one of blockId or role",
      "replacements[1]: give exactly one of text, mediaId, mediaUrl or props",
      "replacements[2].field: only with blockId (a role already says which field)",
      "replacements[3].index: only with role",
    ]);
    const { calls, call } = await connect(() => jsonResponse(200, {}));
    const result = await call("replace_content", { projectId: "p1", replacements: [{ role: "hook", blockId: "a", text: "x" }] });
    assert.equal(result.isError, true);
    assert.match(text(result), /exactly one of blockId or role/);
    assert.equal(calls.length, 0);
  });

  it("needs exactly one of url or base64 to upload", async () => {
    const { call } = await connect(() => jsonResponse(200, {}));
    assert.match(text(await call("upload_media", { name: "x" })), /exactly one of url or base64/);
  });
});

describe("error mapping", () => {
  it("401 → check the API key", async () => {
    const { call } = await connect(() => apiError(401, "unauthorized", "Invalid or revoked API key"));
    const result = await call("list_templates", {});
    assert.equal(result.isError, true);
    assert.match(text(result), /Contently rejected the API key \(401: Invalid or revoked API key\)\. Check CONTENTLY_API_KEY: make a key in Contently → Settings → API keys/);
  });

  it("404 → use ids from the tools", async () => {
    const { call } = await connect(() => apiError(404, "not_found", "No project p9"));
    assert.match(text(await call("replace_content", { projectId: "p9", replacements: [{ role: "hook", text: "x" }] })), /^Not found \(404: No project p9\)\. Use ids from list_templates/);
  });

  it("400 → each problem, and that nothing changed", async () => {
    const { call } = await connect(() => apiError(400, "invalid_request", "Some replacements cannot be applied; nothing was changed", [{ at: "replacements[0]", message: "Product card price: At most 16 characters" }]));
    const out = text(await call("replace_content", { projectId: "p1", replacements: [{ blockId: "card", field: "price", text: "x".repeat(40) }] }));
    assert.match(out, /Contently refused the request \(400: Some replacements cannot be applied; nothing was changed\)\.\n- replacements\[0\]: Product card price: At most 16 characters\nFix the listed fields/);
  });

  it("429 → how long to wait", async () => {
    const { call } = await connect(() => jsonResponse(429, { error: { code: "rate_limited", message: "Rate limit: 60 requests a minute per key" } }, { "Retry-After": "12" }));
    assert.match(text(await call("list_media", {})), /Rate limited \(429: .*\)\. Wait 12 seconds/);
  });

  it("503 no_render_worker → say rendering is unavailable, don't loop", async () => {
    const { call } = await connect(() => jsonResponse(503, { error: { code: "no_render_worker", message: "No render worker is running" } }, { "Retry-After": "60" }));
    assert.match(text(await call("render_project", { projectId: "p1", format: "png" })), /^No render worker is running, so the render was not queued \(503: .*\)\. Tell the user/);
  });

  it("409 → not in a state for it", async () => {
    const { call } = await connect(() => apiError(409, "conflict", "Render job j1 is running; only a queued job can be cancelled"));
    assert.match(text(await call("cancel_render", { jobId: "j1" })), /\(409: Render job j1 is running/);
  });

  it("an unreachable API → where it tried", async () => {
    const { call } = await connect(() => {
      throw new TypeError("fetch failed");
    });
    assert.match(text(await call("list_templates", {})), /Could not reach Contently at https:\/\/api\.test: fetch failed/);
  });

  it("describes errors that are not the API's", () => {
    assert.equal(describeError(new Error("boom")), "Unexpected error: boom");
  });
});

describe("resources and prompt", () => {
  it("serves the skill and the posters", async () => {
    const { client } = await connect(({ url }) => (url.includes("/v1/templates/t1") ? jsonResponse(200, template) : new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "image/png" } })));
    const skill = await client.readResource({ uri: "contently://skills/on-brand-content" });
    assert.match(String((skill.contents[0] as { text: string }).text), /# On-brand content from Contently templates/);
    const scene = await client.readResource({ uri: "contently://templates/t1/scenes/1/poster" });
    assert.deepEqual(scene.contents[0], { uri: "contently://templates/t1/scenes/1/poster", mimeType: "image/png", blob: Buffer.from([1, 2, 3]).toString("base64") });
  });

  it("offers the variations prompt with the skill in it", async () => {
    const { client } = await connect(() => jsonResponse(200, {}));
    const prompt = await client.getPrompt({ name: "on_brand_variations", arguments: { brand: "Glowco: vitamin C serum", count: "3" } });
    const body = (prompt.messages[0]!.content as { text: string }).text;
    assert.match(body, /Make 3 on-brand variations/);
    assert.match(body, /Glowco: vitamin C serum/);
    assert.match(body, /## Writing for each role/);
  });
});
