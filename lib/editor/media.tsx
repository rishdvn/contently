"use client";

import { useQuery } from "convex/react";
import { useEffect, useMemo, useSyncExternalStore } from "react";

import { api } from "@/convex/_generated/api";

import type { Project } from "./types";

/*
  Turning `media` ids into URLs, once per page.

  A document stores ids; only Convex can mint the URL for a stored file. Doing
  that per block would mean one subscription per image — a carousel of twelve
  photos would open twelve — so ids are collected in this module and a single
  `<MediaUrlResolver />` subscribes to all of them. Components read the answer
  through `useMediaUrl`.

  The registry lives outside React because two of its readers are not components:
  the export path waits on it before rasterising, and the Uploads panel primes it
  with rows it already has so a freshly placed upload paints without a round trip.
*/

export type ResolvedMedia = { url: string | null; posterUrl: string | null };

const resolved = new Map<string, ResolvedMedia>();
/* Ids currently on screen, reference counted: a block unmounting should stop us
   asking for its media, but two blocks sharing one upload should not. */
const wanted = new Map<string, number>();
const listeners = new Set<() => void>();

/* The query argument, as a string so that `useSyncExternalStore` can compare it. */
let wantedKey = "";

function notify() {
  wantedKey = [...wanted.keys()].sort().join(" ");
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function retain(id: string) {
  wanted.set(id, (wanted.get(id) ?? 0) + 1);
  if (wanted.get(id) === 1) notify();
}

function release(id: string) {
  const next = (wanted.get(id) ?? 0) - 1;
  if (next > 0) {
    wanted.set(id, next);
    return;
  }
  wanted.delete(id);
  notify();
}

/*
  Rows we already have from another query. The resolver would arrive at the same
  answer a round trip later; skipping that is the difference between a tile
  appearing on the canvas instantly and appearing after a blank frame.
*/
export function primeMedia(items: { id: string; url: string | null; posterUrl?: string | null }[]) {
  let changed = false;
  for (const item of items) {
    const current = resolved.get(item.id);
    if (current?.url === item.url && current?.posterUrl === (item.posterUrl ?? null)) continue;
    resolved.set(item.id, { url: item.url, posterUrl: item.posterUrl ?? null });
    changed = true;
  }
  if (changed) notify();
}

/*
  The URL for one media id, or `fallback` while the answer is outstanding — the
  saved `src` is the best guess we have and is usually still correct, so the
  canvas does not flash a placeholder on every load. Once the answer is in, it
  wins: an id whose row is gone resolves to `""`, which paints "media not
  available" instead of a broken image.
*/
export function useMediaUrl(mediaId: string | undefined, fallback = ""): string {
  useEffect(() => {
    if (!mediaId) return;
    retain(mediaId);
    return () => release(mediaId);
  }, [mediaId]);

  const entry = useSyncExternalStore(
    subscribe,
    () => (mediaId ? resolved.get(mediaId) : undefined),
    () => undefined,
  );

  if (!mediaId) return fallback;
  if (!entry) return fallback;
  return entry.url ?? "";
}

/* The poster frame generated for a video upload, if it has one. Registers the id
   like `useMediaUrl` does, so it works on its own as well as beside it. */
export function useMediaPoster(mediaId: string | undefined): string | undefined {
  useEffect(() => {
    if (!mediaId) return;
    retain(mediaId);
    return () => release(mediaId);
  }, [mediaId]);

  const entry = useSyncExternalStore(
    subscribe,
    () => (mediaId ? resolved.get(mediaId) : undefined),
    () => undefined,
  );
  return entry?.posterUrl ?? undefined;
}

/*
  Mounted once, inside the Convex provider. Renders nothing: it exists so that
  the ids components have asked for become one live query whose results land in
  the registry.
*/
export function MediaUrlResolver() {
  const key = useSyncExternalStore(
    subscribe,
    () => wantedKey,
    () => "",
  );
  const ids = useMemo(() => (key ? key.split(" ") : []), [key]);
  const rows = useQuery(api.media.resolve, ids.length ? { ids } : "skip");

  useEffect(() => {
    if (rows) primeMedia(rows);
  }, [rows]);

  return null;
}

/* Every media id a document mentions — blocks and slide backgrounds alike. */
export function mediaIdsIn(project: Project): string[] {
  const ids = new Set<string>();
  for (const slide of project.slides) {
    if (slide.background.type === "image" && slide.background.mediaId) ids.add(slide.background.mediaId);
    for (const block of slide.blocks) {
      if ((block.type === "image" || block.type === "video") && block.mediaId) ids.add(block.mediaId);
    }
  }
  return [...ids];
}

/*
  Hold until every id in the document has an answer. Exports go through here
  first: rasterising a project that was opened a moment ago would otherwise bake
  in the placeholders of blocks whose URLs had not arrived. Times out rather than
  hanging — a missing file should cost one slow export, not the whole dialog.
*/
export async function waitForMedia(project: Project, timeoutMs = 10_000): Promise<void> {
  const ids = mediaIdsIn(project);
  if (!ids.length) return;

  /* Nothing has asked for these (an export from a page that never rendered the
     document), so ask on their behalf and keep the request alive until resolved. */
  for (const id of ids) retain(id);
  try {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline && ids.some((id) => !resolved.has(id))) {
      await new Promise((r) => setTimeout(r, 50));
    }
  } finally {
    for (const id of ids) release(id);
  }
}

/*
  Wait for the pixels, not just the URLs: <img> elements that have not decoded
  and <video> elements without a frame both rasterise as nothing.
*/
export async function waitForPaintableMedia(node: HTMLElement, timeoutMs = 10_000): Promise<void> {
  const images = Array.from(node.querySelectorAll("img"));
  const videos = Array.from(node.querySelectorAll("video"));
  const deadline = Date.now() + timeoutMs;
  while (
    Date.now() < deadline &&
    (images.some((img) => img.src && !img.complete) || videos.some((video) => video.src && video.readyState < 2))
  ) {
    await new Promise((r) => setTimeout(r, 50));
  }
}
