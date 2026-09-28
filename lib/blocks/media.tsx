"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import { usePlaybackOverride } from "@/components/editor/canvas/playback";
import { useMediaPoster, useMediaUrl } from "@/lib/editor/media";
import { useEditor } from "@/lib/editor/store";

import type { MediaValue } from "./inputs";
import type { RenderContext } from "./registry";

/*
  An `image` input, painted. Blocks use this rather than a bare <img> so org media
  resolves through its `media` id exactly as an image block's does, and so the
  element is CORS-clean for export. Renders nothing when the input is empty.
*/
export function BlockImage({ value, style, className }: { value: MediaValue; style?: CSSProperties; className?: string }) {
  const src = useMediaUrl(value.mediaId, value.src);
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary user media, rendered at document scale
    <img src={src} alt="" draggable={false} crossOrigin="anonymous" className={className} style={{ objectFit: "cover", userSelect: "none", ...style }} />
  );
}

/*
  A `video` input, painted, showing the frame at `time` (the block's
  `ctx.time`): a clip shorter than the block loops. Silent, since a block has
  no soundtrack of its own, and nothing when the input is empty.

  Seeking every frame would stutter, so while the studio (or a hub preview)
  plays, the element plays too and is only pulled back when it drifts. Paused,
  scrubbing or exporting — the exporter pauses and steps the clock, then waits
  for the seek to land — it is held on the exact frame. A still shows the
  frame at its poster time.

  It covers its box, but not with `object-fit`: the exporter copies a <video>
  by drawing the whole frame into a canvas the element's size, which would
  squeeze the clip. The element keeps the clip's own shape instead, sized to
  cover the box, and the box clips it. `className` and `style` go on the box.
*/
export function BlockVideo({ value, time, mode, style, className }: { value: MediaValue; time: number; mode: RenderContext["mode"]; style?: CSSProperties; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const src = useMediaUrl(value.mediaId, value.src);
  const poster = useMediaPoster(value.mediaId);
  const override = usePlaybackOverride();
  const studioPlaying = useEditor((s) => s.playing);
  const playing = mode === "video" && (override ? override.playing : studioPlaying);
  /* Width over height of the clip, once its metadata is in. */
  const [aspect, setAspect] = useState<number | null>(null);

  const sync = useCallback(() => {
    const v = ref.current;
    if (!v) return;
    const length = v.duration;
    const at = Number.isFinite(length) && length > 0 ? time % length : time;
    if (playing) {
      if (Math.abs(v.currentTime - at) > 0.3) v.currentTime = at;
      if (v.paused) v.play().catch(() => {});
    } else {
      if (!v.paused) v.pause();
      if (Math.abs(v.currentTime - at) > 0.01) v.currentTime = at;
    }
  }, [playing, time]);

  useEffect(sync, [sync, src]);

  if (!src) return null;
  const cover: CSSProperties = aspect
    ? { position: "absolute", left: "50%", top: "50%", width: `max(100cqw, ${100 * aspect}cqh)`, height: `max(100cqh, ${100 / aspect}cqw)`, transform: "translate(-50%, -50%)", maxWidth: "none" }
    : { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" };
  return (
    <div className={className} style={{ overflow: "hidden", containerType: "size", ...style }}>
      <video
        ref={ref}
        src={src}
        poster={poster}
        muted
        loop
        playsInline
        preload="auto"
        crossOrigin="anonymous"
        disablePictureInPicture
        style={{ ...cover, userSelect: "none" }}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          if (v.videoWidth && v.videoHeight) setAspect(v.videoWidth / v.videoHeight);
          /* The clip's length is only known now, so the first seek could not wrap. */
          sync();
        }}
      />
    </div>
  );
}
