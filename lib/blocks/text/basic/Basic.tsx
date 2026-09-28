import type { PropsOf } from "../../inputs";
import type { RenderContext } from "../../registry";
import { fitText, FONT, type Weight } from "../measure";

import type { inputs } from "./schema";

type Props = PropsOf<typeof inputs>;

/*
  Wider or taller, the copy is refitted: it wraps to the box's width and the
  type is the largest at which every line fits its height, up to the style's
  own ceiling (a share of the width, so a heading never outgrows a heading).
  The lines are drawn exactly as `fitText` broke them, and centred vertically.
*/
const STYLES: Record<Props["preset"], { weight: Weight; letterSpacing: number; lineHeight: number; maxShare: number }> = {
  heading: { weight: 800, letterSpacing: -0.025, lineHeight: 1.08, maxShare: 0.13 },
  subheading: { weight: 600, letterSpacing: -0.01, lineHeight: 1.2, maxShare: 0.075 },
  body: { weight: 400, letterSpacing: 0, lineHeight: 1.4, maxShare: 0.05 },
};

/* Each line's entrance, as a share of the block's time; lines follow each other, all settled by 30%. */
const ENTER = 0.16;
const SETTLED = 0.3;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export function Basic({ props, ctx }: { props: Props; ctx: RenderContext }) {
  const style = STYLES[props.preset];
  const { fontSize, lines } = fitText(props.text, ctx, { ...style, maxSize: Math.max(1, ctx.width * style.maxShare) });
  const stagger = lines.length > 1 ? Math.min(0.05, (SETTLED - ENTER) / (lines.length - 1)) : 0;

  return (
    <div
      className="size-full overflow-hidden"
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: { left: "flex-start", center: "center", right: "flex-end" }[props.align],
        color: props.color,
        fontFamily: FONT,
        fontWeight: style.weight,
        fontSize,
        lineHeight: style.lineHeight,
        letterSpacing: `${style.letterSpacing}em`,
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {lines.map((line, i) => {
        const t = props.entrance === "none" ? 1 : easeOut(clamp01((ctx.progress - i * stagger) / ENTER));
        return (
          <div
            key={i}
            style={{
              whiteSpace: "pre",
              minHeight: `${style.lineHeight}em`,
              opacity: t,
              transform: props.entrance === "rise" && t < 1 ? `translateY(${(1 - t) * 0.4}em)` : undefined,
            }}
          >
            {line}
          </div>
        );
      })}
    </div>
  );
}
