import type { CSSProperties } from "react";

import type { PropsOf } from "../../inputs";
import type { RenderContext } from "../../registry";

import type { inputs } from "./schema";

type Props = PropsOf<typeof inputs>;

/*
  Sized from the box. `h` is the height the design is laid out against: the
  box's own, or less when the box is narrower than the landscape shape it was
  designed for, so nothing outgrows the width. The amount is the largest Anton
  that fits 84% of the width and 40% of `h`; the headline fits one line; the
  fine print wraps to at most two and shrinks rather than take a third.

  Widths are estimated from per-character advances rather than measured, which
  keeps `render` pure. Anton's were measured in Chrome from the stylesheet the
  app loads; Inter's are its widest capitals and letters. All are rounded up,
  so estimates err wide and nothing overflows.
*/
const ANTON = `"Anton", "Oswald", Impact, sans-serif`;
const INTER = `"Inter", -apple-system, system-ui, sans-serif`;

/* Anton 400, em. */
const ANTON_ADVANCE: Record<string, number> = {
  " ": 0.25, "!": 0.24, "#": 0.56, $: 0.48, "%": 1.07, "&": 0.54, "'": 0.23, "(": 0.31, ")": 0.31, "*": 0.47, "+": 0.37, ",": 0.25, "-": 0.33, ".": 0.24, "/": 0.42, ":": 0.26,
  "?": 0.51, "@": 0.88, "1": 0.35, I: 0.24, M: 0.76, W: 0.73, "€": 0.54, "£": 0.49, "¥": 0.48, "×": 0.36, "·": 0.25, "–": 0.33, "—": 0.58,
};
const ANTON_OTHER = 0.52;
/* Inter 800 capitals with tracking, and Inter 500 mixed case, em. */
const CAPS_ADVANCE: Record<string, number> = { " ": 0.28, ",": 0.36, ".": 0.36, "'": 0.36, "!": 0.4, I: 0.36, J: 0.62, M: 0.96, W: 1.08, "%": 1.04 };
const CAPS_OTHER = 0.8;
const CAPS_TRACKING = 0.14;
const TEXT_AVERAGE = 0.6;

const antonEm = (s: string) => [...s.toUpperCase()].reduce((w, c) => w + (ANTON_ADVANCE[c] ?? ANTON_OTHER), 0);
const capsEm = (s: string) => [...s.toUpperCase()].reduce((w, c) => w + (CAPS_ADVANCE[c] ?? CAPS_OTHER) + CAPS_TRACKING, 0);

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);
const phase = (p: number, from: number, to: number) => clamp01((p - from) / (to - from));

/* Entrance windows as fractions of the block's time: settled by 45%, then held. */
const T = { panel: [0, 0.12], amount: [0.06, 0.28], headline: [0.18, 0.32], fineprint: [0.28, 0.44] } as const;

export function Promo({ props, ctx }: { props: Props; ctx: RenderContext }) {
  const W = ctx.width;
  const h = Math.min(ctx.height, W * 0.6);
  const headline = props.headline.trim();
  const amount = props.amount.trim();
  const fineprint = props.fineprint.trim();

  const amountSize = Math.max(1, Math.min(h * 0.4, (W * 0.84) / Math.max(1, antonEm(amount))));
  const headlineSize = Math.max(1, Math.min(h * 0.075, (W * 0.84) / Math.max(1, capsEm(headline))));
  /* Two lines of fine print at most: shrink when the estimate needs a third. */
  const fineLimit = h * 0.065;
  const fineSize = Math.max(1, Math.min(fineLimit, (W * 0.8 * 2) / Math.max(1, fineprint.length * TEXT_AVERAGE * 1.15)));

  const p = ctx.progress;
  const panel = easeOut(phase(p, T.panel[0], T.panel[1]));
  const pop = phase(p, T.amount[0], T.amount[1]);
  const amountScale = pop >= 1 ? 1 : 0.4 + 0.6 * easeOutBack(pop);
  const rise = (k: "headline" | "fineprint", size: number): CSSProperties => {
    const e = easeOut(phase(p, T[k][0], T[k][1]));
    return e >= 1 ? {} : { opacity: e, transform: `translateY(${(1 - e) * size * 0.6}px)` };
  };

  return (
    <div
      className="size-full overflow-hidden"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: h * 0.035,
        padding: `${h * 0.08}px ${W * 0.06}px`,
        boxSizing: "border-box",
        background: props.fill,
        borderRadius: Math.min(W, ctx.height) * 0.06,
        color: props.textColor,
        textAlign: "center",
        WebkitFontSmoothing: "antialiased",
        opacity: panel,
        transform: panel >= 1 ? undefined : `scale(${0.94 + 0.06 * panel})`,
      }}
    >
      {headline ? (
        <div style={{ fontFamily: INTER, fontWeight: 800, fontSize: headlineSize, lineHeight: 1.1, letterSpacing: `${CAPS_TRACKING}em`, textTransform: "uppercase", whiteSpace: "nowrap", ...rise("headline", headlineSize) }}>
          {headline}
        </div>
      ) : null}
      {amount ? (
        <div
          style={{
            fontFamily: ANTON,
            fontWeight: 400,
            fontSize: amountSize,
            lineHeight: 1.08,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            opacity: clamp01(pop * 3),
            transform: amountScale === 1 ? undefined : `scale(${amountScale})`,
          }}
        >
          {amount}
        </div>
      ) : null}
      {fineprint ? (
        <div
          style={{
            maxWidth: W * 0.8,
            fontFamily: INTER,
            fontWeight: 500,
            fontSize: fineSize,
            lineHeight: 1.3,
            overflowWrap: "anywhere",
            opacity: 0.92,
            ...rise("fineprint", fineSize),
          }}
        >
          {fineprint}
        </div>
      ) : null}
    </div>
  );
}
