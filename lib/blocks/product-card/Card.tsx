import type { CSSProperties, ReactNode } from "react";

import type { PropsOf } from "../inputs";
import { BlockImage } from "../media";
import type { RenderContext } from "../registry";

import type { inputs } from "./schema";

type Props = PropsOf<typeof inputs>;

/*
  Laid out on a 360-unit-wide card and scaled to the block's width: `u` is one
  unit. Wider scales everything; taller gives the photo the extra height, and
  the text block below it keeps its size.
*/
const DESIGN_WIDTH = 360;

const THEMES = {
  light: { card: "#ffffff", photo: "#f2efeb", ink: "#111111", meta: "#6f6f6f", hairline: "rgba(0,0,0,0.08)", starOff: "#dedede" },
  dark: { card: "#161616", photo: "#222222", ink: "#ffffff", meta: "#9c9c9c", hairline: "rgba(255,255,255,0.08)", starOff: "#3a3a3a" },
};

const STAR = "#f5b301";
const FONT = `"Inter", -apple-system, system-ui, sans-serif`;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number) => {
  const c = 1.7;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};
/* 0 → 1 across [from, to] of the block's progress. */
const phase = (p: number, from: number, to: number) => clamp01((p - from) / (to - from));

/* Black or white, whichever reads on `fill`. Accepts #rgb / #rrggbb; anything else gets white. */
function inkOn(fill: string) {
  const hex = fill.trim().replace(/^#/, "");
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex.slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(full)) return "#ffffff";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#111111" : "#ffffff";
}

/*
  Entrance windows, as fractions of the block's time so stretching it on the
  timeline slows the whole thing. Settled by 55%, then held.
*/
const T = {
  card: [0, 0.12],
  photo: [0.04, 0.32],
  name: [0.16, 0.3],
  rating: [0.22, 0.36],
  price: [0.28, 0.42],
  badge: [0.3, 0.44],
  cta: [0.38, 0.55],
} as const;

export function Card({ props, ctx }: { props: Props; ctx: RenderContext }) {
  const theme = THEMES[props.theme];
  const u = ctx.width / DESIGN_WIDTH;
  const p = ctx.progress;
  const f = (k: keyof typeof T) => phase(p, T[k][0], T[k][1]);

  const card = easeOut(f("card"));
  const photo = easeOut(f("photo"));
  const badge = f("badge");
  const ctaInk = inkOn(props.accent);

  return (
    <div
      className="size-full overflow-hidden"
      style={{
        display: "flex",
        flexDirection: "column",
        background: theme.card,
        borderRadius: 22 * u,
        boxShadow: `inset 0 0 0 ${Math.max(1, 0.75 * u)}px ${theme.hairline}`,
        fontFamily: FONT,
        WebkitFontSmoothing: "antialiased",
        opacity: card,
        transform: card >= 1 ? undefined : `translateY(${(1 - card) * 16 * u}px)`,
      }}
    >
      {/* The photo takes whatever height the text leaves. */}
      <div style={{ position: "relative", flex: 1, minHeight: 0, margin: 8 * u, marginBottom: 0, borderRadius: 16 * u, overflow: "hidden", background: theme.photo }}>
        <div style={{ position: "absolute", inset: 0, opacity: photo, transform: photo >= 1 ? undefined : `scale(${1.08 - 0.08 * photo})` }}>
          <BlockImage value={props.image} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
        </div>
        {props.badge && badge > 0 ? (
          <div
            style={{
              position: "absolute",
              top: 12 * u,
              left: 12 * u,
              padding: `${5 * u}px ${11 * u}px`,
              borderRadius: 999,
              background: props.accent,
              color: ctaInk,
              fontSize: 12.5 * u,
              fontWeight: 600,
              letterSpacing: 0.1 * u,
              whiteSpace: "nowrap",
              transform: badge >= 1 ? undefined : `scale(${Math.max(0, easeOutBack(badge))})`,
              transformOrigin: "0% 50%",
              opacity: clamp01(badge * 3),
            }}
          >
            {props.badge}
          </div>
        ) : null}
      </div>

      <div style={{ flexShrink: 0, padding: `${14 * u}px ${18 * u}px ${18 * u}px`, display: "flex", flexDirection: "column", gap: 8 * u }}>
        <Rise f={f("name")} u={u}>
          <div
            style={{
              color: theme.ink,
              fontSize: 18 * u,
              fontWeight: 600,
              lineHeight: 1.25,
              letterSpacing: -0.2 * u,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              overflowWrap: "anywhere",
            }}
          >
            {props.name || " "}
          </div>
        </Rise>
        {props.rating > 0 ? (
          <Rise f={f("rating")} u={u}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 * u }}>
              <Stars rating={props.rating} size={14 * u} off={theme.starOff} />
              <span style={{ color: theme.meta, fontSize: 13 * u, fontWeight: 500 }}>{props.rating.toFixed(1)}</span>
            </div>
          </Rise>
        ) : null}
        <Rise f={f("price")} u={u}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 * u, whiteSpace: "nowrap" }}>
            <span style={{ color: theme.ink, fontSize: 22 * u, fontWeight: 700, letterSpacing: -0.3 * u }}>{props.price}</span>
            {props.compareAtPrice ? <span style={{ color: theme.meta, fontSize: 15 * u, textDecoration: "line-through" }}>{props.compareAtPrice}</span> : null}
          </div>
        </Rise>
        {props.cta ? (
          <Rise f={f("cta")} u={u}>
            <div
              style={{
                marginTop: 4 * u,
                height: 44 * u,
                borderRadius: 12 * u,
                background: props.accent,
                color: ctaInk,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 15 * u,
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              {props.cta}
            </div>
          </Rise>
        ) : null}
      </div>
    </div>
  );
}

/* Fades up into place. Takes its space from the start, so nothing reflows as parts arrive. */
function Rise({ f, u, children }: { f: number; u: number; children: ReactNode }) {
  const e = easeOut(f);
  const style: CSSProperties = e >= 1 ? {} : { opacity: e, transform: `translateY(${(1 - e) * 10 * u}px)` };
  return <div style={style}>{children}</div>;
}

const STAR_PATH = "M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z";

/* Five stars, filled to `rating` in half steps: a grey row with a gold row clipped over it. */
function Stars({ rating, size, off }: { rating: number; size: number; off: string }) {
  const row = (fill: string) => (
    <div style={{ display: "flex", gap: size * 0.12 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" style={{ display: "block", flexShrink: 0 }}>
          <path d={STAR_PATH} fill={fill} />
        </svg>
      ))}
    </div>
  );
  /* Clip at the star edges so a half star is half of its own glyph, not half the gap after it. */
  const width = Math.floor(rating) * size * 1.12 + (rating % 1) * size;
  return (
    <div style={{ position: "relative" }}>
      {row(off)}
      <div style={{ position: "absolute", inset: 0, width, overflow: "hidden" }}>{row(STAR)}</div>
    </div>
  );
}
