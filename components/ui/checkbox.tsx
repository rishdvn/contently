"use client";

import { Check, Minus } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/**
 * Binary choice inside a list or a form. Follows the Switch's rule: the
 * checked state inverts to ink so it never depends on hue. `indeterminate` is
 * for a parent whose children are partly selected.
 */
export function Checkbox({
  checked = false,
  indeterminate = false,
  onCheckedChange,
  className,
  disabled,
  ...props
}: Omit<ComponentProps<"button">, "onChange"> & {
  checked?: boolean;
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  const on = checked || indeterminate;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onCheckedChange?.(!checked);
      }}
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-[5px] outline-none",
        "transition-colors duration-100 ease-out-quart",
        "focus-visible:ring-2 focus-visible:ring-ink/25 focus-visible:ring-offset-2 focus-visible:ring-offset-panel",
        on ? "bg-ink text-canvas" : "bg-field ring-1 ring-inset ring-line-strong hover:ring-ink/40",
        "disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
      {...props}
    >
      {indeterminate ? (
        <Minus className="size-3" strokeWidth={2.5} />
      ) : checked ? (
        <Check className="size-3" strokeWidth={2.5} />
      ) : null}
    </button>
  );
}
