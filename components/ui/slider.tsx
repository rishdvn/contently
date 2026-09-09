"use client";

import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/**
 * Continuous value in the editor — opacity, scale, timing. A native range
 * input restyled, so keyboard, touch and screen readers come from the
 * platform. The filled track is ink, the thumb is ink, and the value reads out
 * to the right when a label is given: never rely on the thumb position alone.
 */
export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  format = (v) => String(v),
  className,
  disabled,
  ...props
}: Omit<ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  format?: (value: number) => string;
}) {
  const pct = ((value - Number(min)) / (Number(max) - Number(min))) * 100;
  return (
    <label className={cn("flex items-center gap-3", disabled && "opacity-50", className)}>
      {label ? <span className="w-20 shrink-0 text-cap text-ink-secondary">{label}</span> : null}
      <span className="relative flex h-5 flex-1 items-center">
        <span className="absolute inset-x-0 h-0.5 rounded-full bg-raised" />
        <span className="absolute left-0 h-0.5 rounded-full bg-ink" style={{ width: `${pct}%` }} />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className={cn(
            "relative z-10 h-5 w-full cursor-pointer appearance-none bg-transparent outline-none",
            "[&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-ink",
            "[&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110",
            "[&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-ink",
            "focus-visible:[&::-webkit-slider-thumb]:ring-2 focus-visible:[&::-webkit-slider-thumb]:ring-ink/25 focus-visible:[&::-webkit-slider-thumb]:ring-offset-2 focus-visible:[&::-webkit-slider-thumb]:ring-offset-canvas",
            "disabled:cursor-not-allowed",
          )}
          {...props}
        />
      </span>
      <span className="w-10 shrink-0 text-right font-mono text-cap text-ink-secondary tabular-nums">{format(value)}</span>
    </label>
  );
}
