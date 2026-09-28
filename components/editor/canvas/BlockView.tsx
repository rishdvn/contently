"use client";

import { ImageOff } from "lucide-react";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { getBlock, type RenderContext } from "@/lib/blocks";
import { coerceProps } from "@/lib/blocks/inputs";
import { reportMediaLoad, useMediaPoster, useMediaUrl } from "@/lib/editor/media";
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
            <ImageContent block={block} interactive={interactive} />
          ) : block.type === "video" ? (
            <VideoContent block={block} interactive={interactive} />
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
  const words = block.animation === "words" && !editing;
  const content = words ? <WordReveal block={block} elapsed={elapsed} /> : block.text;
  /* A highlight arrives with the first word rather than sitting there empty. */
  const lead = words && elapsed !== null ? wordProgress(0, 1, elapsed) : 1;

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
        {hl ? <span style={lead < 1 ? { ...hl, opacity: lead } : hl}>{content}</span> : content}
      </div>
    </div>
  );
}

/*
  The "words" entrance. Words stay inline, offset with `position: relative`
  rather than a transform, so wrapping, break-word and highlights lay out
  exactly as the plain text does. `elapsed` is null in a still: every word
  has landed. Gradient text is one background clipped to every glyph, which
  ignores a word's own opacity and ends at the box, so there a word simply
  appears on its turn.
*/
function WordReveal({ block, elapsed }: { block: TextBlock; elapsed: number | null }) {
  const parts = splitWords(block.text);
  const count = parts.filter((p) => p.word).length;
  let index = 0;
  return parts.map((part, i) => {
    if (!part.word) return part.text;
    const e = elapsed === null ? 1 : wordProgress(index++, count, elapsed);
    const style: CSSProperties | undefined = e >= 1 ? undefined : block.gradient ? (e > 0 ? undefined : { visibility: "hidden" }) : { position: "relative", top: (1 - e) * WORD_RISE * block.fontSize, opacity: e };
    return (
      <span key={i} style={style}>
        {part.text}
      </span>
    );
  });
}

/* --------------------------------------------------------------- media --- */

/*
  The frame around a photo or a clip. `src` is passed in rather than read off the
  block because org media lives behind a `media` id and only resolves to a URL at
  render time. `status` is how the file is doing: loading draws a shimmer under
  it, missing (no URL, or one that failed) draws the placeholder instead.

  Neither is ever exported: both are marked `data-export-skip`, which the
  exporter filters out, so a file that is still loading costs a frame of
  nothing and a missing one is left out rather than baked into the PNG.
*/
type MediaStatus = "loading" | "ready" | "missing";

function MediaFrame({ block, status, onReplace, children }: { block: ImageBlock | VideoBlock; status: MediaStatus; onReplace?: () => void; children: React.ReactNode }) {
  const overlays = effectOverlays(block.effects);
  const missing = status === "missing";
  return (
    <div
      className="relative size-full overflow-hidden"
      data-export-skip={missing || undefined}
      style={{
        borderRadius: block.radius,
        boxShadow: shadowCss(block.shadow),
        border: block.border?.width ? `${block.border.width}px solid ${block.border.color}` : undefined,
        background: missing ? "#1d1d1d" : undefined,
      }}
    >
      {status === "loading" ? <div data-export-skip className="absolute inset-0 animate-pulse bg-[#262626]" /> : null}
      <div className="absolute inset-0" style={{ filter: filterCss(block.adjustments, block.effects) }}>
        {children}
      </div>
      {block.overlay ? (
        <div className="pointer-events-none absolute inset-0" style={{ background: block.overlay.color, opacity: block.overlay.opacity / 100 }} />
      ) : null}
      {overlays.map((o, i) => (
        <div key={i} className="pointer-events-none absolute inset-0" style={o} />
      ))}
      {missing ? <MissingMedia block={block} onReplace={onReplace} /> : null}
    </div>
  );
}

/*
  What a photo or clip that cannot be loaded looks like, wherever the block is
  drawn: the canvas, a filmstrip tile, a hub card. Sized from the block rather
  than the screen, so it reads at every zoom its miniatures are drawn at. Only
  the canvas has somewhere to replace it from, so only the canvas has the button.
*/
function MissingMedia({ block, onReplace }: { block: ImageBlock | VideoBlock; onReplace?: () => void }) {
  const unit = Math.min(block.w, block.h);
  const text = Math.max(12, Math.min(48, unit * 0.06));
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-[#8a8a8a]" style={{ gap: text * 0.6, padding: text }} data-missing-media>
      <ImageOff style={{ width: Math.max(16, unit * 0.16), height: Math.max(16, unit * 0.16) }} strokeWidth={1.5} aria-hidden />
      <span style={{ fontSize: text, lineHeight: 1.2 }}>Media unavailable</span>
      {onReplace ? (
        <button
          type="button"
          className="rounded-full bg-white text-[#111] hover:bg-white/90"
          style={{ fontSize: text * 0.9, padding: `${text * 0.35}px ${text * 0.9}px`, pointerEvents: "auto" }}
          /* Not a press on the block: without preventDefault the mousedown that
             follows would reach the canvas's marquee, select the block and put
             the transform box between this button and its click. */
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          onClick={(e) => {
            e.stopPropagation();
            onReplace();
          }}
        >
          Replace
        </button>
      ) : null}
    </div>
  );
}

/*
  Where a media element's file has got to, per URL, so a new URL starts over
  as loading without an effect resetting anything. What it finds is reported to
  the page-wide registry, which the export's missing-media check reads.
*/
function useMediaLoad(src: string) {
  const [result, setResult] = useState<{ src: string; ok: boolean } | null>(null);
  const status: MediaStatus = !src ? "missing" : result?.src !== src ? "loading" : result.ok ? "ready" : "missing";
  const settle = (ok: boolean) => {
    reportMediaLoad(src, ok);
    setResult({ src, ok });
  };
  return { status, onLoad: () => settle(true), onError: () => settle(false) };
}

/* The Replace flow the selection toolbar and inspector use, for this block. */
function useReplace(block: ImageBlock | VideoBlock, interactive: boolean) {
  const select = useEditor((s) => s.select);
  const pickMedia = useEditor((s) => s.pickMedia);
  if (!interactive) return undefined;
  return () => {
    select([block.id], false, true);
    pickMedia({ blockId: block.id, path: [], kind: block.type, label: block.type === "image" ? "Image" : "Video" });
  };
}

function ImageContent({ block, interactive }: { block: ImageBlock; interactive: boolean }) {
  const src = useMediaUrl(block.mediaId, block.src);
  const { status, onLoad, onError } = useMediaLoad(src);
  return (
    <MediaFrame block={block} status={status} onReplace={useReplace(block, interactive)}>
      {src && status !== "missing" ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary user URLs, rendered at document scale
        <img
          src={src}
          alt=""
          draggable={false}
          crossOrigin="anonymous"
          className="size-full select-none"
          style={{ objectFit: block.fit, objectPosition: `${block.focalX}% ${block.focalY}%` }}
          onLoad={onLoad}
          onError={onError}
        />
      ) : null}
    </MediaFrame>
  );
}

function VideoContent({ block, interactive }: { block: VideoBlock; interactive: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const src = useMediaUrl(block.mediaId, block.src);
  const { status, onLoad, onError } = useMediaLoad(src);
  const replace = useReplace(block, interactive);
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
    <MediaFrame block={block} status={status} onReplace={replace}>
      {src && status !== "missing" ? (
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
          onLoadedData={onLoad}
          onError={onError}
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
