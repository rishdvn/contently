import type { ReactNode } from "react";

import type { PropsOf } from "../inputs";
import type { RenderContext } from "../registry";

import type { inputs } from "./schema";

type Props = PropsOf<typeof inputs>;

/*
  Laid out on a 600-unit-wide stage and scaled to the block's width: `u` is
  one unit. Wider scales everything. The search card sits at the top of the
  box and grows downward as suggestions arrive; five of them, and the pointer
  beneath, fit the 16:9 box the block is added at. A taller box leaves room
  below.
*/
const STAGE = 600;
const INSET = 16;
const BAR = 60;
const ROW = 46;
const PAD = 6;

const THEMES = {
  light: { card: "#ffffff", ink: "#1f1f1f", meta: "#70757a", icon: "#9aa0a6", hairline: "#e8eaed", caret: "#1a73e8", shadow: "rgba(32,33,36,0.18)" },
  dark: { card: "#202124", ink: "#e8eaed", meta: "#9aa0a6", icon: "#9aa0a6", hairline: "#3c4043", caret: "#8ab4f8", shadow: "rgba(0,0,0,0.5)" },
};

const FONT = `"Inter", -apple-system, system-ui, sans-serif`;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const phase = (p: number, from: number, to: number) => clamp01((p - from) / (to - from));

/* Black or white, whichever reads on `fill`. Accepts #rgb / #rrggbb; anything else keeps `fallback`. */
function inkOn(fill: string, fallback: string) {
  const hex = fill.trim().replace(/^#/, "");
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex.slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(full)) return fallback;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#1f1f1f" : "#ffffff";
}

/*
  The script, as fractions of the block's time so stretching it slows the
  whole thing. With no row to pick, the suggestions finish the animation and
  it holds from there.
*/
const S = {
  enter: [0, 0.08],
  type: [0.1, 0.4],
  drop: [0.43, 0.62],
  glide: [0.63, 0.76],
  press: [0.76, 0.8],
} as const;

