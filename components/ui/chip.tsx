import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * Filter / taxonomy token. 34px tall on a 10px radius, matching the reference.
 * Selection is shown by inverting to a light fill, never by colour.
 */
export function Chip({
  selected = false,
  className,
  ...props
}: ComponentProps<"button"> & { selected?: boolean }) {
  return (
    <button
      aria-pressed={selected}
      className={cn(
        "inline-flex h-8.5 shrink-0 items-center gap-1.5 rounded-control px-3.5 text-ui whitespace-nowrap",
        "transition-colors duration-150 ease-out-quart outline-none",
        "focus-visible:ring-2 focus-visible:ring-ink/25",
        selected ? "bg-ink text-canvas" : "bg-raised text-ink hover:bg-line-strong",
        className,
      )}
      {...props}
    />
  );
}

export function ChipRow({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center gap-2 overflow-x-auto", className)}
      {...props}
    />
  );
}

/** Underlined text tabs, as used for Video / Static in the reference. */
export function TextTab({
  active = false,
  className,
  ...props
}: ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      aria-current={active ? "true" : undefined}
      className={cn(
        "pb-1 text-titles transition-colors duration-150 ease-out-quart outline-none",
        active
          ? "border-b border-ink text-ink"
          : "border-b border-transparent text-ink-disabled hover:text-ink-secondary",
        className,
      )}
      {...props}
    />
  );
}
