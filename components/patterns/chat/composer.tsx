"use client";

import { ArrowUp, Square } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { useEffect, useRef } from "react";

import { Kbd } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * The one place the user talks to the model.
 *
 * One bordered panel, three rows — the idiom Cursor, Devin and Codex converge
 * on. Context chips sit *inside* the panel at the top, because they are part
 * of the message the model receives. The text is the middle. The bottom bar
 * holds the pickers that shape how the model works (mode, model, saved
 * prompts) on the left and the single send action on the right.
 *
 * The panel is a hairline on the panel fill, not an overlay surface: it is the
 * quietest element in the frame so the transcript above it stays the focus.
 */
export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  generating = false,
  placeholder = "Ask for a strategy, a persona, a batch of briefs…",
  context,
  leading,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  generating?: boolean;
  placeholder?: string;
  /** The chip row inside the panel — ContextAttachment per source. */
  context?: ReactNode;
  /** Bottom-left pickers: mode, model, QuickPrompts. */
  leading?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const canSend = value.trim().length > 0 && !generating;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 10 * 22)}px`;
  }, [value]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSend();
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col rounded-[14px] bg-panel ring-1 ring-line",
        "transition-shadow duration-150 focus-within:ring-line-strong",
        className,
      )}
    >
      {context ? <div className="flex flex-wrap items-center gap-1 px-2.5 pt-2.5">{context}</div> : null}

      <textarea
        ref={ref}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label="Message"
        className={cn(
          "min-h-[22px] w-full resize-none bg-transparent px-3.5 pt-3 pb-1 text-default leading-[22px] text-ink outline-none",
          "placeholder:text-ink/45",
        )}
      />

      <div className="flex items-center justify-between gap-2 px-2 pb-2 pt-1">
        <div className="flex min-w-0 items-center gap-0.5">{leading}</div>
        <div className="flex shrink-0 items-center gap-2">
          {canSend ? (
            <span className="hidden items-center gap-1 text-cap text-ink-disabled sm:flex">
              <Kbd>⏎</Kbd>
            </span>
          ) : null}
          {generating ? (
            <IconButton aria-label="Stop" variant="secondary" size="sm" onClick={onStop} className="size-7">
              <Square className="size-3 fill-current" />
            </IconButton>
          ) : (
            <IconButton aria-label="Send" variant="primary" size="sm" disabled={!canSend} onClick={onSend} className="size-7">
              <ArrowUp strokeWidth={2.5} className="size-3.5" />
            </IconButton>
          )}
        </div>
      </div>
    </div>
  );
}
