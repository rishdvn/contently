import type { PropsOf } from "../../inputs";
import type { RenderContext } from "../../registry";

import type { inputs } from "./schema";

type Props = PropsOf<typeof inputs>;

/*
  Set in a heavy face with tabular figures, so digits don't shift sideways as
  they change, and fitted to the box: the type is the largest size at which the
  widest value the count passes through fits the width and 80% of the height.
  Resizing the block resizes the number.

  Widths are estimated from per-character advances rather than measured, which
  keeps `render` pure; the estimates err wide, so the number never overflows.
*/
const FONT = `"Inter", -apple-system, system-ui, sans-serif`;
/* Advance widths in em for Inter at weight 800, rounded up. */
const ADVANCE: Record<string, number> = { ",": 0.3, ".": 0.3, " ": 0.28, "%": 0.9, "+": 0.66, "-": 0.5, $: 0.66, "€": 0.7, "£": 0.66, "×": 0.62 };
const DIGIT = 0.68;
const OTHER = 0.72;

/* The count's share of the block; the rest is a hold on the final value. */
const COUNT = 0.8;
/* Seconds to fade in, so the number doesn't pop on at its in point. */
const FADE_IN = 0.2;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

function format(n: number, props: Props) {
  const body = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: props.decimals,
    maximumFractionDigits: props.decimals,
    useGrouping: props.separator,
  }).format(n);
  return `${props.prefix}${body}${props.suffix}`;
}

const widthEm = (s: string) => [...s].reduce((w, c) => w + (/\d/.test(c) ? DIGIT : (ADVANCE[c] ?? OTHER)), 0);

export function Counter({ props, ctx }: { props: Props; ctx: RenderContext }) {
  const decimals = Math.round(props.decimals);
  const k = Math.pow(10, decimals);
  const t = easeOut(clamp01(ctx.progress / COUNT));
  const value = Math.round((props.from + (props.to - props.from) * t) * k) / k;
  const text = format(value, { ...props, decimals });

  const widest = Math.max(widthEm(format(props.from, { ...props, decimals })), widthEm(format(props.to, { ...props, decimals })), 1);
  const fontSize = Math.max(1, Math.min((ctx.height * 0.8) / 1.0, (ctx.width * 0.96) / widest));

  return (
    <div
      className="size-full"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: props.color,
        fontFamily: FONT,
        fontWeight: 800,
        fontSize,
        lineHeight: 1,
        letterSpacing: "-0.02em",
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
        WebkitFontSmoothing: "antialiased",
        opacity: ctx.mode === "video" ? Math.min(1, ctx.time / FADE_IN) : 1,
      }}
    >
      {text}
    </div>
  );
}
