"use client";

import { memo, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

import { useEditor } from "@/lib/editor/store";
import { effectOverlays, filterCss, flipStyle, frameStyle, gradientCss, highlightStyle, shadowCss, textStyle } from "@/lib/editor/style";
import type { Block, ImageBlock, ShapeBlock, TextBlock, VideoBlock } from "@/lib/editor/types";

import { usePlaybackOverride } from "./playback";

/*
  Renders one block inside an artboard. The wrapper carries the geometry and
  is what Moveable / Selecto target; the inner element paints the content.
  Nothing here knows about selection — that is drawn by the gizmo layer so the
  artboard DOM stays clean enough to export as-is.
*/
export const BlockView = memo(function BlockView({
  block,
  interactive = true,
}: {
  block: Block;
  interactive?: boolean;
}) {
  const pb = usePlaybackOverride();
  const isVideoProject = useEditor((s) => (pb ? pb.kind : s.project.kind) === "video");
  const time = useEditor((s) => (isVideoProject ? (pb ? pb.time : s.time) : 0));
  const editing = useEditor((s) => interactive && !pb && s.editingTextId === block.id);

  if (block.hidden) return null;

  /* In a video the block only exists between its in and out points. */
  const inRange = !isVideoProject || (time >= block.start && time <= block.end);
  const progress = isVideoProject && block.end > block.start ? (time - block.start) / (block.end - block.start) : 0;

  const style: CSSProperties = {
    ...frameStyle(block),
    visibility: inRange ? undefined : "hidden",
    pointerEvents: interactive && !block.locked ? "auto" : "none",
  };

  return (
    <div
      className="block"
      data-block-id={block.id}
      data-locked={block.locked || undefined}
      data-type={block.type}
      style={style}
    >
      <div className="absolute inset-0" style={animationStyle(block, progress, inRange)}>
        <div className="absolute inset-0" style={flipStyle(block)}>
          {block.type === "text" ? (
            <TextContent block={block} editing={editing} measure={interactive} />
          ) : block.type === "image" ? (
            <ImageContent block={block} />
          ) : block.type === "video" ? (
            <VideoContent block={block} />
          ) : (
            <ShapeContent block={block} />
          )}
        </div>
      </div>
    </div>
  );
});

/* Preset animations are driven from timeline progress, not CSS keyframes, so scrubbing works. */
function animationStyle(b: Block, p: number, inRange: boolean): CSSProperties {
  if (b.animation === "none" || !inRange) return {};
  const t = Math.min(1, Math.max(0, p));
  const ease = 1 - Math.pow(1 - t, 3);
  switch (b.animation) {
    case "zoom":
      return { transform: `scale(${1 + t * 0.12})` };
    case "pan":
      return { transform: `translateX(${(t - 0.5) * 6}%)` };
    case "fade":
      return { opacity: Math.min(1, ease * 3) };
    case "rise":
      return { transform: `translateY(${(1 - Math.min(1, ease * 2.5)) * 40}px)`, opacity: Math.min(1, ease * 3) };
  }
}

/* ---------------------------------------------------------------- text --- */

/* Re-renders once web fonts finish loading, so text can be re-measured. */
function useFontsReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => alive && setReady(true));
    const onDone = () => alive && setReady((r) => !r);
    document.fonts?.addEventListener("loadingdone", onDone);
    return () => {
      alive = false;
      document.fonts?.removeEventListener("loadingdone", onDone);
    };
  }, []);
  return ready;
}

