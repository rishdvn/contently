import type { CSSProperties } from "react";

import type { PropsOf } from "../inputs";
import { BlockImage } from "../media";
import type { RenderContext } from "../registry";

import type { inputs } from "./schema";

type Props = PropsOf<typeof inputs>;

/*
  Two halves, always 50 / 50: the photo covers one, the copy sits in the
  other. The copy is designed for a 300-unit-wide column and needs at most
  480 units of height (five lines of heading, seven of body, padding), so one
  unit is whichever of those fits the box: wider grows the type until the
  longest copy would run out of height, taller only adds air around it.
*/
const COLUMN = 300;
const COPY_HEIGHT = 480;

const THEMES = {
  light: { copy: "#ffffff", photo: "#e6e6e6", glyph: "#c4c4c4", ink: "#111111", body: "#5c5c5c" },
  dark: { copy: "#161616", photo: "#262626", glyph: "#3d3d3d", ink: "#ffffff", body: "#a3a3a3" },
};

const FONT = `"Inter", -apple-system, system-ui, sans-serif`;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
/* 0 → 1 across [from, to] of the block's progress. */
const phase = (p: number, [from, to]: readonly [number, number]) => clamp01((p - from) / (to - from));

/* Entrance windows as fractions of the block's time: settled by half-way, then held. */
const T = {
  photo: [0, 0.3],
  heading: [0.14, 0.38],
  body: [0.24, 0.5],
} as const;

export function Split({ props, ctx }: { props: Props; ctx: RenderContext }) {
  const theme = THEMES[props.theme];
  const u = Math.min(ctx.width / 2 / COLUMN, ctx.height / COPY_HEIGHT);
  const p = ctx.progress;
  /* +1 when the photo is on the left: it enters from the left edge, the copy from the right. */
  const from = props.side === "left" ? -1 : 1;

  const photo = easeOut(phase(p, T.photo));
  const slide = (f: number, distance: number): CSSProperties => {
    const e = easeOut(f);
    return e >= 1 ? {} : { opacity: e, transform: `translateX(${-from * (1 - e) * distance * u}px)` };
  };

  /* While the photo slides in, the copy's surface shows behind it; the grey well is only for an empty slot. */
  const empty = !props.image.src && !props.image.mediaId;
  const photoHalf = (
    <div style={{ position: "relative", flex: "1 1 0", minWidth: 0, overflow: "hidden", background: empty ? theme.photo : theme.copy }}>
      {empty ? <Placeholder color={theme.glyph} size={96 * u} /> : null}
      <div style={{ position: "absolute", inset: 0, transform: photo >= 1 ? undefined : `translateX(${from * (1 - photo) * 100}%)` }}>
        <BlockImage value={props.image} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      </div>
    </div>
  );

  const copyHalf = (
    <div
      style={{
        flex: "1 1 0",
        minWidth: 0,
        overflow: "hidden",
        background: theme.copy,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 16 * u,
        padding: `${36 * u}px ${32 * u}px`,
      }}
    >
      {props.heading ? (
        <div style={slide(phase(p, T.heading), 40)}>
          <div style={{ ...clampLines(5), color: theme.ink, fontSize: 32 * u, fontWeight: 700, lineHeight: 1.12, letterSpacing: -0.6 * u }}>{props.heading}</div>
        </div>
      ) : null}
      {props.body ? (
        <div style={slide(phase(p, T.body), 40)}>
          <div style={{ ...clampLines(7), color: theme.body, fontSize: 16 * u, fontWeight: 400, lineHeight: 1.5, whiteSpace: "pre-line" }}>{props.body}</div>
        </div>
      ) : null}
    </div>
  );

  return (
    <div
      className="size-full overflow-hidden"
      /* The copy's surface under both halves, so the antialiased seam between them never shows what is behind the block. */
      style={{ display: "flex", flexDirection: props.side === "left" ? "row" : "row-reverse", background: theme.copy, fontFamily: FONT, WebkitFontSmoothing: "antialiased" }}
    >
      {photoHalf}
      {copyHalf}
    </div>
  );
}

const clampLines = (n: number): CSSProperties => ({ display: "-webkit-box", WebkitLineClamp: n, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" });

/* Butter's empty photo well: a mountain and a sun, centred. */
function Placeholder({ color, size }: { color: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}>
      <circle cx="17" cy="7" r="2.2" fill={color} />
      <path d="M2 20 L9 10 L13.5 15.5 L16 12.5 L22 20 Z" fill={color} />
    </svg>
  );
}
