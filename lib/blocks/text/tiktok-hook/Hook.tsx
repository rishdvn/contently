import type { CSSProperties } from "react";

import type { PropsOf } from "../../inputs";
import type { RenderContext } from "../../registry";
import { fitText, FONT } from "../measure";

import type { inputs } from "./schema";

type Props = PropsOf<typeof inputs>;

/*
  The block covers the frame; the caption is set inside the part of it TikTok
  and Reels leave clear: below the top bar, left of the column of buttons,
  above the caption and sound row. Shares of the frame, from the 1080 × 1920
  safe-zone guides. Wider or taller, the zone scales with the frame and the
  caption is refitted to it, at most half its height and a caption's size.
*/
const SAFE = { top: 0.09, right: 0.15, bottom: 0.2, left: 0.06 };
const MAX_SIZE = 0.068;
const MAX_HEIGHT = 0.5;

/*
  Per style: line spacing, tracking, and the padding a background adds around
  the type, in em. The outline is tracked out so its stroke (0.075em each side)
  does not close the gaps between words.
*/
const STYLES = {
  highlight: { lineHeight: 1.36, letterSpacing: 0, padX: 0.28, padY: 0 },
  outline: { lineHeight: 1.18, letterSpacing: 0.03, padX: 0.12, padY: 0 },
  box: { lineHeight: 1.22, letterSpacing: 0, padX: 0.55, padY: 0.4 },
} as const;
const STROKE = 0.075;

/* Words arrive across the first 70% of the block, each popping in over a short window. */
const REVEAL = 0.7;
const POP = 0.08;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);

/* A stroke drawn as a ring of shadows: unlike `-webkit-text-stroke` it sits outside the glyphs, and it survives the exporter. */
function outline(color: string, width: number) {
  return Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return `${(Math.cos(a) * width).toFixed(2)}px ${(Math.sin(a) * width).toFixed(2)}px 0 ${color}`;
  }).join(", ");
}

export function Hook({ props, ctx }: { props: Props; ctx: RenderContext }) {
  const style = STYLES[props.style];
  const zone = {
    left: ctx.width * SAFE.left,
    top: ctx.height * SAFE.top,
    width: ctx.width * (1 - SAFE.left - SAFE.right),
    height: ctx.height * (1 - SAFE.top - SAFE.bottom),
  };
  const maxSize = Math.max(1, ctx.width * MAX_SIZE);
  /* Fit inside the room the background's padding leaves, sized for the largest type. */
  const { fontSize, lines } = fitText(
    props.text,
    { width: zone.width - 2 * style.padX * maxSize, height: zone.height * MAX_HEIGHT - 2 * style.padY * maxSize },
    { weight: 800, lineHeight: style.lineHeight, letterSpacing: style.letterSpacing, maxSize },
  );

  const words = lines.map((line) => line.split(" ").filter(Boolean));
  const total = Math.max(1, words.flat().length);
  let index = 0;
  const at = (k: number) => (ctx.mode === "static" ? 1 : clamp01((ctx.progress - (REVEAL - POP) * (k / total)) / POP));

  const radius = 0.22 * fontSize;
  const word = (k: number): CSSProperties => {
    const t = at(k);
    return {
      display: "inline-block",
      opacity: clamp01(t * 2),
      transform: t < 1 ? `scale(${0.7 + 0.3 * easeOutBack(t)})` : undefined,
      transformOrigin: "50% 80%",
    };
  };
  const panel = easeOut(at(0));

  return (
    <div className="size-full overflow-hidden" style={{ position: "relative" }}>
      <div
        style={{
          position: "absolute",
          ...zone,
          display: "flex",
          flexDirection: "column",
          justifyContent: { top: "flex-start", center: "center", bottom: "flex-end" }[props.position],
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: `${style.padY * fontSize}px ${props.style === "box" ? style.padX * fontSize : 0}px`,
            borderRadius: radius * 1.4,
            background: props.style === "box" ? props.fill : undefined,
            opacity: props.style === "box" ? panel : 1,
            transform: props.style === "box" && panel < 1 ? `scale(${0.92 + 0.08 * panel})` : undefined,
            color: props.textColor,
            fontFamily: FONT,
            fontWeight: 800,
            fontSize,
            lineHeight: style.lineHeight,
            letterSpacing: `${style.letterSpacing}em`,
            textAlign: "center",
            WebkitFontSmoothing: "antialiased",
            textShadow: props.style === "outline" ? outline(props.fill, fontSize * STROKE) : undefined,
          }}
        >
          {words.map((line, i) => {
            const first = index;
            const spans = line.map((w, j) => (
              <span key={j} style={word(index++)}>
                {w}
                {j < line.length - 1 ? " " : ""}
              </span>
            ));
            const bg = easeOut(at(first));
            return (
              <div key={i} style={{ position: "relative", whiteSpace: "pre", minHeight: `${style.lineHeight}em`, padding: `0 ${style.padX}em` }}>
                {props.style === "highlight" && line.length ? (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: radius,
                      background: props.fill,
                      opacity: bg,
                      transform: bg < 1 ? `scaleX(${0.6 + 0.4 * bg})` : undefined,
                    }}
                  />
                ) : null}
                <span style={{ position: "relative" }}>{spans}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
