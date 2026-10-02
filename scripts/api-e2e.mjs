#!/usr/bin/env node
/*
  The public API end to end, as a caller sees it (`docs/api.md`):

      CONTENTLY_API_KEY=ctly_… node scripts/api-e2e.mjs

  key → list templates → read a template (video by default) → make a project
  → replace the heading/hook by role and `image:product` by `mediaUrl` →
  render (MP4 for a video, PNG for an image, ZIP for a carousel) → poll →
  download → ffprobe the duration or size. Then the failures a caller should
  get: a wrong key (401), another organisation's project (404), a malformed
  replacement (400). Last, cancelling a queued render (200, then 409).

  Environment:
    CONTENTLY_API_URL   default https://chatty-giraffe-3.convex.site
    CONTENTLY_API_KEY   an API key (Contently → API keys)
    OTHER_ORG_API_KEY   optional: a key for a second organisation, for the 404 check
    TEMPLATE_KIND       optional: video (default), image or carousel
    TEMPLATE_ID         optional: which template (default: the first of that kind)
    PRODUCT_IMAGE_URL   optional: the picture for image:product
    OUT_DIR             optional: where to save the render (default /tmp/contently-api-e2e)
    RENDER_TIMEOUT_S    optional: how long to wait for the render (default 600)

  Rendering needs a render worker draining the queue (`workers/render`,
  `npm run once`); without one the render is refused (503 no_render_worker)
  and the script checks that instead.
*/

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const base = (process.env.CONTENTLY_API_URL ?? "https://chatty-giraffe-3.convex.site").replace(/\/+$/, "");
const key = process.env.CONTENTLY_API_KEY;
const otherKey = process.env.OTHER_ORG_API_KEY;
const productImage = process.env.PRODUCT_IMAGE_URL ?? "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=900&q=80";
const outDir = process.env.OUT_DIR ?? "/tmp/contently-api-e2e";
const renderTimeout = Number(process.env.RENDER_TIMEOUT_S ?? 600) * 1000;
const kind = process.env.TEMPLATE_KIND ?? "video";
const format = { video: "mp4", image: "png", carousel: "carousel-zip" }[kind];
if (!key) {
  console.error("Set CONTENTLY_API_KEY (Contently → API keys)");
  process.exit(2);
}

let failures = 0;
const step = (title) => console.log(`\n── ${title}`);
const check = (ok, what) => {
  console.log(`${ok ? "✔" : "✖"} ${what}`);
  if (!ok) failures++;
};