function TextContent({ block, editing, measure }: { block: TextBlock; editing: boolean; measure: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const updateBlock = useEditor((s) => s.updateBlock);
  const setEditingText = useEditor((s) => s.setEditingText);

  useLayoutEffect(() => {
    if (!editing || !ref.current) return;
    const el = ref.current;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [editing]);

  const commit = () => {
    const el = ref.current;
    if (!el) return;
    const text = el.innerText.replace(/\n$/, "");
    if (text !== block.text) updateBlock(block.id, { text });
  };

  /*
    Text boxes are auto-height, as in Canva: width is the only free dimension
    and the box always hugs its content. Measured after every style change so
    the selection outline never lies about where the text is.
  */
  const autosize = () => {
    const el = ref.current;
    if (!el) return;
    /* offsetHeight is layout size, so the canvas zoom transform doesn't leak in. */
    const needed = el.offsetHeight;
    if (measure && needed > 0 && Math.abs(needed - block.h) > 1) updateBlock(block.id, { h: needed });
  };
  const fontsReady = useFontsReady();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- measure whenever anything affecting layout changes
  useLayoutEffect(autosize, [
    block.text,
    block.fontSize,
    block.fontFamily,
    block.fontWeight,
    block.italic,
    block.lineHeight,
    block.letterSpacing,
    block.w,
    block.highlight?.padding,
    block.highlight?.color,
    block.textTransform,
    fontsReady,
  ]);

  const hl = highlightStyle(block);
  const base = textStyle(block);

  return (
    <div className="size-full">
      <div
        ref={ref}
        contentEditable={editing}
        suppressContentEditableWarning
        spellCheck={false}
        onBlur={() => {
          commit();
          setEditingText(null);
        }}
        onInput={autosize}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            ref.current?.blur();
          }
          e.stopPropagation();
        }}
        onPointerDown={(e) => editing && e.stopPropagation()}
        data-text
        className="w-full outline-none"
        style={{
          ...base,
          ...(hl ? { lineHeight: hl.lineHeight } : null),
          cursor: editing ? "text" : undefined,
          userSelect: editing ? "text" : "none",
        }}
      >
        {hl ? <span style={hl}>{block.text}</span> : block.text}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- media --- */

function MediaFrame({ block, children }: { block: ImageBlock | VideoBlock; children: React.ReactNode }) {
  const overlays = effectOverlays(block.effects);
  return (
    <div
      className="relative size-full overflow-hidden"
      style={{
        borderRadius: block.radius,
        boxShadow: shadowCss(block.shadow),
        border: block.border?.width ? `${block.border.width}px solid ${block.border.color}` : undefined,
        background: block.src ? undefined : "#1d1d1d",
      }}
    >
      <div className="absolute inset-0" style={{ filter: filterCss(block.adjustments, block.effects) }}>
        {children}
      </div>
      {block.overlay ? (
        <div className="pointer-events-none absolute inset-0" style={{ background: block.overlay.color, opacity: block.overlay.opacity / 100 }} />
      ) : null}
      {overlays.map((o, i) => (
        <div key={i} className="pointer-events-none absolute inset-0" style={o} />
      ))}
      {!block.src ? <MissingMedia /> : null}
    </div>
  );
}

function MissingMedia() {
  return (
    <div className="absolute inset-0 flex items-center justify-center text-ink-disabled" style={{ fontSize: 28 }}>
      Media not available — replace it from Uploads
    </div>
  );
}

function ImageContent({ block }: { block: ImageBlock }) {
  return (
    <MediaFrame block={block}>
      {block.src ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary user URLs, rendered at document scale
        <img
          src={block.src}
          alt=""
          draggable={false}
          crossOrigin="anonymous"
          className="size-full select-none"
          style={{ objectFit: block.fit, objectPosition: `${block.focalX}% ${block.focalY}%` }}
        />
      ) : null}
    </MediaFrame>
  );
}

function VideoContent({ block }: { block: VideoBlock }) {
  const ref = useRef<HTMLVideoElement>(null);
  const pb = usePlaybackOverride();
  const playing = useEditor((s) => (pb ? pb.playing : s.playing));
  const isVideoProject = useEditor((s) => (pb ? pb.kind : s.project.kind) === "video");
  const time = useEditor((s) => (isVideoProject ? (pb ? pb.time : s.time) : 0));
  const globalMuted = useEditor((s) => (pb ? pb.muted : s.muted));
  const updateBlock = useEditor((s) => s.updateBlock);
  const gated = pb !== null;

  /* Keep the element in step with the timeline rather than letting it free-run. */
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (!isVideoProject) {
      /* Free-running clip in a still or carousel: the studio lets it loop, a preview gates it on hover. */
      if (!gated) return;
      if (playing) {
        if (v.paused) v.play().catch(() => {});
      } else {
        if (!v.paused) v.pause();
        if (Math.abs(v.currentTime - block.trimStart) > 0.05) v.currentTime = block.trimStart;
      }
      return;
    }
    const local = block.trimStart + Math.max(0, time - block.start);
    if (playing && time >= block.start && time <= block.end) {
      if (Math.abs(v.currentTime - local) > 0.3) v.currentTime = local;
      if (v.paused) v.play().catch(() => {});
    } else {
      if (!v.paused) v.pause();
      if (Math.abs(v.currentTime - local) > 0.05) v.currentTime = local;
    }
  }, [playing, time, block.start, block.end, block.trimStart, isVideoProject, gated]);

  useEffect(() => {
    const v = ref.current;
    if (v) v.volume = block.volume / 100;
  }, [block.volume]);

  return (
    <MediaFrame block={block}>
      {block.src ? (
        <video
          ref={ref}
          src={block.src}
          muted={block.muted || globalMuted}
          loop={block.loop && !isVideoProject}
          playsInline
          preload="auto"
          crossOrigin="anonymous"
          autoPlay={!isVideoProject && !pb}
          className="size-full"
          style={{ objectFit: block.fit, objectPosition: `${block.focalX}% ${block.focalY}%` }}
          onLoadedMetadata={(e) => {
            if (pb) return;
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d !== block.sourceDuration) updateBlock(block.id, { sourceDuration: d });
          }}
        />
      ) : null}
    </MediaFrame>
  );
}

