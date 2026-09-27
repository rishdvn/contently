/*
  What the render scripts share: a headless Chrome on `/render/stage`, the
  Convex CLI, and Convex storage uploads.

  The browser half is the render worker's (`workers/render/src/render.ts`): the
  same launch flags and the same `drain` over the same bridge, so a script and
  the worker cannot disagree about how a page is rasterised. That is also why
  these scripts run under the worker's `tsx`, resolve Playwright from its
  `node_modules`, and are typechecked by its `npm run check` rather than the
  app's `tsc` — see `npm run block-previews` in the root `package.json`.
*/

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { drain, launch } from "../../workers/render/src/render.js";

export { drain };

/* Playwright's types, by way of the worker: this folder has no `node_modules`
   of its own to import them from. */
type Browser = Awaited<ReturnType<typeof launch>>;
type Page = Parameters<typeof drain>[0];

export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/* ── Arguments ─────────────────────────────────────────────────────────── */

/* Flags after `--` go to `npx convex run` (`-- --prod`), as in `import-stock.ts`. */
export function parseArgs(argv = process.argv.slice(2)) {
  const split = argv.indexOf("--");
  const own = split === -1 ? argv : argv.slice(0, split);
  const passthrough = split === -1 ? [] : argv.slice(split + 1);
  const option = (name: string): string | undefined => {
    const index = own.indexOf(`--${name}`);
    return index === -1 ? undefined : own[index + 1];
  };
  const flag = (name: string) => own.includes(`--${name}`);
  return { option, flag, passthrough };
}

/* ── Convex ────────────────────────────────────────────────────────────── */

/*
  One function, through the CLI. Whichever deployment `npx convex run` would
  pick is the one written to: the dev deployment from `CONVEX_DEPLOYMENT`, or
  `CONVEX_DEPLOY_KEY` if set. Internal functions are callable this way and from
  nowhere else, which is what keeps the upload steps off the public API.
*/
export function convex(passthrough: string[]) {
  return function run<T>(fn: string, args: Record<string, unknown> = {}): T {
    const result = spawnSync("npx", ["convex", "run", fn, JSON.stringify(args), ...passthrough], {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    if (result.status !== 0) throw new Error(`npx convex run ${fn} failed:\n${result.stderr || result.stdout}`);
    /* A function that returns nothing prints nothing. */
    const output = result.stdout.trim();
    return (output ? JSON.parse(output) : null) as T;
  };
}

/* Bytes into Convex storage through a one-time upload URL. */
export async function upload(uploadUrl: string, bytes: Uint8Array, contentType: string): Promise<string> {
  const response = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": contentType }, body: bytes as unknown as BodyInit });
  if (!response.ok) throw new Error(`Upload failed: HTTP ${response.status} ${await response.text()}`);
  const { storageId } = (await response.json()) as { storageId: string };
  return storageId;
}

/* ── Browser ───────────────────────────────────────────────────────────── */

/* The app to render with. Never 127.0.0.1: Next answers 403 to its chunks from
   an origin it was not started on, and the page never hydrates (AGENTS.md). */
export const appUrl = () => (process.env.APP_URL ?? `http://localhost:${process.env.CONDUCTOR_PORT || 3000}`).replace(/\/$/, "");

/* A real Google Chrome: Chromium has no H.264 encoder, and the previews are MP4. */
export function chromePath(): string | undefined {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates = [
    "/opt/google/chrome/chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];
  return candidates.find((path) => existsSync(path));
}

export type StageInfo = {
  blocks: { id: string; name: string; category: string; fingerprint: string }[];
  spec: { artboard: number; scale: number; duration: number; fps: number; background: string };
};

/*
  The `/render/stage` bridge as seen from Node. It is the worker's
  `RenderBridge` (declared in `workers/render/src/bridge.ts`) plus what
  `components/render/Stage.tsx` adds; keep the two in step.
*/
type StageWindow = Window & {
  contently?: {
    status: string;
    blocks: StageInfo["blocks"];
    spec: StageInfo["spec"];
    load(project: unknown): Promise<void>;
    loadBlock(id: string, mode: "static" | "video"): Promise<void>;
    png(scene: number, scale?: number): Promise<number>;
    mp4(options?: { fps?: number; quality?: "medium" | "high" | "best"; scale?: number }): Promise<number>;
  };
};

export type Stage = {
  browser: Browser;
  page: Page;
  info: StageInfo;
  close(): Promise<void>;
};

export async function openStage(viewport: { width: number; height: number }): Promise<Stage> {
  const executablePath = chromePath();
  if (!executablePath) throw new Error("No Google Chrome found. Set CHROME_PATH (Chromium cannot encode the MP4 previews).");
  const browser = await launch({ chromePath: executablePath });
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.error(`  page exception: ${e.message}`));

  const url = `${appUrl()}/render/stage`;
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 }).catch((error: Error) => {
    throw new Error(`Could not open ${url} — is the app running? (${error.message})`);
  });
  if (response && response.status() >= 400) throw new Error(`${url} answered ${response.status()}`);
  await page.waitForFunction(() => (window as StageWindow).contently?.status === "ready", undefined, { timeout: 120_000 });
  const info = await page.evaluate(() => {
    const bridge = (window as StageWindow).contently!;
    return { blocks: bridge.blocks, spec: bridge.spec };
  });
  return { browser, page, info, close: () => browser.close() };
}

export async function loadBlock(page: Page, id: string, mode: "static" | "video") {
  await page.evaluate(([block, m]: readonly [string, "static" | "video"]) => (window as StageWindow).contently!.loadBlock(block, m), [id, mode] as const);
}

export async function loadDocument(page: Page, project: unknown) {
  await page.evaluate((doc: unknown) => (window as StageWindow).contently!.load(doc), project);
}

export async function png(page: Page, scene: number, scale: number): Promise<Uint8Array> {
  const length = await page.evaluate(([index, at]: readonly [number, number]) => (window as StageWindow).contently!.png(index, at), [scene, scale] as const);
  return await drain(page, length);
}

export async function mp4(page: Page, options: { fps: number; scale: number }): Promise<Uint8Array> {
  const length = await page.evaluate((o: { fps: number; scale: number }) => (window as StageWindow).contently!.mp4({ ...o, quality: "high" }), options);
  return await drain(page, length);
}
