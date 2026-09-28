import type { CSSProperties } from "react";

import type { PropsOf } from "../inputs";
import { BlockImage } from "../media";
import type { RenderContext } from "../registry";

import type { inputs } from "./schema";

type Props = PropsOf<typeof inputs>;

/*
  The images fill the box, cropped to cover, so wider or taller simply shows
  more of each photo. Everything else (corners, dots) is sized from the
  shorter side, so the carousel reads the same as a sticker or a full story.
*/

/* Seconds each handover takes, at most, and never more than this share of a short interval. */
const HANDOVER = 0.3;
const HANDOVER_SHARE = 0.4;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/*
  Which image is on screen at `time`, and how far the handover to the next one
  has got (0 → 1). Each image holds for `interval` seconds, the handover taking
  its last stretch, and the sequence loops. A still shows the first image.
*/
export function slideAt(time: number, interval: number, count: number, video: boolean) {
  if (!video || count < 2) return { current: 0, next: count > 1 ? 1 : 0, handover: 0 };
  const slot = Math.floor(time / interval);
  const local = time - slot * interval;
  const length = Math.min(HANDOVER, interval * HANDOVER_SHARE);
  const handover = easeInOut(clamp01((local - (interval - length)) / length));
  return { current: slot % count, next: (slot + 1) % count, handover };
}

export function Carousel({ props, ctx }: { props: Props; ctx: RenderContext }) {
  const { images, transition, intervalSeconds, showDots } = props;
  const short = Math.min(ctx.width, ctx.height);
  const { current, next, handover } = slideAt(ctx.time, intervalSeconds, images.length, ctx.mode === "video");

  return (
    <div className="relative size-full overflow-hidden" style={{ borderRadius: (props.radius / 100) * short, background: "#e9e5df" }}>
      {/* Every image stays mounted, so none has to load mid-export; only the two in a handover show. */}
      {images.map((image, i) => {
        const role = i === current ? "current" : i === next && handover > 0 ? "next" : null;
        let style: CSSProperties = { opacity: 0 };
        /* The incoming image overlaps by a pixel, or the surface behind shows as a hairline seam mid-slide. */
        if (role && transition === "slide") style = { transform: role === "current" ? `translateX(${-handover * 100}%)` : `translateX(calc(${(1 - handover) * 100}% - 1px))` };
        if (role && transition === "fade") style = { opacity: role === "current" ? 1 : handover, zIndex: role === "next" ? 1 : 0 };
        return (
          <div key={i} className="absolute inset-0" style={style}>
            <Placeholder size={short} />
            <BlockImage value={image} className="absolute inset-0 size-full" />
          </div>
        );
      })}
      {showDots && images.length > 1 ? <Dots count={images.length} current={current} next={next} handover={handover} short={short} /> : null}
    </div>
  );
}

/* What an empty slot shows: a quiet surface with a picture glyph, so the frame still reads as a carousel. */
function Placeholder({ size }: { size: number }) {
  const icon = size * 0.16;
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: "#e9e5df" }}>
      <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke="#b4ada3" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="9" cy="10" r="2" />
        <path d="m21 16-5-5-9 9" />
      </svg>
    </div>
  );
}

/*
  Page dots over the bottom of the image. The active one is a pill; during a
  handover the pill's width flows from the current dot to the next, so the dots
  move with the images rather than jumping.
*/
function Dots({ count, current, next, handover, short }: { count: number; current: number; next: number; handover: number; short: number }) {
  const dot = Math.max(3, short * 0.022);
  const pill = dot * 2.6;
  return (
    <div className="absolute inset-x-0 flex justify-center" style={{ bottom: short * 0.05, gap: dot * 0.9, zIndex: 2 }}>
      {Array.from({ length: count }, (_, i) => {
        const lit = i === current ? 1 - handover : i === next ? handover : 0;
        return (
          <div
            key={i}
            style={{
              width: dot + (pill - dot) * lit,
              height: dot,
              borderRadius: dot,
              background: `rgba(255,255,255,${0.55 + 0.45 * lit})`,
              boxShadow: `0 0 ${dot * 0.8}px rgba(0,0,0,0.28)`,
            }}
          />
        );
      })}
    </div>
  );
}
