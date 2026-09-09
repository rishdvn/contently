"use client";

import { Search } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Dialog } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

export type Command = {
  id: string;
  label: string;
  group: string;
  icon?: ReactNode;
  hint?: string;
  shortcut?: string;
  onSelect: () => void;
};

/**
 * ⌘K. One field, grouped results, arrow keys, Enter. Built on Dialog so the
 * page is inert underneath; sized `sm` and pinned near the top so it feels like
 * a command line rather than a modal. Filtering is a plain substring match on
 * label and group — anything cleverer belongs in the caller's `commands`.
 */
export function CommandPalette({
  open,
  onClose,
  commands,
  placeholder = "Type a command or search…",
}: {
  open: boolean;
  onClose: () => void;
  commands: Command[];
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const hits = needle
      ? commands.filter((c) => `${c.group} ${c.label}`.toLowerCase().includes(needle))
      : commands;
    const groups = new Map<string, Command[]>();
    for (const c of hits) groups.set(c.group, [...(groups.get(c.group) ?? []), c]);
    return { flat: hits, groups: [...groups.entries()] };
  }, [q, commands]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${cursor}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  /* Reset on every dismissal so the next open starts clean. */
  const close = () => {
    onClose();
    setQ("");
    setCursor(0);
  };

  const run = (c: Command | undefined) => {
    if (!c) return;
    close();
    c.onSelect();
  };

  return (
    <Dialog open={open} onClose={close} size="md" className="mt-[12vh] mb-auto w-[560px]">
      <div className="flex items-center gap-2.5 border-b border-line px-4">
        <Search className="size-4 shrink-0 text-ink-secondary" />
        <input
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setCursor(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setCursor((c) => Math.min(results.flat.length - 1, c + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setCursor((c) => Math.max(0, c - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              run(results.flat[cursor]);
            }
          }}
          placeholder={placeholder}
          className="h-12 flex-1 bg-transparent text-panels text-ink outline-none placeholder:text-ink/40"
        />
        <Kbd>esc</Kbd>
      </div>
      <ul ref={listRef} role="listbox" className="max-h-[360px] overflow-y-auto p-2">
        {results.flat.length === 0 ? (
          <li className="px-3 py-8 text-center text-default text-ink-secondary">No matches for “{q}”.</li>
        ) : null}
        {results.groups.map(([group, items]) => (
          <li key={group} className="pb-1.5">
            <div className="px-2.5 pt-2 pb-1 text-cap text-ink-disabled">{group}</div>
            <ul>
              {items.map((c) => {
                const index = results.flat.indexOf(c);
                const active = index === cursor;
                return (
                  <li key={c.id} data-index={index}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setCursor(index)}
                      onClick={() => run(c)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-default text-ink outline-none",
                        active && "bg-[var(--state-hover)]",
                      )}
                    >
                      {c.icon ? <span className="shrink-0 text-ink-secondary [&>svg]:size-4">{c.icon}</span> : null}
                      <span className="min-w-0 flex-1 truncate">{c.label}</span>
                      {c.hint ? <span className="truncate text-cap text-ink-disabled">{c.hint}</span> : null}
                      {c.shortcut ? <Kbd>{c.shortcut}</Kbd> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
