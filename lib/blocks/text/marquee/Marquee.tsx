import type { PropsOf } from "../../inputs";
import type { RenderContext } from "../../registry";
import { FONT, measure } from "../measure";

import type { inputs } from "./schema";

type Props = PropsOf<typeof inputs>;

/*
  The type is sized to the band's height; the band is the box. One copy is the
  text, a gap, the separator and a gap. A group repeats the copy until it is
  wider than the box, and the track is two identical groups side by side, so
  sliding it by half its own width (a percentage, not an estimate) lands it
  exactly where it started: the loop has no seam whatever the text measures.
*/
const WEIGHT = 700;
const SIZE = 0.4;
const GAP = 0.6;
/* Type sizes per second at 100%. */
const SPEED = 3;
const MAX_COPIES = 60;

export function Marquee({ props, ctx }: { props: Props; ctx: RenderContext }) {
  const fontSize = Math.max(1, ctx.height * SIZE);
  const copyEm = measure(props.text, { weight: WEIGHT }) + (props.separator ? measure(props.separator, { weight: WEIGHT }) + 2 * GAP : GAP);
  const copies = Math.min(MAX_COPIES, Math.ceil(ctx.width / (Math.max(0.5, copyEm) * fontSize)) + 1);

  /* A still is one pass from the left edge; in a video the offset runs with the clock, not the block's progress. */
  const travelled = ctx.mode === "video" ? (ctx.time * SPEED * props.speed) / 100 : 0;
  const phase = (travelled / (copies * Math.max(0.5, copyEm))) % 1;
  const shift = props.direction === "left" ? phase : phase === 0 ? 0 : 1 - phase;

  const group = (key: string) => (
    <div key={key} style={{ display: "flex", flexShrink: 0 }}>
      {Array.from({ length: copies }, (_, i) => (
        <span key={i} style={{ display: "flex", flexShrink: 0, alignItems: "center" }}>
          <span>{props.text}</span>
          {props.separator ? <span style={{ margin: `0 ${GAP}em` }}>{props.separator}</span> : <span style={{ width: `${GAP}em` }} />}
        </span>
      ))}
    </div>
  );

  return (
    <div
      className="size-full overflow-hidden"
      style={{
        display: "flex",
        alignItems: "center",
        background: props.banner ? props.bannerColor : "transparent",
        color: props.color,
        fontFamily: FONT,
        fontWeight: WEIGHT,
        fontSize,
        lineHeight: 1,
        /* Set, not inherited: the studio's UI tracking would change how far a copy runs. */
        letterSpacing: 0,
        whiteSpace: "pre",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <div style={{ display: "flex", flexShrink: 0, transform: shift ? `translateX(${-shift * 50}%)` : undefined }}>{[group("a"), group("b")]}</div>
    </div>
  );
}
