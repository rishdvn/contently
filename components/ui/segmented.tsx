"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Switch between two to four views of the same thing — Board / List, Month /
 * Week. Always one selected, always all visible; if the options don't fit in a
 * row they are a Select, not a segmented control.
 */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  size = "md",
  className,
}: {
  value: T;
  options: { value: T; label: ReactNode; icon?: ReactNode }[];
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-control bg-field p-0.5",
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[8px] whitespace-nowrap outline-none",
              "transition-colors duration-150 ease-out-quart focus-visible:ring-2 focus-visible:ring-ink/25",
              size === "sm" ? "h-7 px-2.5 text-cap [&>svg]:size-3.5" : "h-8 px-3 text-ui [&>svg]:size-4",
              active ? "bg-raised text-ink" : "text-ink-secondary hover:text-ink",
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
