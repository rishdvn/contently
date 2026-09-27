"use client";

import { useConvex, type ConvexReactClient } from "convex/react";
import { useEffect, useSyncExternalStore } from "react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { sceneOffsets } from "./geometry";
import { useEditor } from "./store";

/*
  Sound, in two places: the Audio panel's preview, and the audio lane playing
  in step with the studio's transport.

  Both play library tracks, and a library track's URL is not a fact about the
  document. Soundstripe signs its CDN URLs for about a week, so a project saved
  today would be silent next month if it trusted the URL it was given. Tracks
  carry their `audioTracks` id and ask `getPlayableUrl` for a live URL when they
  are about to play; the saved `src` is only a fallback for when that fails.
*/

/* ── Live URLs ─────────────────────────────────────────────────────────── */

/* Closer to expiry than this and a URL is asked for again. The server refreshes
   anything within fifteen minutes of expiry, so this never asks it for one it
   would hand straight back. */
const EXPIRY_MARGIN_MS = 5 * 60 * 1000;

type LiveUrl = { url: string; expiresAt: number | null };

const liveUrls = new Map<string, LiveUrl>();
const inflight = new Map<string, Promise<string>>();

const isLive = (entry: LiveUrl) => entry.expiresAt === null || entry.expiresAt - Date.now() > EXPIRY_MARGIN_MS;

/* A URL we already hold from a search result: previewing a row should not cost
   a round trip for an answer the list already gave. */
function primeUrl(trackId: string, url: string | null, expiresAt: number | null) {
  if (!url) return;
  const entry = { url, expiresAt };
  if (isLive(entry)) liveUrls.set(trackId, entry);
}

export function playableUrl(convex: ConvexReactClient | undefined, trackId: string): Promise<string> {
  const cached = liveUrls.get(trackId);
  if (cached && isLive(cached)) return Promise.resolve(cached.url);
  if (!convex) return Promise.reject(new Error("Audio needs a Convex deployment"));

  const pending = inflight.get(trackId);
  if (pending) return pending;
  const request = convex
    .action(api.audio.library.getPlayableUrl, { trackId: trackId as Id<"audioTracks"> })
    .then(({ url, expiresAt }) => {
      liveUrls.set(trackId, { url, expiresAt });
      return url;
    })
    .finally(() => inflight.delete(trackId));
  inflight.set(trackId, request);
  return request;
}

/* ── Preview ───────────────────────────────────────────────────────────── */

/*
  One element for the whole panel, which is what makes "only one plays at once"
  true by construction rather than by every row agreeing to stop the others.
*/

export type PreviewStatus = "idle" | "loading" | "playing" | "paused" | "error";
type PreviewSnapshot = { trackId: string | null; status: PreviewStatus };

export type PreviewableTrack = { id: string; previewUrl: string | null; previewExpiresAt: number | null };

let preview: PreviewSnapshot = { trackId: null, status: "idle" };
let previewEl: HTMLAudioElement | null = null;
/* Bumped by every request, so a URL that arrives after the user has moved on to
   another row is dropped instead of playing over it. */
let previewRequest = 0;
const previewListeners = new Set<() => void>();

function setPreview(next: PreviewSnapshot) {
  preview = next;
  for (const listener of previewListeners) listener();
}

function previewElement() {
  if (previewEl) return previewEl;
  const el = new Audio();
  el.preload = "auto";
  el.addEventListener("playing", () => {
    if (preview.trackId) setPreview({ ...preview, status: "playing" });
  });
  /* A pause we caused while switching rows arrives after the next row is
     already loading; only a playing row can become a paused one. */
  el.addEventListener("pause", () => {
    if (preview.status === "playing") setPreview({ ...preview, status: "paused" });
  });
  el.addEventListener("ended", () => {
    el.currentTime = 0;
    if (preview.trackId) setPreview({ ...preview, status: "paused" });
  });
  el.addEventListener("error", () => {
    if (preview.trackId && el.getAttribute("src")) setPreview({ ...preview, status: "error" });
  });
  previewEl = el;
  return el;
}

export function togglePreview(convex: ConvexReactClient | undefined, track: PreviewableTrack) {
  const el = previewElement();
  const same = preview.trackId === track.id && preview.status !== "error";

  if (same && (preview.status === "playing" || preview.status === "loading")) {
    previewRequest++;
    el.pause();
    setPreview({ trackId: track.id, status: "paused" });
    return;
  }

  /* The studio and a preview at once is two songs over each other. */
  if (useEditor.getState().playing) useEditor.getState().setPlaying(false);

  if (same && el.getAttribute("src")) {
    el.play().catch(() => setPreview({ trackId: track.id, status: "error" }));
    return;
  }

  const mine = ++previewRequest;
  el.pause();
  setPreview({ trackId: track.id, status: "loading" });
  primeUrl(track.id, track.previewUrl, track.previewExpiresAt);
  playableUrl(convex, track.id)
    .then((url) => {
      if (mine !== previewRequest) return;
      el.src = url;
      return el.play();
    })
    .catch(() => {
      if (mine === previewRequest) setPreview({ trackId: track.id, status: "error" });
    });
}

