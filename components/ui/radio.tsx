"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * One of a few, all visible, with room for a line of explanation under each.
 * If the options are short labels use SegmentedControl; if there are many use
 * Select. Radios are for the choice that deserves a sentence.
 */
export function RadioGroup<T extends string>({
  value,
  options,
  onChange,
  name,
  className,
}: {
  value: T;
  options: { value: T; label: ReactNode; description?: ReactNode; disabled?: boolean }[];
  onChange: (value: T) => void;
  name?: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" className={cn("flex flex-col gap-1", className)}>
      {options.map((o) => {
        const checked = o.value === value;
        return (
          <label
            key={o.value}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-control px-2.5 py-2 transition-colors hover:bg-[var(--state-hover)]",
              o.disabled && "pointer-events-none opacity-50",
            )}
          >
            <input
              type="radio"
              name={name}
              checked={checked}
              disabled={o.disabled}
              onChange={() => onChange(o.value)}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className={cn(
                "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full transition-colors",
                "peer-focus-visible:ring-2 peer-focus-visible:ring-ink/25 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-canvas",
                checked ? "bg-ink" : "bg-field ring-1 ring-inset ring-line-strong",
              )}
            >
              {checked ? <span className="size-1.5 rounded-full bg-canvas" /> : null}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-default text-ink">{o.label}</span>
              {o.description ? <span className="text-cap text-ink-secondary">{o.description}</span> : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}
