"use client";

import { toCanvas } from "html-to-image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { waitForMedia, waitForPaintableMedia } from "@/lib/editor/media";
import { useStoredPosterKey, useUploadPoster } from "@/lib/editor/persistence";
import { POSTER_WIDTH, posterKey, posterTime } from "@/lib/editor/poster";
import { useEditor } from "@/lib/editor/store";
import type { Project } from "@/lib/editor/types";

import { SlidePreview } from "./canvas/Artboard";
import { PlaybackContext } from "./canvas/playback";

/* How long the document has to sit still before a poster is taken. Longer
   than the autosave's beat: a poster is for the grid, not for safety. */
const QUIET_MS = 3000;

type Job = { key: string; project: Project };

/*
  Keeps the project's poster in step with its first scene. A few seconds after
  the document last changed — and only while nothing is playing, being dragged
  or typed into, and the browser is idle — the first scene is drawn off screen
  at its settled frame, rasterised the way the filmstrip is, and uploaded.

  Nothing happens when the first scene is what the stored poster was taken
  from (`posterKey`), so opening a project or editing a later scene costs
  nothing. A project from before posters gets one the first time it is opened.
*/
export function PosterCapture({ projectId }: { projectId: string }) {
  const stored = useStoredPosterKey(projectId);
  const upload = useUploadPoster();
  const [job, setJob] = useState<Job | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  /* The key being taken or last taken, so one poster is not taken twice
     while the server's answer is on its way back. */
  const taken = useRef<string | null>(null);

  useEffect(() => {
    if (stored === undefined) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let idle: number | null = null;

    const busy = () => {
      const s = useEditor.getState();
      return s.interacting || s.playing || s.editingTextId !== null;
    };
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(check, QUIET_MS);
    };
    const check = () => {
      timer = null;
      const { project } = useEditor.getState();
      if (project.id !== projectId || !project.slides.length) return;
      const key = posterKey(project);
      if (key === stored || key === taken.current) return;
      /* Playing, dragging or typing: look again once it has been quiet a while. */
      if (busy()) return schedule();
      idle = whenIdle(() => {
        idle = null;
        if (busy()) return schedule();
        taken.current = key;
        setJob({ key, project });
      });
    };

    schedule();
    const unsubscribe = useEditor.subscribe((s, prev) => {
      if (s.project !== prev.project) schedule();
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
      if (idle !== null) cancelIdle(idle);
    };
  }, [projectId, stored]);

  useEffect(() => {
    if (!job) return;
    let cancelled = false;
    (async () => {
      try {
        await waitForMedia(job.project);
        await nextFrame();
        await nextFrame();
        const node = stage.current;
        if (!node || cancelled) return;
        await waitForPaintableMedia(node);
        await waitForSeeks(node);
        await document.fonts.ready;
        if (cancelled) return;
        performance.mark("poster-capture");
        const canvas = await toCanvas(node, { pixelRatio: 1, cacheBust: false });
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
        if (!blob || cancelled) return;
        await upload(projectId, blob, job.key);
      } catch (error) {
        /* Cross-origin media without CORS, or a dropped connection: no poster
           this time, and the next edit tries again. */
        console.warn("Couldn't update the project poster", error);
        taken.current = null;
      } finally {
        if (!cancelled) setJob(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [job, projectId, upload]);

  if (!job) return null;
  const scene = job.project.slides[0];
  const { kind, width, height } = job.project;
  return createPortal(
    <div aria-hidden className="pointer-events-none fixed top-0 left-[-100000px]">
      <div ref={stage}>
        <PlaybackContext.Provider value={{ kind, time: posterTime(job.project, scene), playing: false, muted: true }}>
          <SlidePreview slide={scene} scale={POSTER_WIDTH / width} size={{ width, height }} />
        </PlaybackContext.Provider>
      </div>
    </div>,
    document.body,
  );
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/* Clips seek to the poster's moment once mounted; wait for them to land. */
async function waitForSeeks(node: HTMLElement, timeoutMs = 3000) {
  const videos = Array.from(node.querySelectorAll("video"));
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline && videos.some((v) => v.seeking)) await new Promise((r) => setTimeout(r, 30));
}

/* Safari has no requestIdleCallback; a short timeout is the usual stand-in. */
function whenIdle(cb: () => void): number {
  if (typeof window.requestIdleCallback === "function") return window.requestIdleCallback(cb, { timeout: 2000 });
  return window.setTimeout(cb, 50);
}

function cancelIdle(handle: number) {
  if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(handle);
  else window.clearTimeout(handle);
}
