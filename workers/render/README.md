# Render worker

Headless Chrome that turns a Contently project into finished files. It claims
jobs from the `renderJobs` queue in Convex, opens `<APP_URL>/render/<projectId>`
with a signed token, asks the page to rasterise itself, and uploads the result
to Convex storage.

Why a separate service: Convex actions cannot run a browser, and every pixel
this product ships is painted by the studio's React tree. Rendering anywhere
else would mean a second renderer and two different answers to "what does this
project look like".

How the pieces fit together, and what the page does, is in
[`docs/render-worker.md`](../../docs/render-worker.md).

## Run it locally

```bash
npm install                      # in this directory

export CONVEX_URL="$NEXT_PUBLIC_CONVEX_URL"
export RENDER_WORKER_SECRET=…    # same value as on the Convex deployment
export APP_URL=http://localhost:3000
export CHROME_PATH=/usr/bin/google-chrome   # any Chrome; Chromium cannot encode H.264

npm start        # poll for ever
npm run once     # drain whatever is queued, then exit
```

`npm run check` typechecks the worker. It is not part of the app's `tsc`/eslint
pass — `workers/` is excluded from both — because a Node service and a Next app
do not share a compiler target.

## Configuration

| Variable | Required | Default | What it is |
|---|---|---|---|
| `CONVEX_URL` | yes | — | The deployment's client URL (`https://….convex.cloud`) |
| `RENDER_WORKER_SECRET` | yes | — | Matches `RENDER_WORKER_SECRET` on that deployment |
| `APP_URL` | yes | — | Origin serving `/render`, e.g. the Vercel deployment |
| `CHROME_PATH` | no | Playwright's default | Chrome binary. Use a real Chrome: H.264 encoding needs it |
| `RENDER_CONCURRENCY` | no | `1` | Jobs at once, capped at 2 |
| `RENDER_POLL_MS` | no | `2000` | Idle poll interval |
| `RENDER_JOB_TIMEOUT_MS` | no | `300000` | Per-job deadline; keep it at or under Convex's |
| `PORT` | no | `8080` | Health and wake endpoints |

`GET /healthz` reports jobs in flight. `POST /wake` skips the poll interval,
for a caller that has just enqueued something.

## Deploy

```bash
docker build -t contently-render .
fly launch --no-deploy --copy-config --name contently-render
fly secrets set CONVEX_URL=… RENDER_WORKER_SECRET=… APP_URL=…
fly deploy
```

`fly.toml` runs one machine that is never auto-stopped: the queue is polled, so
the worker is doing its job with nobody talking to it, and stopping a machine
mid-render loses the job until the five-minute sweep puts it back.
