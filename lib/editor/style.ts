import type { CSSProperties } from "react";

import type { Adjustments, Background, Block, Effect, Gradient, Shadow, TextBlock } from "./types";

export function gradientCss(g: Gradient) {
  return `linear-gradient(${g.angle}deg, ${g.stops.join(", ")})`;
}

export function backgroundCss(bg: Background): CSSProperties {
  switch (bg.type) {
    case "color":
      return { background: bg.color };
    case "gradient":
      return { background: gradientCss(bg.gradient) };
    case "image":
      return {
        backgroundImage: bg.src ? `url("${bg.src}")` : undefined,
        backgroundColor: "#1d1d1d",
        backgroundSize: "cover",
        backgroundPosition: `${bg.focalX}% ${bg.focalY}%`,
        filter: filterCss(bg.adjustments),
      };
  }
}

export function filterCss(a: Adjustments, effects: Effect[] = []) {
  const parts: string[] = [];
  if (a.brightness !== 100) parts.push(`brightness(${a.brightness}%)`);
  if (a.contrast !== 100) parts.push(`contrast(${a.contrast}%)`);
  if (a.saturate !== 100) parts.push(`saturate(${a.saturate}%)`);
  if (a.hue) parts.push(`hue-rotate(${a.hue}deg)`);
  if (a.grayscale) parts.push(`grayscale(${a.grayscale}%)`);
  const blur = a.blur + (effects.find((e) => e.kind === "blur")?.amount ?? 0) / 5;
  if (blur) parts.push(`blur(${blur}px)`);
  return parts.length ? parts.join(" ") : undefined;
}

export function shadowCss(s?: Shadow) {
  return s ? `${s.x}px ${s.y}px ${s.blur}px ${s.color}` : undefined;
}

/*
  The outer frame every block shares: position, size, rotation. Flips live on
  the content layer (see `flipStyle`) so the frame's transform is a pure
  rotation that the manipulation gizmo can read back unambiguously.
*/
export function frameStyle(b: Block): CSSProperties {
  return {
    position: "absolute",
    left: b.x,
    top: b.y,
    width: b.w,
    height: b.h,
    transform: `rotate(${b.rotation}deg)`,
    transformOrigin: "center center",
    opacity: b.opacity / 100,
  };
}

export function flipStyle(b: Block): CSSProperties {
  if (!b.flipX && !b.flipY) return {};
  return { transform: `${b.flipX ? "scaleX(-1)" : ""} ${b.flipY ? "scaleY(-1)" : ""}`.trim() };
}

export function textStyle(b: TextBlock): CSSProperties {
  const shadows: string[] = [];
  if (b.shadow) shadows.push(shadowCss(b.shadow)!);
  if (b.glow) shadows.push(`0 0 ${b.glow.blur}px ${b.glow.color}`, `0 0 ${b.glow.blur * 2}px ${b.glow.color}`);
  const s: CSSProperties = {
    fontFamily: `"${b.fontFamily}", sans-serif`,
    fontWeight: b.fontWeight,
    fontStyle: b.italic ? "italic" : "normal",
    textDecoration: b.underline ? "underline" : "none",
    fontSize: b.fontSize,
    lineHeight: b.lineHeight,
    letterSpacing: b.letterSpacing,
    textAlign: b.textAlign,
    textTransform: b.textTransform,
    color: b.color,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    textShadow: shadows.length ? shadows.join(", ") : undefined,
  };
  if (b.gradient) {
    s.backgroundImage = gradientCss(b.gradient);
    s.WebkitBackgroundClip = "text";
    s.backgroundClip = "text";
    s.color = "transparent";
    s.WebkitTextFillColor = "transparent";
  }
  if (b.stroke) {
    s.WebkitTextStroke = `${b.stroke.width}px ${b.stroke.color}`;
    /* Paint the stroke behind the fill so thick strokes don't eat the glyph. */
    s.paintOrder = "stroke fill";
  }
  return s;
}

/*
  Instagram-style highlight: the background belongs to an inline span with
  `box-decoration-break: clone`, so each wrapped line gets its own rounded
  slab rather than one rectangle around the whole paragraph.
*/
export function highlightStyle(b: TextBlock): CSSProperties | undefined {
  if (!b.highlight) return undefined;
  const { color, padding, radius } = b.highlight;
  return {
    background: color,
    padding: `${padding * 0.45}px ${padding}px`,
    borderRadius: radius,
    boxDecorationBreak: "clone",
    WebkitBoxDecorationBreak: "clone",
    /* Keep highlighted lines from touching. */
    lineHeight: b.lineHeight + 0.35,
  };
}

/* Effects that render as an overlay layer rather than a filter. */
export function effectOverlays(effects: Effect[]): CSSProperties[] {
  const out: CSSProperties[] = [];
  for (const e of effects) {
    if (e.kind === "tint") {
      out.push({ background: e.color ?? "#ff9a3c", opacity: e.amount / 100, mixBlendMode: "multiply" });
    }
    if (e.kind === "grain") {
      out.push({
        opacity: e.amount / 100,
        mixBlendMode: "overlay",
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 1 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        backgroundSize: "200px 200px",
      });
    }
    if (e.kind === "halftone") {
      const size = 6 + (e.amount / 100) * 14;
      out.push({
        opacity: 0.35 + (e.amount / 100) * 0.5,
        mixBlendMode: "multiply",
        backgroundImage: `radial-gradient(circle, rgba(0,0,0,0.9) ${size * 0.28}px, transparent ${size * 0.3}px)`,
        backgroundSize: `${size}px ${size}px`,
      });
    }
  }
  return out;
}