/* --------------------------------------------------------------- shape --- */

const POLYGONS: Record<string, string> = {
  triangle: "50,2 98,98 2,98",
  diamond: "50,2 98,50 50,98 2,50",
  hexagon: "25,4 75,4 98,50 75,96 25,96 2,50",
  star: "50,2 61,36 98,38 68,60 79,96 50,74 21,96 32,60 2,38 39,36",
};

function ShapeContent({ block }: { block: ShapeBlock }) {
  const fill = block.gradient ? `url(#g-${block.id})` : block.fill;
  const strokeProps = block.stroke
    ? { stroke: block.stroke.color, strokeWidth: block.stroke.width, vectorEffect: "non-scaling-stroke" as const }
    : { stroke: "none" };
  const shadow = shadowCss(block.shadow);

  if (block.shape === "rect") {
    return (
      <div
        className="size-full"
        style={{
          background: block.gradient ? gradientCss(block.gradient) : block.fill,
          borderRadius: block.radius,
          border: block.stroke ? `${block.stroke.width}px solid ${block.stroke.color}` : undefined,
          boxShadow: shadow,
        }}
      />
    );
  }
  if (block.shape === "ellipse") {
    return (
      <div
        className="size-full rounded-full"
        style={{
          background: block.gradient ? gradientCss(block.gradient) : block.fill,
          border: block.stroke ? `${block.stroke.width}px solid ${block.stroke.color}` : undefined,
          boxShadow: shadow,
        }}
      />
    );
  }

  const sw = block.stroke?.width ?? 8;
  const color = block.stroke?.color ?? block.fill;

  if (block.shape === "line" || block.shape === "arrow") {
    return (
      <svg className="size-full overflow-visible" viewBox={`0 0 ${block.w} ${block.h}`} preserveAspectRatio="none" style={{ filter: shadow ? `drop-shadow(${shadow})` : undefined }}>
        <line x1={0} y1={block.h / 2} x2={block.shape === "arrow" ? block.w - sw * 2.2 : block.w} y2={block.h / 2} stroke={color} strokeWidth={sw} strokeLinecap="round" />
        {block.shape === "arrow" ? (
          <polygon
            points={`${block.w},${block.h / 2} ${block.w - sw * 3.2},${block.h / 2 - sw * 1.8} ${block.w - sw * 3.2},${block.h / 2 + sw * 1.8}`}
            fill={color}
          />
        ) : null}
      </svg>
    );
  }

  return (
    <svg className="size-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ filter: shadow ? `drop-shadow(${shadow})` : undefined }}>
      {block.gradient ? (
        <defs>
          <linearGradient id={`g-${block.id}`} gradientTransform={`rotate(${block.gradient.angle - 90} 0.5 0.5)`}>
            {block.gradient.stops.map((c, i, arr) => (
              <stop key={i} offset={`${(i / Math.max(1, arr.length - 1)) * 100}%`} stopColor={c} />
            ))}
          </linearGradient>
        </defs>
      ) : null}
      <polygon points={POLYGONS[block.shape]} fill={fill} strokeLinejoin="round" {...strokeProps} />
    </svg>
  );
}