async function call(method, path, { body, auth = key } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { ...(auth ? { Authorization: `Bearer ${auth}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  console.log(`${method} ${path} → ${res.status}${res.headers.get("x-ratelimit-remaining") ? ` (${res.headers.get("x-ratelimit-remaining")} left this minute)` : ""}`);
  return { status: res.status, json, headers: res.headers };
}

step("OpenAPI (no key)");
const spec = await call("GET", "/v1/openapi.json", { auth: null });
check(spec.status === 200 && spec.json.openapi === "3.1.0", "openapi.json is served");

step("Authentication");
const nokey = await call("GET", "/v1/templates", { auth: null });
check(nokey.status === 401 && nokey.json.error?.code === "unauthorized", `no key → 401 (${nokey.json.error?.message})`);
const wrong = await call("GET", "/v1/templates", { auth: "ctly_thisIsNotARealKeyAtAll000000000" });
check(wrong.status === 401, `wrong key → 401 (${wrong.json.error?.message})`);

step("List templates");
const list = await call("GET", `/v1/templates?kind=${kind}`);
check(list.status === 200 && Array.isArray(list.json.data), `${list.json.data?.length} ${kind} templates`);
for (const t of list.json.data ?? []) console.log(`   ${t.id}  ${t.name}  ${t.sceneCount} scenes${t.duration !== null ? `, ${t.duration}s` : ""}  roles ${JSON.stringify(t.roles)}${t.published ? "" : "  (unpublished)"}`);
const templateId = process.env.TEMPLATE_ID ?? list.json.data?.[0]?.id;
if (!templateId) {
  console.error(`No ${kind} template to work with`);
  process.exit(1);
}

step("Read the template");
const template = await call("GET", `/v1/templates/${templateId}`);
check(template.status === 200, `template "${template.json.name}"`);
for (const scene of template.json.scenes ?? []) {
  console.log(`   scene ${scene.index} "${scene.name}"${scene.duration !== undefined ? ` ${scene.duration}s` : ""} poster ${scene.poster ? "yes" : "no"}`);
  for (const b of scene.blocks) {
    const what = b.text !== undefined ? `"${b.text}" (≤${b.textConstraints.maxChars} chars, ${b.textConstraints.lines} lines)` : b.mediaSlot ? `${b.mediaSlot.kind} slot, aspect ${b.mediaSlot.aspect}` : b.component ? `${b.component.name}: ${b.component.fields.map((f) => `${f.path}=${f.role}`).join(", ") || "no content roles"}` : "";
    console.log(`     ${b.id.padEnd(22)} ${b.type.padEnd(9)} ${(b.role ?? "–").padEnd(16)} ${what}`);
  }
}
const hasRole = (role) => (template.json.scenes ?? []).some((s) => s.blocks.some((b) => b.role === role || b.component?.fields.some((f) => f.role === role)));
const productSlot = hasRole("image:product");
console.log(`   image:product slot: ${productSlot ? "yes" : "no (the replacement will be reported unmatched)"}`);

step("Make a project from it");
const created = await call("POST", "/v1/projects", { body: { templateId, name: `API e2e ${new Date().toISOString()}` } });
check(created.status === 201, `project ${created.json.id}`);
const projectId = created.json.id;

step("Replace content");
const replacements = [
  { role: "heading", text: "Meet your new glow" },
  { role: "hook", text: "Still dull by noon?" },
  { role: "image:product", mediaUrl: productImage },
  { role: "cta", text: "Get yours" },
];
const patched = await call("PATCH", `/v1/projects/${projectId}/content`, { body: { replacements } });
check(patched.status === 200, `${patched.json.changed?.length} changed, ${patched.json.unmatched?.length} unmatched, ${patched.json.warnings?.length} warnings`);
for (const c of patched.json.changed ?? []) console.log(`   ✎ scene ${c.scene} ${c.blockId}${c.field ? `.${c.field}` : ""}: ${JSON.stringify(c.before)} → ${JSON.stringify(c.after)}`);
for (const u of patched.json.unmatched ?? []) console.log(`   ∅ replacement ${u.replacement}: ${u.reason}`);
const productChanges = (patched.json.changed ?? []).filter((c) => replacements[c.replacement].role === "image:product");
if (productSlot) check(productChanges.length > 0 && productChanges.every((c) => c.after?.mediaId), `image:product filled from mediaUrl with an imported media id (${productChanges.map((c) => c.blockId + (c.field ? `.${c.field}` : "")).join(", ")})`);
else check((patched.json.unmatched ?? []).some((u) => replacements[u.replacement].role === "image:product"), "image:product reported unmatched, not an error");
check((patched.json.changed ?? []).some((c) => ["heading", "hook"].includes(replacements[c.replacement].role)), "heading/hook replaced by role");

step("Failures a caller should see");
const malformed = await call("PATCH", `/v1/projects/${projectId}/content`, { body: { replacements: [{ role: "headline", text: 42 }] } });
check(malformed.status === 400 && malformed.json.error?.code === "invalid_request", `malformed → 400: ${malformed.json.error?.message}`);
for (const d of malformed.json.error?.details ?? []) console.log(`   ${d.at}: ${d.message}`);
const mediaBlock = (template.json.scenes ?? []).flatMap((sc) => sc.blocks).find((b) => b.mediaSlot);
if (mediaBlock) {
  const wrongKind = await call("PATCH", `/v1/projects/${projectId}/content`, { body: { replacements: [{ blockId: mediaBlock.id, text: "not a picture" }] } });
  check(wrongKind.status === 400, `text into the ${mediaBlock.mediaSlot.kind} block ${mediaBlock.id} → 400: ${wrongKind.json.error?.details?.[0]?.message}`);
}
if (otherKey) {
  const foreign = await call("GET", `/v1/projects/${projectId}`, { auth: otherKey });
  check(foreign.status === 404 && foreign.json.error?.code === "not_found", `another organisation's key → 404 (${foreign.json.error?.message})`);
} else console.log("   (set OTHER_ORG_API_KEY to check another organisation's project is 404)");
const missing = await call("GET", "/v1/projects/not-a-project");
check(missing.status === 404, "unknown project → 404");

/* With no worker running, a render is refused rather than queued for ever. */
const noWorker = (res) => res.status === 503 && res.json.error?.code === "no_render_worker";
const checkRefused = (res) => {
  check(noWorker(res) && Number(res.headers.get("retry-after")) > 0, `no render worker → 503 no_render_worker, Retry-After ${res.headers.get("retry-after")}: ${res.json.error?.message}`);
  console.log("   No render worker is running (workers/render, npm run once); the render steps that need one are skipped.");
};

step(`Render (${format})`);
const job = await call("POST", `/v1/projects/${projectId}/render`, { body: { format } });
if (noWorker(job)) checkRefused(job);
else check(job.status === 202, `job ${job.json.id} ${job.json.status}`);
const started = Date.now();
let state = job.status === 202 ? job.json : { status: "refused" };
let last = "";
while (["queued", "running"].includes(state.status) && Date.now() - started < renderTimeout) {
  await new Promise((r) => setTimeout(r, 3000));
  const polled = await fetch(`${base}/v1/render-jobs/${job.json.id}`, { headers: { Authorization: `Bearer ${key}` } });
  state = await polled.json();
  const now = `${state.status}${state.queuePosition !== undefined ? ` (${state.queuePosition} ahead)` : ""}`;
  if (now !== last) console.log(`   ${Math.round((Date.now() - started) / 1000)}s: ${now}`);
  last = now;
}
if (state.status !== "refused") check(state.status === "done", `render ${state.status}${state.error ? `: ${state.error}` : ""}`);

if (state.status === "done") {
  mkdirSync(outDir, { recursive: true });
  for (const output of state.outputs) {
    const file = join(outDir, output.name);
    const bytes = Buffer.from(await (await fetch(output.url)).arrayBuffer());
    writeFileSync(file, bytes);
    console.log(`   ⤓ ${file} (${(bytes.length / 1024 / 1024).toFixed(2)} MB)`);
    try {
      if (format === "carousel-zip") continue;
      const probe = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_name,width,height", "-of", "json", file]).toString();
      const info = JSON.parse(probe);
      const video = info.streams.find((s) => s.width);
      if (format === "mp4") {
        const duration = Number(info.format.duration);
        console.log(`   ffprobe: ${duration.toFixed(2)} s, ${video?.codec_name} ${video?.width}×${video?.height}`);
        check(Math.abs(duration - template.json.duration) < 0.5, `duration ${duration.toFixed(2)} s matches the template's ${template.json.duration} s`);
      } else {
        console.log(`   ffprobe: ${video?.codec_name} ${video?.width}×${video?.height}`);
        check(video?.width === template.json.width && video?.height === template.json.height, `size matches the template's ${template.json.width}×${template.json.height}`);
      }
    } catch (error) {
      console.log(`   (ffprobe unavailable: ${error.message.split("\n")[0]})`);
    }
  }
}

step("Cancel a queued render");
const extra = await call("POST", `/v1/projects/${projectId}/render`, { body: { format } });
if (noWorker(extra)) checkRefused(extra);
else {
  check(extra.status === 202, `job ${extra.json.id} ${extra.json.status}`);
  const cancelled = await call("POST", `/v1/render-jobs/${extra.json.id}/cancel`);
  if (cancelled.status === 409) {
    /* A worker polling every two seconds can get there first; that is the 409 a caller would see. */
    check(cancelled.json.error?.code === "conflict", `the worker took it first → 409 conflict: ${cancelled.json.error?.message}`);
  } else {
    check(cancelled.status === 200 && cancelled.json.status === "failed" && cancelled.json.error === "Cancelled", `cancel → 200, ${cancelled.json.status}: ${cancelled.json.error}`);
    const again = await call("POST", `/v1/render-jobs/${extra.json.id}/cancel`);
    check(again.status === 409 && again.json.error?.code === "conflict", `cancel again → 409 conflict: ${again.json.error?.message}`);
  }
}
const unknownJob = await call("POST", "/v1/render-jobs/not-a-job/cancel");
check(unknownJob.status === 404, "cancel an unknown job → 404");

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
