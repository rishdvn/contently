import type { PropsOf } from "../../inputs";
import type { RenderContext } from "../../registry";
import { FONT, wrapLines, type TextStyle } from "../measure";

import type { inputs } from "./schema";

type Props = PropsOf<typeof inputs>;

/*
  Items are set left-aligned beside a column of markers and wrap to the box's
  width. All share one size: the largest at which every item, wrapped, fits the
  box's height, capped at a share of its width. Wider or taller, the list is
  refitted; it sits centred in the box's height.
*/
const TYPE: TextStyle = { weight: 600 };
const LINE = 1.25;
/* Space between items, and the marker column's width and gap, in em. */
const ITEM_GAP = 0.5;
const MARKER = { check: 1.05, bullet: 0.9, number: 1.35 };
const MARKER_GAP = 0.45;
const MAX_SHARE = 0.075;

/* Each item slides in over 14% of the block; the last one is in by 70%. */
const ENTER = 0.14;
const LAST = 0.7;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

function layout(items: string[], markerEm: number, width: number, height: number) {
  const wrap = (size: number) => items.map((item) => wrapLines(item, width / size - markerEm - MARKER_GAP, TYPE));
  const fits = (size: number) => {
    const lines = wrap(size).reduce((n, l) => n + l.length, 0);
    return (lines * LINE + (items.length - 1) * ITEM_GAP) * size <= height;
  };
  let lo = 1;
  let hi = Math.max(1, width * MAX_SHARE);
  if (fits(hi)) lo = hi;
  for (let i = 0; i < 24 && hi - lo > 0.25; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return { fontSize: lo, lines: wrap(lo) };
}

function Marker({ kind, n, color }: { kind: Props["marker"]; n: number; color: string }) {
  if (kind === "number") return <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{n}.</span>;
  if (kind === "bullet") return <span style={{ display: "block", width: "0.36em", height: "0.36em", borderRadius: "50%", background: color }} />;
  return (
    <svg viewBox="0 0 24 24" width="0.95em" height="0.95em" fill="none" stroke={color} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 12.5l5 5 10-11" />
    </svg>
  );
}

export function List({ props, ctx }: { props: Props; ctx: RenderContext }) {
  const markerEm = MARKER[props.marker];
  const { fontSize, lines } = layout(props.items, markerEm, ctx.width, ctx.height);
  const n = props.items.length;
  const step = n > 1 ? (LAST - ENTER) / (n - 1) : 0;

  return (
    <div
      className="size-full overflow-hidden"
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: ITEM_GAP * fontSize,
        color: props.color,
        fontFamily: FONT,
        fontWeight: TYPE.weight,
        fontSize,
        lineHeight: LINE,
        /* Set, not inherited: the studio's UI tracking would widen every line past its estimate. */
        letterSpacing: 0,
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {lines.map((itemLines, i) => {
        const t = easeOut(clamp01((ctx.progress - i * step) / ENTER));
        return (
          <div key={i} style={{ display: "flex", gap: `${MARKER_GAP}em`, opacity: t, transform: t < 1 ? `translateX(${(t - 1) * 0.8}em)` : undefined }}>
            <div style={{ flexShrink: 0, width: `${markerEm}em`, height: `${LINE}em`, display: "flex", alignItems: "center", justifyContent: props.marker === "number" ? "flex-end" : "center", color: props.accent }}>
              <Marker kind={props.marker} n={i + 1} color={props.accent} />
            </div>
            <div style={{ minWidth: 0 }}>
              {itemLines.map((line, j) => (
                <div key={j} style={{ whiteSpace: "pre", minHeight: `${LINE}em` }}>
                  {line}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
