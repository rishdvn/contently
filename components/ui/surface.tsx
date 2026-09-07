import type { ComponentProps, ElementType } from "react";
import { cn } from "@/lib/cn";

type Level = "panel" | "sunken" | "raised" | "card";

const levels: Record<Level, string> = {
  panel: "bg-panel border border-line rounded-panel",
  sunken: "bg-sunken border border-line rounded-card",
  raised: "bg-raised border border-line rounded-card",
  card: "bg-card border border-line rounded-card",
};

/**
 * Every enclosed region in the app is a Surface. Elevation is expressed as
 * lightness first; `floating` adds shadow only for things that overlay content.
 */
export function Surface({
  as: Tag = "div",
  level = "panel",
  floating = false,
  className,
  ...props
}: ComponentProps<"div"> & {
  as?: ElementType;
  level?: Level;
  floating?: boolean;
}) {
  return (
    <Tag
      className={cn(levels[level], floating && "shadow-panel", className)}
      {...props}
    />
  );
}

export function SurfaceHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-line px-4 py-3",
        className,
      )}
      {...props}
    />
  );
}

export function SurfaceBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-4", className)} {...props} />;
}

/** Small all-caps label that titles a group of controls. */
export function SectionLabel({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "text-micro font-medium uppercase tracking-wider text-ink-faint",
        className,
      )}
      {...props}
    />
  );
}
