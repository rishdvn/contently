import { SLIDE_GAP, type Project, type Rect, type Viewport } from "./types";

/* Slides sit side by side on the world plane, the first at the origin. */
export function slideOrigin(p: Project, index: number) {
  return { x: index * (p.width + SLIDE_GAP), y: 0 };
}

export function slideRect(p: Project, index: number): Rect {
  const o = slideOrigin(p, index);
  return { x: o.x, y: o.y, w: p.width, h: p.height };
}

export function worldBounds(p: Project): Rect {
  const n = p.slides.length;
  return { x: 0, y: 0, w: n * p.width + (n - 1) * SLIDE_GAP, h: p.height };
}

export function worldToScreen(v: Viewport, x: number, y: number) {
  return { x: v.x + x * v.zoom, y: v.y + y * v.zoom };
}

export function screenToWorld(v: Viewport, x: number, y: number) {
  return { x: (x - v.x) / v.zoom, y: (y - v.y) / v.zoom };
}

/*
  The viewport that centres `rect` inside `area` (screen px, relative to the
  canvas element) with breathing room. `area` is the region not covered by
  floating panels, so "fit" means fit between them, not behind them.
*/
export function fitViewport(rect: Rect, area: Rect, padding = 48): Viewport {
  const zoom = Math.min((area.w - padding * 2) / rect.w, (area.h - padding * 2) / rect.h);
  const z = clampZoom(zoom);
  return {
    zoom: z,
    x: area.x + (area.w - rect.w * z) / 2 - rect.x * z,
    y: area.y + (area.h - rect.h * z) / 2 - rect.y * z,
  };
}

export const MIN_ZOOM = 0.02;
export const MAX_ZOOM = 8;
export const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

/* Zoom about a screen point so the world under the cursor stays put. */
export function zoomAt(v: Viewport, nextZoom: number, sx: number, sy: number): Viewport {
  const z = clampZoom(nextZoom);
  const w = screenToWorld(v, sx, sy);
  return { zoom: z, x: sx - w.x * z, y: sy - w.y * z };
}

export function unionRects(rects: Rect[]): Rect | null {
  if (!rects.length) return null;
  const x1 = Math.min(...rects.map((r) => r.x));
  const y1 = Math.min(...rects.map((r) => r.y));
  const x2 = Math.max(...rects.map((r) => r.x + r.w));
  const y2 = Math.max(...rects.map((r) => r.y + r.h));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/* Axis-aligned bounds of a rotated rect, in the same frame as the rect. */
export function rotatedBounds(r: Rect, deg: number): Rect {
  if (!deg) return r;
  const rad = (deg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const w = r.w * cos + r.h * sin;
  const h = r.w * sin + r.h * cos;
  return { x: r.x + r.w / 2 - w / 2, y: r.y + r.h / 2 - h / 2, w, h };
}

export const round = (n: number, dp = 0) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

export function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/*
  Video projects play their scenes back to back. The store keeps `time` local
  to the active scene; these helpers translate to and from the global
  timeline position the ruler and playhead use.
*/
export function sceneOffsets(p: Project): number[] {
  const out: number[] = [];
  let t = 0;
  for (const s of p.slides) {
    out.push(t);
    t += s.duration;
  }
  return out;
}

export const totalDuration = (p: Project) => p.slides.reduce((a, s) => a + s.duration, 0);

export function sceneAt(p: Project, globalTime: number): { index: number; local: number } {
  const offsets = sceneOffsets(p);
  for (let i = p.slides.length - 1; i >= 0; i--) {
    if (globalTime >= offsets[i]) return { index: i, local: globalTime - offsets[i] };
  }
  return { index: 0, local: 0 };
}
