"use client";

import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { getBlock, type RenderContext } from "@/lib/blocks";
import { coerceProps } from "@/lib/blocks/inputs";
import { useMediaPoster, useMediaUrl } from "@/lib/editor/media";
import { useEditor, withoutHistory } from "@/lib/editor/store";
import { effectOverlays, filterCss, flipStyle, frameStyle, gradientCss, highlightStyle, shadowCss, textStyle } from "@/lib/editor/style";
import { NEUTRAL_ADJUSTMENTS, type Block, type ComponentBlock, type ImageBlock, type ShapeBlock, type TextBlock, type VideoBlock } from "@/lib/editor/types";
import { splitWords, WORD_RISE, wordProgress } from "@/lib/editor/wordReveal";

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

  /*
    In a video the block only exists between its in and out points. Anywhere
    else there is no clock, so progress is null and a still shows every preset
    at rest: entrances have landed, zoom and pan sit at their neutral frame.
  */
  const inRange = !isVideoProject || (time >= block.start && time <= block.end);
  const progress = !isVideoProject ? null : block.end > block.start ? (time - block.start) / (block.end - block.start) : 0;

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
            <TextContent block={block} editing={editing} measure={interactive} elapsed={progress === null ? null : time - block.start} />
          ) : block.type === "image" ? (
            <ImageContent block={block} />
          ) : block.type === "video" ? (
            <VideoContent block={block} />
          ) : block.type === "component" ? (
            <ComponentContent block={block} video={isVideoProject} time={time} />
          ) : (
            <ShapeContent block={block} />
          )}
        </div>
      </div>
    </div>
  );
});

/* Preset animations are driven from timeline progress, not CSS keyframes, so scrubbing works. */
function animationStyle(b: Block, p: number | null, inRange: boolean): CSSProperties {
  if (b.animation === "none" || !inRange || p === null) return {};
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
    case "words":
      /* Animated per word by TextContent. */
      return {};
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

function TextContent({ block, editing, measure, elapsed }: { block: TextBlock; editing: boolean; measure: boolean; elapsed: number | null }) {
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
    if (measure && needed > 0 && Math.abs(needed - block.h) > 1) withoutHistory(() => updateBlock(block.id, { h: needed }));
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
  const content = block.animation === "words" && !editing ? <WordReveal block={block} elapsed={elapsed} /> : block.text;

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
        {hl ? <span style={hl}>{content}</span> : content}
      </div>
    </div>
  );
}

/*
  The "words" entrance. Words stay inline, offset with `position: relative`
  rather than a transform, so wrapping, break-word and highlights lay out
  exactly as the plain text does. `elapsed` is null in a still: every word
  has landed.
*/
function WordReveal({ block, elapsed }: { block: TextBlock; elapsed: number | null }) {
  const parts = splitWords(block.text);
  const count = parts.filter((p) => p.word).length;
  let index = 0;
  return parts.map((part, i) => {
    if (!part.word) return part.text;
    const e = elapsed === null ? 1 : wordProgress(index++, count, elapsed);
    return (
      <span key={i} style={e < 1 ? { position: "relative", top: (1 - e) * WORD_RISE * block.fontSize, opacity: e } : undefined}>
        {part.text}
      </span>
    );
  });
}

/* --------------------------------------------------------------- media --- */

/*
  The frame around a photo or a clip. `src` is passed in rather than read off the
  block because org media lives behind a `media` id and only resolves to a URL at
  render time; "no src" is what draws the missing-media state.
*/
function MediaFrame({ block, src, children }: { block: ImageBlock | VideoBlock; src: string; children: React.ReactNode }) {
  const overlays = effectOverlays(block.effects);
  return (
    <div
      className="relative size-full overflow-hidden"
      style={{
        borderRadius: block.radius,
        boxShadow: shadowCss(block.shadow),
        border: block.border?.width ? `${block.border.width}px solid ${block.border.color}` : undefined,
        background: src ? undefined : "#1d1d1d",
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
      {!src ? <MissingMedia /> : null}
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
  const src = useMediaUrl(block.mediaId, block.src);
  return (
    <MediaFrame block={block} src={src}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary user URLs, rendered at document scale
        <img
          src={src}
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
  const src = useMediaUrl(block.mediaId, block.src);
  /* Uploads carry a poster, so a clip shows its first frame while it buffers
     instead of a black hole. */
  const poster = useMediaPoster(block.mediaId);
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
    <MediaFrame block={block} src={src}>
      {src ? (
        <video
          ref={ref}
          src={src}
          poster={poster}
          /* Only a video project has a soundtrack. In a still or a carousel
             the clip loops as a moving picture, and a loop with sound would
             play for as long as the studio is open. */
          muted={block.muted || globalMuted || !isVideoProject}
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
            if (Number.isFinite(d) && d !== block.sourceDuration) withoutHistory(() => updateBlock(block.id, { sourceDuration: d }));
          }}
        />
      ) : null}
    </MediaFrame>
  );
}

/* ----------------------------------------------------------- component --- */

/*
  A catalog block, drawn by its registered definition. The clock is the one
  `animationStyle` uses: in a video, progress runs 0 → 1 between the block's in
  and out points; anywhere else the block shows its poster frame. Props pass
  through the schema first, so a document written by an older schema or an API
  caller still renders.
*/
function ComponentContent({ block, video, time }: { block: ComponentBlock; video: boolean; time: number }) {
  const def = getBlock(block.componentId);
  const props = useMemo(() => (def ? coerceProps(def.inputs, block.props) : null), [def, block.props]);
  const ref = useRef<HTMLDivElement>(null);
  const live = useLiveSize(ref);
  if (!def || !props) return <UnknownComponent id={block.componentId} />;

  const duration = video ? Math.max(0.001, block.end - block.start) : def.defaultDuration;
  const progress = video ? Math.min(1, Math.max(0, (time - block.start) / duration)) : (def.poster?.progress ?? 1);
  /* Mid-gesture the gizmo resizes the element before the store hears of it; lay out to what is on screen. */
  const width = live && live.w !== block.w ? live.w : block.w;
  const height = live && live.h !== block.h ? live.h : block.h;
  const ctx: RenderContext = { mode: video ? "video" : "static", progress, time: progress * duration, duration, width, height };
  const overlays = effectOverlays(block.effects);

  return (
    <div ref={ref} className="relative size-full" style={{ filter: shadowCss(block.shadow) ? `drop-shadow(${shadowCss(block.shadow)})` : undefined }}>
      <div className="absolute inset-0" style={{ filter: filterCss(NEUTRAL_ADJUSTMENTS, block.effects) }}>
        {def.render(props, ctx)}
      </div>
      {overlays.map((o, i) => (
        <div key={i} className="pointer-events-none absolute inset-0" style={o} />
      ))}
    </div>
  );
}

/* The element's layout size (unaffected by zoom transforms), tracked as it changes. */
function useLiveSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setSize({ w: el.offsetWidth, h: el.offsetHeight }));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

function UnknownComponent({ id }: { id: string }) {
  return (
    <div className="flex size-full items-center justify-center bg-[#1d1d1d] text-center text-ink-disabled" style={{ fontSize: 28 }}>
      Unknown block “{id}”
    </div>
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
