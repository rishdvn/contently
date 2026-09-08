"use client";

import { ChevronRight, CornerDownLeft, Zap } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/badge";
import { Popover } from "@/components/ui/popover";
import { cn } from "@/lib/cn";

import type { Prompt, PromptGroup } from "./types";

/**
 * A two-pane browser for saved prompts. Groups on the left switch on hover, so
 * the whole library can be scanned with one horizontal sweep; the prompt under
 * the pointer prints its full text in the preview band, so the user reads what
 * will be sent before committing. Choosing one fills the composer — it never
 * sends on its own.
 */
export function QuickPromptsPanel({
  groups,
  onPick,
  className,
}: {
  groups: PromptGroup[];
  onPick: (prompt: Prompt) => void;
  className?: string;
}) {
  const [groupIndex, setGroupIndex] = useState(0);
  const [hovered, setHovered] = useState<Prompt | null>(null);
  const group = groups[groupIndex];
  const preview = hovered ?? group?.prompts[0] ?? null;

  return (
    <div className={cn("flex w-[560px] flex-col", className)}>
      <div className="flex">
        <ul className="w-[176px] shrink-0 border-r border-line p-1.5">
          {groups.map((g, i) => {
            const Icon = g.icon;
            const active = i === groupIndex;
            return (
              <li key={g.label}>
                <button
                  type="button"
                  onMouseEnter={() => {
                    setGroupIndex(i);
                    setHovered(null);
                  }}
                  onFocus={() => setGroupIndex(i)}
                  onClick={() => setGroupIndex(i)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-default outline-none",
                    "transition-colors duration-100",
                    active ? "bg-[var(--state-selected)] text-ink" : "text-ink-secondary hover:text-ink",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{g.label}</span>
                  <span className="text-tiny text-ink-disabled">{g.prompts.length}</span>
                  {active ? <ChevronRight className="size-3.5 text-ink-disabled" /> : null}
                </button>
              </li>
            );
          })}
        </ul>

        <ul className="min-w-0 flex-1 p-1.5" onMouseLeave={() => setHovered(null)}>
          {group?.prompts.map((p) => (
            <li key={p.title}>
              <button
                type="button"
                onMouseEnter={() => setHovered(p)}
                onFocus={() => setHovered(p)}
                onClick={() => onPick(p)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-default text-ink outline-none",
                  "transition-colors duration-100 hover:bg-[var(--state-hover)] focus-visible:bg-[var(--state-hover)]",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{p.title}</span>
                <CornerDownLeft className="size-3.5 shrink-0 text-ink-disabled opacity-0 transition-opacity [li:hover_&]:opacity-100" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-line px-4 py-3">
        <p className="line-clamp-3 min-h-[3lh] text-cap leading-4 text-ink-secondary">
          {preview ? preview.text : "Hover a prompt to preview it."}
        </p>
      </div>
    </div>
  );
}

/** Trigger plus panel: the lightning button in the composer's bottom bar. */
export function QuickPrompts({
  groups,
  onPick,
}: {
  groups: PromptGroup[];
  onPick: (prompt: Prompt) => void;
}) {
  return (
    <Popover
      side="top"
      trigger={(props) => (
        <Button variant="ghost" size="sm" className="text-ink-secondary" {...props}>
          <Zap /> Prompts <Kbd className="ml-0.5 h-4 min-w-4 px-1 text-[10px]">/</Kbd>
        </Button>
      )}
    >
      {(close) => (
        <QuickPromptsPanel
          groups={groups}
          onPick={(p) => {
            onPick(p);
            close();
          }}
        />
      )}
    </Popover>
  );
}
