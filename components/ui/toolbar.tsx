import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * Floating control cluster that overlays the canvas. Unlike a Surface it is
 * always shadowed, because it has no structural relationship to what's beneath.
 */
export function Toolbar({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      role="toolbar"
      className={cn(
        "inline-flex items-center gap-1 rounded-panel border border-line bg-panel p-1 shadow-panel",
        className,
      )}
      {...props}
    />
  );
}

export function ToolbarDivider({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      className={cn("mx-1 h-5 w-px bg-line-strong", className)}
      {...props}
    />
  );
}
