"use client";

import { useConvex, type ConvexReactClient } from "convex/react";
import { useEffect, useSyncExternalStore } from "react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { sceneOffsets } from "./geometry";
import { useEditor } from "./store";
import type { AudioTrack } from "./types";

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

/* ── Tracks ────────────────────────────────────────────────────────────── */

/* The URL a lane track plays from: a live one for library audio, the saved
   `src` if that cannot be had (or for anything that never came from the
   library). Empty when there is nothing to play at all. */
export function trackUrl(convex: ConvexReactClient | undefined, track: Pick<AudioTrack, "trackId" | "src">): Promise<string> {
  if (!track.trackId) return Promise.resolve(track.src ?? "");
  return playableUrl(convex, track.trackId).catch(() => track.src ?? "");
}

/* Longest fade either end may have; the inspector offers 0–3 s. */
export const MAX_FADE = 3;

/* The two fades never overlap: on a pill shorter than both together, each
   gets at most half of it. */
export function fadeLengths(track: Pick<AudioTrack, "fadeIn" | "fadeOut" | "duration">) {
  const half = track.duration / 2;
  return {
    fadeIn: Math.min(Math.max(track.fadeIn ?? 0, 0), MAX_FADE, half),
    fadeOut: Math.min(Math.max(track.fadeOut ?? 0, 0), MAX_FADE, half),
  };
}

/* 0–1 envelope at `t` seconds into the pill — the same linear ramps the export
   mix schedules, so what plays in the studio is what the file sounds like. */
export function fadeGain(track: Pick<AudioTrack, "fadeIn" | "fadeOut" | "duration">, t: number) {
  const { fadeIn, fadeOut } = fadeLengths(track);
  let gain = 1;
  if (fadeIn > 0) gain = Math.min(gain, t / fadeIn);
  if (fadeOut > 0) gain = Math.min(gain, (track.duration - t) / fadeOut);
  return Math.min(Math.max(gain, 0), 1);
}

/* ── Waveforms ─────────────────────────────────────────────────────────── */

/*
  Peaks for the lane's pills: the loudest sample in each 1/PEAKS_PER_SECOND of
  the source, 0–1, mono. Decoding is the expensive part (a three-minute song is
  some sixty megabytes of samples for a moment), so it happens once per file,
  one file at a time, and only the peaks are kept.
*/
export const PEAKS_PER_SECOND = 50;

type PeaksEntry = Float32Array | "error";
const peaks = new Map<string, PeaksEntry>();
const peaksWanted = new Set<string>();
const peaksListeners = new Set<() => void>();
let decodeQueue: Promise<void> = Promise.resolve();

function computePeaks(buffer: AudioBuffer) {
  const size = Math.max(1, Math.ceil(buffer.duration * PEAKS_PER_SECOND));
  const out = new Float32Array(size);
  const window = buffer.length / size;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < size; i++) {
      const from = Math.floor(i * window);
      const to = Math.min(data.length, Math.floor((i + 1) * window));
      let max = out[i];
      /* Every eighth sample is plenty for a line a few pixels tall, and an
         eighth of the work on a long file. */
      for (let j = from; j < to; j += 8) {
        const v = Math.abs(data[j]);
        if (v > max) max = v;
      }
      out[i] = max;
    }
  }
  return out;
}

function requestPeaks(convex: ConvexReactClient | undefined, key: string, track: Pick<AudioTrack, "trackId" | "src">) {
  if (peaks.has(key) || peaksWanted.has(key)) return;
  peaksWanted.add(key);
  decodeQueue = decodeQueue.then(async () => {
    let entry: PeaksEntry = "error";
    try {
      const url = await trackUrl(convex, track);
      if (url) {
        const bytes = await (await fetch(url)).arrayBuffer();
        entry = computePeaks(await new OfflineAudioContext(1, 1, 44_100).decodeAudioData(bytes));
      }
    } catch {
      /* A pill without a waveform is still a pill. */
    }
    peaks.set(key, entry);
    peaksWanted.delete(key);
    for (const listener of peaksListeners) listener();
  });
}

/* The peaks for a track's file, or null until they are ready (or if the file
   cannot be decoded). */
export function useWaveform(track: Pick<AudioTrack, "trackId" | "src">): Float32Array | null {
  const convex = useConvex();
  const key = track.trackId ?? track.src ?? "";
  useEffect(() => {
    if (key) requestPeaks(convex, key, track);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the key is the track's identity
  }, [convex, key]);
  const entry = useSyncExternalStore(
    (listener) => {
      peaksListeners.add(listener);
      return () => {
        peaksListeners.delete(listener);
      };
    },
    () => peaks.get(key),
    () => undefined,
  );
  return entry instanceof Float32Array ? entry : null;
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
      void trackUrl(convex, { trackId, src }).then((url) => {
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
        if (player.retried || !trackId || players.get(id) !== player) return;
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

        const into = now - track.start;
        el.volume = Math.min(Math.max((track.volume / 100) * fadeGain(track, into), 0), 1);
        el.muted = s.muted || !!track.muted;
        const inside = s.playing && into >= 0 && into < track.duration;
        const at = into + (track.offset ?? 0);
        /* A pill trimmed longer than its file: past the end is silence. Calling
           `play()` on an ended element would restart it from the top. */
        const past = Number.isFinite(el.duration) && at >= el.duration;
        if (inside && player.ready && !past) {
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
