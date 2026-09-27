"use client";

import { useMemo, useSyncExternalStore } from "react";

import type { PlayableTrack } from "@/convex/audio/library";

/*
  The Audio flyout's "Recently used": the tracks this browser last previewed or
  put on a timeline, newest first, one list per tab. It is a convenience, not a
  record, so it lives in localStorage rather than Convex.

  Each entry keeps only what a row draws. Its `previewUrl` may be long expired
  by the time it is played again; that is fine, because preview and the lane
  both go through `playableUrl`, which only trusts a URL that is still live.
*/

export type RecentTrack = Pick<
  PlayableTrack,
  "id" | "provider" | "kind" | "title" | "artist" | "duration" | "mood" | "genre" | "categories" | "tags" | "artworkUrl" | "previewUrl" | "previewExpiresAt"
>;

/* Butter keeps a short list; this is enough for its "See more". */
const MAX_RECENT = 30;
const storageKey = (kind: RecentTrack["kind"]) => `contently.audio.recent.v1.${kind}`;

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function subscribe(cb: () => void) {
  listeners.add(cb);
  /* Another tab adding a track should show up here too. */
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function read(raw: string): RecentTrack[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((t): t is RecentTrack => typeof t?.id === "string" && typeof t?.title === "string") : [];
  } catch {
    return [];
  }
}

/* Moves the track to the front, or puts it there. */
export function rememberTrack(track: RecentTrack) {
  const key = storageKey(track.kind);
  const entry: RecentTrack = {
    id: track.id,
    provider: track.provider,
    kind: track.kind,
    title: track.title,
    artist: track.artist,
    duration: track.duration,
    mood: track.mood,
    genre: track.genre,
    categories: track.categories,
    tags: track.tags,
    artworkUrl: track.artworkUrl,
    previewUrl: track.previewUrl,
    previewExpiresAt: track.previewExpiresAt,
  };
  try {
    const list = read(window.localStorage.getItem(key) ?? "").filter((t) => t.id !== track.id);
    window.localStorage.setItem(key, JSON.stringify([entry, ...list].slice(0, MAX_RECENT)));
  } catch {
    /* Storage full or blocked: the list just doesn't grow. */
    return;
  }
  notify();
}

/* The snapshot is the stored string itself, so it only changes when storage
   does — `useSyncExternalStore` compares it by identity. */
export function useRecentTracks(kind: RecentTrack["kind"]): RecentTrack[] {
  const raw = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(storageKey(kind)) ?? "",
    () => "",
  );
  return useMemo(() => read(raw), [raw]);
}
