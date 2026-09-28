import type { PropsOf } from "../../inputs";
import type { RenderContext } from "../../registry";
import { FONT, measure } from "../measure";

import type { inputs } from "./schema";

type Props = PropsOf<typeof inputs>;

/*
  The shape is designed in ems of its label and scaled to the largest size the
  box holds, centred in it, with room for the pop's overshoot. A tag adds a
  pointed end on the left, with a punched hole, ahead of the label.
*/
const WEIGHT = 700;
const HEIGHT = 2.1;
const PAD_X = { pill: 0.95, rounded: 0.8, tag: 0.8 };
/* The tag's pointed end, as a share of its height. */
const POINT = 0.5;
const FIT = 0.84;

/* Pops in, overshooting, over the first 20%; then holds. */
const POP = 0.2;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeOutBack = (t: number) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);

/* A luggage tag w × h px: pointed left end, rounded right corners, a hole near the point. */
function tagPath(w: number, h: number) {
  const p = h * POINT;
  const r = h * 0.2;
  const hole = h * 0.1;
  const hx = p * 0.78;
  return [
    `M 0 ${h / 2} L ${p} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${p} Z`,
    `M ${hx - hole} ${h / 2} a ${hole} ${hole} 0 1 0 ${2 * hole} 0 a ${hole} ${hole} 0 1 0 ${-2 * hole} 0 Z`,
  ].join(" ");
}

export function Callout({ props, ctx }: { props: Props; ctx: RenderContext }) {
  const point = props.shape === "tag" ? HEIGHT * POINT : 0;
  const widthEm = point + 2 * PAD_X[props.shape] + measure(props.text, { weight: WEIGHT });
  const fontSize = Math.max(1, Math.min((ctx.height * FIT) / HEIGHT, (ctx.width * FIT) / widthEm));
  const w = widthEm * fontSize;
  const h = HEIGHT * fontSize;

  const t = clamp01(ctx.progress / POP);
  const scale = t < 1 ? Math.max(0, easeOutBack(t)) : 1;

  return (
    <div className="size-full overflow-hidden" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          position: "relative",
          flexShrink: 0,
          width: w,
          height: h,
          opacity: clamp01(t * 4),
          transform: scale < 1 || t < 1 ? `scale(${scale})` : undefined,
        }}
      >
        {props.shape === "tag" ? (
          <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", inset: 0 }}>
            <path d={tagPath(w, h)} fill={props.fill} fillRule="evenodd" />
          </svg>
        ) : (
          <div style={{ position: "absolute", inset: 0, background: props.fill, borderRadius: props.shape === "pill" ? 999 : 0.38 * fontSize }} />
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            paddingLeft: (point + PAD_X[props.shape]) * fontSize,
            display: "flex",
            alignItems: "center",
            color: props.textColor,
            fontFamily: FONT,
            fontWeight: WEIGHT,
            fontSize,
            lineHeight: 1,
            /* Set, not inherited: the studio's UI tracking would widen the label past its shape. */
            letterSpacing: 0,
            whiteSpace: "pre",
            WebkitFontSmoothing: "antialiased",
          }}
        >
          {props.text}
        </div>
      </div>
    </div>
  );
}
