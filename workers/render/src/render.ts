import JSZip from "jszip";
import { chromium, type Browser, type Page } from "playwright-core";

import "./bridge.js";
import type { Config } from "./config.js";
import type { ClaimedJob } from "./queue.js";

/*
  One job, from a URL to bytes.

  The worker never rasterises anything itself: it opens the app's `/render`
  route and asks the page to do it, because the page is the studio's own canvas
  and its own exporter. What lives here is the part a browser cannot do —
  waiting for the render to be deterministic, and carrying the result out.
*/

/* A failure the queue should try again (a crashed tab), as opposed to one it
   should not (a project that no longer exists). */
export class RenderFailure extends Error {
  constructor(
    message: string,
    readonly retry: boolean,
  ) {
    super(message);
    this.name = "RenderFailure";
  }
}

export type RenderedFile = { name: string; contentType: string; bytes: Uint8Array };

/* Base64 over the CDP connection, half a megabyte at a time: one string for a
   whole video would be tens of megabytes of JSON. */
const CHUNK = 512 * 1024;

export async function launch(cfg: Config): Promise<Browser> {
  return await chromium.launch({
    executablePath: cfg.chromePath,
    args: [
      /* Containers run as root and have a small /dev/shm; both are the usual
         reasons Chrome will not start in one. */
      "--no-sandbox",
      "--disable-dev-shm-usage",
      /* Clips have to start without a click, and no one is listening. */
      "--autoplay-policy=no-user-gesture-required",
      "--mute-audio",
      "--hide-scrollbars",
      /* One device pixel per CSS pixel, whatever the host thinks its display
         is: the artboard is measured in document pixels and the export
         multiplies them itself. */
      "--force-device-scale-factor=1",
    ],
  });
}

const safeName = (s: string) => s.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "render";

const pad = (n: number) => String(n).padStart(2, "0");

/* The page stages a file and hands back its length; this walks it out. */
async function drain(page: Page, length: number): Promise<Uint8Array> {
  const bytes = new Uint8Array(length);
  for (let offset = 0; offset < length; offset += CHUNK) {
    const slice = await page.evaluate(
      ([at, size]) => window.contently!.read(at as number, size as number),
      [offset, Math.min(CHUNK, length - offset)],
    );
    bytes.set(Buffer.from(slice, "base64"), offset);
  }
  await page.evaluate(() => window.contently!.clear());
  return bytes;
}

/* Wait for the page to say it has the document, its fonts and its media. */
async function open(page: Page, cfg: Config, job: ClaimedJob) {
  const scene = job.scene === undefined ? "" : `&scene=${job.scene}`;
  const url = `${cfg.appUrl}/render/${job.projectId}?token=${encodeURIComponent(job.token)}${scene}`;

  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  if (response && response.status() >= 400) {
    throw new RenderFailure(`The render route answered ${response.status()}`, true);
  }

  await page
    .waitForFunction(() => window.contently && window.contently.status !== "loading", undefined, { timeout: 120_000 })
    .catch(() => {
      throw new RenderFailure("The render page never became ready", true);
    });

  const state = await page.evaluate(() => ({ status: window.contently!.status, error: window.contently!.error, project: window.contently!.project }));
  /* The page could not load the document: a deleted project, an expired token.
     Nothing a second attempt would change. */
  if (state.status === "error" || !state.project) throw new RenderFailure(state.error ?? "The render page failed to load the project", false);

  await page.setViewportSize({
    width: Math.min(2400, Math.max(320, state.project.width)),
    height: Math.min(2400, Math.max(320, state.project.height)),
  });
  return state.project;
}

async function png(page: Page, scene: number, scale: number): Promise<Uint8Array> {
  const length = await page.evaluate(([index, at]) => window.contently!.png(index as number, at as number), [scene, scale]);
  return await drain(page, length);
}

/* Video is minutes of work with no output until the end, so the page's own
   progress is polled and logged: a silent worker and a hung one look alike. */
async function mp4(page: Page, fps: number, log: (line: string) => void): Promise<Uint8Array> {
  let last = -1;
  const ticker = setInterval(() => {
    void page
      .evaluate(() => window.contently?.progress ?? 0)
      .then((value) => {
        const percent = Math.round(value * 100);
        if (percent >= last + 10) {
          last = percent;
          log(`encoding ${percent}%`);
        }
      })
      .catch(() => {});
  }, 2000);

  try {
    const length = await page.evaluate(([rate]) => window.contently!.mp4({ fps: rate as number }), [fps]);
    return await drain(page, length);
  } finally {
    clearInterval(ticker);
  }
}

export async function renderJob(
  browser: Browser,
  cfg: Config,
  job: ClaimedJob,
  log: (line: string) => void,
  signal?: AbortSignal,
): Promise<RenderedFile[]> {
  const context = await browser.newContext({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 1,
    /* Everything the page draws with — fonts, Convex storage — is fetched over
       the network as a browser would, so no request interception here. */
    bypassCSP: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") log(`page error: ${m.text()}`);
  });
  page.on("pageerror", (e) => log(`page exception: ${e.message}`));
  /* Closing the context is how a render is cancelled: whatever the page was in
     the middle of rejects, and the tab goes with it rather than encoding
     frames nobody will collect. */
  const abandon = () => void context.close().catch(() => {});
  signal?.addEventListener("abort", abandon, { once: true });

  try {
    const project = await open(page, cfg, job);
    const base = safeName(project.name);
    const scale = job.scale && job.scale > 0 ? Math.min(4, job.scale) : 1;

    if (job.format === "mp4") {
      if (project.kind !== "video") throw new RenderFailure(`A ${project.kind} project has no video to render`, false);
      log(`rendering ${project.slides.length} scene(s) as MP4`);
      const bytes = await mp4(page, job.fps && job.fps > 0 ? Math.min(60, job.fps) : 30, log);
      return [{ name: `${base}.mp4`, contentType: "video/mp4", bytes }];
    }

    /* A scene was named: that one still, nothing else. Otherwise the whole
       document, in order — one file per slide, which is what a carousel is. */
    const scenes = job.scene === undefined ? project.slides.map((_, i) => i) : [job.scene];
    const stills: RenderedFile[] = [];
    for (const index of scenes) {
      log(`rendering scene ${index + 1}/${scenes.length} as PNG`);
      const bytes = await png(page, index, scale);
      const suffix = project.slides.length > 1 ? `-${pad(index + 1)}` : "";
      stills.push({ name: `${base}${suffix}.png`, contentType: "image/png", bytes });
    }

    if (job.format !== "carousel-zip") return stills;

    const zip = new JSZip();
    for (const still of stills) zip.file(still.name, still.bytes);
    /* PNG is already compressed; storing costs a second of CPU less per file
       and the zip is the same size either way. */
    const bytes = await zip.generateAsync({ type: "uint8array", compression: "STORE" });
    return [{ name: `${base}.zip`, contentType: "application/zip", bytes }];
  } finally {
    signal?.removeEventListener("abort", abandon);
    await context.close().catch(() => {});
  }
}
