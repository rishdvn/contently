"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { SlidePreview } from "@/components/editor/canvas/Artboard";
import { PlaybackContext, type Playback } from "@/components/editor/canvas/playback";
import { cn } from "@/lib/cn";
import type { Project } from "@/lib/editor/types";

/* How long a carousel preview rests on each slide before sliding on. */
export const CAROUSEL_DWELL = 2.4;

/*
  A self-contained transport for one project, independent of the studio store.
  Videos advance through their scenes in real time; carousels step through
  their slides on a fixed dwell; stills have no clock at all. `elapsed` and
  `total` are in seconds across the whole project so a progress bar can be
  drawn without knowing which kind it is.
*/
export type Clock = {
  index: number;
  /* Seconds into the active scene (video only). */
  time: number;
  elapsed: number;
  total: number;
  playing: boolean;
  seek: (elapsed: number) => void;
  goTo: (index: number) => void;
};

export function useProjectClock(project: Project, playing: boolean, { loop = true, resetOnStop = true }: { loop?: boolean; resetOnStop?: boolean } = {}): Clock {
  const kind = project.kind;
  const durations = useMemo(
    () => (kind === "video" ? project.slides.map((s) => s.duration) : kind === "carousel" ? project.slides.map(() => CAROUSEL_DWELL) : [0]),
    [kind, project.slides],
  );
  const total = useMemo(() => durations.reduce((a, b) => a + b, 0), [durations]);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!playing || total <= 0) return;
    let raf = 0;
    let last: number | null = null;
    const tick = (now: number) => {
      const dt = last === null ? 0 : (now - last) / 1000;
      last = now;
      setElapsed((e) => {
        const next = e + dt;
        if (next < total) return next;
        return loop ? next % total : total;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      /* A card that stops being hovered snaps back to its poster frame, as the reference does. */
      if (resetOnStop) setElapsed(0);
    };
  }, [playing, total, loop, resetOnStop]);

  let index = 0;
  let time = elapsed;
  for (let i = 0; i < durations.length; i++) {
    if (time < durations[i] || i === durations.length - 1) {
      index = i;
      break;
    }
    time -= durations[i];
  }
  if (kind !== "video") time = 0;

  const seek = useCallback((e: number) => setElapsed(Math.min(Math.max(0, e), total)), [total]);
  const goTo = useCallback(
    (i: number) => {
      const clamped = Math.min(Math.max(0, i), durations.length - 1);
      setElapsed(durations.slice(0, clamped).reduce((a, b) => a + b, 0));
    },
    [durations],
  );

  return { index, time, elapsed, total, playing, seek, goTo };
}

/*
  Paints the project at whatever width the container gives it, keeping the
  document's aspect. Carousels lay every slide on a track and slide it so the
  step reads as a swipe rather than a cut.
*/
export function ProjectStage({
  project,
  clock,
  muted = true,
  className,
  style,
}: {
  project: Project;
  clock: Clock;
  muted?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = width / project.width;
  const size = { width: project.width, height: project.height };
  const playback: Playback = { kind: project.kind, time: clock.time, playing: clock.playing, muted };

  return (
    <div ref={ref} className={cn("relative overflow-hidden bg-[#1d1d1d]", className)} style={{ aspectRatio: `${project.width} / ${project.height}`, ...style }}>
      {width > 0 ? (
        <PlaybackContext.Provider value={playback}>
          {project.kind === "carousel" ? (
            <div
              className="absolute inset-0 flex"
              style={{
                width: `${project.slides.length * 100}%`,
                transform: `translateX(${(-clock.index * 100) / project.slides.length}%)`,
                transition: "transform 700ms var(--ease-out-quart)",
              }}
            >
              {project.slides.map((s) => (
                <SlidePreview key={s.id} slide={s} scale={scale} size={size} />
              ))}
            </div>
          ) : (
            <div className="absolute inset-0">
              {project.slides[clock.index] ? <SlidePreview slide={project.slides[clock.index]} scale={scale} size={size} /> : null}
            </div>
          )}
        </PlaybackContext.Provider>
      ) : null}
    </div>
  );
}

export function formatClock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/* "3 scenes · 14s" for a video, "5 slides" for a carousel, the frame size for a still. */
export function projectMeta(project: Project) {
  const n = project.slides.length;
  if (project.kind === "video") {
    const total = Math.round(project.slides.reduce((a, s) => a + s.duration, 0));
    return `${n} scene${n === 1 ? "" : "s"} · ${total}s`;
  }
  if (project.kind === "carousel") return `${n} slide${n === 1 ? "" : "s"}`;
  return project.aspect;
}
