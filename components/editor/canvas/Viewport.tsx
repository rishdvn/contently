"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { fitViewport, slideOrigin, slideRect, worldBounds, zoomAt } from "@/lib/editor/geometry";
import { useEditor } from "@/lib/editor/store";
import type { Rect } from "@/lib/editor/types";

import { Artboard } from "./Artboard";
import { ContextMenu } from "./ContextMenu";
import { Gizmo } from "./Gizmo";
import { SelectionToolbar } from "./SelectionToolbar";

export type Insets = { left: number; right: number; top: number; bottom: number };

/*
  The infinite canvas. Everything the user edits lives on a "world" plane that
  is translated and scaled as one; panels float above it and never push it
  around. Panning is wheel / trackpad, middle-drag, or space-drag; zoom is
  ctrl/cmd + wheel about the cursor.
*/
export function Viewport({ insets, children }: { insets: Insets; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  /* The element itself, as state, so children can use it during render. */
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const viewport = useEditor((s) => s.viewport);
  const setViewport = useEditor((s) => s.setViewport);
  const project = useEditor((s) => s.project);
  const spaceHeld = useEditor((s) => s.spaceHeld);
  const activeSlideId = useEditor((s) => s.activeSlideId);
  const clearSelection = useEditor((s) => s.clearSelection);
  const setActiveSlide = useEditor((s) => s.setActiveSlide);
  const setEditingText = useEditor((s) => s.setEditingText);
  const insetsRef = useRef(insets);
  useLayoutEffect(() => {
    insetsRef.current = insets;
  });

  const visibleArea = useCallback((): Rect => {
    const el = ref.current;
    const i = insetsRef.current;
    if (!el) return { x: 0, y: 0, w: 1, h: 1 };
    return { x: i.left, y: i.top, w: el.clientWidth - i.left - i.right, h: el.clientHeight - i.top - i.bottom };
  }, []);

  /* Fit once per project; after that the user owns the camera. */
  const fittedFor = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (fittedFor.current === project.id) return;
    fittedFor.current = project.id;
    const rect = project.kind === "carousel" ? worldBounds(project) : slideRect(project, 0);
    setViewport(fitViewport(rect, visibleArea()));
  }, [project, setViewport, visibleArea]);

  useEffect(() => {
    const api: CameraApi = {
      fit: () => {
        const rect = project.kind === "carousel" ? worldBounds(project) : slideRect(project, 0);
        setViewport(fitViewport(rect, visibleArea()));
      },
      fitSlide: (index) => setViewport(fitViewport(slideRect(project, index), visibleArea())),
      zoomTo: (z) => {
        const a = visibleArea();
        setViewport((v) => zoomAt(v, z, a.x + a.w / 2, a.y + a.h / 2));
      },
      zoomBy: (f) => {
        const a = visibleArea();
        setViewport((v) => zoomAt(v, v.zoom * f, a.x + a.w / 2, a.y + a.h / 2));
      },
      centerSlide: (index) => {
        const a = visibleArea();
        const o = slideOrigin(project, index);
        setViewport((v) => ({
          zoom: v.zoom,
          x: a.x + a.w / 2 - (o.x + project.width / 2) * v.zoom,
          y: a.y + a.h / 2 - (o.y + project.height / 2) * v.zoom,
        }));
      },
    };
    cameraRef.current = api;
  }, [project, setViewport, visibleArea]);

  /* Wheel must be a native, non-passive listener or preventDefault is ignored. */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      /* Chrome floats inside the viewport; wheel over a panel scrolls the panel, not the canvas. */
      const target = e.target as Element;
      if (target !== el && !target.closest(".world, .moveable-control-box")) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-e.deltaY * 0.0022);
        setViewport((v) => zoomAt(v, v.zoom * factor, e.clientX - rect.left, e.clientY - rect.top));
      } else {
        setViewport((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setViewport]);

  /* Middle button or space + primary button pans. */
  const pan = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const [panning, setPanning] = useState(false);
  const onPointerDown = (e: React.PointerEvent) => {
    const wantsPan = e.button === 1 || (e.button === 0 && spaceHeld);
    if (!wantsPan) return;
    e.preventDefault();
    e.stopPropagation();
    pan.current = { x: e.clientX, y: e.clientY, vx: viewport.x, vy: viewport.y };
    setPanning(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const p = pan.current;
    if (!p) return;
    setViewport({ zoom: viewport.zoom, x: p.vx + (e.clientX - p.x), y: p.vy + (e.clientY - p.y) });
  };
  const onPointerUp = () => {
    pan.current = null;
    setPanning(false);
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>(".block[data-type='text']");
    if (el?.dataset.blockId && !el.dataset.locked) setEditingText(el.dataset.blockId);
  };

  /* Clicking an artboard's empty area makes it the active slide. */
  const onBackgroundClick = (slideId: string) => {
    setActiveSlide(slideId);
    clearSelection();
  };

  return (
    <div
      ref={(node) => {
        ref.current = node;
        setContainer(node);
      }}
      className="viewport absolute inset-0 overflow-hidden bg-canvas select-none"
      style={{ cursor: spaceHeld ? (panning ? "grabbing" : "grab") : undefined }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
    >
      <div
        ref={worldRef}
        className="world absolute left-0 top-0"
        style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`, transformOrigin: "0 0" }}
      >
        {project.slides.map((s, i) => {
          /* Video scenes are sequential in time, so only the active one is on the canvas. */
          if (project.kind === "video" && s.id !== activeSlideId) return null;
          const o = slideOrigin(project, project.kind === "video" ? 0 : i);
          return (
            <ArtboardWithLabel
              key={s.id}
              index={i}
              slideId={s.id}
              x={o.x}
              y={o.y}
              showLabel={project.kind === "carousel"}
              onBackgroundClick={onBackgroundClick}
            >
              <Artboard slide={s} width={project.width} height={project.height} x={o.x} y={o.y} />
            </ArtboardWithLabel>
          );
        })}
      </div>

      <Gizmo container={container} worldRef={worldRef} />
      <SelectionToolbar container={container} />
      <ContextMenu container={container} />
      {children}
    </div>
  );
}

function ArtboardWithLabel({
  index,
  slideId,
  x,
  y,
  showLabel,
  onBackgroundClick,
  children,
}: {
  index: number;
  slideId: string;
  x: number;
  y: number;
  showLabel: boolean;
  onBackgroundClick: (id: string) => void;
  children: ReactNode;
}) {
  const active = useEditor((s) => s.activeSlideId === slideId);
  const zoom = useEditor((s) => s.viewport.zoom);
  const name = useEditor((s) => s.project.slides[index]?.name ?? "");
  const width = useEditor((s) => s.project.width);
  const height = useEditor((s) => s.project.height);
  return (
    <>
      {/* Lift the artboard off the canvas. Lives outside the exportable node. */}
      <div
        className="pointer-events-none absolute"
        style={{
          left: x,
          top: y,
          width,
          height,
          boxShadow: `0 0 0 ${1 / zoom}px rgb(255 255 255 / 0.1), 0 ${24 / zoom}px ${64 / zoom}px rgb(0 0 0 / 0.55)`,
        }}
      />
      {showLabel ? (
        <div
          className="absolute whitespace-nowrap text-ink-secondary"
          style={{
            left: x,
            top: y,
            /* Labels are chrome, so they stay a constant screen size. */
            transform: `translateY(calc(-100% - ${10 / zoom}px)) scale(${1 / zoom})`,
            transformOrigin: "0 100%",
            fontSize: 13,
            letterSpacing: 0.8,
            color: active ? "#f5f5f5" : "#71717a",
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            onBackgroundClick(slideId);
          }}
        >
          {name || `Slide ${index + 1}`}
        </div>
      ) : null}
      {children}
    </>
  );
}

export type CameraApi = {
  fit: () => void;
  fitSlide: (index: number) => void;
  zoomTo: (z: number) => void;
  zoomBy: (f: number) => void;
  centerSlide: (index: number) => void;
};

/* Imperative camera access for the toolbar and shortcuts; there is only one viewport. */
export const cameraRef: { current: CameraApi | null } = { current: null };
