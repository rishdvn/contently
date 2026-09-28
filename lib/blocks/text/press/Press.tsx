import type { CSSProperties } from "react";

import { useMediaUrl } from "@/lib/editor/media";

import type { PropsOf } from "../../inputs";
import { BlockImage } from "../../media";
import type { RenderContext } from "../../registry";

import type { inputs } from "./schema";

type Props = PropsOf<typeof inputs>;
type Logo = Props["logos"][number];

/*
  The label on top, the logos in centred rows beneath: one row for up to
  three, a 2 × 2 grid for four, rows of three for five or six. Every logo gets
  the same slot, SLOT_RATIO wide by one tall, and is contained inside it, so
  logos of any shape line up. Slots are as large as the box allows: the width
  sets them in a wide box, the height in a short one.

  A typed name is set in Playfair Display, fitted to its slot from advances
  measured in Chrome (weight 700) and rounded up, so it never overflows. The
  label is fitted the same way in Inter.
*/
const INTER = `"Inter", -apple-system, system-ui, sans-serif`;
const SERIF = `"Playfair Display", Georgia, serif`;
const SLOT_RATIO = 2.2;
const ROW_GAP = 0.35;

const serifEm = (s: string) =>
  [...s].reduce((w, c) => w + (c === " " ? 0.25 : /[MW@&]/.test(c) ? 0.98 : /[mw]/.test(c) ? 0.92 : /[A-Z]/.test(c) ? 0.8 : /\d/.test(c) ? 0.66 : /[a-z]/.test(c) ? 0.6 : 0.8) + 0.02, 0);
const labelEm = (s: string) => [...s].reduce((w, c) => w + (c === " " ? 0.28 : /[MW@%]/.test(c) ? 1.08 : 0.72), 0);

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const phase = (p: number, from: number, to: number) => clamp01((p - from) / (to - from));

/* Entrance windows as fractions of the block's time: the label, then each logo in turn. */
const LABEL = [0, 0.14] as const;
const logoWindow = (i: number) => [0.1 + i * 0.07, 0.24 + i * 0.07] as const;

export function Press({ props, ctx }: { props: Props; ctx: RenderContext }) {
  const W = ctx.width;
  const H = ctx.height;
  const label = props.label.trim();
  const n = props.logos.length;

  const labelSize = label ? Math.max(1, Math.min(H * 0.1, (W * 0.9) / Math.max(1, labelEm(label)))) : 0;
  const labelGap = labelSize * 0.9;
  const region = H * 0.84 - (label ? labelSize * 1.2 + labelGap : 0);

  const perRow = n <= 3 ? n : n === 4 ? 2 : 3;
  const rows = Math.ceil(n / perRow);
  const colGap = W * 0.05;
  const slotW0 = (W * 0.9 - (perRow - 1) * colGap) / perRow;
  const slotH = Math.max(1, Math.min(slotW0 / SLOT_RATIO, region / (rows + (rows - 1) * ROW_GAP)));
  const slotW = slotH * SLOT_RATIO;

  const p = ctx.progress;
  const labelIn = easeOut(phase(p, LABEL[0], LABEL[1]));

  return (
    <div className="size-full overflow-hidden" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: labelGap }}>
      {label ? (
        <div
          style={{
            color: props.color,
            fontFamily: INTER,
            fontWeight: 700,
            fontSize: labelSize,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            WebkitFontSmoothing: "antialiased",
            ...(labelIn >= 1 ? {} : { opacity: labelIn, transform: `translateY(${(1 - labelIn) * labelSize * 0.4}px)` }),
          }}
        >
          {label}
        </div>
      ) : null}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          columnGap: colGap,
          rowGap: slotH * ROW_GAP,
          width: perRow * slotW + (perRow - 1) * colGap,
        }}
      >
        {props.logos.map((logo, i) => {
          const [a, b] = logoWindow(i);
          const e = easeOut(phase(p, a, b));
          const style: CSSProperties = { width: slotW, height: slotH, flexShrink: 0, ...(e >= 1 ? {} : { opacity: e, transform: `translateY(${(1 - e) * slotH * 0.25}px)` }) };
          return <Slot key={i} logo={logo} color={props.color} tint={props.tint} style={style} />;
        })}
      </div>
    </div>
  );
}

function Slot({ logo, color, tint, style }: { logo: Logo; color: string; tint: boolean; style: CSSProperties }) {
  const w = Number(style.width) || 0;
  const h = Number(style.height) || 0;
  const hasImage = Boolean(logo.image.src || logo.image.mediaId);

  if (logo.kind === "text" && logo.text.trim()) {
    const size = Math.max(1, Math.min(h * 0.62, (w * 0.96) / Math.max(1, serifEm(logo.text.trim()))));
    return (
      <div style={{ ...style, display: "flex", alignItems: "center", justifyContent: "center", color, fontFamily: SERIF, fontWeight: 700, fontSize: size, letterSpacing: "0.02em", lineHeight: 1, whiteSpace: "nowrap", WebkitFontSmoothing: "antialiased" }}>
        {logo.text.trim()}
      </div>
    );
  }
  if (logo.kind === "image" && hasImage) {
    return <div style={{ ...style, position: "relative" }}>{tint ? <Tinted value={logo.image} color={color} /> : <BlockImage value={logo.image} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />}</div>;
  }
  /* Nothing to show yet (a logo just added in the inspector): where it will go. */
  return (
    <div
      style={{
        ...style,
        boxSizing: "border-box",
        border: `${Math.max(1, h * 0.03)}px dashed rgba(128,128,128,0.6)`,
        borderRadius: h * 0.16,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "rgba(128,128,128,0.9)",
        fontFamily: INTER,
        fontSize: h * 0.24,
        fontWeight: 500,
      }}
    >
      {logo.kind === "text" ? "Name" : "Logo"}
    </div>
  );
}

/*
  The logo's shape filled with one colour: a box of `color` masked by the
  image. The exporter embeds mask images, so the export matches the canvas.
*/
function Tinted({ value, color }: { value: Logo["image"]; color: string }) {
  const src = useMediaUrl(value.mediaId, value.src);
  if (!src) return null;
  const mask = `url("${src}") center / contain no-repeat`;
  return <div style={{ position: "absolute", inset: 0, background: color, mask, WebkitMask: mask }} />;
}
