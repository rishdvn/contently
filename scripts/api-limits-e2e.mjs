#!/usr/bin/env node
/*
  The API's limits end to end (`docs/api.md` → Limits), as a caller meets them:

      CONTENTLY_API_KEY=ctly_… node scripts/api-limits-e2e.mjs

  - an image over its kind's size → 413 payload_too_large
  - an HEVC video → 415 unsupported_media, naming the codec
  - renders past the organisation's concurrent quota → 429 quota_exceeded
    with Retry-After

  The files are made here, a few bytes of real header and the rest padding:
  the API reads what a file is from its header, so that is all it takes.
  Refused uploads are left in storage unregistered (the API never deletes a
  file named by a caller); the 21 MB one is the only large one.

  The render check queues PNG renders of one image project until the quota
  answers. Those jobs are real: a render worker will draw them. Use a key for
  a test organisation.

  Environment:
    CONTENTLY_API_URL   default https://chatty-giraffe-3.convex.site
    CONTENTLY_API_KEY   an API key (Contently → API keys)
    PROJECT_ID          optional: the image project to render (default: a new one from the first image template)
    MAX_RENDERS         optional: give up after this many renders without a 429 (default 8)
*/

const base = (process.env.CONTENTLY_API_URL ?? "https://chatty-giraffe-3.convex.site").replace(/\/+$/, "");
const key = process.env.CONTENTLY_API_KEY;
const maxRenders = Number(process.env.MAX_RENDERS ?? 8);
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

async function call(method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  console.log(`${method} ${path} → ${res.status}${res.headers.get("retry-after") ? ` (Retry-After: ${res.headers.get("retry-after")})` : ""}`);
  return { status: res.status, json, retryAfter: res.headers.get("retry-after") };
}

/* Upload bytes through a signed URL, then ask the API to register them. */
async function register(bytes, contentType, name) {
  const { json } = await call("POST", "/v1/media/upload-url");
  const uploaded = await fetch(json.uploadUrl, { method: "POST", headers: { "Content-Type": contentType }, body: bytes });
  const { storageId } = await uploaded.json();
  return await call("POST", "/v1/media", { storageId, name });
}

const ascii = (s) => [...s].map((c) => c.charCodeAt(0));
const be32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const box = (type, ...content) => {
  const body = content.flat();
  return [...be32(8 + body.length), ...ascii(type), ...body];
};

/* A PNG header for a 6000 × 4000 image, padded out to `size` bytes. */
function bigPng(size) {
  const bytes = new Uint8Array(size);
  bytes.set([0x89, ...ascii("PNG\r\n\x1a\n"), ...be32(13), ...ascii("IHDR"), ...be32(6000), ...be32(4000)]);
  return bytes;
}

/* An MP4 whose one video track is HEVC (`hvc1`), 1080 × 1920, 4 s. */
function hevcMp4() {
  const tkhd = box("tkhd", [0, 0, 0, 0], new Array(72).fill(0), be32(1080 * 65536), be32(1920 * 65536));
  const hdlr = box("hdlr", [0, 0, 0, 0], be32(0), ascii("vide"), new Array(12).fill(0), [0]);
  const stsd = box("stsd", [0, 0, 0, 0], be32(1), be32(16), ascii("hvc1"), new Array(8).fill(0));
  const trak = box("trak", tkhd, box("mdia", hdlr, box("minf", box("stbl", stsd))));
  const mvhd = box("mvhd", [0, 0, 0, 0], be32(0), be32(0), be32(1000), be32(4000), new Array(80).fill(0));
  return new Uint8Array([...box("ftyp", ascii("isom"), be32(0)), ...box("moov", mvhd, trak)]);
}

step("Media over its kind's limit → 413");
const big = await register(bigPng(21 * 1024 * 1024), "image/png", "limits e2e: too big");
check(big.status === 413 && big.json?.error?.code === "payload_too_large", `21 MB PNG → ${big.status}: ${big.json?.error?.message}`);
check(/20 MB/.test(big.json?.error?.message ?? ""), "the message names the image limit");

step("HEVC video → 415");
const hevc = await register(hevcMp4(), "video/mp4", "limits e2e: hevc");
check(hevc.status === 415 && hevc.json?.error?.code === "unsupported_media", `HEVC MP4 → ${hevc.status}: ${hevc.json?.error?.message}`);
check(/HEVC/.test(hevc.json?.error?.message ?? ""), "the message names the codec");

step("Renders past the concurrent quota → 429");
let projectId = process.env.PROJECT_ID;
if (!projectId) {
  const templates = await call("GET", "/v1/templates?kind=image");
  const templateId = templates.json?.data?.[0]?.id;
  if (!templateId) {
    console.error("No image template to make a project from; set PROJECT_ID");
    process.exit(1);
  }
  const created = await call("POST", "/v1/projects", { templateId, name: `API limits e2e ${new Date().toISOString()}` });
  projectId = created.json?.id;
}
let refused = null;
for (let i = 0; i < maxRenders && !refused; i++) {
  const job = await call("POST", `/v1/projects/${projectId}/render`, { format: "png" });
  if (job.status === 429) refused = job;
  else if (job.status !== 202) {
    check(false, `render ${i + 1} → ${job.status}: ${job.json?.error?.message}`);
    break;
  }
}
check(refused?.json?.error?.code === "quota_exceeded", `quota_exceeded: ${refused?.json?.error?.message}`);
check(Number(refused?.retryAfter) > 0, `Retry-After: ${refused?.retryAfter}`);

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
