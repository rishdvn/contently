import { ImageOff } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

/* ---------------------------------------------------------------------------
   Thumbnail
   ------------------------------------------------------------------------ */

const ratios = {
  "1:1": "aspect-square",
  "4:5": "aspect-[4/5]",
  "9:16": "aspect-[9/16]",
  "16:9": "aspect-video",
} as const;

export type Ratio = keyof typeof ratios;

/**
 * Artwork at a fixed ratio with an optional overlay row. The only rounded-card
 * element besides the card itself; imagery is where the 32px radius comes
 * from. When there is no source it shows the raised fill and a glyph, never a
 * broken image.
 */
export function Thumbnail({
  src,
  alt = "",
  ratio = "4:5",
  overlay,
  selected,
  className,
  children,
  ...props
}: Omit<ComponentProps<"div">, "children"> & {
  src?: string | null;
  alt?: string;
  ratio?: Ratio;
  /** Bottom-anchored content laid over a scrim — title, meta, actions. */
  overlay?: ReactNode;
  selected?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "group/thumb relative overflow-hidden rounded-[20px] bg-raised",
        ratios[ratio],
        selected && "ring-2 ring-ink ring-offset-2 ring-offset-canvas",
        className,
      )}
      {...props}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-ink-disabled">
          {children ?? <ImageOff className="size-5" />}
        </div>
      )}
      {overlay ? <div className="scrim absolute inset-x-0 bottom-0 p-3 pt-10">{overlay}</div> : null}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Logo
   ------------------------------------------------------------------------ */

/**
 * The mark: a lowercase c drawn as a broken ring, the gap where the spectrum
 * begins. Monochrome by default; `spectrum` for the app icon and the empty
 * state only. The wordmark is the italic serif already used in the sidebar.
 */
export function Logo({ size = 24, spectrum = false, className }: { size?: number; spectrum?: boolean; className?: string }) {
  const id = `logo-grad-${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={cn("shrink-0", className)}>
      {spectrum ? (
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--color-spectrum-green)" />
            <stop offset="0.5" stopColor="var(--color-spectrum-amber)" />
            <stop offset="1" stopColor="var(--color-spectrum-orange)" />
          </linearGradient>
        </defs>
      ) : null}
      <path
        d="M18.5 7.2A8 8 0 1 0 18.5 16.8"
        stroke={spectrum ? `url(#${id})` : "currentColor"}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="19" cy="12" r="1.6" fill={spectrum ? "var(--color-spectrum-orange)" : "currentColor"} />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-ink", className)}>
      <Logo size={20} />
      <span className="text-titles italic">Contently</span>
    </span>
  );
}

/* ---------------------------------------------------------------------------
   Illustration
   ------------------------------------------------------------------------ */

/**
 * Empty-state glyphs: a few strokes on a 96px stage, in the same 1.5px line
 * as the icons, so an empty screen and a full screen share one hand. Named by
 * what is missing, not by what they depict.
 */
export function Illustration({ name, className }: { name: "empty-board" | "empty-calendar" | "empty-library" | "empty-thread" | "no-results"; className?: string }) {
  const stroke = { stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  return (
    <svg viewBox="0 0 96 96" width="96" height="96" aria-hidden className={cn("text-ink-disabled", className)}>
      {name === "empty-board" ? (
        <>
          <rect x="14" y="20" width="20" height="56" rx="5" {...stroke} />
          <rect x="38" y="20" width="20" height="40" rx="5" {...stroke} />
          <rect x="62" y="20" width="20" height="28" rx="5" {...stroke} />
          <path d="M20 30h8M44 30h8M68 30h8" {...stroke} />
        </>
      ) : null}
      {name === "empty-calendar" ? (
        <>
          <rect x="16" y="22" width="64" height="56" rx="8" {...stroke} />
          <path d="M16 38h64M32 16v10M64 16v10" {...stroke} />
          <circle cx="48" cy="58" r="6" {...stroke} />
        </>
      ) : null}
      {name === "empty-library" ? (
        <>
          <rect x="14" y="18" width="30" height="36" rx="6" {...stroke} />
          <rect x="52" y="18" width="30" height="22" rx="6" {...stroke} />
          <rect x="52" y="48" width="30" height="30" rx="6" {...stroke} />
          <rect x="14" y="62" width="30" height="16" rx="6" {...stroke} />
        </>
      ) : null}
      {name === "empty-thread" ? (
        <>
          <path d="M20 26h56a6 6 0 0 1 6 6v22a6 6 0 0 1-6 6H40l-14 12V60h-6a6 6 0 0 1-6-6V32a6 6 0 0 1 6-6Z" {...stroke} />
          <path d="M32 40h32M32 50h20" {...stroke} />
        </>
      ) : null}
      {name === "no-results" ? (
        <>
          <circle cx="44" cy="44" r="22" {...stroke} />
          <path d="M60 60l16 16M36 44h16" {...stroke} />
        </>
      ) : null}
    </svg>
  );
}
