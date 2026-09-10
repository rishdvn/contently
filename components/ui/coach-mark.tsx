"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

import { Button, IconButton } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * A pointed note anchored to one control, shown once, in a short sequence.
 * The inverse surface is what makes it read as guidance rather than UI: it is
 * the only light-on-dark panel in the system, so it can never be mistaken for
 * a menu or a popover. Two actions at most, and a step counter so the user
 * knows how long the tour is.
 */
export function CoachMark({
  title,
  children,
  step,
  total,
  side = "bottom",
  onNext,
  onDismiss,
  nextLabel,
  className,
}: {
  title: string;
  children: ReactNode;
  step?: number;
  total?: number;
  side?: "top" | "bottom" | "left" | "right";
  onNext?: () => void;
  onDismiss?: () => void;
  nextLabel?: string;
  className?: string;
}) {
  const arrow = {
    bottom: "-top-1 left-6",
    top: "-bottom-1 left-6",
    left: "-right-1 top-5",
    right: "-left-1 top-5",
  }[side];
  const last = step !== undefined && total !== undefined && step >= total;
  return (
    <div
      role="dialog"
      aria-label={title}
      className={cn(
        "relative w-[280px] rounded-nav bg-inverse-surface p-4 text-inverse-ink shadow-overlay",
        "animate-pop",
        className,
      )}
      style={{ zIndex: "var(--z-floating-bar)" }}
    >
      <span aria-hidden className={cn("absolute size-2.5 rotate-45 bg-inverse-surface", arrow)} />
      <div className="flex items-start gap-2">
        <p className="flex-1 text-ui font-medium">{title}</p>
        {onDismiss ? (
          <IconButton aria-label="Dismiss" size="sm" onClick={onDismiss} className="-mt-1 -mr-1.5 text-inverse-ink hover:bg-black/8 hover:text-inverse-ink">
            <X />
          </IconButton>
        ) : null}
      </div>
      <p className="pt-1 text-default text-inverse-ink/70">{children}</p>
      <div className="flex items-center justify-between pt-3">
        <span className="text-cap text-inverse-ink/50 tabular-nums">
          {step !== undefined && total !== undefined ? `${step} of ${total}` : ""}
        </span>
        {onNext ? (
          <Button size="sm" variant="ghost" onClick={onNext} className="bg-inverse-ink text-inverse-surface hover:bg-inverse-ink/85">
            {nextLabel ?? (last ? "Done" : "Next")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
