import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Names an unlabelled control. It must never carry information that is not
 * available elsewhere — it is unreachable by touch and by keyboard-only users,
 * so anything essential belongs in the interface itself.
 *
 * CSS-only on purpose: no state, no listeners, and it cannot get stuck open.
 */
export function Tooltip({
  label,
  side = "top",
  children,
  className,
}: {
  label: string;
  side?: "top" | "bottom" | "left" | "right";
  children: ReactNode;
  className?: string;
}) {
  const placement = {
    top: "bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2",
    bottom: "top-[calc(100%+6px)] left-1/2 -translate-x-1/2",
    left: "right-[calc(100%+6px)] top-1/2 -translate-y-1/2",
    right: "left-[calc(100%+6px)] top-1/2 -translate-y-1/2",
  }[side];

  return (
    <span className={cn("group/tt relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute whitespace-nowrap rounded-[8px] px-2 py-1 text-cap text-ink",
          "bg-tooltip opacity-0 transition-opacity duration-100 ease-out-quart",
          "group-hover/tt:opacity-100 group-focus-within/tt:opacity-100",
          placement,
        )}
        style={{ zIndex: "var(--z-tooltip)" }}
      >
        {label}
      </span>
    </span>
  );
}
