"use client";

import { memo } from "react";

import { useEditor } from "@/lib/editor/store";
import { backgroundCss } from "@/lib/editor/style";
import type { Slide } from "@/lib/editor/types";

import { BlockView } from "./BlockView";

/*
  One slide, painted at document scale (1 CSS px = 1 artboard px). The world
  transform on the parent handles zoom. Everything inside is exportable: no
  chrome, no selection UI.
*/
export const Artboard = memo(function Artboard({
  slide,
  width,
  height,
  x,
  y,
  interactive = true,
}: {
  slide: Slide;
  width: number;
  height: number;
  x: number;
  y: number;
  interactive?: boolean;
}) {
  const bg = slide.background;
  return (
    <div
      className="artboard absolute overflow-hidden"
      data-slide-id={slide.id}
      style={{ left: x, top: y, width, height, background: "#1d1d1d" }}
    >
      <div className="absolute inset-0" style={backgroundCss(bg)} />
      {slide.blocks.map((b) => (
        <BlockView key={b.id} block={b} interactive={interactive} />
      ))}
    </div>
  );
});

/* Static miniature of a slide for the slide strip, timeline, and export previews. */
export function SlidePreview({ slide, scale, className }: { slide: Slide; scale: number; className?: string }) {
  const width = useEditor((s) => s.project.width);
  const height = useEditor((s) => s.project.height);
  return (
    <div className={className} style={{ width: width * scale, height: height * scale, position: "relative", overflow: "hidden" }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width, height, position: "absolute" }}>
        <Artboard slide={slide} width={width} height={height} x={0} y={0} interactive={false} />
      </div>
    </div>
  );
}
