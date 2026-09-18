"use client";

import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  Group,
  Lock,
  LockOpen,
  Maximize2,
  MoreHorizontal,
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
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { create } from "zustand";

import { Menu, MenuDivider, MenuItem } from "@/components/ui/menu";
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
const TIMELINE_MIN_HEIGHT = 140;

/* Timeline chrome state: not part of the document, not part of undo. */
type BottomUi = {
  collapsed: boolean;
  /* Expanded timeline height; the user drags the top edge to make room for more layer rows. */
  height: number;
  pxPerSec: number | null;
  /* Zoom that fits the whole project in view; measured by the track area, used by the header. */
  fitPx: number;
  brokenApart: string[];
  toggleCollapsed: () => void;
  setPxPerSec: (v: number | null) => void;
  setFitPx: (v: number) => void;
  setHeight: (v: number) => void;
  breakApart: (slideId: string, on: boolean) => void;
};

export const useBottomUi = create<BottomUi>((set) => ({
  collapsed: false,
  height: TIMELINE_HEIGHT,
  pxPerSec: null,
  fitPx: 40,
  brokenApart: [],
  toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
  setPxPerSec: (v) => set({ pxPerSec: v }),
  setFitPx: (v) => set({ fitPx: v }),
  setHeight: (v) => set({ height: Math.round(Math.min(Math.max(TIMELINE_MIN_HEIGHT, v), window.innerHeight * 0.6)) }),
  breakApart: (id, on) =>
    set((s) => ({ brokenApart: on ? [...new Set([...s.brokenApart, id])] : s.brokenApart.filter((x) => x !== id) })),
}));

