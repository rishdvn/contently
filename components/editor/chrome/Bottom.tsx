"use client";

import {
  ChevronDown,
  ChevronUp,
  Copy,
  Group,
  Maximize2,
  Music,
  Pause,
  Play,
  Plus,
  Rows3,
  Shapes,
  Trash2,
  Ungroup,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { create } from "zustand";

import { Menu, MenuItem } from "@/components/ui/menu";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { formatTime, sceneAt, sceneOffsets, totalDuration } from "@/lib/editor/geometry";
import { useEditor } from "@/lib/editor/store";
import { backgroundCss } from "@/lib/editor/style";
import type { Block, Slide } from "@/lib/editor/types";

import { SlidePreview } from "../canvas/Artboard";
import { cameraRef } from "../canvas/Viewport";
import { Panel } from "../controls";

export const STRIP_HEIGHT = 92;
export const TIMELINE_HEIGHT = 212;
export const TIMELINE_COLLAPSED = 44;

/* Timeline chrome state: not part of the document, not part of undo. */
type BottomUi = {
  collapsed: boolean;
  pxPerSec: number | null;
  brokenApart: string[];
  toggleCollapsed: () => void;
  setPxPerSec: (v: number | null) => void;
  breakApart: (slideId: string, on: boolean) => void;
};

export const useBottomUi = create<BottomUi>((set) => ({
  collapsed: false,
  pxPerSec: null,
  brokenApart: [],
  toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
  setPxPerSec: (v) => set({ pxPerSec: v }),
  breakApart: (id, on) =>
    set((s) => ({ brokenApart: on ? [...new Set([...s.brokenApart, id])] : s.brokenApart.filter((x) => x !== id) })),
}));

/* How much of the viewport the bottom chrome covers, so fit-to-screen can avoid it. */
export function useBottomInset() {
  const kind = useEditor((s) => s.project.kind);
  const collapsed = useBottomUi((s) => s.collapsed);
  if (kind === "video") return (collapsed ? TIMELINE_COLLAPSED : TIMELINE_HEIGHT) + 16;
  if (kind === "carousel") return STRIP_HEIGHT + 16;
  return 8;
}

export function Bottom({ left, right }: { left: number; right: number }) {
  const kind = useEditor((s) => s.project.kind);
  if (kind === "video") return <Timeline left={left} right={right} />;
  if (kind === "carousel") return <SlideStrip left={left} right={right} />;
  return null;
}

/* ---------------------------------------------------------- slide strip --- */

/*
  Carousel navigation. Each slide is a live miniature; the active one carries
  a ring. Slides drag to reorder, and the trailing tile adds one.
*/
function SlideStrip({ left, right }: { left: number; right: number }) {
  const slides = useEditor((s) => s.project.slides);
  const height = useEditor((s) => s.project.height);
  const activeId = useEditor((s) => s.activeSlideId);
  const setActiveSlide = useEditor((s) => s.setActiveSlide);
  const addSlide = useEditor((s) => s.addSlide);
  const duplicateSlide = useEditor((s) => s.duplicateSlide);
  const removeSlide = useEditor((s) => s.removeSlide);
  const moveSlide = useEditor((s) => s.moveSlide);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const thumbH = STRIP_HEIGHT - 32;
  const scale = thumbH / height;

  const go = (id: string) => {
    setActiveSlide(id);
    cameraRef.current?.centerSlide(slides.findIndex((s) => s.id === id));
  };

  const drop = (targetId: string) => {
    if (!dragging || dragging === targetId) return;
    const from = slides.findIndex((s) => s.id === dragging);
    const to = slides.findIndex((s) => s.id === targetId);
    const dir = to > from ? 1 : -1;
    for (let i = from; i !== to; i += dir) moveSlide(dragging, dir);
    setDragging(null);
    setOver(null);
  };

  return (
    <div className="pointer-events-none absolute bottom-2 flex justify-center" style={{ left, right }}>
      <Panel className="flex max-w-full items-center gap-2 overflow-x-auto px-3 py-2.5 [scrollbar-width:none]" onPointerDown={(e) => e.stopPropagation()}>
        {slides.map((s, i) => {
          const active = s.id === activeId;
          return (
            <div
              key={s.id}
              className={cn("group relative flex shrink-0 flex-col items-center gap-1", over === s.id && dragging !== s.id && "translate-x-1")}
              draggable
              onDragStart={() => setDragging(s.id)}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(s.id);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={() => drop(s.id)}
              onDragEnd={() => {
                setDragging(null);
                setOver(null);
              }}
            >
              <button
                type="button"
                aria-label={`Slide ${i + 1}`}
                aria-current={active}
                className={cn(
                  "relative overflow-hidden rounded-[8px] ring-2 ring-offset-2 ring-offset-panel transition-[box-shadow]",
                  active ? "ring-ink" : "ring-transparent hover:ring-line-strong",
                )}
                onClick={() => go(s.id)}
              >
                <SlidePreview slide={s} scale={scale} />
              </button>
              <span className={cn("text-[10px] leading-none tracking-[0.5px]", active ? "text-ink" : "text-ink-disabled")}>{i + 1}</span>
              <div className="absolute -top-1.5 -right-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <Menu
                  align="end"
                  trigger={(p) => (
                    <button type="button" aria-label="Slide options" className="flex size-5 items-center justify-center rounded-full bg-raised text-ink shadow-overlay" {...p}>
                      <span className="text-[11px] leading-none">⋯</span>
                    </button>
                  )}
                  className="!top-auto bottom-[calc(100%+6px)]"
                >
                  <MenuItem onClick={() => duplicateSlide(s.id)}>Duplicate</MenuItem>
                  <MenuItem onClick={() => addSlide(s.id)}>Add slide after</MenuItem>
                  <MenuItem onClick={() => moveSlide(s.id, -1)} disabled={i === 0}>
                    Move left
                  </MenuItem>
                  <MenuItem onClick={() => moveSlide(s.id, 1)} disabled={i === slides.length - 1}>
                    Move right
                  </MenuItem>
                  <MenuItem onClick={() => removeSlide(s.id)} disabled={slides.length <= 1} destructive>
                    Delete
                  </MenuItem>
                </Menu>
              </div>
            </div>
          );
        })}
        <Tooltip label="Add slide">
          <button
            type="button"
            aria-label="Add slide"
            className="ml-1 flex shrink-0 items-center justify-center self-start rounded-[8px] bg-card text-ink-secondary transition-colors hover:bg-raised hover:text-ink"
            style={{ width: Math.round(thumbH * (useEditor.getState().project.width / height)), height: thumbH }}
            onClick={() => {
              const id = addSlide();
              requestAnimationFrame(() => cameraRef.current?.centerSlide(useEditor.getState().project.slides.findIndex((s) => s.id === id)));
            }}
          >
            <Plus className="size-4" />
          </button>
        </Tooltip>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------- timeline --- */

const RULER_H = 26;
const ROW_H = 30;
const SCENE_H = 40;
const LABEL_W = 0;
const PAD_X = 12;

/*
  Video timeline. Header carries transport; under it a ruler, the "Add
  blocks" affordance, one bar per scene, any broken-apart layers, and the
  audio lane. Zoom sits bottom-right, exactly where the reference keeps it.
*/
function Timeline({ left, right }: { left: number; right: number }) {
  const collapsed = useBottomUi((s) => s.collapsed);
  const toggleCollapsed = useBottomUi((s) => s.toggleCollapsed);
  const playing = useEditor((s) => s.playing);
  const setPlaying = useEditor((s) => s.setPlaying);
  const muted = useEditor((s) => s.muted);
  const setMuted = useEditor((s) => s.setMuted);
  const project = useEditor((s) => s.project);
  const activeSlideId = useEditor((s) => s.activeSlideId);
  const time = useEditor((s) => s.time);
  const brokenApart = useBottomUi((s) => s.brokenApart);
  const breakApart = useBottomUi((s) => s.breakApart);

  const total = totalDuration(project);
  const activeIndex = Math.max(0, project.slides.findIndex((s) => s.id === activeSlideId));
  const globalTime = sceneOffsets(project)[activeIndex] + time;
  const isApart = brokenApart.includes(activeSlideId);

  return (
    <Panel
      className="absolute bottom-2 flex flex-col overflow-hidden"
      style={{ left, right, height: collapsed ? TIMELINE_COLLAPSED : TIMELINE_HEIGHT }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex h-11 shrink-0 items-center gap-2 px-2.5">
        <Tooltip label={playing ? "Pause (Space)" : "Play (Space)"}>
          <button
            type="button"
            aria-label={playing ? "Pause" : "Play"}
            className="flex size-7 items-center justify-center rounded-full bg-raised text-ink transition-colors hover:bg-[var(--state-selected)]"
            onClick={() => {
              if (!playing && globalTime >= total - 0.01) {
                useEditor.setState({ activeSlideId: project.slides[0].id, time: 0 });
              }
              setPlaying(!playing);
            }}
          >
            {playing ? <Pause className="size-3.5 fill-current" /> : <Play className="size-3.5 translate-x-px fill-current" />}
          </button>
        </Tooltip>
        <span className="tabular-nums text-cap text-ink">
          {formatTime(globalTime)} <span className="text-ink-disabled">/</span> {formatTime(total)}
        </span>
        <div className="mx-1 h-4 w-px bg-line-strong" />
        <button
          type="button"
          className="flex h-7 items-center gap-1.5 rounded-[8px] px-2 text-cap text-ink-secondary transition-colors hover:bg-[var(--state-hover)] hover:text-ink"
          onClick={() => breakApart(activeSlideId, !isApart)}
        >
          {isApart ? <Group className="size-3.5" /> : <Ungroup className="size-3.5" />}
          {isApart ? "Group" : "Break Apart"}
        </button>
        <div className="flex-1" />
        <Tooltip label={muted ? "Unmute" : "Mute"}>
          <button type="button" aria-label={muted ? "Unmute" : "Mute"} aria-pressed={muted} className={headerIcon} onClick={() => setMuted(!muted)}>
            {muted ? <VolumeX /> : <Volume2 />}
          </button>
        </Tooltip>
        <Tooltip label={collapsed ? "Expand timeline" : "Collapse timeline"}>
          <button type="button" aria-label={collapsed ? "Expand timeline" : "Collapse timeline"} className={headerIcon} onClick={toggleCollapsed}>
            {collapsed ? <ChevronUp /> : <ChevronDown />}
          </button>
        </Tooltip>
      </div>
      {collapsed ? null : <Tracks />}
    </Panel>
  );
}

const headerIcon =
  "flex size-7 items-center justify-center rounded-[8px] text-ink-secondary transition-colors hover:bg-[var(--state-hover)] hover:text-ink [&>svg]:size-4";

type Ctx = { x: number; y: number; items: ReactNode };

function Tracks() {
  const project = useEditor((s) => s.project);
  const activeSlideId = useEditor((s) => s.activeSlideId);
  const selection = useEditor((s) => s.selection);
  const time = useEditor((s) => s.time);
  const playing = useEditor((s) => s.playing);
  const setLeftTab = useEditor((s) => s.setLeftTab);
  const pxPerSecPref = useBottomUi((s) => s.pxPerSec);
  const setPxPerSec = useBottomUi((s) => s.setPxPerSec);
  const brokenApart = useBottomUi((s) => s.brokenApart);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewW, setViewW] = useState(800);
  const [ctx, setCtx] = useState<Ctx | null>(null);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewW(el.clientWidth));
    ro.observe(el);
    setViewW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const total = totalDuration(project);
  const fitPx = Math.max(20, (viewW - PAD_X * 2 - 80) / Math.max(total, 0.5));
  const pxPerSec = pxPerSecPref ?? fitPx;
  const offsets = sceneOffsets(project);
  const activeIndex = Math.max(0, project.slides.findIndex((s) => s.id === activeSlideId));
  const globalTime = offsets[activeIndex] + time;
  const playheadX = PAD_X + globalTime * pxPerSec;
  const contentW = Math.max(viewW, PAD_X * 2 + total * pxPerSec + 120);

  /* Keep the playhead in view while playing. */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !playing) return;
    if (playheadX < el.scrollLeft + 20 || playheadX > el.scrollLeft + el.clientWidth - 20) {
      el.scrollLeft = Math.max(0, playheadX - el.clientWidth / 3);
    }
  }, [playheadX, playing]);

  const seek = (clientX: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const t = Math.min(total, Math.max(0, (clientX - rect.left + el.scrollLeft - PAD_X) / pxPerSec));
    const { index, local } = sceneAt(project, t);
    const id = project.slides[index]?.id;
    useEditor.setState({ activeSlideId: id, time: Math.min(local, project.slides[index].duration) });
  };

  const onScrub = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    useEditor.getState().setPlaying(false);
    seek(e.clientX);
    const move = (ev: PointerEvent) => seek(ev.clientX);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const step = pxPerSec >= 90 ? 0.5 : pxPerSec >= 45 ? 1 : pxPerSec >= 20 ? 2 : 5;
  const ticks: number[] = [];
  for (let t = 0; t <= total + step; t += step) ticks.push(Math.round(t * 100) / 100);

  const layerRows: { slide: Slide; block: Block }[] = [];
  project.slides.forEach((sl) => {
    const apart = brokenApart.includes(sl.id);
    sl.blocks.forEach((b) => {
      if (apart || selection.includes(b.id)) layerRows.push({ slide: sl, block: b });
    });
  });

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="timeline-scroll relative min-h-0 flex-1 overflow-x-auto overflow-y-auto" onPointerDown={() => setCtx(null)}>
        <div className="relative" style={{ width: contentW, minHeight: "100%" }}>
          <div className="sticky top-0 z-10 cursor-ew-resize select-none bg-panel" style={{ height: RULER_H }} onPointerDown={onScrub}>
            {ticks.map((t) => {
              const x = PAD_X + t * pxPerSec;
              const major = Math.abs(t / (step * 2) - Math.round(t / (step * 2))) < 1e-6;
              return (
                <div key={t} className="absolute top-0 flex flex-col items-start" style={{ left: x }}>
                  <span className="mt-[9px] text-[10px] leading-none tracking-[0.4px] text-ink-disabled" style={{ transform: "translateX(-50%)" }}>
                    {step < 1 || major ? `${t}s` : ""}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center" style={{ height: ROW_H, paddingLeft: PAD_X + LABEL_W }}>
            <button type="button" className={laneBtn} onClick={() => setLeftTab("blocks")}>
              <Shapes className="size-3.5" /> Add blocks
            </button>
          </div>

          <div className="relative" style={{ height: SCENE_H, marginLeft: PAD_X + LABEL_W }}>
            {project.slides.map((sl, i) => (
              <SceneBar
                key={sl.id}
                slide={sl}
                index={i}
                left={offsets[i] * pxPerSec}
                pxPerSec={pxPerSec}
                active={sl.id === activeSlideId}
                onContext={(x, y, items) => setCtx({ x, y, items })}
              />
            ))}
          </div>

          {layerRows.map(({ slide, block }) => (
            <LayerBar
              key={block.id}
              slide={slide}
              block={block}
              offset={offsets[project.slides.indexOf(slide)]}
              pxPerSec={pxPerSec}
              selected={selection.includes(block.id)}
              onContext={(x, y, items) => setCtx({ x, y, items })}
            />
          ))}

          <div className="relative flex items-center" style={{ height: ROW_H, paddingLeft: PAD_X + LABEL_W }}>
            {project.audio.length ? (
              project.audio.map((a) => (
                <AudioBar key={a.id} track={a} pxPerSec={pxPerSec} total={total} onContext={(x, y, items) => setCtx({ x, y, items })} />
              ))
            ) : (
              <button type="button" className={laneBtn} onClick={() => setLeftTab("audio")}>
                <Music className="size-3.5" /> Add audio
              </button>
            )}
          </div>
          {project.audio.length ? (
            <div className="flex items-center" style={{ height: ROW_H, paddingLeft: PAD_X + LABEL_W }}>
              <button type="button" className={laneBtn} onClick={() => setLeftTab("audio")}>
                <Music className="size-3.5" /> Add audio
              </button>
            </div>
          ) : null}

          <div className="pointer-events-none absolute top-0 bottom-0 z-20" style={{ left: playheadX }}>
            <div className="absolute top-[3px] size-2 -translate-x-1/2 rounded-full bg-ink" />
            <div className="absolute top-[7px] bottom-0 w-px -translate-x-1/2 bg-ink" />
          </div>
        </div>
      </div>

      <ZoomControls pxPerSec={pxPerSec} fitPx={fitPx} onChange={setPxPerSec} />

      {ctx ? (
        <div
          role="menu"
          className="fixed z-[var(--z-floating-bar)] min-w-[160px] rounded-control bg-panel p-1.5 shadow-overlay animate-pop"
          style={{ left: ctx.x, top: ctx.y }}
          onClick={() => setCtx(null)}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {ctx.items}
        </div>
      ) : null}
    </div>
  );
}

const laneBtn =
  "flex h-6 items-center gap-1.5 rounded-[6px] px-2 text-cap text-ink-secondary transition-colors hover:bg-[var(--state-hover)] hover:text-ink";

function ZoomControls({ pxPerSec, fitPx, onChange }: { pxPerSec: number; fitPx: number; onChange: (v: number | null) => void }) {
  const min = 10;
  const max = 400;
  const toSlider = (v: number) => (Math.log(v / min) / Math.log(max / min)) * 100;
  const fromSlider = (s: number) => min * Math.pow(max / min, s / 100);
  return (
    <div className="pointer-events-auto absolute right-2.5 bottom-2 flex h-7 items-center gap-1 rounded-[8px] bg-raised px-1 shadow-overlay">
      <button type="button" aria-label="Zoom out" className={zoomIcon} onClick={() => onChange(Math.max(min, pxPerSec / 1.25))}>
        <ZoomOut />
      </button>
      <input
        type="range"
        aria-label="Timeline zoom"
        min={0}
        max={100}
        value={toSlider(pxPerSec)}
        onChange={(e) => onChange(fromSlider(Number(e.target.value)))}
        className="timeline-zoom h-1 w-14 cursor-pointer appearance-none rounded-full bg-line-strong accent-ink"
      />
      <button type="button" aria-label="Zoom in" className={zoomIcon} onClick={() => onChange(Math.min(max, pxPerSec * 1.25))}>
        <ZoomIn />
      </button>
      <Tooltip label="Fit timeline">
        <button type="button" className="h-6 rounded-[6px] px-1.5 text-cap text-ink-secondary hover:bg-[var(--state-hover)] hover:text-ink" onClick={() => onChange(null)}>
          Fit
        </button>
      </Tooltip>
      <Tooltip label="Fit timeline">
        <button type="button" aria-label="Fit timeline" className={zoomIcon} onClick={() => onChange(fitPx)}>
          <Maximize2 />
        </button>
      </Tooltip>
      <Tooltip label="Layers view">
        <button type="button" aria-label="Layers view" className={zoomIcon} onClick={() => useBottomUi.getState().breakApart(useEditor.getState().activeSlideId, true)}>
          <Rows3 />
        </button>
      </Tooltip>
    </div>
  );
}

const zoomIcon = "flex size-6 items-center justify-center rounded-[6px] text-ink-secondary hover:bg-[var(--state-hover)] hover:text-ink [&>svg]:size-3.5";

/* Pointer-drag helper shared by every bar: reports dx in seconds. */
function useDragSeconds(pxPerSec: number) {
  return (e: React.PointerEvent, onMove: (dt: number) => void, onEnd?: () => void) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const x0 = e.clientX;
    const move = (ev: PointerEvent) => onMove((ev.clientX - x0) / pxPerSec);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      onEnd?.();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
}

const snap = (v: number) => Math.round(v * 10) / 10;

function SceneBar({
  slide,
  index,
  left,
  pxPerSec,
  active,
  onContext,
}: {
  slide: Slide;
  index: number;
  left: number;
  pxPerSec: number;
  active: boolean;
  onContext: (x: number, y: number, items: ReactNode) => void;
}) {
  const setActiveSlide = useEditor((s) => s.setActiveSlide);
  const updateSlide = useEditor((s) => s.updateSlide);
  const updateBlocks = useEditor((s) => s.updateBlocks);
  const duplicateSlide = useEditor((s) => s.duplicateSlide);
  const removeSlide = useEditor((s) => s.removeSlide);
  const addSlide = useEditor((s) => s.addSlide);
  const count = useEditor((s) => s.project.slides.length);
  const height = useEditor((s) => s.project.height);
  const isApart = useBottomUi((s) => s.brokenApart.includes(slide.id));
  const breakApart = useBottomUi((s) => s.breakApart);
  const drag = useDragSeconds(pxPerSec);
  const startDuration = useRef(slide.duration);

  const width = slide.duration * pxPerSec;
  const thumbScale = (SCENE_H - 8) / height;

  const resize = (e: React.PointerEvent) => {
    startDuration.current = slide.duration;
    const original = startDuration.current;
    drag(
      e,
      (dt) => updateSlide(slide.id, { duration: Math.max(0.5, snap(original + dt)) }),
      () => {
        /* Blocks that ran to the end of the scene keep doing so. */
        const now = useEditor.getState().project.slides.find((s) => s.id === slide.id);
        if (!now) return;
        const patches: Record<string, Partial<Block>> = {};
        now.blocks.forEach((b) => {
          if (Math.abs(b.end - original) < 0.05 || b.end > now.duration) patches[b.id] = { end: now.duration, start: Math.min(b.start, now.duration - 0.1) };
        });
        if (Object.keys(patches).length) updateBlocks(patches);
      },
    );
  };

  return (
    <div
      className={cn(
        "group absolute top-1 bottom-1 overflow-hidden rounded-[6px] ring-1 ring-inset transition-[box-shadow]",
        active ? "ring-ink/60" : "ring-white/10 hover:ring-white/25",
      )}
      style={{ left, width: Math.max(8, width - 2) }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        setActiveSlide(slide.id);
        useEditor.setState({ time: 0 });
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setActiveSlide(slide.id);
        onContext(
          e.clientX,
          e.clientY,
          <>
            <MenuItem onClick={() => breakApart(slide.id, !isApart)}>{isApart ? "Group" : "Break Apart"}</MenuItem>
            <MenuItem onClick={() => duplicateSlide(slide.id)}>Duplicate scene</MenuItem>
            <MenuItem onClick={() => addSlide(slide.id)}>Add scene after</MenuItem>
            <MenuItem onClick={() => removeSlide(slide.id)} disabled={count <= 1} destructive>
              Delete
            </MenuItem>
          </>,
        );
      }}
    >
      <div className="absolute inset-0 opacity-70" style={backgroundCss(slide.background)} />
      <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0_23px,rgb(0_0_0/0.28)_23px_24px)]" />
      <div className="absolute top-1 left-1 overflow-hidden rounded-[3px] ring-1 ring-black/40">
        <SlidePreview slide={slide} scale={thumbScale} />
      </div>
      <span className="absolute bottom-1 left-1 max-w-[calc(100%-8px)] truncate rounded-[4px] bg-black/70 px-1.5 py-0.5 text-[10px] leading-[12px] font-medium tracking-[0.3px] text-white">
        {slide.name || `Scene ${index + 1}`}
      </span>
      <div
        className="absolute top-0 right-0 bottom-0 w-2 cursor-ew-resize opacity-0 transition-opacity group-hover:opacity-100"
        onPointerDown={resize}
      >
        <div className="absolute top-1/2 right-[3px] h-3 w-[2px] -translate-y-1/2 rounded-full bg-white/80" />
      </div>
    </div>
  );
}

