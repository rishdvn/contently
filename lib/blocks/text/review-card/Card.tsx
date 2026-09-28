import type { CSSProperties, ReactNode } from "react";

import type { PropsOf } from "../../inputs";
import { BlockImage } from "../../media";
import type { RenderContext } from "../../registry";

import type { inputs } from "./schema";

type Props = PropsOf<typeof inputs>;

/*
  Laid out on a 360-unit square and scaled by the box's shorter side, so the
  whole card always fits: `u` is one unit. A wider or taller box gives the card
  more room and the content stays centred in it; the quote wraps to the card's
  width.

  The quote's type steps down as it gets longer, so the longest quote the
  schema allows still fits the square with room to spare.
*/
const DESIGN = 360;

const THEMES = {
  light: { card: "#ffffff", ink: "#111111", meta: "#6f6f6f", hairline: "rgba(0,0,0,0.08)", starOff: "#e2e2e2", avatar: "#efebe6" },
  dark: { card: "#161616", ink: "#ffffff", meta: "#9c9c9c", hairline: "rgba(255,255,255,0.08)", starOff: "#3a3a3a", avatar: "#2a2a2a" },
};

const STAR = "#f5b301";
const FONT = `"Inter", -apple-system, system-ui, sans-serif`;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/* 0 → 1 across [from, to] of the block's progress. */
const phase = (p: number, from: number, to: number) => clamp01((p - from) / (to - from));

/*
  Entrance windows, as fractions of the block's time so stretching it on the
  timeline slows the whole thing. Settled by 42%, then held.
*/
const T = {
  card: [0, 0.12],
  quote: [0.08, 0.22],
  author: [0.16, 0.3],
  stars: [0.14, 0.42],
} as const;

/* Quote size in units by length: at 200 characters, eight lines of 17.5 still fit. */
const quoteSize = (length: number) => (length <= 70 ? 26 : length <= 130 ? 21 : 17.5);

export function Card({ props, ctx }: { props: Props; ctx: RenderContext }) {
  const theme = THEMES[props.theme];
  const u = Math.min(ctx.width, ctx.height) / DESIGN;
  const p = ctx.progress;
  const f = (k: keyof typeof T) => phase(p, T[k][0], T[k][1]);

  const card = easeOut(f("card"));
  const fill = easeInOut(f("stars"));
  const initial = [...props.author.trim()][0]?.toUpperCase() ?? "";

  return (
    <div
      className="size-full overflow-hidden"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18 * u,
        padding: 28 * u,
        boxSizing: "border-box",
        background: theme.card,
        borderRadius: 24 * u,
        boxShadow: `inset 0 0 0 ${Math.max(1, 0.75 * u)}px ${theme.hairline}`,
        fontFamily: FONT,
        textAlign: "center",
        WebkitFontSmoothing: "antialiased",
        opacity: card,
        transform: card >= 1 ? undefined : `translateY(${(1 - card) * 16 * u}px) scale(${0.97 + 0.03 * card})`,
      }}
    >
      {props.rating > 0 ? <Stars rating={props.rating * fill} size={22 * u} off={theme.starOff} /> : null}

      <Rise f={f("quote")} u={u}>
        <div
          style={{
            color: theme.ink,
            fontSize: quoteSize(props.quote.length) * u,
            fontWeight: 500,
            lineHeight: 1.4,
            letterSpacing: -0.15 * u,
            whiteSpace: "pre-line",
            overflowWrap: "anywhere",
          }}
        >
          {props.quote}
        </div>
      </Rise>

      {props.author || props.avatar.src || props.avatar.mediaId ? (
        <Rise f={f("author")} u={u}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 * u, minWidth: 0 }}>
            <div
              style={{
                position: "relative",
                flexShrink: 0,
                width: 36 * u,
                height: 36 * u,
                borderRadius: 999,
                overflow: "hidden",
                background: theme.avatar,
                color: theme.meta,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16 * u,
                fontWeight: 600,
              }}
            >
              {initial}
              <BlockImage value={props.avatar} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
            </div>
            {props.author ? (
              <span style={{ color: theme.ink, fontSize: 15 * u, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{props.author}</span>
            ) : null}
          </div>
        </Rise>
      ) : null}
    </div>
  );
}

/* Fades up into place. Takes its space from the start, so nothing reflows as parts arrive. */
function Rise({ f, u, children }: { f: number; u: number; children: ReactNode }) {
  const e = easeOut(f);
  const style: CSSProperties = { maxWidth: "100%", ...(e >= 1 ? {} : { opacity: e, transform: `translateY(${(1 - e) * 10 * u}px)` }) };
  return <div style={style}>{children}</div>;
}

const STAR_PATH = "M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z";

/*
  Five stars, filled to `rating` (any fraction, so the fill can sweep): a grey
  row with a gold row clipped over it. The clip is measured to the star edges,
  so half a star is half of its own glyph, not half of the gap after it.
*/
function Stars({ rating, size, off }: { rating: number; size: number; off: string }) {
  const gap = size * 0.14;
  const row = (fill: string) => (
    <div style={{ display: "flex", gap }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" style={{ display: "block", flexShrink: 0 }}>
          <path d={STAR_PATH} fill={fill} />
        </svg>
      ))}
    </div>
  );
  const whole = Math.floor(rating);
  const width = whole * (size + gap) + (rating - whole) * size;
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      {row(off)}
      <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width, overflow: "hidden" }}>{row(STAR)}</div>
    </div>
  );
}
