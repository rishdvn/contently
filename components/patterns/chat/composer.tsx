"use client";

import { ArrowUp, Paperclip, Square } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { useEffect, useRef } from "react";

import { Kbd } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

/**
 * The one place the user talks to the model.
 *
 * Three rows, each with a fixed job. The text area is the message. The bar
 * under it holds tools that change *this* message — attach a file, insert a
 * saved prompt, send. The row beneath the panel holds context pills, which
 * change what the model knows for the whole conversation and therefore live
 * outside the message itself.
 *
 * The panel is a Butter overlay surface (20px radius, panel fill) rather than a
 * field, because it is a workspace rather than an input.
 */
export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  generating = false,
  placeholder = "Ask for a strategy, a persona, a batch of briefs…",
  tools,
  context,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  generating?: boolean;
  placeholder?: string;
  /** Extra controls for the bottom-left of the bar — QuickPrompts lives here. */
  tools?: ReactNode;
  /** The pill row beneath the panel. */
  context?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const canSend = value.trim().length > 0 && !generating;

  /* Grow with the content, up to roughly eight lines; scroll after that. */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 8 * 24)}px`;
  }, [value]);

  /* Enter sends; Shift+Enter breaks the line. ⌘/Ctrl+Enter also sends, for muscle memory. */
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (canSend) onSend();
  };

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <div
        className={cn(
          "flex flex-col rounded-[var(--radius-overlay)] bg-panel p-3 pb-2",
          "ring-1 ring-transparent transition-shadow duration-150 focus-within:ring-line-strong",
        )}
      >
        <textarea
          ref={ref}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label="Message"
          className={cn(
            "min-h-6 w-full resize-none bg-transparent px-1 pt-0.5 text-default leading-6 text-ink outline-none",
            "placeholder:text-ink/50",
          )}
        />

        <div className="flex items-center justify-between gap-2 pt-2">
          <div className="flex items-center gap-0.5">
            <Tooltip label="Attach files">
              <IconButton aria-label="Attach files" size="sm">
                <Paperclip />
              </IconButton>
            </Tooltip>
            {tools}
          </div>
          <div className="flex items-center gap-2.5">
            {canSend ? (
              <span className="hidden items-center gap-1 text-cap text-ink-disabled sm:flex">
                <Kbd>⏎</Kbd> to send
              </span>
            ) : null}
            {generating ? (
              <IconButton aria-label="Stop generating" variant="secondary" size="sm" onClick={onStop}>
                <Square className="fill-current" />
              </IconButton>
            ) : (
              <IconButton
                aria-label="Send"
                variant="primary"
                size="sm"
                disabled={!canSend}
                onClick={onSend}
              >
                <ArrowUp strokeWidth={2.25} />
              </IconButton>
            )}
          </div>
        </div>
      </div>

      {context ? <div className="flex flex-wrap items-center gap-1.5 px-1">{context}</div> : null}
    </div>
  );
}
