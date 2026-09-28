import type { ReactNode } from "react";

import type { PropsOf } from "../../inputs";
import type { RenderContext } from "../../registry";
import { FONT, measure } from "../measure";

import type { inputs } from "./schema";

type Props = PropsOf<typeof inputs>;

/*
  The pill is designed in ems of its label and scaled to the largest size the
  box holds, centred in it: a longer label makes a longer pill, not smaller
  type. Room is left for the press to breathe.
*/
const WEIGHT = 600;
const HEIGHT = 2.6;
const PAD_X = 1.15;
const ICON = 0.95;
const GAP = 0.42;
const FIT = 0.9;

/* Fade and rise in over the first 15%, then one press at 62–80%. */
const ENTER = 0.15;
const PRESS = [0.62, 0.8] as const;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/* Stroked 24-unit glyphs in the label's colour. */
const ICONS: Record<Exclude<Props["icon"], "none">, ReactNode> = {
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  cart: (
    <>
      <circle cx="9" cy="20" r="1.3" />
      <circle cx="18" cy="20" r="1.3" />
      <path d="M2.5 3.5h2.6l2.4 11.2a1.6 1.6 0 0 0 1.6 1.3h8.3a1.6 1.6 0 0 0 1.6-1.2L21 7H6.2" />
    </>
  ),
  link: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
};

/* `#rgb` / `#rrggbb` at an alpha, for the glass tint; anything else passes through. */
function alpha(color: string, a: number) {
  const hex = color.trim().replace(/^#/, "");
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex.slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(full)) return color;
  return `#${full}${Math.round(a * 255).toString(16).padStart(2, "0")}`;
}

export function Button({ props, ctx }: { props: Props; ctx: RenderContext }) {
  const hasIcon = props.icon !== "none";
  const labelEm = measure(props.label, { weight: WEIGHT });
  const widthEm = 2 * PAD_X + labelEm + (hasIcon ? (props.label ? GAP : 0) + ICON : 0);
  const fontSize = Math.max(1, Math.min((ctx.height * FIT) / HEIGHT, (ctx.width * FIT) / widthEm));

  const enter = easeOut(clamp01(ctx.progress / ENTER));
  const press = Math.sin(Math.PI * clamp01((ctx.progress - PRESS[0]) / (PRESS[1] - PRESS[0])));
  const scale = 1 - 0.07 * press;

  /* A filled pill takes the text colour for its label; outline and glass are drawn in one colour, the fill. */
  const look = {
    filled: { background: props.fill, color: props.textColor, border: "none", shadow: `0 ${0.28 * fontSize}px ${0.8 * fontSize}px rgba(0,0,0,0.22)` },
    outline: { background: "transparent", color: props.fill, border: `${0.09 * fontSize}px solid ${props.fill}`, shadow: "none" },
    glass: { background: `linear-gradient(180deg, ${alpha(props.fill, 0.3)}, ${alpha(props.fill, 0.14)})`, color: props.fill, border: `${0.05 * fontSize}px solid ${alpha(props.fill, 0.45)}`, shadow: `0 ${0.28 * fontSize}px ${0.8 * fontSize}px rgba(0,0,0,0.18)` },
  }[props.style];

  const icon = hasIcon ? (
    <svg viewBox="0 0 24 24" width={ICON * fontSize} height={ICON * fontSize} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {ICONS[props.icon as keyof typeof ICONS]}
    </svg>
  ) : null;

  return (
    <div className="size-full overflow-hidden" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: GAP * fontSize,
          boxSizing: "border-box",
          width: widthEm * fontSize,
          height: HEIGHT * fontSize,
          padding: `0 ${PAD_X * fontSize}px`,
          borderRadius: 999,
          background: look.background,
          border: look.border,
          boxShadow: look.shadow,
          color: look.color,
          fontFamily: FONT,
          fontWeight: WEIGHT,
          fontSize,
          lineHeight: 1,
          /* Set, not inherited: the studio's UI tracking would widen the label past the pill it was measured for. */
          letterSpacing: 0,
          whiteSpace: "pre",
          WebkitFontSmoothing: "antialiased",
          opacity: enter,
          transform: enter < 1 || press > 0 ? `translateY(${(1 - enter) * 0.5 * fontSize}px) scale(${scale})` : undefined,
        }}
      >
        {props.icon === "cart" ? icon : null}
        {props.label}
        {props.icon !== "cart" ? icon : null}
        {press > 0 ? <div style={{ position: "absolute", inset: 0, borderRadius: 999, background: `rgba(0,0,0,${0.14 * press})` }} /> : null}
      </div>
    </div>
  );
}
