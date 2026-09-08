import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "spectrum" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-control whitespace-nowrap " +
  "transition-colors duration-150 ease-out-quart outline-none " +
  "[&_svg]:shrink-0 " +
  "focus-visible:ring-2 focus-visible:ring-ink/25 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas " +
  "disabled:pointer-events-none disabled:text-ink-disabled";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-canvas hover:bg-white disabled:bg-raised",
  /*
    The gradient ring is the app's only chromatic mark. Reserve it for the
    single action on a surface where the model does work on the user's behalf.
    More than one on screen and it stops meaning anything.
  */
  spectrum: "spectrum-edge text-ink hover:bg-card",
  secondary: "bg-card text-ink hover:bg-raised disabled:bg-panel",
  ghost: "bg-transparent text-ink-secondary hover:bg-card hover:text-ink",
  danger: "bg-card text-critical hover:bg-critical hover:text-canvas",
};

/* Heights and padding follow the reference: 38px at rest, 48px for the page-level action. */
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-cap [&_svg]:size-3.5",
  md: "h-9.5 px-4 text-default [&_svg]:size-4",
  lg: "h-12 px-5 text-panels [&_svg]:size-[18px]",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
}

/** Circular, matching the reference's icon buttons. Always pair with a label. */
export function IconButton({
  variant = "ghost",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  const square = { sm: "size-8", md: "size-9.5", lg: "size-12" }[size];
  return (
    <button
      className={cn(
        base,
        variants[variant],
        sizes[size],
        "rounded-full px-0",
        square,
        className,
      )}
      {...props}
    />
  );
}