export function Search({ props, ctx }: { props: Props; ctx: RenderContext }) {
  const theme = THEMES[props.theme];
  const u = ctx.width / STAGE;
  const p = ctx.progress;
  const { suggestions } = props;
  const pick = Math.min(Math.round(props.highlight), suggestions.length);

  const enter = easeOut(phase(p, ...S.enter));
  const typed = props.query.slice(0, Math.round(props.query.length * phase(p, ...S.type)));
  const typing = p > S.type[0] && p < S.type[1];
  /* A text caret blinks while idle and holds steady while typing. There is no caret in a still. */
  const caret = ctx.mode === "video" && p < S.glide[0] && (typing || Math.floor(ctx.time * 2) % 2 === 0);
  const slot = (S.drop[1] - S.drop[0]) / Math.max(1, suggestions.length);
  const rows = suggestions.map((_, i) => easeOut(phase(p, S.drop[0] + i * slot, S.drop[0] + (i + 1) * slot)));
  const hover = pick > 0 ? phase(p, S.press[0], S.press[0] + 0.02) : 0;

  const cardH = BAR + (rows.some((r) => r > 0) ? PAD * 2 : 0) + rows.reduce((a, r) => a + r * ROW, 0);

  return (
    <div className="size-full" style={{ position: "relative", fontFamily: FONT, WebkitFontSmoothing: "antialiased", pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: INSET * u,
          right: INSET * u,
          top: INSET * u,
          height: cardH * u,
          borderRadius: (BAR / 2) * u,
          background: theme.card,
          boxShadow: `0 ${4 * u}px ${14 * u}px ${theme.shadow}, 0 0 0 ${Math.max(1, 0.75 * u)}px ${theme.hairline}`,
          overflow: "hidden",
          opacity: enter,
          transform: enter >= 1 ? undefined : `translateY(${(1 - enter) * 12 * u}px) scale(${0.97 + 0.03 * enter})`,
        }}
      >
        <div style={{ height: BAR * u, display: "flex", alignItems: "center", gap: 14 * u, padding: `0 ${24 * u}px` }}>
          <Magnifier size={22 * u} color={theme.icon} />
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", fontSize: 21 * u, lineHeight: 1.5, whiteSpace: "pre", overflow: "hidden" }}>
            {typed ? <span style={{ color: theme.ink }}>{typed}</span> : !caret ? <span style={{ color: theme.meta }}>{props.placeholder}</span> : null}
            <span style={{ width: 2 * u, height: 26 * u, marginLeft: 1 * u, background: theme.caret, opacity: caret ? 1 : 0, flexShrink: 0 }} />
            {!typed && caret ? <span style={{ color: theme.meta }}>{props.placeholder}</span> : null}
          </div>
        </div>
        {rows.some((r) => r > 0) ? <div style={{ height: Math.max(1, 0.75 * u), margin: `0 ${24 * u}px`, background: theme.hairline }} /> : null}
        <div style={{ paddingTop: PAD * u }}>
          {suggestions.map((text, i) => {
            const f = rows[i];
            if (f <= 0) return null;
            const lit = i + 1 === pick ? hover : 0;
            return (
              <div key={i} style={{ height: f * ROW * u, overflow: "hidden" }}>
                <div
                  style={{
                    position: "relative",
                    height: ROW * u,
                    display: "flex",
                    alignItems: "center",
                    gap: 14 * u,
                    padding: `0 ${24 * u}px`,
                    opacity: f,
                    transform: f >= 1 ? undefined : `translateY(${(f - 1) * 8 * u}px)`,
                  }}
                >
                  {lit > 0 ? <div style={{ position: "absolute", inset: 0, background: props.accent, opacity: lit }} /> : null}
                  <span style={{ position: "relative", display: "flex" }}>
                    <Magnifier size={17 * u} color={lit >= 1 ? inkOn(props.accent, theme.icon) : theme.icon} />
                  </span>
                  <span style={{ position: "relative", minWidth: 0, fontSize: 19 * u, lineHeight: 1.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: lit >= 1 ? inkOn(props.accent, theme.ink) : theme.ink }}>
                    <Completion text={text} query={props.query} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {pick > 0 ? <Pointer p={p} u={u} target={{ x: STAGE * 0.62, y: INSET + BAR + PAD * 2 + (pick - 0.5) * ROW }} width={ctx.width} height={ctx.height} /> : null}
    </div>
  );
}

/* A suggestion that starts with the query shows the typed part plain and the rest in bold, as search engines do. */
function Completion({ text, query }: { text: string; query: string }): ReactNode {
  const q = query.trim();
  if (q && text.toLowerCase().startsWith(q.toLowerCase())) {
    return (
      <>
        {text.slice(0, q.length)}
        <b style={{ fontWeight: 650 }}>{text.slice(q.length)}</b>
      </>
    );
  }
  return text || " ";
}

/*
  The mouse pointer: it drifts in from below right, glides to the chosen row,
  and presses. `target` is in stage units; the tip of the arrow lands on it.
*/
function Pointer({ p, u, target, width, height }: { p: number; u: number; target: { x: number; y: number }; width: number; height: number }) {
  const shown = phase(p, S.glide[0] - 0.03, S.glide[0] + 0.02);
  if (shown <= 0) return null;
  const g = easeInOut(phase(p, ...S.glide));
  const from = { x: Math.min(STAGE - 30, target.x + 150), y: target.y + 110 };
  const x = (from.x + (target.x - from.x) * g) * u;
  const y = (from.y + (target.y - from.y) * g) * u;
  const pr = phase(p, ...S.press);
  const press = 1 - 0.14 * Math.sin(Math.PI * pr);
  const size = 30 * u;
  /* Kept inside the box, which is what the export captures. */
  const left = Math.min(x, width - size * 0.7);
  const top = Math.min(y, height - size);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ position: "absolute", left, top, opacity: shown, transform: `scale(${press})`, transformOrigin: "0 0", filter: `drop-shadow(0 ${1 * u}px ${2 * u}px rgba(0,0,0,0.35))` }}
    >
      <path d="M3 2 L3 19.5 L7.6 15.4 L10.6 22 L13.6 20.7 L10.7 14.2 L17 14.2 Z" fill="#ffffff" stroke="#111111" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function Magnifier({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block", flexShrink: 0 }}>
      <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke={color} strokeWidth="2.4" />
      <path d="M15.5 15.5 L21 21" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