const LAYER_TINT: Record<Block["type"], string> = {
  text: "rgb(255 216 77 / 0.35)",
  image: "rgb(96 165 250 / 0.35)",
  video: "rgb(110 232 110 / 0.35)",
  shape: "rgb(246 200 221 / 0.35)",
};

function layerLabel(b: Block) {
  if (b.name) return b.name;
  if (b.type === "text") return b.text.replace(/\s+/g, " ").trim().slice(0, 28) || "Text";
  return { image: "Image", video: "Video", shape: "Shape" }[b.type];
}

function LayerBar({
  slide,
  block,
  offset,
  pxPerSec,
  selected,
  onContext,
}: {
  slide: Slide;
  block: Block;
  offset: number;
  pxPerSec: number;
  selected: boolean;
  onContext: (x: number, y: number, items: ReactNode) => void;
}) {
  const updateBlock = useEditor((s) => s.updateBlock);
  const select = useEditor((s) => s.select);
  const setActiveSlide = useEditor((s) => s.setActiveSlide);
  const removeBlocks = useEditor((s) => s.removeBlocks);
  const duplicateBlocks = useEditor((s) => s.duplicateBlocks);
  const drag = useDragSeconds(pxPerSec);

  const clampStart = (v: number) => Math.min(Math.max(0, v), block.end - 0.1);
  const clampEnd = (v: number) => Math.max(Math.min(slide.duration, v), block.start + 0.1);

  const pick = () => {
    if (useEditor.getState().activeSlideId !== slide.id) setActiveSlide(slide.id);
    select([block.id]);
  };

  const move = (e: React.PointerEvent) => {
    const { start, end } = block;
    const len = end - start;
    pick();
    drag(e, (dt) => {
      const s = Math.min(Math.max(0, snap(start + dt)), slide.duration - len);
      updateBlock(block.id, { start: s, end: s + len });
    });
  };
  const trimStart = (e: React.PointerEvent) => {
    const { start } = block;
    drag(e, (dt) => updateBlock(block.id, { start: clampStart(snap(start + dt)) }));
  };
  const trimEnd = (e: React.PointerEvent) => {
    const { end } = block;
    drag(e, (dt) => updateBlock(block.id, { end: clampEnd(snap(end + dt)) }));
  };

  const style: CSSProperties = {
    left: (offset + block.start) * pxPerSec,
    width: Math.max(6, (block.end - block.start) * pxPerSec - 2),
    background: LAYER_TINT[block.type],
  };

  return (
    <div className="relative" style={{ height: ROW_H, marginLeft: PAD_X + LABEL_W }}>
      <div
        className={cn(
          "group absolute top-[3px] bottom-[3px] flex cursor-grab items-center overflow-hidden rounded-[5px] ring-1 ring-inset active:cursor-grabbing",
          selected ? "ring-ink" : "ring-white/10 hover:ring-white/30",
        )}
        style={style}
        onPointerDown={move}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          pick();
          onContext(
            e.clientX,
            e.clientY,
            <>
              <MenuItem onClick={() => duplicateBlocks([block.id])} icon={<Copy />}>
                Duplicate
              </MenuItem>
              <MenuItem onClick={() => removeBlocks([block.id])} icon={<Trash2 />} destructive>
                Delete
              </MenuItem>
            </>,
          );
        }}
      >
        <span className="pointer-events-none truncate px-2 text-[10px] leading-none font-medium tracking-[0.3px] text-white/90">{layerLabel(block)}</span>
        <div className="absolute top-0 bottom-0 left-0 w-2 cursor-ew-resize" onPointerDown={trimStart}>
          <div className="absolute top-1/2 left-[3px] h-2.5 w-[2px] -translate-y-1/2 rounded-full bg-white/70 opacity-0 group-hover:opacity-100" />
        </div>
        <div className="absolute top-0 right-0 bottom-0 w-2 cursor-ew-resize" onPointerDown={trimEnd}>
          <div className="absolute top-1/2 right-[3px] h-2.5 w-[2px] -translate-y-1/2 rounded-full bg-white/70 opacity-0 group-hover:opacity-100" />
        </div>
      </div>
    </div>
  );
}

