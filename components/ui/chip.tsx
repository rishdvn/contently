import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** Filter / taxonomy token. Selection is shown by fill, never by colour. */
export function Chip({
  selected = false,
  className,
  ...props
}: ComponentProps<"button"> & { selected?: boolean }) {
  return (
    <button
      aria-pressed={selected}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-chip px-2.5 text-xs whitespace-nowrap",
        "transition-colors duration-150 ease-out-quart outline-none",
        "focus-visible:ring-2 focus-visible:ring-ink/25",
        selected
          ? "bg-selected text-ink"
          : "bg-sunken text-ink-secondary hover:bg-raised hover:text-ink",
        className,
      )}
      {...props}
    />
  );
}

export function ChipRow({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center gap-1.5 overflow-x-auto", className)}
      {...props}
    />
  );
}