/* How much of the viewport the bottom chrome covers, so fit-to-screen can avoid it. */
export function useBottomInset() {
  const kind = useEditor((s) => s.project.kind);
  const collapsed = useBottomUi((s) => s.collapsed);
  const height = useBottomUi((s) => s.height);
  if (kind === "video") return (collapsed ? TIMELINE_COLLAPSED : height) + 16;
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
                  active ? "ring-ink" : "ring-line-strong/60 hover:ring-line-strong",
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
  audio lane. Zoom lives in the header so nothing floats over the bars: every
  pill end stays reachable for trimming.
*/
function Timeline({ left, right }: { left: number; right: number }) {
  const collapsed = useBottomUi((s) => s.collapsed);
  const height = useBottomUi((s) => s.height);
  const setHeight = useBottomUi((s) => s.setHeight);
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
      style={{ left, right, height: collapsed ? TIMELINE_COLLAPSED : height }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {collapsed ? null : (
        <div
          role="separator"
          aria-label="Resize timeline"
          aria-orientation="horizontal"
          className="group/resize absolute inset-x-0 top-0 z-30 h-2 cursor-ns-resize"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            const y0 = e.clientY;
            const h0 = height;
            const move = (ev: PointerEvent) => setHeight(h0 + (y0 - ev.clientY));
            const up = () => {
              window.removeEventListener("pointermove", move);
              window.removeEventListener("pointerup", up);
            };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", up);
          }}
        >
          <div className="mx-auto mt-[3px] h-[3px] w-10 rounded-full bg-white/0 transition-colors group-hover/resize:bg-white/30" />
        </div>
      )}
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
          <Rows3 className="size-3.5" />
          {isApart ? "Hide layers" : "Show layers"}
        </button>
        <div className="flex-1" />
        {collapsed ? null : <ZoomControls />}
        <div className="mx-1 h-4 w-px bg-line-strong" />
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
  /* Fit shows the whole project plus a quarter of headroom, as the reference does, so the end is never against the edge. */
  const fitPx = Math.max(20, (viewW - PAD_X * 2) / (Math.max(total, 0.5) * 1.25));
  const pxPerSec = pxPerSecPref ?? fitPx;
  const setFitPx = useBottomUi((s) => s.setFitPx);
  useEffect(() => setFitPx(fitPx), [fitPx, setFitPx]);
  const offsets = sceneOffsets(project);
  const activeIndex = Math.max(0, project.slides.findIndex((s) => s.id === activeSlideId));
  const globalTime = offsets[activeIndex] + time;
  const playheadX = PAD_X + globalTime * pxPerSec;
  const contentW = Math.max(viewW, PAD_X * 2 + total * pxPerSec + Math.max(160, total * pxPerSec * 0.25));

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

  /* Rows read top-down as the canvas stacks: the frontmost layer is the first row. */
  const layerRows: { slide: Slide; block: Block; index: number; rows: number }[] = [];
  project.slides.forEach((sl) => {
    const apart = brokenApart.includes(sl.id);
    const shown = sl.blocks.map((b, index) => ({ slide: sl, block: b, index })).filter(({ block }) => apart || selection.includes(block.id));
    shown.reverse().forEach((r) => layerRows.push({ ...r, rows: shown.length }));
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
                  <span className="mt-[9px] text-[10px] leading-none tracking-[0.4px] text-ink-secondary/80" style={{ transform: "translateX(-50%)" }}>
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
                scrollRef={scrollRef}
                onContext={(x, y, items) => setCtx({ x, y, items })}
              />
            ))}
          </div>

          {layerRows.map(({ slide, block, index, rows }) => (
            <LayerBar
              key={block.id}
              slide={slide}
              block={block}
              index={index}
              /* Only a fully expanded slide can be re-stacked by drag; a lone selected row has nothing to pass. */
              reorderable={rows === slide.blocks.length && rows > 1}
              offset={offsets[project.slides.indexOf(slide)]}
              pxPerSec={pxPerSec}
              selected={selection.includes(block.id)}
              scrollRef={scrollRef}
              onContext={(x, y, items) => setCtx({ x, y, items })}
            />
          ))}

          <div className="relative flex items-center" style={{ height: ROW_H, paddingLeft: PAD_X + LABEL_W }}>
            {project.audio.length ? (
              project.audio.map((a) => (
                <AudioBar key={a.id} track={a} pxPerSec={pxPerSec} total={total} scrollRef={scrollRef} onContext={(x, y, items) => setCtx({ x, y, items })} />
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

      {ctx ? <TimelineMenu ctx={ctx} onClose={() => setCtx(null)} /> : null}
    </div>
  );
}

/* Timeline context menu: opens at the pointer, flips to stay on screen, closes on Escape. */
function TimelineMenu({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.left = `${Math.min(ctx.x, window.innerWidth - r.width - 8)}px`;
    el.style.top = `${ctx.y + r.height + 8 > window.innerHeight ? Math.max(8, ctx.y - r.height) : ctx.y}px`;
  }, [ctx]);
  useEffect(() => {
    /* Escape dismisses the menu only; it must not reach the hotkeys and clear the selection too. */
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-[var(--z-floating-bar)] min-w-[180px] rounded-control bg-panel p-1.5 shadow-overlay animate-pop"
      style={{ left: ctx.x, top: ctx.y }}
      onClick={onClose}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {ctx.items}
    </div>
  );
}

const laneBtn =
  "flex h-6 items-center gap-1.5 rounded-[6px] px-2 text-cap text-ink-secondary transition-colors hover:bg-[var(--state-hover)] hover:text-ink";

function ZoomControls() {
  const fitPx = useBottomUi((s) => s.fitPx);
  const pref = useBottomUi((s) => s.pxPerSec);
  const onChange = useBottomUi((s) => s.setPxPerSec);
  const pxPerSec = pref ?? fitPx;
  const min = 10;
  const max = 400;
  const toSlider = (v: number) => (Math.log(v / min) / Math.log(max / min)) * 100;
  const fromSlider = (s: number) => min * Math.pow(max / min, s / 100);
  return (
    <div className="flex h-7 items-center gap-1 rounded-[8px] px-1">
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

const pillIcon = "flex size-4 items-center justify-center rounded-[4px] text-white/80 hover:bg-white/20 hover:text-white [&>svg]:size-3";

const zoomIcon = "flex size-6 items-center justify-center rounded-[6px] text-ink-secondary hover:bg-[var(--state-hover)] hover:text-ink [&>svg]:size-3.5";

/*
  Pointer-drag helper shared by every bar. Reports the pointer's travel in
  seconds, including any distance the view scrolled. While the pointer sits
  past either edge of the track area the view creeps along — faster the
  further past — and keeps reporting, so a long edit is one held drag. The
  scale is frozen for the gesture (fit mode would otherwise re-scale under
  the pointer) and stays frozen afterwards, as in the reference.
*/
function useTimelineDrag(scrollRef: RefObject<HTMLDivElement | null>, pxPerSec: number) {
  return (e: React.PointerEvent, onMove: (dt: number) => void, onEnd?: () => void) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const scroller = scrollRef.current;
    const ui = useBottomUi.getState();
    if (ui.pxPerSec === null) ui.setPxPerSec(pxPerSec);
    const x0 = e.clientX;
    const scroll0 = scroller?.scrollLeft ?? 0;
    let pointerX = x0;
    let raf = 0;
    const dt = () => (pointerX - x0 + ((scroller?.scrollLeft ?? 0) - scroll0)) / pxPerSec;
    const edge = () => {
      if (scroller) {
        const r = scroller.getBoundingClientRect();
        const over = pointerX > r.right - 24 ? pointerX - (r.right - 24) : pointerX < r.left + 24 ? pointerX - (r.left + 24) : 0;
        if (over) {
          scroller.scrollLeft += Math.sign(over) * Math.min(28, 3 + Math.abs(over) / 6);
          onMove(dt());
        }
      }
      raf = requestAnimationFrame(edge);
    };
    const move = (ev: PointerEvent) => {
      pointerX = ev.clientX;
      onMove(dt());
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      cancelAnimationFrame(raf);
      /* The handle tracked a pointer that was past the edge; bring it back into view. */
      if (scroller) {
        const r = scroller.getBoundingClientRect();
        if (pointerX > r.right - 24) scroller.scrollLeft += pointerX - (r.right - 24) + 8;
        else if (pointerX < r.left + 24) scroller.scrollLeft -= r.left + 24 - pointerX + 8;
      }
      onEnd?.();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    raf = requestAnimationFrame(edge);
  };
}

/* mm:ss.t, the reference's label while a pill end is being dragged. */
const clockLabel = (t: number) => `${String(Math.floor(t / 60)).padStart(2, "0")}:${(t % 60).toFixed(1).padStart(4, "0")}`;

const snap = (v: number) => Math.round(v * 10) / 10;

function SceneBar({
  slide,
  index,
  left,
  pxPerSec,
  active,
  scrollRef,
  onContext,
}: {
  slide: Slide;
  index: number;
  left: number;
  pxPerSec: number;
  active: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  onContext: (x: number, y: number, items: ReactNode) => void;
}) {
  const setActiveSlide = useEditor((s) => s.setActiveSlide);
  const updateSlide = useEditor((s) => s.updateSlide);
  const updateBlocks = useEditor((s) => s.updateBlocks);
  const duplicateSlide = useEditor((s) => s.duplicateSlide);
  const removeSlide = useEditor((s) => s.removeSlide);
  const addSlide = useEditor((s) => s.addSlide);
  const moveSlide = useEditor((s) => s.moveSlide);
  const count = useEditor((s) => s.project.slides.length);
  const height = useEditor((s) => s.project.height);
  const isApart = useBottomUi((s) => s.brokenApart.includes(slide.id));
  const breakApart = useBottomUi((s) => s.breakApart);
  const [dragging, setDragging] = useState<number | null>(null);

  const width = slide.duration * pxPerSec;
  const thumbScale = (SCENE_H - 8) / height;

  /*
    Dragging the scene's end. Layers that ran to the end of the scene follow
    it live; the helper handles the frozen scale and edge auto-scroll.
  */
  const drag = useTimelineDrag(scrollRef, pxPerSec);
  const resize = (e: React.PointerEvent) => {
    const original = slide.duration;
    const pinned = new Set(slide.blocks.filter((b) => Math.abs(b.end - original) < 0.05).map((b) => b.id));
    useEditor.getState().setInteracting(true);
    setDragging(original);
    drag(
      e,
      (dt) => {
        const duration = Math.max(0.5, snap(original + dt));
        const now = useEditor.getState().project.slides.find((s) => s.id === slide.id);
        if (!now || now.duration === duration) return;
        updateSlide(slide.id, { duration });
        const patches: Record<string, Partial<Block>> = {};
        now.blocks.forEach((b) => {
          if (pinned.has(b.id) || b.end > duration) patches[b.id] = { end: duration, start: Math.min(b.start, duration - 0.1) };
        });
        if (Object.keys(patches).length) updateBlocks(patches);
        setDragging(duration);
      },
      () => {
        useEditor.getState().setInteracting(false);
        setDragging(null);
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
            <MenuItem onClick={() => breakApart(slide.id, !isApart)} icon={<Rows3 />}>
              {isApart ? "Hide layers" : "Show layers"}
            </MenuItem>
            <MenuDivider />
            <MenuItem onClick={() => moveSlide(slide.id, -1)} disabled={index === 0} icon={<ChevronLeft />}>
              Move scene left
            </MenuItem>
            <MenuItem onClick={() => moveSlide(slide.id, 1)} disabled={index >= count - 1} icon={<ChevronRight />}>
              Move scene right
            </MenuItem>
            <MenuDivider />
            <MenuItem onClick={() => duplicateSlide(slide.id)} icon={<Copy />}>
              Duplicate scene
            </MenuItem>
            <MenuItem onClick={() => addSlide(slide.id)} icon={<Plus />}>
              Add scene after
            </MenuItem>
            <MenuItem onClick={() => removeSlide(slide.id)} disabled={count <= 1} icon={<Trash2 />} destructive>
              Delete scene
            </MenuItem>
          </>,
        );
      }}
    >
      <div className="absolute inset-0 opacity-70" style={backgroundCss(slide.background)} />
      <Filmstrip slide={slide} scale={thumbScale} />
      <span className="absolute bottom-1 left-1 max-w-[calc(100%-8px)] truncate rounded-[4px] bg-black/70 px-1.5 py-0.5 text-[10px] leading-[12px] font-medium tracking-[0.3px] text-white">
        {slide.name || `Scene ${index + 1}`}
      </span>
      <div
        className={cn(
          "absolute top-0 right-0 bottom-0 w-3 cursor-ew-resize transition-opacity",
          dragging !== null ? "opacity-100" : active ? "opacity-70 group-hover:opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
        onPointerDown={resize}
        aria-label="Scene length"
      >
        <div className={cn("absolute top-1/2 right-[4px] h-4 w-[3px] -translate-y-1/2 rounded-full", dragging !== null ? "bg-spectrum-amber" : "bg-white/80")} />
      </div>
      {dragging !== null ? (
        <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 rounded-[4px] bg-black/80 px-1.5 py-0.5 text-[10px] leading-[12px] font-medium tabular-nums text-white">
          {clockLabel(dragging)}
        </span>
      ) : null}
    </div>
  );
}

/*
  Scene bars tile a miniature of the scene edge to edge, like a filmstrip. The
  miniature is rasterised once per change (idle only) so the bar costs one
  image, not a DOM copy of the scene per tile. The live preview stays in the
  DOM as the source for the raster and as the fallback before it lands.
*/
function Filmstrip({ slide, scale }: { slide: Slide; scale: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  /* Bumped when a still-loading video gets its first frame, so the raster retries. */
  const [mediaTick, setMediaTick] = useState(0);
  const busy = useEditor((s) => s.interacting || s.playing || s.editingTextId !== null);
  const width = useEditor((s) => s.project.width);
  const height = useEditor((s) => s.project.height);

  useEffect(() => {
    if (busy) return;
    let cancelled = false;
    const listeners: (() => void)[] = [];
    const timer = setTimeout(async () => {
      const node = ref.current;
      if (!node) return;
      /* An empty <video> rasterises as a broken image; wait for a frame or retry when one lands. */
      const videos = Array.from(node.querySelectorAll("video"));
      const deadline = performance.now() + 4000;
      while (!cancelled && performance.now() < deadline && videos.some((v) => v.readyState < 2)) {
        await new Promise((r) => setTimeout(r, 100));
      }
      if (cancelled) return;
      const pending = videos.filter((v) => v.readyState < 2);
      if (pending.length) {
        pending.forEach((v) => {
          const on = () => setMediaTick((t) => t + 1);
          v.addEventListener("loadeddata", on, { once: true });
          listeners.push(() => v.removeEventListener("loadeddata", on));
        });
        return;
      }
      try {
        const { toPng } = await import("html-to-image");
        const png = await toPng(node, {
          pixelRatio: 2,
          cacheBust: false,
          style: { left: "0px", top: "0px", opacity: "1" },
        });
        if (!cancelled) setUrl(png);
      } catch {
        /* Cross-origin media without CORS falls back to the live preview. */
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      listeners.forEach((off) => off());
    };
  }, [slide, width, height, busy, mediaTick]);

  const tileW = width * scale;
  return (
    <>
      {url ? (
        <div
          className="absolute inset-0"
          style={{ backgroundImage: `url(${url})`, backgroundSize: `${tileW}px 100%`, backgroundRepeat: "repeat-x" }}
        />
      ) : null}
      <div ref={ref} className="absolute top-0 left-0 overflow-hidden" style={{ opacity: url ? 0 : 1 }}>
        <SlidePreview slide={slide} scale={scale} />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0,transparent_calc(var(--tile)-1px),rgb(0_0_0/0.45)_calc(var(--tile)-1px),rgb(0_0_0/0.45)_var(--tile))]" style={{ "--tile": `${tileW}px` } as CSSProperties} />
    </>
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

/*
  One layer's pill. Horizontal drag moves it in time (with every other
  selected layer in the scene); a mostly vertical drag re-stacks it, which is
  what moving a row up or down in the list means for z-order. Shift or ⌘
  click adds to the selection so several layers can be deleted, grouped or
  moved together.
*/
function LayerBar({
  slide,
  block,
  index,
  reorderable,
  offset,
  pxPerSec,
  selected,
  scrollRef,
  onContext,
}: {
  slide: Slide;
  block: Block;
  index: number;
  reorderable: boolean;
  offset: number;
  pxPerSec: number;
  selected: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  onContext: (x: number, y: number, items: ReactNode) => void;
}) {
  const updateBlock = useEditor((s) => s.updateBlock);
  const updateBlocks = useEditor((s) => s.updateBlocks);
  const updateSlide = useEditor((s) => s.updateSlide);
  const moveBlockTo = useEditor((s) => s.moveBlockTo);
  const select = useEditor((s) => s.select);
  const setActiveSlide = useEditor((s) => s.setActiveSlide);
  const removeBlocks = useEditor((s) => s.removeBlocks);
  const duplicateBlocks = useEditor((s) => s.duplicateBlocks);
  const reorder = useEditor((s) => s.reorder);
  const groupBlocks = useEditor((s) => s.groupBlocks);
  const ungroupBlocks = useEditor((s) => s.ungroupBlocks);
  const drag = useTimelineDrag(scrollRef, pxPerSec);
  const [lifting, setLifting] = useState(false);
  /* Time shown beside the handle while an end is being dragged. */
  const [label, setLabel] = useState<{ side: "start" | "end"; t: number } | null>(null);

  const clampStart = (v: number) => Math.min(Math.max(0, v), block.end - 0.1);

  /* The ids an action applies to: the selection when this layer is part of it, else just this layer. */
  const targets = () => {
    const s = useEditor.getState();
    return s.selection.includes(block.id) ? s.selection : [block.id];
  };
  const pick = (e?: React.PointerEvent | React.MouseEvent) => {
    if (useEditor.getState().activeSlideId !== slide.id) setActiveSlide(slide.id);
    if (e && (e.shiftKey || e.metaKey || e.ctrlKey)) select([block.id], true);
    else if (!useEditor.getState().selection.includes(block.id)) select([block.id]);
  };

  const move = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    pick(e);
    if (additive) return;
    e.preventDefault();
    e.stopPropagation();
    const ids = targets();
    const state = useEditor.getState();
    const movers = slide.blocks.filter((b) => ids.includes(b.id));
    const origin = new Map(movers.map((b) => [b.id, { start: b.start, end: b.end }]));
    /* Together the selection can only shift as far as its tightest member allows. */
    const minDt = -Math.min(...movers.map((b) => b.start));
    const maxDt = Math.min(...movers.map((b) => slide.duration - b.end));
    const x0 = e.clientX;
    const y0 = e.clientY;
    const scroller = scrollRef.current;
    const scroll0 = scroller?.scrollLeft ?? 0;
    let pointer = { x: x0, y: y0 };
    let mode: "time" | "stack" | null = null;
    let raf = 0;
    const onMove = (ev: PointerEvent | { clientX: number; clientY: number }) => {
      pointer = { x: ev.clientX, y: ev.clientY };
      const dx = ev.clientX - x0 + ((scroller?.scrollLeft ?? 0) - scroll0);
      const dy = ev.clientY - y0;
      if (!mode) {
        if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
        mode = reorderable && Math.abs(dy) > Math.abs(dx) ? "stack" : "time";
        state.setInteracting(true);
        if (mode === "stack") setLifting(true);
      }
      if (mode === "stack") {
        /* Rows run top-down from the front, so moving down the list is moving back in z. */
        const to = index - Math.round(dy / ROW_H);
        if (to !== useEditor.getState().project.slides.find((s) => s.id === slide.id)?.blocks.findIndex((b) => b.id === block.id)) moveBlockTo(block.id, to);
        return;
      }
      const dt = Math.min(maxDt, Math.max(minDt, snap(dx / pxPerSec)));
      const patches: Record<string, Partial<Block>> = {};
      origin.forEach((o, id) => (patches[id] = { start: snap(o.start + dt), end: snap(o.end + dt) }));
      updateBlocks(patches);
    };
    /* Past the track's edge the view creeps along so a pill can be carried further than the panel is wide. */
    const edge = () => {
      if (scroller && mode === "time") {
        const r = scroller.getBoundingClientRect();
        const over = pointer.x > r.right - 24 ? pointer.x - (r.right - 24) : pointer.x < r.left + 24 ? pointer.x - (r.left + 24) : 0;
        if (over) {
          scroller.scrollLeft += Math.sign(over) * Math.min(28, 3 + Math.abs(over) / 6);
          onMove({ clientX: pointer.x, clientY: pointer.y });
        }
      }
      raf = requestAnimationFrame(edge);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      cancelAnimationFrame(raf);
      state.setInteracting(false);
      setLifting(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    raf = requestAnimationFrame(edge);
  };
  const trimStart = (e: React.PointerEvent) => {
    const { start } = block;
    useEditor.getState().setInteracting(true);
    drag(
      e,
      (dt) => {
        const v = clampStart(snap(start + dt));
        updateBlock(block.id, { start: v });
        setLabel({ side: "start", t: v });
      },
      () => {
        useEditor.getState().setInteracting(false);
        setLabel(null);
      },
    );
  };
  /*
    Dragging an end past the scene's end lengthens the scene with it — the
    project is as long as its longest layer, as in the reference. Other
    layers keep their own length.
  */
  const trimEnd = (e: React.PointerEvent) => {
    const { end } = block;
    useEditor.getState().setInteracting(true);
    drag(
      e,
      (dt) => {
        const v = Math.max(block.start + 0.1, snap(end + dt));
        const now = useEditor.getState().project.slides.find((s) => s.id === slide.id);
        if (now && v > now.duration) updateSlide(slide.id, { duration: v });
        updateBlock(block.id, { end: v });
        setLabel({ side: "end", t: v });
      },
      () => {
        useEditor.getState().setInteracting(false);
        setLabel(null);
      },
    );
  };

  const openMenu = (x: number, y: number) => {
    const ids = targets();
    const grouped = slide.blocks.some((b) => ids.includes(b.id) && b.groupId);
    onContext(
      x,
      y,
      <>
        <MenuItem onClick={() => duplicateBlocks(ids)} icon={<Copy />} shortcut="⌘D">
          Duplicate
        </MenuItem>
        <MenuDivider />
        <MenuItem onClick={() => ids.forEach((id) => reorder(id, "forward"))} icon={<ArrowUp />} shortcut="]">
          Move up
        </MenuItem>
        <MenuItem onClick={() => ids.forEach((id) => reorder(id, "backward"))} icon={<ArrowDown />} shortcut="[">
          Move down
        </MenuItem>
        <MenuDivider />
        {ids.length > 1 && !grouped ? (
          <MenuItem onClick={() => groupBlocks(ids)} icon={<Group />} shortcut="⌘G">
            Group
          </MenuItem>
        ) : null}
        {grouped ? (
          <MenuItem onClick={() => ungroupBlocks(ids)} icon={<Ungroup />} shortcut="⌘⇧G">
            Ungroup
          </MenuItem>
        ) : null}
        <MenuItem onClick={() => ids.forEach((id) => updateBlock(id, { locked: !block.locked }))} icon={block.locked ? <LockOpen /> : <Lock />}>
          {block.locked ? "Unlock" : "Lock"}
        </MenuItem>
        <MenuItem onClick={() => removeBlocks(ids)} icon={<Trash2 />} shortcut="⌫" destructive>
          Delete{ids.length > 1 ? ` ${ids.length} layers` : ""}
        </MenuItem>
      </>,
    );
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
          lifting && "z-10 shadow-overlay ring-ink brightness-125",
        )}
        style={style}
        onPointerDown={move}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          pick();
          openMenu(e.clientX, e.clientY);
        }}
      >
        {block.groupId ? <Group className="ml-1.5 size-3 shrink-0 text-white/70" aria-label="In a group" /> : null}
        <span className={cn("pointer-events-none truncate px-2 text-[10px] leading-none font-medium tracking-[0.3px] text-white/90", block.hidden && "line-through opacity-60")}>{layerLabel(block)}</span>
        <span className="flex-1" />
        {/* The reference's pill affordances: menu, lock and visibility, shown on hover at the right end. */}
        <div className="mr-3 hidden shrink-0 items-center gap-0.5 group-hover:flex" onPointerDown={(e) => e.stopPropagation()}>
          <button
            type="button"
            aria-label="Layer options"
            className={pillIcon}
            onClick={(e) => {
              pick();
              const r = e.currentTarget.getBoundingClientRect();
              openMenu(r.left, r.bottom + 4);
            }}
          >
            <MoreHorizontal />
          </button>
          <button type="button" aria-label={block.locked ? "Unlock" : "Lock"} aria-pressed={block.locked} className={pillIcon} onClick={() => updateBlock(block.id, { locked: !block.locked })}>
            {block.locked ? <Lock /> : <LockOpen />}
          </button>
          <button type="button" aria-label={block.hidden ? "Show layer" : "Hide layer"} aria-pressed={block.hidden} className={pillIcon} onClick={() => updateBlock(block.id, { hidden: !block.hidden })}>
            {block.hidden ? <EyeOff /> : <Eye />}
          </button>
        </div>
        <div className="absolute top-0 bottom-0 left-0 w-2 cursor-ew-resize" onPointerDown={trimStart}>
          <div className="absolute top-1/2 left-[3px] h-2.5 w-[2px] -translate-y-1/2 rounded-full bg-white/70 opacity-0 group-hover:opacity-100" />
        </div>
        <div className="absolute top-0 right-0 bottom-0 w-2 cursor-ew-resize" onPointerDown={trimEnd}>
          <div className="absolute top-1/2 right-[3px] h-2.5 w-[2px] -translate-y-1/2 rounded-full bg-white/70 opacity-0 group-hover:opacity-100" />
        </div>
      </div>
      {label ? (
        <span
          className="pointer-events-none absolute -top-3 z-20 rounded-[4px] bg-black/85 px-1.5 py-0.5 text-[10px] leading-[12px] font-medium tabular-nums text-white"
          style={label.side === "end" ? { left: (offset + label.t) * pxPerSec + 6 } : { left: (offset + label.t) * pxPerSec - 44 }}
        >
          {clockLabel(label.t)}
        </span>
      ) : null}
    </div>
  );
}

function AudioBar({
  track,
  pxPerSec,
  total,
  scrollRef,
  onContext,
}: {
  track: { id: string; title: string; start: number; duration: number };
  pxPerSec: number;
  total: number;
  scrollRef: RefObject<HTMLDivElement | null>;
  onContext: (x: number, y: number, items: ReactNode) => void;
}) {
  const updateAudio = useEditor((s) => s.updateAudio);
  const removeAudio = useEditor((s) => s.removeAudio);
  const drag = useTimelineDrag(scrollRef, pxPerSec);
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
