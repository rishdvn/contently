"use client";

import type { CSSProperties } from "react";

import { useMediaUrl } from "@/lib/editor/media";

import type { MediaValue } from "./inputs";

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