function AudioBar({
  track,
  pxPerSec,
  total,
  onContext,
}: {
  track: { id: string; title: string; start: number; duration: number };
  pxPerSec: number;
  total: number;
  onContext: (x: number, y: number, items: ReactNode) => void;
}) {
  const updateAudio = useEditor((s) => s.updateAudio);
  const removeAudio = useEditor((s) => s.removeAudio);
  const drag = useDragSeconds(pxPerSec);
  const move = (e: React.PointerEvent) => {
    const { start } = track;
    drag(e, (dt) => updateAudio(track.id, { start: Math.min(Math.max(0, snap(start + dt)), Math.max(0, total - track.duration)) }));
  };
  const trimEnd = (e: React.PointerEvent) => {
    const { duration } = track;
    drag(e, (dt) => updateAudio(track.id, { duration: Math.max(0.5, Math.min(snap(duration + dt), total - track.start)) }));
  };
  return (
    <div
      className="group absolute top-[3px] bottom-[3px] flex cursor-grab items-center overflow-hidden rounded-[5px] bg-[rgb(167_139_250/0.35)] ring-1 ring-white/10 ring-inset hover:ring-white/30 active:cursor-grabbing"
      style={{ left: PAD_X + LABEL_W + track.start * pxPerSec, width: Math.max(6, track.duration * pxPerSec - 2) }}
      onPointerDown={move}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContext(
          e.clientX,
          e.clientY,
          <MenuItem onClick={() => removeAudio(track.id)} icon={<Trash2 />} destructive>
            Remove audio
          </MenuItem>,
        );
      }}
    >
      <Music className="ml-1.5 size-3 shrink-0 text-white/80" />
      <span className="pointer-events-none truncate px-1.5 text-[10px] leading-none font-medium tracking-[0.3px] text-white/90">{track.title}</span>
      <div className="absolute inset-x-8 top-1/2 h-px -translate-y-1/2 bg-[repeating-linear-gradient(90deg,rgb(255_255_255/0.5)_0_2px,transparent_2px_5px)] opacity-60" />
      <div className="absolute top-0 right-0 bottom-0 w-2 cursor-ew-resize" onPointerDown={trimEnd} />
    </div>
  );
}
