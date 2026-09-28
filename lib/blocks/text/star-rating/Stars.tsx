import type { PropsOf } from "../../inputs";
import type { RenderContext } from "../../registry";

import type { inputs } from "./schema";

type Props = PropsOf<typeof inputs>;

/*
  Fitted to the box: the row of stars takes up to 92% of the width and, with a
  caption, half the height (80% without); the caption is one line in caps, as
  large as fits under it. Resizing the block resizes the rating.

  The caption's width is estimated from per-character advances rather than
  measured, which keeps `render` pure. The estimates are Inter 800 capitals
  rounded up, so the caption never overflows.
*/
const FONT = `"Inter", -apple-system, system-ui, sans-serif`;
const TRACKING = 0.06;
const ADVANCE: Record<string, number> = { " ": 0.28, ",": 0.36, ".": 0.36, "'": 0.36, "!": 0.4, I: 0.36, J: 0.62, M: 0.96, W: 1.08, "%": 1.04, "★": 0.8 };
const DIGIT = 0.7;
const OTHER = 0.8;
const widthEm = (s: string) => [...s.toUpperCase()].reduce((w, c) => w + (/\d/.test(c) ? DIGIT : (ADVANCE[c] ?? OTHER)) + TRACKING, 0);

const GAP = 0.14;
const ROW = 5 + 4 * GAP;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const phase = (p: number, from: number, to: number) => clamp01((p - from) / (to - from));

/* Entrance windows as fractions of the block's time: settled by 60%, then held. */
const T = { stars: [0, 0.1], fill: [0.08, 0.55], caption: [0.4, 0.6] } as const;

const STAR_PATH = "M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z";

export function Stars({ props, ctx }: { props: Props; ctx: RenderContext }) {
  const caption = props.count.trim();
  const star = Math.max(1, Math.min((ctx.width * 0.92) / ROW, ctx.height * (caption ? 0.5 : 0.8)));
  const fontSize = caption ? Math.max(1, Math.min(star * 0.4, (ctx.width * 0.94) / Math.max(1, widthEm(caption)))) : 0;

  const p = ctx.progress;
  const shown = easeOut(phase(p, T.stars[0], T.stars[1]));
  const fill = props.rating * easeInOut(phase(p, T.fill[0], T.fill[1]));
  const cap = easeOut(phase(p, T.caption[0], T.caption[1]));

  const gap = star * GAP;
  const whole = Math.floor(fill);
  const clip = whole * (star + gap) + (fill - whole) * star;
  const row = (color: string, opacity = 1) => (
    <div style={{ display: "flex", gap, opacity }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width={star} height={star} viewBox="0 0 24 24" style={{ display: "block", flexShrink: 0 }}>
          <path d={STAR_PATH} fill={color} />
        </svg>
      ))}
    </div>
  );

  return (
    <div className="size-full overflow-hidden" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: star * 0.22 }}>
      <div style={{ position: "relative", flexShrink: 0, opacity: shown, transform: shown >= 1 ? undefined : `scale(${0.9 + 0.1 * shown})` }}>
        {row(props.textColor, 0.22)}
        <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: clip, overflow: "hidden" }}>{row(props.color)}</div>
      </div>
      {caption ? (
        <div
          style={{
            flexShrink: 0,
            color: props.textColor,
            fontFamily: FONT,
            fontWeight: 800,
            fontSize,
            lineHeight: 1.15,
            letterSpacing: `${TRACKING}em`,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            WebkitFontSmoothing: "antialiased",
            opacity: cap,
            transform: cap >= 1 ? undefined : `translateY(${(1 - cap) * fontSize * 0.4}px)`,
          }}
        >
          {caption}
        </div>
      ) : null}
    </div>
  );
}
