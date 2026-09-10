"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useState } from "react";

import { IconButton } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import { cn } from "@/lib/cn";

/* Date helpers, local time, Monday-first weeks. */
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** The 42 cells of a month view, starting on the Monday on or before the 1st. */
export function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

export function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * A month of days. Used bare inside the Calendar surface and inside the
 * DatePicker popover, so the two can never disagree about what a month looks
 * like. Today is marked with a raised fill; the selection inverts to ink.
 */
export function MonthGrid({
  year,
  month,
  selected,
  onSelect,
  today = new Date(),
  disabledBefore,
  className,
}: {
  year: number;
  month: number;
  selected?: Date | null;
  onSelect?: (d: Date) => void;
  today?: Date;
  disabledBefore?: Date;
  className?: string;
}) {
  const days = monthGrid(year, month);
  return (
    <div className={cn("grid grid-cols-7 gap-0.5", className)}>
      {WEEKDAYS.map((w) => (
        <div key={w} className="pb-1 text-center text-tiny text-ink-disabled">
          {w[0]}
        </div>
      ))}
      {days.map((d) => {
        const inMonth = d.getMonth() === month;
        const isToday = sameDay(d, today);
        const isSel = selected ? sameDay(d, selected) : false;
        const disabled = disabledBefore ? d < disabledBefore && !sameDay(d, disabledBefore) : false;
        return (
          <button
            key={d.toISOString()}
            type="button"
            disabled={disabled}
            onClick={() => onSelect?.(d)}
            aria-pressed={isSel}
            className={cn(
              "flex size-8 items-center justify-center rounded-[8px] text-cap tabular-nums outline-none",
              "transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-ink/25",
              isSel
                ? "bg-ink text-canvas"
                : isToday
                  ? "bg-raised text-ink"
                  : inMonth
                    ? "text-ink hover:bg-[var(--state-hover)]"
                    : "text-ink-disabled hover:bg-[var(--state-hover)]",
              disabled && "pointer-events-none opacity-30",
            )}
          >
            {d.getDate()}
          </button>
        );
      })}
    </div>
  );
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabledBefore,
  className,
}: {
  value: Date | null;
  onChange: (d: Date) => void;
  placeholder?: string;
  disabledBefore?: Date;
  className?: string;
}) {
  const base = value ?? new Date();
  const [view, setView] = useState({ y: base.getFullYear(), m: base.getMonth() });
  const label = new Date(view.y, view.m, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const step = (n: number) => {
    const d = new Date(view.y, view.m + n, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };

  return (
    <Popover
      trigger={(props) => (
        <button
          type="button"
          className={cn(
            "inline-flex h-9.5 items-center gap-2 rounded-control bg-field px-3 text-default text-ink outline-none",
            "border border-transparent transition-colors hover:border-line-strong aria-expanded:border-line-strong",
            "focus-visible:ring-2 focus-visible:ring-ink/25",
            className,
          )}
          {...props}
        >
          <CalendarDays className="size-4 text-ink-secondary" />
          <span className={cn(!value && "text-ink/50")}>{value ? formatDate(value) : placeholder}</span>
        </button>
      )}
    >
      {(close) => (
        <div className="w-[264px] p-3">
          <div className="flex items-center justify-between pb-2">
            <IconButton aria-label="Previous month" size="sm" onClick={() => step(-1)}>
              <ChevronLeft />
            </IconButton>
            <span className="text-ui text-ink">{label}</span>
            <IconButton aria-label="Next month" size="sm" onClick={() => step(1)}>
              <ChevronRight />
            </IconButton>
          </div>
          <MonthGrid
            year={view.y}
            month={view.m}
            selected={value}
            disabledBefore={disabledBefore}
            onSelect={(d) => {
              onChange(d);
              close();
            }}
          />
        </div>
      )}
    </Popover>
  );
}

/** Quarter-hour slots in a scrolling list — the smallest thing that is still a picker. */
export function TimePicker({
  value,
  onChange,
  className,
}: {
  value: string | null;
  onChange: (hhmm: string) => void;
  className?: string;
}) {
  const slots = Array.from({ length: 24 * 4 }, (_, i) => {
    const h = Math.floor(i / 4);
    const m = (i % 4) * 15;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  });
  return (
    <Popover
      trigger={(props) => (
        <button
          type="button"
          className={cn(
            "inline-flex h-9.5 items-center gap-2 rounded-control bg-field px-3 text-default text-ink outline-none",
            "border border-transparent transition-colors hover:border-line-strong aria-expanded:border-line-strong",
            "focus-visible:ring-2 focus-visible:ring-ink/25",
            className,
          )}
          {...props}
        >
          <Clock className="size-4 text-ink-secondary" />
          <span className={cn("tabular-nums", !value && "text-ink/50")}>{value ?? "Time"}</span>
        </button>
      )}
    >
      {(close) => (
        <ul className="max-h-[240px] w-[120px] overflow-y-auto p-1.5">
          {slots.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => {
                  onChange(s);
                  close();
                }}
                className={cn(
                  "w-full rounded-[8px] px-2.5 py-1.5 text-left text-default tabular-nums outline-none",
                  "hover:bg-[var(--state-hover)] focus-visible:bg-[var(--state-hover)]",
                  s === value ? "bg-[var(--state-selected)] text-ink" : "text-ink-secondary",
                )}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Popover>
  );
}
