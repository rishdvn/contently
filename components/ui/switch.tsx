"use client";

import type { ReactNode } from "react";
import { useId } from "react";

import { cn } from "@/lib/cn";

/**
 * Immediate binary state — it applies the moment it moves, with no confirming
 * action. If the change needs saving, use a Checkbox and a submit button.
 */
export function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  label,
  description,
  className,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  label?: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  const id = useId();

  const control = (
    <button
      id={id}
      role="switch"
      type="button"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5",
        "transition-colors duration-150 ease-out-quart outline-none",
        "focus-visible:ring-2 focus-visible:ring-ink/25 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
        "disabled:opacity-40",
        /*
          The reference keeps the off-track at 30% of the knob colour rather
          than using a solid grey, so the control reads as one object in two
          states instead of two different colours.
        */
        checked ? "bg-positive" : "bg-ink/30",
      )}
    >
      <span
        className={cn(
          "size-4 rounded-full transition-transform duration-150 ease-out-quart",
          checked ? "translate-x-4 bg-canvas" : "translate-x-0 bg-ink",
        )}
      />
    </button>
  );

  if (!label) return control;

  return (
    <div className={cn("flex items-start gap-3", className)}>
      {control}
      <label htmlFor={id} className="flex min-w-0 flex-col gap-0.5">
        <span className="text-default text-ink">{label}</span>
        {description ? (
          <span className="text-cap text-ink-secondary">{description}</span>
        ) : null}
      </label>
    </div>
  );
}
