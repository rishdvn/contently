import { createServer } from "node:http";

import type { Browser } from "playwright-core";

import { config } from "./config.js";
import { Queue, errorMessage, type ClaimedJob } from "./queue.js";
import { RenderFailure, launch, renderJob } from "./render.js";

/*
  The render worker: claim a job, open the app's `/render` route in a headless
  Chrome, upload what comes out, mark the job done.

  It polls rather than listening. A queue that is usually empty and a job that
  takes minutes make the two-second round trip free, and polling survives the
  things a socket does not — a Convex deploy, a pod move, a network blip.
  `POST /wake` is there so a caller who has just enqueued something does not
  have to wait out the interval.

  One browser per process, one context per job: contexts are cheap and a page
  that wedges takes its own tab down instead of the service.
*/

const cfg = config();
const queue = new Queue(cfg);

let browser: Browser | null = null;
let stopping = false;
const inflight = new Map<string, ClaimedJob>();
const waiting = new Set<() => void>();

const log = (line: string) => console.log(`[render] ${new Date().toISOString()} ${line}`);

/* Sleep until the interval is up or something asks us to look now. */
function idle(ms: number) {
  return new Promise<void>((resolve) => {
    const wake = () => {
      clearTimeout(timer);
      waiting.delete(wake);
      resolve();
    };
    const timer = setTimeout(wake, ms);
    waiting.add(wake);
  });
}

const wakeAll = () => [...waiting].forEach((wake) => wake());

async function browserFor(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    log("launching chrome");
    browser = await launch(cfg);
  }
  return browser;
}

async function upload(job: ClaimedJob, files: { name: string; contentType: string; bytes: Uint8Array }[]) {
  const outputs = [];
  for (const file of files) {
    const storageId = await queue.upload(file.bytes, file.contentType);
    outputs.push({ storageId, name: file.name });
    log(`job ${job.jobId}: uploaded ${file.name} (${Math.round(file.bytes.length / 1024)} KB)`);
  }
  return outputs;
}

/*
  A job never outlives the claim Convex handed out: past that the queue assumes
  the worker is gone and gives the work to somebody else, and two workers
  uploading for one job is how a caller ends up with half a carousel.
*/
async function withDeadline<T>(ms: number, work: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const result = await work(controller.signal);
    /* Aborting closes the page, so `work` normally rejects with whatever the
       page was doing. Reporting the deadline instead of that is the difference
       between "Render exceeded 300s" and "Target page closed". */
    if (controller.signal.aborted) throw new RenderFailure(`Render exceeded ${Math.round(ms / 1000)}s`, true);
    return result;
  } catch (error) {
    if (controller.signal.aborted) throw new RenderFailure(`Render exceeded ${Math.round(ms / 1000)}s`, true);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function run(chrome: Browser, job: ClaimedJob) {
  inflight.set(job.jobId, job);
  const started = Date.now();
  log(`job ${job.jobId}: ${job.format} for project ${job.projectId}`);
  try {
    const files = await withDeadline(Math.min(job.timeoutMs, cfg.jobTimeoutMs), (signal) =>
      renderJob(chrome, cfg, job, (line) => log(`job ${job.jobId}: ${line}`), signal),
    );
    await queue.complete(job.jobId, await upload(job, files));
    log(`job ${job.jobId}: done in ${Math.round((Date.now() - started) / 1000)}s`);
  } catch (error) {
    const retry = error instanceof RenderFailure ? error.retry : true;
    const reason = error instanceof RenderFailure ? error.message : errorMessage(error);
    log(`job ${job.jobId}: failed — ${reason}`);
    try {
      const requeued = await queue.fail(job.jobId, reason, retry);
      if (requeued) log(`job ${job.jobId}: requeued`);
    } catch (report) {
      /* The job is already gone (swept, or finished by the attempt that
         replaced this one). Nothing to do but say so. */
      log(`job ${job.jobId}: could not report the failure — ${errorMessage(report)}`);
    }
  } finally {
    inflight.delete(job.jobId);
  }
}

/* One turn: a job if there is one, false if the queue was empty. */
async function turn(): Promise<boolean> {
  const job = await queue.claim();
  if (!job) return false;
  await run(await browserFor(), job);
  return true;
}

async function lane(id: number) {
  log(`lane ${id} started`);
  while (!stopping) {
    try {
      if (await turn()) continue;
    } catch (error) {
      /* Convex unreachable, secret rejected: back off and try again rather
         than exiting, so a deploy or a rotated key heals on its own. */
      log(`lane ${id}: ${errorMessage(error)}`);
      await idle(Math.max(cfg.pollMs, 5000));
      continue;
    }
    await idle(cfg.pollMs);
  }
  log(`lane ${id} stopped`);
}

/*
  Health for the platform, and a nudge for whoever enqueued something. Both are
  plain HTTP because everything that calls them — Fly's checks, a Convex HTTP
  action later — speaks that and nothing else.
*/
function serve() {
  const server = createServer((request, response) => {
    const url = request.url ?? "/";
    if (url.startsWith("/healthz")) {
      const body = JSON.stringify({ status: stopping ? "stopping" : "ok", inflight: inflight.size, concurrency: cfg.concurrency });
      response.writeHead(200, { "Content-Type": "application/json" }).end(body);
      return;
    }
    if (url.startsWith("/wake")) {
      wakeAll();
      response.writeHead(202, { "Content-Type": "application/json" }).end(`{"woken":true}`);
      return;
    }
    response.writeHead(404).end();
  });
  server.listen(cfg.port, () => log(`health on :${cfg.port}`));
  return server;
}

async function shutdown(signal: string, server: ReturnType<typeof serve>) {
  if (stopping) return;
  stopping = true;
  log(`${signal}: finishing ${inflight.size} job(s)`);
  wakeAll();
  const deadline = Date.now() + cfg.jobTimeoutMs;
  while (inflight.size && Date.now() < deadline) await new Promise((r) => setTimeout(r, 250));
  await browser?.close().catch(() => {});
  server.close();
  process.exit(0);
}

async function main() {
  log(`convex ${cfg.convexUrl} · app ${cfg.appUrl} · concurrency ${cfg.concurrency}`);

  /* `--once` drains what is queued and exits: what a verification script and a
     one-off backfill both want, and the only way to run the worker without a
     process that never returns. */
  if (process.argv.includes("--once")) {
    let rendered = 0;
    while (await turn()) rendered++;
    await browser?.close().catch(() => {});
    log(`rendered ${rendered} job(s)`);
    return;
  }

  const server = serve();
  process.on("SIGINT", () => void shutdown("SIGINT", server));
  process.on("SIGTERM", () => void shutdown("SIGTERM", server));
  await Promise.all(Array.from({ length: cfg.concurrency }, (_, i) => lane(i + 1)));
}

main().catch((error) => {
  log(`fatal: ${errorMessage(error)}`);
  process.exit(1);
});
