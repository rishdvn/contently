import type { Project, Slide } from "./types";

/*
  A project's poster: its first scene as a still, the picture the Projects grid,
  the share link's preview and the API show before anything plays. The studio
  takes it (`PosterCapture`); these are the parts that need no browser.
*/

/* Wide enough for a card on a large screen at 2x, small enough to stay a few
   tens of KB as a JPEG. */
export const POSTER_WIDTH = 640;

/*
  When in a video scene to take the still. Time zero is the one frame where
  every entrance animation has not started yet, so it is the worst choice: the
  poster wants the scene settled. That is the latest moment just before a block
  leaves with the most blocks on screen, the same rule `scripts/template-posters.ts`
  uses for templates. Stills and carousels have no clock.
*/
export function posterTime(project: Pick<Project, "kind">, scene: Slide): number {
  if (project.kind !== "video") return 0;
  const blocks = scene.blocks.filter((b) => !b.hidden);
  const epsilon = 1 / 30;
  const candidates = [...blocks.map((b) => Math.min(b.end ?? scene.duration, scene.duration)), scene.duration].map((t) => Math.max(0, t - epsilon));
  const visibleAt = (t: number) => blocks.filter((b) => (b.start ?? 0) <= t && t < (b.end ?? scene.duration)).length;
  let best = candidates[0]!;
  for (const t of candidates) if (visibleAt(t) > visibleAt(best) || (visibleAt(t) === visibleAt(best) && t < best)) best = t;
  return best;
}

/* Bumped when the way a poster is drawn changes, so every stored one is
   retaken the next time its project is open. */
const POSTER_VERSION = 1;

/*
  What the poster depends on, as a short string. The studio compares it with
  the key stored beside the poster and skips the capture when they match, so
  opening a project, or editing its third scene, uploads nothing.
*/
export function posterKey(project: Pick<Project, "kind" | "width" | "height" | "slides">): string {
  const scene = project.slides[0] ?? null;
  return hash(canonical([POSTER_VERSION, project.kind, project.width, project.height, scene]));
}

/* JSON with object keys sorted. Convex hands documents back with their keys
   in its own order, so the scene the studio loads and the scene it edited
   into the same state must still serialise alike. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/* cyrb53: fast, and 53 bits is plenty to tell one scene from its next edit. */
function hash(s: string) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
