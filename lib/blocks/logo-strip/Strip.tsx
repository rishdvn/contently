import type { CSSProperties } from "react";

import type { MediaValue, PropsOf } from "../inputs";
import { BlockImage } from "../media";
import type { RenderContext } from "../registry";

import type { inputs } from "./schema";

type Props = PropsOf<typeof inputs>;

/*
  Every logo gets the same slot, `SLOT_RATIO` wide by one tall, and is
  contained inside it, so the row's geometry is known without measuring any
  image — which is what lets the marquee be a pure function of time.

  The slot height follows the block's height, capped so about four slots fit
  across: a wider block shows more logos, a taller one makes them larger up to
  that cap. Spacing is a percentage of the slot height, so it keeps its
  proportion as the block is resized.
*/
const SLOT_RATIO = 3.2;
const MAX_ACROSS = 4;
/* Seconds for the strip to fade in, so it doesn't pop on at its in point. */
const FADE_IN = 0.4;

/* Flattening to white or black keeps a logo's shape and drops its colours, whatever they were. */
const TONES: Record<Props["tone"], string | undefined> = {
  white: "brightness(0) invert(1) opacity(0.9)",
  black: "brightness(0) opacity(0.85)",
  grayscale: "grayscale(1) opacity(0.8)",
  original: undefined,
};

export function Strip({ props, ctx }: { props: Props; ctx: RenderContext }) {
  const { logos } = props;
  const slotH = Math.max(1, Math.min(ctx.height * 0.7, ctx.width / MAX_ACROSS / SLOT_RATIO));
  const slotW = slotH * SLOT_RATIO;
  const gap = (slotH * props.gap) / 100;
  const filter = TONES[props.tone];

  if (ctx.mode === "static") return <StaticRow logos={logos} slotW={slotW} slotH={slotH} gap={gap} width={ctx.width} filter={filter} />;

  /*
    One period is the whole list plus its trailing gap. The row is repeated
    enough times to cover the box and one period more, then slid by the
    distance travelled modulo a period — so the seam is never on screen.
    Speed 1 moves one slot (logo plus gap) a second.
  */
  const cell = slotW + gap;
  const period = logos.length * cell;
  const copies = Math.ceil(ctx.width / period) + 1;
  const travelled = (ctx.time * props.speed * cell) % period;
  const x = props.direction === "left" ? -travelled : travelled - period;
  const fade = "linear-gradient(to right, transparent, #000 9%, #000 91%, transparent)";

  return (
    <div
      className="size-full overflow-hidden"
      style={{ position: "relative", maskImage: fade, WebkitMaskImage: fade, opacity: Math.min(1, ctx.time / FADE_IN) }}
    >
      <div style={{ position: "absolute", left: 0, top: (ctx.height - slotH) / 2, height: slotH, display: "flex", transform: `translateX(${x}px)` }}>
        {Array.from({ length: copies }, (_, c) =>
          logos.map((value, i) => <Slot key={`${c}-${i}`} value={value} style={{ width: slotW, height: slotH, marginRight: gap, filter }} />),
        )}
      </div>
    </div>
  );
}

/*
  The still: evenly spaced across the box when the logos fit with at least the
  chosen spacing between them, otherwise at that spacing and scaled down to fit.
*/
function StaticRow({ logos, slotW, slotH, gap, width, filter }: { logos: MediaValue[]; slotW: number; slotH: number; gap: number; width: number; filter?: string }) {
  const n = logos.length;
  const fits = width - n * slotW >= (n + 1) * gap;
  const scale = fits ? 1 : Math.min(1, width / (n * slotW + (n + 1) * gap));
  return (
    <div className="size-full overflow-hidden" style={{ display: "flex", alignItems: "center", justifyContent: fits ? "space-evenly" : "center", gap: fits ? undefined : gap * scale, padding: fits ? undefined : `0 ${gap * scale}px` }}>
      {logos.map((value, i) => (
        <Slot key={i} value={value} style={{ width: slotW * scale, height: slotH * scale, flexShrink: 0, filter }} />
      ))}
    </div>
  );
}

/* An empty slot (a logo just added in the inspector) shows where the logo will go. */
function Slot({ value, style }: { value: MediaValue; style: CSSProperties }) {
  const h = Number(style.height) || 0;
  if (!value.src && !value.mediaId) {
    return (
      <div
        style={{
          flexShrink: 0,
          ...style,
          filter: undefined,
          boxSizing: "border-box",
          border: `${Math.max(1, h * 0.03)}px dashed rgba(128,128,128,0.6)`,
          borderRadius: h * 0.16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(128,128,128,0.9)",
          fontFamily: `"Inter", system-ui, sans-serif`,
          fontSize: h * 0.26,
          fontWeight: 500,
        }}
      >
        Logo
      </div>
    );
  }
  return (
    <div style={{ position: "relative", flexShrink: 0, ...style }}>
      <BlockImage value={value} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
    </div>
  );
}
