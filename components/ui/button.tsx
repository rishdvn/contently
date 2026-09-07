import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "spectrum" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-control font-medium whitespace-nowrap " +
  "transition-colors duration-150 ease-out-quart outline-none " +
  "[&_svg]:shrink-0 " +
  "focus-visible:ring-2 focus-visible:ring-ink/25 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas " +
  "disabled:pointer-events-none disabled:text-ink-disabled";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-canvas hover:bg-white disabled:bg-selected",
  /*
    The gradient stroke is the app's only chromatic mark. Reserve it for the
    single action on a surface where the model does work on the user's behalf.
    More than one on screen and it stops meaning anything.
  */
  spectrum: "spectrum-edge text-ink hover:bg-raised",
  secondary: "bg-raised text-ink hover:bg-hover disabled:bg-panel",
  ghost: "bg-transparent text-ink-secondary hover:bg-raised hover:text-ink",
  danger: "bg-raised text-critical hover:bg-critical hover:text-canvas",
};

const sizes: Record<Size, string> = {
  sm: "h-7 px-2.5 text-xs [&_svg]:size-3.5",
  md: "h-8 px-3 text-sm [&_svg]:size-4",
  lg: "h-9.5 px-4 text-base [&_svg]:size-4",
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

/** Square variant for icon-only actions. Always pair with an accessible label. */
export function IconButton({
  variant = "ghost",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  const square = { sm: "size-7", md: "size-8", lg: "size-9.5" }[size];
  return (
    <button
      className={cn(base, variants[variant], sizes[size], "px-0", square, className)}
      {...props}
    />
  );
}
