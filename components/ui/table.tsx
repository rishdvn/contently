import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Dense, scannable rows of like objects — the list view of the Board, the
 * schedule queue. Head cells are caps-sized and secondary; body rows separate
 * with hairlines, not fills, and lift on hover so a row reads as a target.
 */
export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="w-full overflow-x-auto rounded-nav bg-card">
      <table className={cn("w-full border-collapse text-default text-ink", className)} {...props} />
    </div>
  );
}

export function TableHead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-line">{children}</tr>
    </thead>
  );
}

export function Th({ className, align = "left", ...props }: ComponentProps<"th"> & { align?: "left" | "right" }) {
  return (
    <th
      className={cn(
        "h-9 px-3 text-cap font-normal whitespace-nowrap text-ink-secondary",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
      {...props}
    />
  );
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function Tr({ className, selected, ...props }: ComponentProps<"tr"> & { selected?: boolean }) {
  return (
    <tr
      aria-selected={selected}
      className={cn(
        "border-b border-line last:border-b-0 transition-colors duration-100",
        props.onClick && "cursor-pointer hover:bg-[var(--state-hover)]",
        selected && "bg-[var(--state-selected)]",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, align = "left", muted, ...props }: ComponentProps<"td"> & { align?: "left" | "right"; muted?: boolean }) {
  return (
    <td
      className={cn(
        "h-11 px-3 align-middle",
        align === "right" ? "text-right tabular-nums" : "text-left",
        muted && "text-ink-secondary",
        className,
      )}
      {...props}
    />
  );
}
