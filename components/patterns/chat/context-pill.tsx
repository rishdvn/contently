"use client";

import { ArrowUpRight, Check, Plus, Search, Sparkles, X } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { SearchInput } from "@/components/ui/input";
import { cn } from "@/lib/cn";

import type { ContextItem, ContextSource } from "./types";

/* ------------------------------------------------------------------ */
/*  Pill                                                               */
/* ------------------------------------------------------------------ */

/**
 * One attachable source of grounding, shown in the row beneath the composer.
 *
 * Deliberately a different shape from Chip: a Chip filters a list, a pill
 * changes what the model knows. Rest state is an outline with a plus; once
 * something is attached it fills and shows the count, and the clear affordance
 * appears on hover so the row stays quiet. A pinned pill (Brand) is on by
 * default and shows a check instead of a count — it is a fact, not a choice.
 */
export function ContextPill({
  icon,
  label,
  count = 0,
  pinned = false,
  onClear,
  className,
  ...props
}: {
  icon: ReactNode;
  label: string;
  count?: number;
  pinned?: boolean;
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
          pinned ? (
            <Check className="size-3 text-ink-secondary" strokeWidth={2.5} />
          ) : (
            <span className="text-ink-secondary">{count}</span>
          )
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

/* ------------------------------------------------------------------ */
/*  Picker                                                             */
/* ------------------------------------------------------------------ */

/**
 * The body of a picker: search where the list is long enough to need it, an
 * optional suggestion from the agent, the items in the layout that suits them,
 * and a footer that says how many are attached. Rendered inside a Dialog by
 * ContextPickerDialog and inline on the design pages.
 *
 * Three layouts, chosen by the source:
 *   cards — a handful of things the user should recognise by face (personas)
 *   grid  — many visual things (assets)
 *   list  — everything else: a searchable checklist
 */
export function ContextPickerBody({
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
  const layout = source.layout ?? "list";
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
  const noun = source.label.toLowerCase();
  const count = source.selected.length;
  const suggested = source.suggested && source.items.find((i) => i.id === source.suggested!.id);

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      {layout !== "cards" ? (
        <div className="px-5 pb-3">
          <SearchInput
            autoFocus={autoFocus}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${noun}`}
            leading={<Search />}
            className="h-9 bg-field"
          />
        </div>
      ) : null}

      {suggested ? (
        <div className="mx-5 mb-3 flex items-start gap-3 rounded-control bg-card px-3.5 py-3">
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-raised [&>svg]:size-3.5">
            <Sparkles className="text-ink" />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-default text-ink">Suggested for this chat</span>
            <span className="text-cap leading-4 text-ink-secondary">
              {source.suggested!.reason} <span className="text-ink">{suggested.label}</span>.
            </span>
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2">
        {layout === "cards" ? (
          <div className="grid gap-2.5 sm:grid-cols-3">
            {items.map((item) => (
              <PersonaCard
                key={item.id}
                item={item}
                checked={source.selected.includes(item.id)}
                suggested={item.id === source.suggested?.id}
                onToggle={() => toggle(item)}
              />
            ))}
          </div>
        ) : layout === "grid" ? (
          <div className="grid grid-cols-4 gap-2.5">
            {items.map((item) => (
              <AssetTile
                key={item.id}
                item={item}
                checked={source.selected.includes(item.id)}
                onToggle={() => toggle(item)}
              />
            ))}
          </div>
        ) : (
          <ul className="-mx-2 flex flex-col">
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
                      <span className="flex items-center gap-2">
                        <span className="truncate text-default text-ink">{item.label}</span>
                        {item.id === source.suggested?.id ? <Badge dot={false}>Suggested</Badge> : null}
                      </span>
                      {item.detail ? <span className="truncate text-cap text-ink-secondary">{item.detail}</span> : null}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {items.length === 0 ? (
          <p className="px-2.5 py-8 text-center text-cap text-ink-disabled">Nothing matches &ldquo;{query}&rdquo;</p>
        ) : null}
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-line px-5 py-3">
        <span className="text-cap text-ink-secondary">
          {count === 0 ? `No ${noun} selected` : `${count} selected`}
        </span>
        <div className="flex items-center gap-2">
          {source.href ? (
            <Button variant="ghost" size="sm" className="text-ink-secondary">
              Open {noun} <ArrowUpRight />
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" disabled={count === 0} onClick={() => onChange([])}>
            Clear
          </Button>
          <Button variant="primary" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </footer>
    </div>
  );
}

/**
 * A persona as a face and a sentence. Selection is a ring on the card and a
 * check at the foot — the whole card is the target, because the reason to use
 * cards at all is that the user recognises the person before they read.
 */
function PersonaCard({
  item,
  checked,
  suggested,
  onToggle,
}: {
  item: ContextItem;
  checked: boolean;
  suggested: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={cn(
        "relative flex flex-col items-center gap-2 rounded-[var(--radius-overlay)] bg-card px-4 pt-6 pb-4 text-center outline-none",
        "transition-colors duration-150 ease-out-quart hover:bg-raised",
        "focus-visible:ring-2 focus-visible:ring-ink/25",
        checked && "ring-1 ring-ink/40",
      )}
    >
      {suggested ? (
        <Badge dot={false} className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-line-strong text-ink">
          Suggested
        </Badge>
      ) : null}
      <span
        className="size-14 rounded-full bg-raised"
        style={item.image ? { backgroundImage: item.image, backgroundSize: "cover" } : undefined}
      />
      <span className="pt-1 text-default text-ink">{item.label}</span>
      {item.detail ? <span className="text-tiny leading-4 text-ink-disabled">{item.detail}</span> : null}
      {item.description ? (
        <span className="line-clamp-5 pt-1 text-cap leading-4 text-ink-secondary">{item.description}</span>
      ) : null}
      <span className="flex-1" />
      <span
        className={cn(
          "mt-2 flex size-5 items-center justify-center rounded-full transition-colors duration-100",
          checked ? "bg-ink text-canvas" : "ring-1 ring-inset ring-line-strong",
        )}
      >
        {checked ? <Check className="size-3" strokeWidth={2.5} /> : null}
      </span>
    </button>
  );
}

/** An asset at 4:5 with the checkbox in the corner and the label beneath. */
function AssetTile({ item, checked, onToggle }: { item: ContextItem; checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={cn(
        "group/tile relative flex flex-col gap-1.5 rounded-control text-left outline-none",
        "focus-visible:ring-2 focus-visible:ring-ink/25",
      )}
    >
      <span
        className={cn(
          "relative aspect-[4/5] w-full overflow-hidden rounded-control bg-raised transition-shadow",
          checked && "ring-2 ring-ink/60",
        )}
        style={item.image ? { backgroundImage: item.image, backgroundSize: "cover" } : undefined}
      >
        <Checkbox
          checked={checked}
          onCheckedChange={onToggle}
          className={cn(
            "absolute top-2 right-2 bg-canvas/70 backdrop-blur",
            !checked && "opacity-0 group-hover/tile:opacity-100",
          )}
        />
      </span>
      <span className="truncate text-cap text-ink">{item.label}</span>
      {item.detail ? <span className="-mt-1 truncate text-tiny text-ink-disabled">{item.detail}</span> : null}
    </button>
  );
}

/**
 * The picker as a dialog, centred over the chat. A dialog rather than a
 * popover because choosing a persona deserves the room to see three at once,
 * and because it closes with a decision (Done), not a click-away.
 */
export function ContextPickerDialog({
  source,
  open,
  onClose,
  onChange,
}: {
  source: ContextSource;
  open: boolean;
  onClose: () => void;
  onChange: (selected: string[]) => void;
}) {
  const Icon = source.icon;
  return (
    <Dialog open={open} onClose={onClose} size="lg" className="max-h-[calc(100dvh-96px)]">
      <DialogHeader
        icon={
          <span className="flex size-9 items-center justify-center rounded-control bg-raised text-ink [&>svg]:size-4.5">
            <Icon />
          </span>
        }
        title={`Select ${source.label.toLowerCase()}`}
        onClose={onClose}
      />
      <ContextPickerBody source={source} onChange={onChange} onClose={onClose} autoFocus />
    </Dialog>
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
  const [open, setOpen] = useState(false);
  const Icon = source.icon;
  return (
    <>
      <ContextPill
        icon={<Icon />}
        label={source.label}
        count={source.selected.length}
        pinned={source.pinned}
        onClear={() => onChange([])}
        onClick={() => setOpen(true)}
        aria-expanded={open}
      />
      <ContextPickerDialog source={source} open={open} onClose={() => setOpen(false)} onChange={onChange} />
    </>
  );
}
