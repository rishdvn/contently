"use client";

import { Check, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { Menu, MenuItem, MenuLabel } from "@/components/ui/menu";
import { cn } from "@/lib/cn";

export type SelectOption<T extends string = string> = {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  detail?: string;
};

/**
 * Pick one of a few. Built on Menu, so it closes on choice and never traps
 * focus. Two looks: `field` for forms (input height, field fill) and `inline`
 * for toolbars and the composer bar (ghost, text-sized), which is the Cursor
 * mode/model-picker idiom.
 */
export function Select<T extends string>({
  value,
  options,
  onChange,
  label,
  placeholder = "Choose…",
  variant = "field",
  size = "md",
  align = "start",
  className,
}: {
  value: T | null;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  /** Optional heading inside the menu. */
  label?: string;
  placeholder?: string;
  variant?: "field" | "inline";
  size?: "sm" | "md";
  align?: "start" | "end";
  className?: string;
}) {
  const current = options.find((o) => o.value === value) ?? null;

  const trigger = cn(
    "inline-flex items-center gap-2 whitespace-nowrap outline-none transition-colors duration-150 ease-out-quart",
    "focus-visible:ring-2 focus-visible:ring-ink/25",
    variant === "field"
      ? cn(
          "w-full justify-between rounded-control bg-field text-ink",
          "border border-transparent hover:border-line-strong aria-expanded:border-line-strong",
          size === "sm" ? "h-8 px-2.5 text-cap" : "h-9.5 px-3 text-default",
        )
      : cn(
          "rounded-[8px] text-ink-secondary hover:bg-[var(--state-hover)] hover:text-ink aria-expanded:bg-[var(--state-hover)] aria-expanded:text-ink",
          size === "sm" ? "h-7 px-2 text-cap" : "h-8 px-2.5 text-ui",
        ),
    className,
  );

  return (
    <Menu
      align={align}
      trigger={(props) => (
        <button type="button" className={trigger} {...props}>
          {current?.icon ? <span className="[&>svg]:size-3.5">{current.icon}</span> : null}
          <span className={cn("truncate", !current && "text-ink/50")}>{current ? current.label : placeholder}</span>
          <ChevronDown className="size-3.5 shrink-0 text-ink-disabled" />
        </button>
      )}
    >
      {label ? <MenuLabel>{label}</MenuLabel> : null}
      {options.map((o) => (
        <MenuItem
          key={o.value}
          icon={o.icon}
          onClick={() => onChange(o.value)}
          trailing={o.value === value ? <Check className="text-ink" /> : <span className="block size-3.5" />}
        >
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{o.label}</span>
            {o.detail ? <span className="truncate text-cap text-ink-disabled">{o.detail}</span> : null}
          </span>
        </MenuItem>
      ))}
    </Menu>
  );
}
