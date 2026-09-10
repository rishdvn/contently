"use client";

import { ArrowUpRight, Check } from "lucide-react";

import { Kbd } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

import type { ContextItem, ContextSource } from "./types";

export type MentionHit = { source: ContextSource; item: ContextItem };

/** Everything that matches, grouped by source, in source order. Empty query lists the first few of each. */
export function mentionHits(sources: ContextSource[], query: string, perGroup = 4): MentionHit[] {
  const q = query.trim().toLowerCase();
  return sources.flatMap((source) => {
    const items = q
      ? source.items.filter((i) => i.label.toLowerCase().includes(q) || i.detail?.toLowerCase().includes(q))
      : source.items.slice(0, perGroup);
    return items.map((item) => ({ source, item }));
  });
}

/**
 * The dropdown that `@` opens in the composer.
 *
 * One flat, keyboard-walkable list grouped under the document types, so the
 * user sees what kinds of thing exist while typing the name of one. Items
 * already attached show a check rather than disappearing, because the list
 * is also how the user confirms what the model can see. Picking attaches;
 * it never sends.
 */
export function MentionMenu({
  hits,
  query,
  activeIndex,
  attached,
  onPick,
  onHover,
  onBrowse,
  className,
}: {
  hits: MentionHit[];
  query: string;
  activeIndex: number;
  /** ids already attached to the conversation. */
  attached: string[];
  onPick: (hit: MentionHit) => void;
  onHover?: (index: number) => void;
  onBrowse?: () => void;
  className?: string;
}) {
  return (
    <div
      role="listbox"
      aria-label="Mention a document"
      className={cn("flex w-[380px] flex-col overflow-hidden rounded-[var(--radius-overlay)] bg-panel shadow-overlay", className)}
    >
      <div className="max-h-[320px] overflow-y-auto p-1.5">
        {hits.length === 0 ? (
          <p className="px-3 py-6 text-center text-cap text-ink-disabled">
            No documents match &ldquo;{query}&rdquo;
          </p>
        ) : null}
        {hits.map((hit, i) => {
          const header = i === 0 || hits[i - 1].source.kind !== hit.source.kind;
          const Icon = hit.source.icon;
          const isAttached = attached.includes(hit.item.id);
          return (
            <div key={`${hit.source.kind}:${hit.item.id}`}>
              {header ? (
                <div className={cn("px-2.5 pb-1 text-tiny text-ink-disabled", i === 0 ? "pt-1.5" : "pt-3")}>
                  {hit.source.label}
                </div>
              ) : null}
              <button
                type="button"
                role="option"
                aria-selected={i === activeIndex}
                onMouseEnter={() => onHover?.(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onPick(hit)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 text-left outline-none",
                  "transition-colors duration-75",
                  i === activeIndex ? "bg-[var(--state-hover)]" : "",
                )}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-raised text-ink [&>svg]:size-3.5">
                  <Icon />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-default text-ink">{hit.item.label}</span>
                  {hit.item.detail ? (
                    <span className="truncate text-cap leading-4 text-ink-secondary">{hit.item.detail}</span>
                  ) : null}
                </span>
                {isAttached ? <Check className="size-3.5 shrink-0 text-ink-secondary" /> : null}
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2">
        <span className="flex items-center gap-1 text-tiny text-ink-disabled">
          <Kbd className="h-4 min-w-4 px-1 text-[10px]">↑↓</Kbd> move
          <Kbd className="ml-1.5 h-4 min-w-4 px-1 text-[10px]">⏎</Kbd> attach
        </span>
        {onBrowse ? (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onBrowse}
            className="inline-flex items-center gap-1 text-cap text-ink-secondary hover:text-ink"
          >
            All documents <ArrowUpRight className="size-3" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
