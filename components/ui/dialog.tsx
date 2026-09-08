"use client";

import { X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { useEffect, useRef } from "react";

import { IconButton } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Size = "sm" | "md" | "lg" | "full";
type Side = "right" | "left" | "bottom";

const sizes: Record<Size, string> = {
  sm: "w-[400px]",
  md: "w-[520px]",
  lg: "w-[720px]",
  full: "w-[calc(100vw-64px)] h-[calc(100dvh-64px)]",
};

const sides: Record<Side, string> = {
  right: "overlay-drawer-right w-[440px]",
  left: "overlay-drawer-left w-[440px]",
  bottom: "overlay-drawer-bottom max-h-[80dvh]",
};

/**
 * Shared plumbing for both overlay shapes.
 *
 * The heavy lifting belongs to the browser: `showModal()` puts the element in
 * the top layer, traps focus, makes the rest of the page inert and wires up
 * Escape. What is left for us is keeping React state in sync with the element's
 * own open state, dismissing on a backdrop click, and locking background
 * scroll — which the platform still does not do on its own.
 */
function useOverlay(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    /* Fires for Escape too, so state stays correct however it was dismissed. */
    const sync = () => onClose();
    el.addEventListener("close", sync);
    return () => el.removeEventListener("close", sync);
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previous;
    };
  }, [open]);

  /*
    A click on the backdrop is reported against the dialog element itself,
    since the backdrop is a pseudo-element. Anything inside the panel has a
    different target, so this cleanly separates the two.
  */
  const onBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === ref.current) onClose();
  };

  return { ref, onBackdropClick };
}

type OverlayProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  /** Set false for flows the user must resolve, e.g. unsaved-work prompts. */
  dismissable?: boolean;
};

/** Centred modal. Use for a decision or a short focused task. */
export function Dialog({
  open,
  onClose,
  size = "md",
  dismissable = true,
  className,
  children,
}: OverlayProps & { size?: Size }) {
  const { ref, onBackdropClick } = useOverlay(open, onClose);
  return (
    <dialog
      ref={ref}
      onClick={dismissable ? onBackdropClick : undefined}
      onCancel={dismissable ? undefined : (e) => e.preventDefault()}
      className={cn(
        "overlay overlay-dialog m-auto max-h-[calc(100dvh-64px)]",
        sizes[size],
        className,
      )}
    >
      {children}
    </dialog>
  );
}

/**
 * Edge-anchored panel. Use when the work is secondary to what is on the canvas
 * and the user benefits from still seeing it — inspectors, filters, detail.
 */
export function Drawer({
  open,
  onClose,
  side = "right",
  dismissable = true,
  className,
  children,
}: OverlayProps & { side?: Side }) {
  const { ref, onBackdropClick } = useOverlay(open, onClose);
  return (
    <dialog
      ref={ref}
      onClick={dismissable ? onBackdropClick : undefined}
      onCancel={dismissable ? undefined : (e) => e.preventDefault()}
      className={cn("overlay overlay-drawer", sides[side], className)}
    >
      {children}
    </dialog>
  );
}

/* ---------------------------------------------------------------------------
   Composition parts. Shared by both shapes so a flow can be moved from a
   dialog to a drawer without rewriting its contents.
   ------------------------------------------------------------------------ */

/**
 * Optional leading glyph. Tone tints the badge only — the title still carries
 * the meaning, so the icon is reinforcement rather than the message.
 */
export function DialogIcon({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "critical" | "caution" | "positive" | "spectrum";
  children: ReactNode;
}) {
  const tones = {
    neutral: "bg-raised text-ink",
    critical: "bg-critical-surface text-critical",
    caution: "bg-caution-surface text-caution",
    positive: "bg-positive-surface text-positive",
    spectrum: "spectrum-edge text-ink",
  } as const;
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-control [&>svg]:size-4.5",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function DialogHeader({
  icon,
  title,
  description,
  onClose,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  onClose?: () => void;
  className?: string;
}) {
  return (
    <header className={cn("flex items-start gap-3 px-5 pt-5 pb-4", className)}>
      {icon}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 className="text-titles text-ink">{title}</h2>
        {description ? (
          <p className="text-default text-ink-secondary">{description}</p>
        ) : null}
      </div>
      {onClose ? (
        <IconButton aria-label="Close" size="sm" onClick={onClose} className="-mt-1 -mr-1">
          <X />
        </IconButton>
      ) : null}
    </header>
  );
}

/** Scrolls when the content outgrows the viewport; the header and footer do not. */
export function DialogBody({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("min-h-0 flex-1 overflow-y-auto px-5 pb-5", className)}
      {...props}
    />
  );
}

/**
 * Actions sit right, in ascending order of consequence, so the confirming
 * action lands closest to the thumb and the pointer's resting position.
 */
export function DialogFooter({
  className,
  children,
  secondary,
  ...props
}: ComponentProps<"div"> & { secondary?: ReactNode }) {
  return (
    <footer
      className={cn(
        "flex items-center justify-between gap-3 bg-canvas/40 px-5 py-4",
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-2">{secondary}</div>
      <div className="flex items-center gap-2">{children}</div>
    </footer>
  );
}
