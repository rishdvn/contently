import type { PropsOf } from "../inputs";
import { BlockImage } from "../media";
import type { RenderContext } from "../registry";

import type { inputs } from "./schema";

type Props = PropsOf<typeof inputs>;

/*
  Laid out on a 390-point-wide phone and scaled to the block's width: `u` is
  one point. Wider scales everything. The banner is as tall as its text needs
  and sits centred in the box, so a taller box only adds space around it.
*/
const STAGE = 390;

/* Solid rather than blurred: a backdrop blur does not survive the exporter. */
const THEMES = {
  light: { card: "rgba(246,246,248,0.97)", ink: "#111111", meta: "#6d6d72", hairline: "rgba(0,0,0,0.06)", shadow: "rgba(0,0,0,0.22)", tile: "#e3e3e8" },
  dark: { card: "rgba(40,40,44,0.97)", ink: "#f5f5f7", meta: "#a1a1a8", hairline: "rgba(255,255,255,0.08)", shadow: "rgba(0,0,0,0.5)", tile: "#3a3a40" },
};

const FONT = `"Inter", -apple-system, system-ui, sans-serif`;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeOutBack = (t: number) => {
  const c = 1.0;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

/* The drop takes the first 12 % of the block, so it stretches with it. */
const ENTRANCE = 0.12;

export function Banner({ props, ctx }: { props: Props; ctx: RenderContext }) {
  const t = THEMES[props.theme];
  const u = ctx.width / STAGE;
  const p = clamp01(ctx.progress / ENTRANCE);
  const drop = ctx.mode === "video" ? easeOutBack(p) : 1;
  const fade = ctx.mode === "video" ? clamp01(p * 2.5) : 1;

  return (
    <div className="flex size-full items-center overflow-hidden" style={{ padding: `0 ${8 * u}px`, fontFamily: FONT, WebkitFontSmoothing: "antialiased" }}>
      <div
        className="flex w-full"
        style={{
          /* From a box-height above, which is always out of view, down past its place and back. */
          transform: `translateY(${(drop - 1) * ctx.height}px)`,
          opacity: fade,
          gap: 11 * u,
          padding: `${13 * u}px ${14 * u}px ${14 * u}px`,
          borderRadius: 24 * u,
          background: t.card,
          boxShadow: `0 ${8 * u}px ${26 * u}px ${t.shadow}, inset 0 0 0 ${Math.max(0.5, 0.6 * u)}px ${t.hairline}`,
          color: t.ink,
        }}
      >
        <div className="relative shrink-0 overflow-hidden" style={{ width: 38 * u, height: 38 * u, borderRadius: 9 * u, background: t.tile, marginTop: 2 * u }}>
          <div className="absolute inset-0 flex items-center justify-center" style={{ fontSize: 18 * u, fontWeight: 700, color: t.meta }}>
            {props.appName.trim().charAt(0).toUpperCase()}
          </div>
          <BlockImage value={props.appIcon} className="absolute inset-0 size-full" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 1 * u }}>
          <div className="flex items-baseline justify-between" style={{ gap: 8 * u }}>
            <span className="min-w-0 truncate" style={{ fontSize: 12.5 * u, lineHeight: 1.35, fontWeight: 600, letterSpacing: 0.4 * u, textTransform: "uppercase", color: t.meta }}>
              {props.appName}
            </span>
            <span className="shrink-0" style={{ fontSize: 13 * u, lineHeight: 1.35, color: t.meta }}>
              {props.time}
            </span>
          </div>
          {props.title ? (
            <div className="truncate" style={{ fontSize: 15 * u, lineHeight: 1.35, fontWeight: 600, letterSpacing: -0.1 * u }}>
              {props.title}
            </div>
          ) : null}
          {props.body ? (
            <div style={{ fontSize: 15 * u, lineHeight: 1.33, letterSpacing: -0.1 * u, whiteSpace: "pre-line", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 3, overflow: "hidden" }}>
              {props.body}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
