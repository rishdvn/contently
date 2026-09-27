import type { Project } from "@/lib/editor/types";

/*
  What every headless render page does before and after it rasterises: wait for
  the scene to be paintable, and hand bytes to a Node process one base64 slice
  at a time. Shared by `/render/<projectId>` (the render worker) and
  `/render/stage` (the block preview and template poster scripts), so a fix to
  how a page waits for fonts reaches both.
*/

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/* Two frames: one for React to commit the scene, one for the browser to lay it
   out and paint it. The video exporter waits the same way. */
export async function settle() {
  await nextFrame();
  await nextFrame();
}

/*
  Web fonts, before anything is rasterised. `document.fonts.ready` only covers
  faces the browser has already decided to load, and a scene that is not mounted
  yet has asked for none of them — so every family the document names is
  requested explicitly first.
*/
export async function loadFonts(project: Project, timeoutMs = 15_000) {
  const wanted = new Set<string>();
  for (const slide of project.slides) {
    for (const block of slide.blocks) {
      if (block.type === "text") wanted.add(`${block.italic ? "italic " : ""}${block.fontWeight} 64px "${block.fontFamily}"`);
    }
  }
  const deadline = new Promise<void>((r) => setTimeout(r, timeoutMs));
  const fonts = Promise.all([...wanted].map((font) => document.fonts.load(font).catch(() => []))).then(() => document.fonts.ready.then(() => {}));
  /* A font server that is slow or blocked costs one render its typeface, not
     the whole job: the page falls back to the system stack, as a browser does. */
  await Promise.race([fonts, deadline]);
}

export function errorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "data" in error) {
    const data = (error as { data?: unknown }).data;
    if (typeof data === "object" && data !== null && "message" in data) return String((data as { message: unknown }).message);
  }
  return error instanceof Error ? error.message : String(error);
}

/*
  A staged file, base64, in slices. A render is megabytes and the only way
  across the CDP connection is a string, so the caller reads it in pieces
  rather than asking for one string the size of the video.
*/
export function base64Slice(bytes: Uint8Array, offset: number, length: number) {
  const slice = bytes.subarray(offset, offset + length);
  let binary = "";
  /* In chunks: `String.fromCharCode(...slice)` on a megabyte overflows the
     argument list. */
  for (let i = 0; i < slice.length; i += 8192) binary += String.fromCharCode(...slice.subarray(i, i + 8192));
  return btoa(binary);
}
