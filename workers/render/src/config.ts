/*
  Everything the worker needs to know, read once at boot so a missing variable
  is a startup failure rather than a job that fails five minutes in.
*/

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required. See workers/render/README.md.`);
  return value;
}

function number(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${name} must be a number, got ${raw}`);
  return value;
}

export type Config = {
  convexUrl: string;
  /* The same secret as `RENDER_WORKER_SECRET` on the Convex deployment. */
  secret: string;
  /* Where the app is served from; the worker opens `<appUrl>/render/<id>`. */
  appUrl: string;
  chromePath: string | undefined;
  /* Jobs in flight on this instance. Each one is a Chrome tab rendering video
     frames, so this is bounded by CPU, not by sockets. */
  concurrency: number;
  pollMs: number;
  /* A job gets this long from claim to upload, matching `JOB_TIMEOUT_MS` in
     `convex/render.ts`; past it the queue assumes the worker is gone. */
  jobTimeoutMs: number;
  port: number;
};

export function config(): Config {
  return {
    convexUrl: required("CONVEX_URL"),
    secret: required("RENDER_WORKER_SECRET"),
    appUrl: required("APP_URL").replace(/\/+$/, ""),
    chromePath: process.env.CHROME_PATH,
    concurrency: Math.min(2, Math.max(1, Math.round(number("RENDER_CONCURRENCY", 1)))),
    pollMs: Math.max(250, number("RENDER_POLL_MS", 2000)),
    jobTimeoutMs: Math.max(30_000, number("RENDER_JOB_TIMEOUT_MS", 5 * 60 * 1000)),
    port: number("PORT", 8080),
  };
}
