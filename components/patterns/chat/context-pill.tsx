"use client";

import { ArrowUpRight, Plus, Search, X } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchInput } from "@/components/ui/input";
import { Popover } from "@/components/ui/popover";
import { cn } from "@/lib/cn";

import type { ContextItem, ContextSource } from "./types";

/**
 * One attachable source of grounding, shown in the row beneath the composer.
 *
 * Deliberately a different shape from Chip: a Chip filters a list, a pill
 * changes what the model knows. Rest state is an outline with a plus; once
 * something is attached it fills and shows the count, and the clear affordance
 * appears on hover so the row stays quiet.
 */
export function ContextPill({
  icon,
  label,
  count = 0,
  onClear,
  className,
  ...props
}: {
  icon: ReactNode;
  label: string;
  count?: number;
  onClear?: () => void;
  className?: string;
  onClick?: () => void;
  "aria-expanded"?: boolean;
}) {
  const attached = count > 0;
  return (
    <span className={cn("group/pill relative inline-flex", className)}>
      <button
        type="button"
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-full pr-3 pl-2.5 text-ui whitespace-nowrap",
          "transition-colors duration-150 ease-out-quart outline-none",
          "focus-visible:ring-2 focus-visible:ring-ink/25",
          attached
            ? "bg-raised text-ink hover:bg-line-strong"
            : "text-ink-secondary ring-1 ring-inset ring-line-strong hover:bg-[var(--state-hover)] hover:text-ink",
          attached && onClear && "group-hover/pill:pr-7",
        )}
        {...props}
      >
        <span className="[&>svg]:size-3.5">{icon}</span>
        <span>{label}</span>
        {attached ? (
          <span className="text-ink-secondary">{count}</span>
        ) : (
          <Plus className="size-3 text-ink-disabled" />
        )}
      </button>
      {attached && onClear ? (
        <button
          type="button"
          aria-label={`Clear ${label}`}
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className={cn(
            "absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center rounded-full",
            "text-ink-secondary opacity-0 transition-opacity duration-100 hover:bg-line-strong hover:text-ink",
            "group-hover/pill:opacity-100 focus-visible:opacity-100",
          )}
        >
          <X className="size-3" />
        </button>
      ) : null}
    </span>
  );
}

/**
 * The panel a pill opens. Search, a checklist, and a way out to the library —
 * enough to attach the right two personas without leaving the conversation,
 * and no more. Anything heavier (creating a persona) belongs on its own page.
 */
export function ContextPickerPanel({
  source,
  onChange,
  onClose,
  autoFocus = false,
  className,
}: {
  source: ContextSource;
  onChange: (selected: string[]) => void;
  onClose?: () => void;
  /** Only when opened from a pill — a focused field in static documentation scrolls the page. */
  autoFocus?: boolean;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return source.items;
    return source.items.filter(
      (i) => i.label.toLowerCase().includes(q) || i.detail?.toLowerCase().includes(q),
    );
  }, [query, source.items]);

  const toggle = (item: ContextItem) => {
    const has = source.selected.includes(item.id);
    onChange(has ? source.selected.filter((id) => id !== item.id) : [...source.selected, item.id]);
  };
  const allSelected = source.items.length > 0 && source.selected.length === source.items.length;

  return (
    <div className={cn("flex w-[340px] flex-col", className)}>
      <div className="p-2 pb-1">
        <SearchInput
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${source.label.toLowerCase()}`}
          leading={<Search />}
          className="h-9 bg-field"
        />
      </div>

      <div className="flex items-center justify-between px-3.5 pt-2 pb-1">
        <span className="text-cap text-ink-disabled">
          {source.selected.length ? `${source.selected.length} attached` : "None attached"}
        </span>
        <button
          type="button"
          className="text-cap text-ink-secondary hover:text-ink"
          onClick={() => onChange(allSelected ? [] : source.items.map((i) => i.id))}
        >
          {allSelected ? "Clear all" : "Attach all"}
        </button>
      </div>

      <ul className="max-h-[280px] overflow-y-auto px-1.5 pb-1.5">
        {items.map((item) => {
          const checked = source.selected.includes(item.id);
          return (
            <li key={item.id}>
              {/* The checkbox is the focusable control; the row widens its hit area. */}
              <div
                onClick={() => toggle(item)}
                className={cn(
                  "flex w-full cursor-pointer items-start gap-3 rounded-[10px] px-2.5 py-2 text-left",
                  "transition-colors duration-100 hover:bg-[var(--state-hover)] focus-within:bg-[var(--state-hover)]",
                )}
              >
                <Checkbox checked={checked} onCheckedChange={() => toggle(item)} className="mt-0.5" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-default text-ink">{item.label}</span>
                  {item.detail ? (
                    <span className="truncate text-cap text-ink-secondary">{item.detail}</span>
                  ) : null}
                </span>
              </div>
            </li>
          );
        })}
        {items.length === 0 ? (
          <li className="px-2.5 py-6 text-center text-cap text-ink-disabled">
            Nothing matches &ldquo;{query}&rdquo;
          </li>
        ) : null}
      </ul>

      <div className="flex items-center justify-between gap-2 border-t border-line px-2 py-2">
        <Button variant="ghost" size="sm" className="text-ink-secondary">
          Open {source.label.toLowerCase()} <ArrowUpRight />
        </Button>
        <Button variant="primary" size="sm" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}

/** Pill plus picker, wired together. The composer renders one of these per source. */
export function ContextAttachment({
  source,
  onChange,
}: {
  source: ContextSource;
  onChange: (selected: string[]) => void;
}) {
  const Icon = source.icon;
  return (
    <Popover
      side="top"
      trigger={(props) => (
        <ContextPill
          icon={<Icon />}
          label={source.label}
          count={source.selected.length}
          onClear={() => onChange([])}
          {...props}
        />
      )}
    >
      {(close) => <ContextPickerPanel source={source} onChange={onChange} onClose={close} autoFocus />}
    </Popover>
  );
}
