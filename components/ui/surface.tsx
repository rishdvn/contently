import type { ComponentProps, ElementType } from "react";
import { cn } from "@/lib/cn";

type Level = "panel" | "card" | "raised";

const levels: Record<Level, string> = {
  panel: "bg-panel rounded-nav",
  card: "bg-card rounded-card",
  raised: "bg-raised rounded-control",
};

/**
 * Every enclosed region is a Surface. Elevation is expressed as lightness;
 * `floating` adds shadow only for things that overlay content.
 *
 * Note there are no borders by default — the reference separates surfaces by
 * value alone, and adding hairlines everywhere makes the UI look boxed in.
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
      className={cn(levels[level], floating && "shadow-overlay", className)}
      {...props}
    />
  );
}

export function SurfaceHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center justify-between gap-3 px-5 pt-4 pb-3", className)}
      {...props}
    />
  );
}

export function SurfaceBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("px-5 pb-5", className)} {...props} />;
}

/** Small label that titles a group of controls. */
export function SectionLabel({ className, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("text-cap text-ink-disabled", className)} {...props} />
  );
}
