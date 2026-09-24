# Rendering

How a project becomes a file the API can hand back.

The studio already exports: `lib/editor/export.ts` rasterises an artboard with
html-to-image and encodes video with WebCodecs, in the tab the person is
working in. Everything that is not a person — the REST API, the MCP server, a
scheduled job — has no tab, and Convex actions cannot run a browser. So there
is a worker with a headless Chrome that opens the app and uses the same code.

The rule this follows: **one renderer**. A server-side rasteriser would be a
second definition of what a project looks like, and "the download and the API
return different images" is not a bug anyone can act on.

## The pieces

| | |
|---|---|
| `convex/schema.ts` → `renderJobs` | The queue: one row per render, `queued → running → done \| failed` |
| `convex/render.ts` | Tokens, the queue's mutations, and `document` — the one read a token unlocks |
| `app/render/[projectId]/page.tsx`, `components/render/RenderStage.tsx` | The page Chrome opens: one artboard at 1:1, no chrome, no session |
| `workers/render/` | The Node service with the browser |
| `proxy.ts` | `/render` is public, because the worker has no Clerk session |

## The flow

```
someone                 Convex                      worker                     page
   │ enqueue(project,     │                            │                          │
   │        format) ─────►│ renderJobs: queued         │                          │
   │                      │◄──── claim(secret) ────────│ (polls every 2s)         │
   │                      │ running + render token ───►│                          │
   │                      │                            │ GET /render/<id>?token ─►│
   │                      │◄──── render:document ──────┼──────────────────────────│
   │                      │ document + media URLs ─────┼─────────────────────────►│
   │                      │                            │◄─ status: "ready" ───────│
   │                      │                            │── png(scene) / mp4() ───►│
   │                      │                            │◄─ bytes, base64 chunks ──│
   │                      │◄──── uploadUrl + POST ──────│                          │
   │                      │◄──── complete(storageIds) ─│                          │
   │ job(jobId) ─────────►│ done + file URLs           │                          │
```

### Tokens

The worker is a server; there is nobody to sign it in. Convex mints an
HMAC-SHA256 token naming one project, good for ten minutes, and `/render`
accepts nothing else. A leaked token is worth one document for a few minutes,
which is the same exposure as the storage URLs inside it.

Two deployment env vars, both required — a deployment missing either refuses to
render rather than falling back to an open route:

```bash
npx convex env set RENDER_TOKEN_SECRET  "$(openssl rand -base64 32)"
npx convex env set RENDER_WORKER_SECRET "$(openssl rand -base64 32)"
```

`RENDER_WORKER_SECRET` also goes to the worker (`fly secrets set`). It stands in
for a user: whoever holds it can render anything any organisation owns.

### Deterministic rendering

A render that depends on how fast the machine was is a render that cannot be
compared with anything. So, before the page says `ready`:

- every font family the document names is requested explicitly and
  `document.fonts.ready` is awaited — `ready` alone only covers faces something
  already asked for, and an unmounted scene has asked for none;
- media is resolved server-side into plain URLs (no live query that could
  answer half way through a frame) and waited on until images have decoded and
  videos report `readyState >= 2`;
- the device scale is pinned to 1 and the viewport is set to the artboard;
- CSS transitions and animations are switched off. Every animation this product
  has is a function of timeline `progress`, driven by the exporter frame by
  frame; anything running on wall-clock time would land differently depending
  on how long the page took to load.

### Formats

| Format | Projects | Output |
|---|---|---|
| `png` | any | One PNG per slide, in order, or one for `scene` |
| `carousel-zip` | carousel | Those PNGs in a zip |
| `mp4` | video | One MP4, H.264, 30 fps by default |

MP4 goes through the studio's WebCodecs encoder in the page: the timeline is
stepped one frame at a time, so the file is smooth regardless of how slow the
render was. It needs a browser with an H.264 encoder — a real Google Chrome,
not Chromium, which is why the Dockerfile installs one.

Audio is not in the file yet. The studio's exporter is silent too (T-116).

### Failure and timeouts

A job gets five minutes from claim to upload. Past that the worker abandons the
tab, and Convex's sweep — on every claim, and on a five-minute cron for when no
worker is polling — puts the row back on the queue. Two attempts, then it is
`failed` with the reason on the row.

Failures that another attempt cannot fix (a deleted project, an expired token,
an MP4 asked of a still project) fail on the first attempt. Anything the
caller can act on is on the job as `error`.

## Hosting

Fly.io is the recommendation and `workers/render/fly.toml` is ready for it: one
`performance-2x` machine, never auto-stopped, health-checked on `/healthz`. The
decision was still open when this landed, so nothing in the app assumes the
worker is anywhere in particular — it is a client of Convex and of `APP_URL`,
and it can run on a laptop against the dev deployment with no changes:

```bash
cd workers/render && npm install
CONVEX_URL="$NEXT_PUBLIC_CONVEX_URL" \
RENDER_WORKER_SECRET=… \
APP_URL=http://localhost:3000 \
CHROME_PATH=/usr/bin/google-chrome \
npm start
```

A Vercel function with `@sparticuz/chromium` would do PNGs, but a video render
is minutes of CPU and does not fit in one.

## Asking for a render

```ts
const jobId = await convex.mutation(api.render.enqueue, {
  orgId,                       // the Clerk org id, as everywhere else
  projectId,
  format: "png",               // "png" | "carousel-zip" | "mp4"
  scene: 0,                    // optional: one slide instead of all
  scale: 2,                    // optional: 2× stills
  fps: 30,                     // optional: video
});

const job = await convex.query(api.render.job, { orgId, jobId });
// job.status, job.error, job.outputs: [{ name, url, storageId }]
```

`enqueue` refuses a format the project cannot produce, and a scene it does not
have, rather than letting the worker discover it minutes later.
