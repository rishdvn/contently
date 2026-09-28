import type { PropsOf } from "../../inputs";
import type { RenderContext } from "../../registry";
import { fitText, FONT, measure } from "../measure";

import type { inputs } from "./schema";

type Props = PropsOf<typeof inputs>;
type Shape = Props["shape"];

/*
  The shape is drawn in the box's own pixels (no stretched viewBox, so the
  outline keeps one width), as large as fits once tilted: a w × h shape turned
  by θ needs w·cos θ + h·sin θ across, plus room for the shadow. The text is
  fitted to the shape's inner area with the shared estimate (`measure.ts`),
  capped just under the size at which the longest word fills a line, so no
  word is split, and drawn line by line as it was wrapped.
*/
const WEIGHT = 800;
const LINE = 1.05;

/* The share of the shape's width and height the text may use. */
const INNER: Record<Shape, [number, number]> = { starburst: [0.62, 0.5], circle: [0.7, 0.56], blob: [0.68, 0.54], ribbon: [0.72, 0.62] };

const TAU = Math.PI * 2;
const f1 = (n: number) => n.toFixed(1);

/* Points round an ellipse, radius scaled by `r(θ)`. */
function around(w: number, h: number, n: number, r: (a: number, i: number) => number) {
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU - Math.PI / 2;
    const k = r(a, i);
    pts.push(`${f1(w / 2 + (Math.cos(a) * w * k) / 2)},${f1(h / 2 + (Math.sin(a) * h * k) / 2)}`);
  }
  return `M${pts.join("L")}Z`;
}

function path(shape: Shape, w: number, h: number): string {
  switch (shape) {
    /* Butter's Star: 22 arms, arm length 14%. */
    case "starburst":
      return around(w, h, 44, (_, i) => (i % 2 ? 0.86 : 1));
    case "circle":
      return `M0,${f1(h / 2)}A${f1(w / 2)},${f1(h / 2)} 0 1 1 ${f1(w)},${f1(h / 2)}A${f1(w / 2)},${f1(h / 2)} 0 1 1 0,${f1(h / 2)}Z`;
    /* Ten soft bumps: a scallop. */
    case "blob":
      return around(w, h, 240, (a) => 0.9 + 0.1 * Math.abs(Math.cos(a * 5)));
    /* A band with notched ends, a third of the height tall. */
    case "ribbon": {
      const top = h * 0.3;
      const bottom = h * 0.7;
      const notch = w * 0.07;
      return `M0,${f1(top)}L${f1(w)},${f1(top)}L${f1(w - notch)},${f1(h / 2)}L${f1(w)},${f1(bottom)}L0,${f1(bottom)}L${f1(notch)},${f1(h / 2)}Z`;
    }
  }
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeOutBack = (t: number) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);
const phase = (p: number, from: number, to: number) => clamp01((p - from) / (to - from));

/* Pop over the first 22% of the block, wobble settled by 40%. */
const POP = [0, 0.22] as const;
const WOBBLE = [0, 0.4] as const;

export function Sticker({ props, ctx }: { props: Props; ctx: RenderContext }) {
  const m = Math.min(ctx.width, ctx.height);
  const shadow = props.outline ? m * 0.035 : 0;
  const stroke = props.outline ? Math.max(1, m * 0.018) : 0;
  const theta = (Math.abs(props.tilt) * Math.PI) / 180;
  const [c, s] = [Math.cos(theta), Math.sin(theta)];
  /* The largest shape of the box's proportions that fits once tilted, leaving room for the shadow and outline. */
  const W0 = ctx.width - shadow - stroke;
  const H0 = ctx.height - shadow - stroke;
  const k = Math.max(0.05, Math.min(W0 / (W0 * c + H0 * s), H0 / (W0 * s + H0 * c)));
  const w = W0 * k;
  const h = H0 * k;

  const text = props.text.trim().toUpperCase();
  const [iw, ih] = INNER[props.shape];
  const box = { width: w * iw, height: h * ih * (props.shape === "ribbon" ? 0.4 / 0.62 : 1) };
  const longest = Math.max(1, ...text.split(/\s+/).map((word) => measure(word, { weight: WEIGHT })));
  const fitted = text ? fitText(text, box, { weight: WEIGHT, lineHeight: LINE, maxSize: Math.min(box.height * 0.6, (box.width / longest) * 0.999) }) : null;

  const p = ctx.progress;
  const pop = phase(p, POP[0], POP[1]);
  const scale = pop >= 1 ? 1 : Math.max(0, easeOutBack(pop));
  const t = phase(p, WOBBLE[0], WOBBLE[1]);
  const angle = props.tilt + (t >= 1 ? 0 : 16 * Math.pow(1 - t, 2) * Math.sin(t * Math.PI * 3.5));
  const d = path(props.shape, w, h);

  return (
    <div className="size-full overflow-hidden" style={{ position: "relative" }}>
      <div
        style={{
          position: "absolute",
          left: (ctx.width - w - shadow) / 2,
          top: (ctx.height - h - shadow) / 2,
          width: w,
          height: h,
          opacity: clamp01(pop * 4),
          transform: `rotate(${angle}deg)${scale === 1 ? "" : ` scale(${scale})`}`,
        }}
      >
        <svg width={w + shadow + stroke} height={h + shadow + stroke} style={{ position: "absolute", left: -stroke / 2, top: -stroke / 2, overflow: "visible" }}>
          <g transform={`translate(${stroke / 2},${stroke / 2})`}>
            {shadow ? <path d={d} transform={`translate(${shadow},${shadow})`} fill={props.textColor} stroke={props.textColor} strokeWidth={stroke} strokeLinejoin="round" /> : null}
            <path d={d} fill={props.fill} stroke={stroke ? props.textColor : "none"} strokeWidth={stroke} strokeLinejoin="round" />
          </g>
        </svg>
        {fitted ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              color: props.textColor,
              fontFamily: FONT,
              fontWeight: WEIGHT,
              fontSize: fitted.fontSize,
              lineHeight: LINE,
              whiteSpace: "pre",
              WebkitFontSmoothing: "antialiased",
            }}
          >
            {fitted.lines.join("\n")}
          </div>
        ) : null}
      </div>
    </div>
  );
}
