"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";
import Moveable, { type OnClick, type OnClickGroup, type OnDrag, type OnResize, type OnRotate } from "react-moveable";
import Selecto from "react-selecto";

import { findBlock, useEditor } from "@/lib/editor/store";
import type { Block } from "@/lib/editor/types";

/*
  The manipulation layer: Moveable draws the selection box and handles and
  drives drag / resize / rotate; Selecto provides click and marquee selection.
  Both sit in screen space above the world, so handles stay a constant size
  at any zoom. Moveable reads the world transform from the DOM itself.

  Geometry is written straight to the element during a gesture for
  responsiveness, then committed to the store once on release — one history
  entry per gesture, and React reconciles to the same values.
*/
export function Gizmo({ container, worldRef }: { container: HTMLDivElement | null; worldRef: RefObject<HTMLDivElement | null> }) {
  const moveableRef = useRef<Moveable>(null);
  const selectoRef = useRef<Selecto>(null);
  const selection = useEditor((s) => s.selection);
  const project = useEditor((s) => s.project);
  const viewport = useEditor((s) => s.viewport);
  const editing = useEditor((s) => s.editingTextId);
  const spaceHeld = useEditor((s) => s.spaceHeld);
  const select = useEditor((s) => s.select);
  const clearSelection = useEditor((s) => s.clearSelection);
  const setActiveSlide = useEditor((s) => s.setActiveSlide);
  const setEditingText = useEditor((s) => s.setEditingText);
  const updateBlocks = useEditor((s) => s.updateBlocks);
  const setInteracting = useEditor((s) => s.setInteracting);

  const [targets, setTargets] = useState<HTMLElement[]>([]);
  const [guidelines, setGuidelines] = useState<Element[]>([]);
  const [keepRatio, setKeepRatio] = useState(false);
  const pointerDown = useRef(false);
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (e.button === 0) pointerDown.current = true;
    };
    const up = () => {
      pointerDown.current = false;
    };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
    window.addEventListener("blur", up);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
      window.removeEventListener("blur", up);
    };
  }, []);

  /* Resolve selection ids to live DOM nodes after every render that could change them. */
  useEffect(() => {
    const root = worldRef.current;
    if (!root) return;
    const els = selection
      .map((id) => root.querySelector<HTMLElement>(`.block[data-block-id="${id}"]`))
      .filter((el): el is HTMLElement => !!el && !el.dataset.locked);
    setTargets(els);
    /* Selection is owned by the store; Selecto only needs it for shift-toggling. */
    selectoRef.current?.setSelectedTargets(els);

    const artboard = els[0]?.closest(".artboard");
    if (artboard) {
      const siblings = Array.from(artboard.querySelectorAll<HTMLElement>(".block")).filter((el) => !els.includes(el));
      setGuidelines([artboard, ...siblings]);
    } else {
      setGuidelines([]);
    }
  }, [selection, project, worldRef]);

  /* Any external geometry change — inspector fields, undo, zoom — re-syncs the box. */
  useEffect(() => {
    moveableRef.current?.updateRect();
  }, [project, viewport, targets]);

  const isText = targets.length === 1 && targets[0].dataset.type === "text";

  /* ------------------------------------------------------------- drag --- */
  const applyDrag = (e: OnDrag) => {
    e.target.style.left = `${e.left}px`;
    e.target.style.top = `${e.top}px`;
  };
  const commitFrames = (els: HTMLElement[], extra?: (el: HTMLElement) => Partial<Block>) => {
    const patches: Record<string, Partial<Block>> = {};
    for (const el of els) {
      const id = el.dataset.blockId!;
      patches[id] = {
        x: round(parseFloat(el.style.left)),
        y: round(parseFloat(el.style.top)),
        w: round(parseFloat(el.style.width)),
        h: round(parseFloat(el.style.height)),
        rotation: rotationOf(el),
        ...extra?.(el),
      };
    }
    updateBlocks(patches);
  };

  /* ----------------------------------------------------------- resize --- */
  const startFont = useRef<Map<HTMLElement, { size: number; w: number }>>(new Map());
  const applyResize = (e: OnResize) => {
    const el = e.target as HTMLElement;
    const text = el.dataset.type === "text";
    el.style.width = `${e.width}px`;
    if (!text) el.style.height = `${e.height}px`;
    el.style.left = `${e.drag.left}px`;
    el.style.top = `${e.drag.top}px`;
    /* Corner-dragging a text box scales the type, as in Canva. */
    const start = startFont.current.get(el);
    if (text && start && e.direction[0] !== 0 && e.direction[1] !== 0) {
      const inner = el.querySelector<HTMLElement>("[data-text]");
      if (inner) inner.style.fontSize = `${(start.size * e.width) / start.w}px`;
    }
  };
  const commitResize = (els: HTMLElement[]) => {
    commitFrames(els, (el) => {
      if (el.dataset.type !== "text") return {};
      const inner = el.querySelector<HTMLElement>("[data-text]");
      const size = inner ? parseFloat(inner.style.fontSize) : NaN;
      /* Height is owned by the auto-sizer; commit width and type size only. */
      const patch: Partial<Block> = { h: findBlock(project, el.dataset.blockId!)?.block.h };
      if (Number.isFinite(size)) (patch as { fontSize?: number }).fontSize = round(size, 1);
      return patch;
    });
    startFont.current.clear();
  };

  /* ----------------------------------------------------------- rotate --- */
  const applyRotate = (e: OnRotate) => {
    const el = e.target as HTMLElement;
    el.style.transform = `rotate(${e.rotation}deg)`;
  };

  const onClick = (e: OnClick) => {
    const el = e.target as HTMLElement;
    if (e.isDouble && el.dataset.type === "text") setEditingText(el.dataset.blockId!);
    else if (e.inputEvent?.shiftKey && el.dataset.blockId) select([el.dataset.blockId], true);
  };
  /* Group mode covers its members with an area element, so clicks arrive here instead. */
  const onClickGroup = (e: OnClickGroup) => {
    const el = e.targets[e.targetIndex] as HTMLElement | undefined;
    if (!el?.dataset.blockId) {
      /* Empty space inside the group box behaves like empty canvas. */
      if (!e.inputEvent?.shiftKey) clearSelection();
      return;
    }
    if (e.inputEvent?.shiftKey) select([el.dataset.blockId], true);
    else if (e.isDouble && el.dataset.type === "text") {
      select([el.dataset.blockId]);
      setEditingText(el.dataset.blockId);
    } else if (!e.isDouble) select([el.dataset.blockId]);
  };

  const begin = () => setInteracting(true);
  const end = () => setInteracting(false);

  if (!container) return null;

  return (
    <>
      <Moveable
        ref={moveableRef}
        target={targets}
        rootContainer={container}
        className="gizmo"
        draggable={!editing}
        resizable={!editing}
        rotatable={!editing}
        throttleDrag={0}
        throttleResize={0}
        throttleRotate={0}
        keepRatio={keepRatio}
        renderDirections={isText ? ["w", "e", "nw", "ne", "sw", "se"] : ["nw", "n", "ne", "w", "e", "sw", "s", "se"]}
        edge={false}
        origin={false}
        rotationPosition="bottom"
        snappable
        snapThreshold={5}
        snapDirections={{ top: true, left: true, bottom: true, right: true, center: true, middle: true }}
        elementSnapDirections={{ top: true, left: true, bottom: true, right: true, center: true, middle: true }}
        elementGuidelines={guidelines}
        snapGap={false}
        isDisplaySnapDigit={false}
        snapRotationDegrees={[0, 45, 90, 135, 180, 225, 270, 315]}
        snapRotationThreshold={4}
        useResizeObserver
        useMutationObserver
        preventClickDefault
        onClick={onClick}
        onClickGroup={onClickGroup}
        onDragStart={begin}
        onDrag={applyDrag}
        onDragEnd={(e) => {
          end();
          if (e.isDrag) commitFrames([e.target as HTMLElement]);
        }}
        onDragGroupStart={begin}
        onDragGroup={(e) => e.events.forEach(applyDrag)}
        onDragGroupEnd={(e) => {
          end();
          if (e.isDrag) commitFrames(e.targets as HTMLElement[]);
        }}
        onResizeStart={(e) => {
          begin();
          const el = e.target as HTMLElement;
          const corner = e.direction[0] !== 0 && e.direction[1] !== 0;
          flushSync(() => setKeepRatio(corner || el.dataset.type === "text"));
          if (el.dataset.type === "text") {
            const inner = el.querySelector<HTMLElement>("[data-text]");
            startFont.current.set(el, { size: parseFloat(inner?.style.fontSize || "64"), w: el.offsetWidth });
          }
        }}
        onResize={applyResize}
        onResizeEnd={(e) => {
          end();
          if (e.isDrag) commitResize([e.target as HTMLElement]);
        }}
        onResizeGroupStart={(e) => {
          begin();
          const corner = e.direction[0] !== 0 && e.direction[1] !== 0;
          flushSync(() => setKeepRatio(corner));
        }}
        onResizeGroup={(e) => e.events.forEach(applyResize)}
        onResizeGroupEnd={(e) => {
          end();
          if (e.isDrag) commitResize(e.targets as HTMLElement[]);
        }}
        onRotateStart={begin}
        onRotate={applyRotate}
        onRotateEnd={(e) => {
          end();
          if (e.isDrag) commitFrames([e.target as HTMLElement]);
        }}
        onRotateGroupStart={begin}
        onRotateGroup={(e) =>
          e.events.forEach((ev) => {
            applyRotate(ev);
            applyDrag(ev.drag);
          })
        }
        onRotateGroupEnd={(e) => {
          end();
          if (e.isDrag) commitFrames(e.targets as HTMLElement[]);
        }}
      />
      <Selecto
        ref={selectoRef}
        container={container}
        dragContainer={container}
        rootContainer={container}
        selectableTargets={[".artboard .block:not([data-locked])"]}
        hitRate={0}
        selectByClick
        selectFromInside={false}
        toggleContinueSelect={["shift"]}
        ratio={0}
        onDragStart={(e) => {
          const moveable = moveableRef.current;
          const target = e.inputEvent.target as Element;
          const btn = (e.inputEvent as PointerEvent).button;
          if (btn !== 0 || spaceHeld || editing) return e.stop();
          /*
            Panels float inside the viewport, so their presses reach this
            native listener regardless of React's stopPropagation. Only a
            press on the world plane or the bare canvas starts a selection.
          */
          if (target !== container && !target.closest(".world")) return e.stop();
          /* Let Moveable own presses on its handles or on an already-selected block. */
          if (moveable?.isMoveableElement(target) || targets.some((t) => t === target || t.contains(target))) e.stop();
        }}
        onSelectEnd={(e) => {
          const ids = (e.selected as HTMLElement[]).map((el) => el.dataset.blockId!).filter(Boolean);
          const target = e.inputEvent?.target as Element | undefined;
          const artboard = target?.closest<HTMLElement>(".artboard");
          if (artboard?.dataset.slideId) setActiveSlide(artboard.dataset.slideId);
          if (ids.length) {
            const block = findBlock(project, ids[0]);
            const slideId = block?.slide.id;
            if (slideId) setActiveSlide(slideId);
            select(ids);
          } else {
            clearSelection();
          }
          /*
            A press-and-drag on an unselected block selects it and starts moving
            it in one motion. Only hand the gesture to Moveable while the button
            is still down; a stale dragStart would glue the block to the cursor.
          */
          if (e.isDragStartEnd && ids.length && pointerDown.current) {
            e.inputEvent.preventDefault();
            moveableRef.current?.waitToChangeTarget().then(() => {
              if (pointerDown.current) moveableRef.current?.dragStart(e.inputEvent);
            });
          }
        }}
      />
    </>
  );
}

const round = (n: number, dp = 1) => Math.round(n * 10 ** dp) / 10 ** dp;

/* Rotation lives in the frame's transform; parse it back rather than trusting a cache. */
function rotationOf(el: HTMLElement): number {
  const m = /rotate\((-?[\d.]+)deg\)/.exec(el.style.transform);
  return m ? round(parseFloat(m[1]), 1) : 0;
}
