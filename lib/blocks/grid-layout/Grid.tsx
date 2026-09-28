import type { MediaValue, PropsOf } from "../inputs";
import { BlockImage } from "../media";
import type { RenderContext } from "../registry";

import type { inputs } from "./schema";

type Props = PropsOf<typeof inputs>;

/*
  Tiles are placed in unit coordinates of the box and inset by the spacing,
  so the layout is exact at any size and every photo in the list always has a
  tile. Spacing and corners are percent of the box's shorter side: resizing
  keeps the look. Photos cover their tiles.
*/
type Cell = { x: number; y: number; w: number; h: number };

const across = (n: number, y = 0, h = 1, x0 = 0, w = 1): Cell[] => Array.from({ length: n }, (_, i) => ({ x: x0 + (i * w) / n, y, w: w / n, h }));
const down = (n: number, x = 0, w = 1, y0 = 0, h = 1): Cell[] => Array.from({ length: n }, (_, i) => ({ x, y: y0 + (i * h) / n, w, h: h / n }));

function cells(layout: Props["layout"], n: number): Cell[] {
  switch (layout) {
    case "row":
      return across(n);
    case "column":
      return down(n);
    case "feature":
      /* The first photo takes the left half; the rest stack on the right. */
      return n <= 2 ? across(n) : [{ x: 0, y: 0, w: 0.5, h: 1 }, ...down(n - 1, 0.5, 0.5)];
    case "grid":
      /* Two to a row; an odd last photo runs the full width. */
      if (n <= 2) return across(n);
      return [...across(2, 0, 0.5), ...(n === 3 ? [{ x: 0, y: 0.5, w: 1, h: 0.5 }] : across(2, 0.5, 0.5))];
  }
}

const THEME = { well: "#e6e6e6", glyph: "#c4c4c4" };

/* Each tile's entrance, as a fraction of the block's time: staggered, settled by about half-way. */
const ENTER = 0.26;
const STAGGER = 0.08;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export function Grid({ props, ctx }: { props: Props; ctx: RenderContext }) {
  const { width: W, height: H } = ctx;
  const side = Math.min(W, H);
  const gap = (props.gap / 100) * side;
  const radius = (props.radius / 100) * side;
  const layout = cells(props.layout, props.images.length);

  return (
    <div className="size-full overflow-hidden" style={{ position: "relative" }}>
      {props.images.map((image, i) => {
        const c = layout[i]!;
        /* Half the gap on inner edges, none on the box's own edges, so tiles meet the box flush. */
        const left = c.x * W + (c.x > 0 ? gap / 2 : 0);
        const top = c.y * H + (c.y > 0 ? gap / 2 : 0);
        const right = (c.x + c.w) * W - (c.x + c.w < 0.999 ? gap / 2 : 0);
        const bottom = (c.y + c.h) * H - (c.y + c.h < 0.999 ? gap / 2 : 0);
        const f = easeOut(clamp01((ctx.progress - i * STAGGER) / ENTER));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left,
              top,
              width: Math.max(0, right - left),
              height: Math.max(0, bottom - top),
              borderRadius: radius,
              overflow: "hidden",
              opacity: f,
              transform: f >= 1 ? undefined : `scale(${0.88 + 0.12 * f})`,
            }}
          >
            <Tile image={image} glyph={Math.min(right - left, bottom - top) * 0.28} />
          </div>
        );
      })}
    </div>
  );
}

/* A photo, or Butter's grey well with a mountain and a sun while the slot is empty. */
function Tile({ image, glyph }: { image: MediaValue; glyph: number }) {
  if (image.src || image.mediaId) return <BlockImage value={image} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />;
  return (
    <div style={{ position: "absolute", inset: 0, background: THEME.well, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={glyph} height={glyph} viewBox="0 0 24 24">
        <circle cx="17" cy="7" r="2.2" fill={THEME.glyph} />
        <path d="M2 20 L9 10 L13.5 15.5 L16 12.5 L22 20 Z" fill={THEME.glyph} />
      </svg>
    </div>
  );
}
