"use client";

import { Minus, Plus } from "lucide-react";

import { IconButton } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/** Small integer with a hard range — slide count, variants per brief. */
export function Stepper({
  value,
  onChange,
  min = 1,
  max = 99,
  label,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex items-center gap-1 rounded-control bg-field p-0.5", className)} aria-label={label}>
      <IconButton aria-label="Decrease" size="sm" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        <Minus />
      </IconButton>
      <span className="min-w-8 text-center font-mono text-default text-ink tabular-nums">{value}</span>
      <IconButton aria-label="Increase" size="sm" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
        <Plus />
      </IconButton>
    </div>
  );
}
