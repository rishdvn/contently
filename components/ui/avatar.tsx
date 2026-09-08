import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

type Size = "xs" | "sm" | "md" | "lg";

const sizes: Record<Size, string> = {
  xs: "size-5 text-[9px]",
  sm: "size-6 text-tiny",
  md: "size-8 text-cap",
  lg: "size-10 text-default",
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * A person or a workspace. Falls back to initials on a raised fill rather than
 * to a coloured tile, so a list of avatars never becomes a colour palette.
 * `shape="square"` is for workspaces and brands; people are round.
 */
export function Avatar({
  name,
  src,
  size = "md",
  shape = "round",
  className,
  ...props
}: ComponentProps<"span"> & {
  name: string;
  src?: string;
  size?: Size;
  shape?: "round" | "square";
}) {
  return (
    <span
      role="img"
      aria-label={name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden bg-raised text-ink-secondary select-none",
        shape === "round" ? "rounded-full" : "rounded-[8px]",
        sizes[size],
        className,
      )}
      {...props}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

/**
 * The model's identity in the interface: an empty spectrum ring. It is the one
 * place the gradient is allowed to be persistent, because it names who is
 * speaking. `active` breathes while a response is streaming.
 */
export function AgentMark({
  size = "md",
  active = false,
  className,
}: {
  size?: Size;
  active?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "spectrum-edge inline-flex shrink-0 items-center justify-center rounded-full",
        { xs: "size-5", sm: "size-6", md: "size-8", lg: "size-10" }[size],
        active && "animate-breathe",
        className,
      )}
    >
      <span
        className={cn(
          "rounded-full bg-ink",
          { xs: "size-1", sm: "size-1.5", md: "size-2", lg: "size-2.5" }[size],
        )}
        style={active ? { backgroundImage: "var(--gradient-spectrum-fill)" } : undefined}
      />
    </span>
  );
}
