import { useId } from "react";

import type { PropsOf } from "../inputs";
import type { RenderContext } from "../registry";

import type { inputs } from "./schema";

type Props = PropsOf<typeof inputs>;

/*
  Each shape is a path in unit coordinates, laid across the box inset by the
  head size, so heads never clip. Wider makes the line longer, taller makes
  its curves deeper; the stroke weight is artboard px and stays put either
  way. Direction is the block's rotation.

  Every shape is a chain of cubic segments so both end tangents are known
  without measuring the DOM: that is what points the heads.
*/
type Pt = [number, number];
type Shape = { start: Pt; segments: [Pt, Pt, Pt][] };

const SHAPES: Record<Props["style"], Shape> = {
  straight: { start: [0, 0.5], segments: [[[1 / 3, 0.5], [2 / 3, 0.5], [1, 0.5]]] },
  /* A lopsided arc: rises fast, lands to the right. */
  curved: { start: [0, 0.85], segments: [[[0.25, 0.05], [0.72, 0.02], [1, 0.55]]] },
  /* Runs right, throws a loop, carries on. */
  scribble: {
    start: [0, 0.72],
    segments: [
      [[0.22, 0.74], [0.5, 0.8], [0.58, 0.5]],
      [[0.64, 0.24], [0.5, 0.08], [0.42, 0.26]],
      [[0.34, 0.44], [0.5, 0.64], [0.7, 0.6]],
      [[0.82, 0.58], [0.92, 0.5], [1, 0.36]],
    ],
  },
  /* A marker swoosh: across, round the end, and a shorter pass back underneath. */
  underline: {
    start: [0, 0.4],
    segments: [
      [[0.3, 0.3], [0.75, 0.28], [0.95, 0.36]],
      [[1.02, 0.39], [1, 0.5], [0.85, 0.52]],
      [[0.6, 0.55], [0.35, 0.6], [0.12, 0.72]],
    ],
  },
};

/* The draw's share of the block; the rest holds the finished line. */
const DRAW = 0.6;
/* The end head lands across this window of progress, as the stroke arrives. */
const LAND: [number, number] = [0.52, 0.64];

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t: number) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);

const DASH: Record<Props["stroke"], (w: number) => string | undefined> = {
  solid: () => undefined,
  dashed: (w) => `${w * 2} ${w * 2.4}`,
  /* A zero-length dash with a round cap is a dot. */
  dotted: (w) => `0 ${w * 2}`,
};

export function Stroke({ props, ctx }: { props: Props; ctx: RenderContext }) {
  const mask = `line-${useId().replace(/[^\w-]/g, "")}`;
  const { width: W, height: H } = ctx;
  const w = props.weight;
  const headLen = Math.max(16, w * 4);
  const dotR = Math.max(6, w * 1.5);
  const inset = props.head === "none" ? w : Math.max(headLen, dotR) + w;
  const px = Math.min(inset, W / 4);
  const py = Math.min(inset, H / 4);
  const at = ([u, v]: Pt): Pt => [px + u * (W - 2 * px), py + v * (H - 2 * py)];

  const shape = SHAPES[props.style];
  const start = at(shape.start);
  const segs = shape.segments.map((s) => s.map(at) as [Pt, Pt, Pt]);
  const d = `M${start.join(" ")}` + segs.map(([a, b, c]) => `C${a.join(" ")} ${b.join(" ")} ${c.join(" ")}`).join("");

  const last = segs[segs.length - 1]!;
  const end = last[2];
  const endDir = direction(last[1], end, last[0]);
  const startDir = direction(segs[0]![0], start, segs[0]![1]);

  const p = ctx.progress;
  const drawn = easeInOut(clamp01(p / DRAW));
  const landed = clamp01((p - LAND[0]) / (LAND[1] - LAND[0]));
  const startHead = clamp01(drawn / 0.08);

  const paint = { stroke: props.color, strokeWidth: w, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" } as const;
  const head = (at: Pt, dir: Pt, t: number) => {
    if (props.head === "none" || t <= 0) return null;
    const scale = t >= 1 ? undefined : `translate(${at[0]} ${at[1]}) scale(${Math.max(0, easeOutBack(t))}) translate(${-at[0]} ${-at[1]})`;
    if (props.head === "dot") return <circle cx={at[0]} cy={at[1]} r={dotR} fill={props.color} transform={scale} />;
    const wing = (sign: number): Pt => {
      const a = sign * (Math.PI / 6);
      const [x, y] = [-dir[0], -dir[1]];
      return [at[0] + headLen * (x * Math.cos(a) - y * Math.sin(a)), at[1] + headLen * (x * Math.sin(a) + y * Math.cos(a))];
    };
    return <path d={`M${wing(1).join(" ")}L${at.join(" ")}L${wing(-1).join(" ")}`} {...paint} transform={scale} />;
  };

  return (
    <div className="size-full overflow-hidden">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
        {drawn > 0 && drawn < 1 ? (
          /* Revealing through a mask keeps a dash pattern still while the line draws. */
          <mask id={mask} maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
            <path d={d} stroke="#fff" strokeWidth={w + 2} strokeLinecap="round" fill="none" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - drawn} />
          </mask>
        ) : null}
        {drawn > 0 ? <path d={d} {...paint} strokeDasharray={DASH[props.stroke](w)} mask={drawn < 1 ? `url(#${mask})` : undefined} /> : null}
        {props.bothEnds ? head(start, startDir, startHead) : null}
        {head(end, endDir, landed)}
      </svg>
    </div>
  );
}

/* Unit vector from `from` to `to`, falling back to `alt` → `to` when the control point sits on the end. */
function direction(from: Pt, to: Pt, alt: Pt): Pt {
  let [x, y] = [to[0] - from[0], to[1] - from[1]];
  if (Math.hypot(x, y) < 1e-6) [x, y] = [to[0] - alt[0], to[1] - alt[1]];
  const len = Math.hypot(x, y) || 1;
  return [x / len, y / len];
}