export function stopPreview() {
  previewRequest++;
  if (previewEl) {
    previewEl.pause();
    previewEl.removeAttribute("src");
    previewEl.load();
  }
  if (preview.trackId) setPreview({ trackId: null, status: "idle" });
}

/* Jump the current preview to a fraction of its length — the progress line is
   also a scrubber. */
export function seekPreview(fraction: number) {
  const el = previewEl;
  if (!el || !Number.isFinite(el.duration)) return;
  el.currentTime = Math.min(Math.max(fraction, 0), 1) * el.duration;
}

/* Where the preview is, read per frame by the row that shows it rather than
   pushed through React: a progress line re-rendering the list sixty times a
   second is the wrong way round. */
export function previewPosition() {
  const el = previewEl;
  if (!el || !Number.isFinite(el.duration) || el.duration <= 0) return null;
  return { time: el.currentTime, duration: el.duration };
}

export function usePreview(): PreviewSnapshot {
  return useSyncExternalStore(
    (listener) => {
      previewListeners.add(listener);
      return () => {
        previewListeners.delete(listener);
      };
    },
    () => preview,
    () => preview,
  );
}

/* ── The audio lane ────────────────────────────────────────────────────── */

type LanePlayer = { el: HTMLAudioElement; key: string; ready: boolean; retried: boolean };

/*
  Plays the project's audio tracks against the transport. One element per
  track, created when the track appears and dropped when it goes; each frame of
  playback puts every element where the playhead says it should be.

  Runs from a store subscription rather than React state: the transport ticks
  once a frame, and the elements are not something React renders.
*/
export function useAudioLane() {
  const convex = useConvex();

  useEffect(() => {
    const players = new Map<string, LanePlayer>();

    const load = (id: string, player: LanePlayer, trackId: string | undefined, src: string | undefined) => {
      const resolve = trackId ? playableUrl(convex, trackId).catch(() => src ?? "") : Promise.resolve(src ?? "");
      void resolve.then((url) => {
        /* The track may have been removed, or re-pointed, while we asked. */
        if (!url || players.get(id) !== player) return;
        player.el.src = url;
        player.ready = true;
        sync();
      });
    };

    const create = (id: string, key: string, trackId: string | undefined, src: string | undefined) => {
      const el = new Audio();
      el.preload = "auto";
      const player: LanePlayer = { el, key, ready: false, retried: false };
      /* A URL that died between being resolved and being played — the tab was
         left open over the week a signature lasts. Ask once more, then give up
         rather than looping on a track that has gone for good. */
      el.addEventListener("error", () => {
        if (player.retried || !trackId) return;
        player.retried = true;
        player.ready = false;
        liveUrls.delete(trackId);
        load(id, player, trackId, undefined);
      });
      players.set(id, player);
      load(id, player, trackId, src);
      return player;
    };

    const dispose = (id: string) => {
      const player = players.get(id);
      if (!player) return;
      players.delete(id);
      player.el.pause();
      player.el.removeAttribute("src");
      player.el.load();
    };

    function sync() {
      const s = useEditor.getState();
      const { project } = s;
      const index = project.slides.findIndex((slide) => slide.id === s.activeSlideId);
      const now = (sceneOffsets(project)[index] ?? 0) + s.time;
      const present = new Set<string>();

      for (const track of project.audio) {
        present.add(track.id);
        const key = `${track.id}:${track.trackId ?? track.src ?? ""}`;
        let player = players.get(track.id);
        if (player && player.key !== key) {
          dispose(track.id);
          player = undefined;
        }
        player ??= create(track.id, key, track.trackId, track.src);
        const { el } = player;

        el.volume = Math.min(Math.max(track.volume / 100, 0), 1);
        el.muted = s.muted;
        const inside = s.playing && now >= track.start && now < track.start + track.duration;
        if (inside && player.ready) {
          const at = now - track.start;
          /* The audio clock and the transport's drift apart slowly; only a real
             gap is worth the audible skip of correcting it. */
          if (Math.abs(el.currentTime - at) > 0.3) el.currentTime = at;
          if (el.paused) el.play().catch(() => {});
        } else if (!el.paused) {
          el.pause();
        }
      }

      for (const id of [...players.keys()]) if (!present.has(id)) dispose(id);
    }

    const unsubscribe = useEditor.subscribe((s, prev) => {
      /* Pressing play means the studio has the speakers. */
      if (s.playing && !prev.playing) stopPreview();
      if (s.project !== prev.project || s.playing !== prev.playing || s.time !== prev.time || s.muted !== prev.muted || s.activeSlideId !== prev.activeSlideId) sync();
    });
    sync();

    return () => {
      unsubscribe();
      for (const id of [...players.keys()]) dispose(id);
    };
  }, [convex]);
}
