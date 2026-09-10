"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Section switcher for one object — Persona / Angles / Briefs on a detail
 * page, Shell / Browser / Planner in a workspace. Underline, not pill: the
 * selected tab is a 2px ink rule under text-sized labels. Use SegmentedControl
 * when the options are views of the *same* data; tabs are different data.
 */
export function TabBar<T extends string>({
  value,
  tabs,
  onChange,
  className,
}: {
  value: T;
  tabs: { value: T; label: ReactNode; count?: number; icon?: ReactNode }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("flex items-center gap-1 border-b border-line", className)}>
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              "relative -mb-px inline-flex h-9 items-center gap-1.5 px-2.5 text-ui whitespace-nowrap outline-none",
              "transition-colors duration-150 ease-out-quart focus-visible:rounded-[6px] focus-visible:ring-2 focus-visible:ring-ink/25",
              active ? "text-ink" : "text-ink-secondary hover:text-ink",
              "[&>svg]:size-3.5",
            )}
          >
            {t.icon}
            {t.label}
            {typeof t.count === "number" ? (
              <span className={cn("rounded-full px-1.5 text-tiny tabular-nums", active ? "bg-raised text-ink" : "bg-field text-ink-secondary")}>
                {t.count}
              </span>
            ) : null}
            <span className={cn("absolute inset-x-2.5 bottom-0 h-0.5 rounded-full bg-ink transition-opacity", active ? "opacity-100" : "opacity-0")} />
          </button>
        );
      })}
    </div>
  );
}
