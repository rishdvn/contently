import type { PropsOf } from "../inputs";
import { BlockImage } from "../media";
import type { RenderContext } from "../registry";

import type { inputs } from "./schema";

type Props = PropsOf<typeof inputs>;

/*
  Laid out on a 320-unit-wide stage and scaled to the block's width: `u` is
  one unit. Wider scales everything. The sheet fills the box's height; the
  preview takes whatever the title, message and buttons leave, so a taller box
  shows a larger preview.
*/
const STAGE = 320;

/* Solid rather than frosted: a backdrop blur does not survive the exporter. */
const THEMES = {
  light: { sheet: "#f2f2f4", ink: "#111111", meta: "#3c3c43", hairline: "rgba(60,60,67,0.22)", pressed: [0, 0, 0, 0.08], blue: "#007aff", shadow: "rgba(0,0,0,0.28)", tile: "#e0e0e5" },
  dark: { sheet: "#252528", ink: "#f5f5f7", meta: "#c7c7cc", hairline: "rgba(235,235,245,0.18)", pressed: [255, 255, 255, 0.1], blue: "#0a84ff", shadow: "rgba(0,0,0,0.55)", tile: "#38383c" },
};

const FONT = `"Inter", -apple-system, system-ui, sans-serif`;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const phase = (p: number, from: number, to: number) => clamp01((p - from) / (to - from));

/*
  The script, as fractions of the block's time so stretching it slows the
  whole thing: the sheet rises, the buttons come up, and near the end Accept
  is pressed and released. The last fifth holds the settled sheet.
*/
const S = { rise: [0, 0.12], buttons: [0.1, 0.24], press: [0.68, 0.74], release: [0.74, 0.8] } as const;

export function Sheet({ props, ctx }: { props: Props; ctx: RenderContext }) {
  const t = THEMES[props.theme];
  const u = ctx.width / STAGE;
  const video = ctx.mode === "video";
  const p = ctx.progress;
  const rise = video ? easeOut(phase(p, ...S.rise)) : 1;
  const buttons = video ? easeOut(phase(p, ...S.buttons)) : 1;
  /* 0 → 1 → 0 across the tap. */
  const press = video ? phase(p, ...S.press) - phase(p, ...S.release) : 0;
  const hairline = Math.max(0.5, 0.5 * u);

  return (
    <div className="flex size-full items-stretch justify-center overflow-hidden" style={{ padding: `${10 * u}px ${10 * u}px`, fontFamily: FONT, WebkitFontSmoothing: "antialiased" }}>
      <div
        className="flex w-full flex-col overflow-hidden"
        style={{
          transform: `translateY(${(1 - rise) * 30}%) scale(${0.94 + 0.06 * rise})`,
          opacity: clamp01(rise * 1.6),
          borderRadius: 16 * u,
          background: t.sheet,
          boxShadow: `0 ${10 * u}px ${30 * u}px ${t.shadow}`,
          color: t.ink,
        }}
      >
        <div className="flex shrink-0 flex-col items-center text-center" style={{ padding: `${18 * u}px ${18 * u}px 0`, gap: 3 * u }}>
          <div className="w-full truncate" style={{ fontSize: 17 * u, lineHeight: 1.3, fontWeight: 600, letterSpacing: -0.2 * u }}>
            {props.title}
          </div>
          {props.subtitle ? (
            <div style={{ fontSize: 13 * u, lineHeight: 1.35, color: t.meta, whiteSpace: "pre-line", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 3, overflow: "hidden" }}>{props.subtitle}</div>
          ) : null}
        </div>
        <div className="relative min-h-0 flex-1 overflow-hidden" style={{ margin: `${14 * u}px ${16 * u}px ${16 * u}px`, borderRadius: 10 * u, background: t.tile }}>
          <svg className="absolute top-1/2 left-1/2" width={36 * u} height={36 * u} viewBox="0 0 24 24" fill="none" stroke={t.meta} strokeOpacity="0.45" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: -18 * u, marginTop: -18 * u }}>
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="9" cy="10" r="2" />
            <path d="m21 16-5-5-9 9" />
          </svg>
          <BlockImage value={props.image} className="absolute inset-0 size-full" />
        </div>
        <div className="flex shrink-0" style={{ height: 44 * u, borderTop: `${hairline}px solid ${t.hairline}`, opacity: buttons, color: t.blue, fontSize: 17 * u, lineHeight: 1.3, letterSpacing: -0.2 * u }}>
          <div className="flex min-w-0 flex-1 items-center justify-center" style={{ padding: `0 ${8 * u}px`, borderRight: `${hairline}px solid ${t.hairline}` }}>
            <span className="truncate">{props.declineLabel}</span>
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-center" style={{ padding: `0 ${8 * u}px`, fontWeight: 600, background: `rgba(${t.pressed[0]},${t.pressed[1]},${t.pressed[2]},${t.pressed[3] * press})` }}>
            <span className="truncate" style={{ transform: `scale(${1 - 0.06 * press})`, opacity: 1 - 0.35 * press }}>
              {props.acceptLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
