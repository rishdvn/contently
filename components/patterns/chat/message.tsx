"use client";

import { Check, ChevronRight, Copy, RotateCcw, ThumbsDown, ThumbsUp } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { AgentMark, Avatar } from "@/components/ui/avatar";
import { IconButton } from "@/components/ui/button";
import { Chip, ChipRow } from "@/components/ui/chip";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

/** The column both kinds of message share. Readable measure, generous rhythm. */
export function Thread({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mx-auto flex w-full max-w-[760px] flex-col gap-7", className)} {...props} />;
}

/**
 * The user's turn is a bubble; the model's is not.
 *
 * That asymmetry is the whole message design. A bubble says "this is a quote",
 * which is exactly what a prompt is. The model's reply is the working surface
 * the user reads, scrolls and acts on, so it takes the full measure with only
 * the spectrum mark to attribute it.
 */
export function UserMessage({
  children,
  context,
  author,
  className,
}: {
  children: ReactNode;
  /** Pills echoing what was attached when this was sent. */
  context?: ReactNode;
  author?: { name: string; src?: string };
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-end gap-1.5", className)}>
      {context ? <div className="flex flex-wrap justify-end gap-1">{context}</div> : null}
      <div className="flex max-w-[78%] items-end gap-2.5">
        <div className="rounded-[20px] rounded-br-[8px] bg-card px-4 py-2.5 text-default leading-6 text-ink">
          {children}
        </div>
        {author ? <Avatar name={author.name} src={author.src} size="sm" className="mb-0.5" /> : null}
      </div>
    </div>
  );
}

/** Tiny echo of an attached source on a sent message. */
export function ContextEcho({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-full bg-raised pr-2.5 pl-2 text-tiny text-ink-secondary [&>svg]:size-3">
      {icon}
      {children}
    </span>
  );
}

export function AssistantMessage({
  children,
  streaming = false,
  actions = true,
  className,
}: {
  children: ReactNode;
  streaming?: boolean;
  /** Copy / regenerate / rate, revealed on hover. Off for the final streaming chunk. */
  actions?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("group/msg grid grid-cols-[24px_1fr] gap-x-3.5", className)}>
      <AgentMark size="sm" active={streaming} className="mt-0.5" />
      <div className="flex min-w-0 flex-col gap-3.5 text-default leading-6 text-ink [&_p]:text-ink [&_strong]:font-medium">
        {children}
        {actions && !streaming ? (
          <div className="-ml-2 flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover/msg:opacity-100 focus-within:opacity-100">
            <Tooltip label="Copy">
              <IconButton aria-label="Copy" size="sm">
                <Copy />
              </IconButton>
            </Tooltip>
            <Tooltip label="Regenerate">
              <IconButton aria-label="Regenerate" size="sm">
                <RotateCcw />
              </IconButton>
            </Tooltip>
            <Tooltip label="Good response">
              <IconButton aria-label="Good response" size="sm">
                <ThumbsUp />
              </IconButton>
            </Tooltip>
            <Tooltip label="Poor response">
              <IconButton aria-label="Poor response" size="sm">
                <ThumbsDown />
              </IconButton>
            </Tooltip>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Text still arriving. The caret is the only motion; nothing else pulses. */
export function StreamingText({ children }: { children: ReactNode }) {
  return (
    <p>
      {children}
      <span aria-hidden className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[3px] animate-pulse bg-ink" />
    </p>
  );
}

/**
 * What the model did before it answered. Collapsed to one line by default,
 * because the steps are evidence rather than content; expanded they read as a
 * checklist so the user can see which sources were actually consulted.
 */
export function Steps({
  summary,
  items,
  running = false,
}: {
  summary: string;
  items: { label: string; done?: boolean }[];
  running?: boolean;
}) {
  return (
    <details className="group/steps -my-1">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 py-1 text-cap text-ink-secondary select-none hover:text-ink [&::-webkit-details-marker]:hidden">
        {running ? <AgentMark size="xs" active /> : null}
        <span>{summary}</span>
        <ChevronRight className="size-3.5 transition-transform duration-150 group-open/steps:rotate-90" />
      </summary>
      <ul className="mt-1 mb-1 flex flex-col gap-1 border-l border-line pl-3.5">
        {items.map((it) => (
          <li key={it.label} className="flex items-center gap-2 text-cap text-ink-secondary">
            {it.done === false ? (
              <span className="size-3.5 shrink-0 rounded-full ring-1 ring-inset ring-line-strong" />
            ) : (
              <Check className="size-3.5 shrink-0 text-ink-disabled" />
            )}
            {it.label}
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Buttons under a reply. At most one is spectrum, and only if it costs model time. */
export function ActionRow({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-wrap items-center gap-2 pt-0.5", className)} {...props} />;
}

/** Follow-up questions the user can send with one click. Reuses Chip: these filter what happens next. */
export function Suggestions({
  items,
  onPick,
}: {
  items: string[];
  onPick?: (text: string) => void;
}) {
  return (
    <ChipRow wrap className="pt-0.5">
      {items.map((s) => (
        <Chip key={s} onClick={() => onPick?.(s)} className="h-8 text-cap">
          {s}
        </Chip>
      ))}
    </ChipRow>
  );
}
