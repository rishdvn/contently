"use client";

import { MoreHorizontal, Plus, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/cn";

/*
  The Board: briefs moving from idea to scheduled post.

  A kanban rather than a list because a brief's *stage* is the thing a strategist
  scans for, and stage is spatial. Columns are fixed — the pipeline is the
  product's opinion, not the user's — and every card is the same BriefCard, so
  a brief looks identical whether the model or a person wrote it. The only
  colour is artwork, once the brief has slides.
*/

export type BriefStage = "ideas" | "briefed" | "generating" | "review" | "scheduled";

export const stages: { id: BriefStage; label: string; hint: string }[] = [
  { id: "ideas", label: "Ideas", hint: "Angles and hooks, not yet briefed" },
  { id: "briefed", label: "Briefed", hint: "Slide beats written; ready to generate" },
  { id: "generating", label: "Generating", hint: "The model is rendering slides" },
  { id: "review", label: "Review", hint: "Needs a person's eyes" },
  { id: "scheduled", label: "Scheduled", hint: "On the calendar" },
];

export type Brief = {
  id: string;
  stage: BriefStage;
  title: string;
  persona: string;
  awareness: string;
  format: string;
  slides?: number;
  thumbnails?: string[];
  progress?: number;
  flags?: number;
  date?: string;
  ai?: boolean;
};

export function BriefCard({ brief, onOpen, className }: { brief: Brief; onOpen?: (b: Brief) => void; className?: string }) {
  /* A div, not a button: the overflow menu inside is itself a button. */
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.(brief)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen?.(brief);
        }
      }}
      className={cn(
        "group/brief flex w-full cursor-pointer flex-col gap-2.5 rounded-nav bg-card p-3 text-left outline-none",
        "transition-colors duration-150 hover:bg-raised focus-visible:ring-2 focus-visible:ring-ink/25",
        className,
      )}
    >
      {brief.thumbnails?.length ? (
        <div className="flex gap-1">
          {brief.thumbnails.slice(0, 4).map((t, i) => (
            <span key={i} className="aspect-[4/5] min-w-0 flex-1 rounded-[6px]" style={{ backgroundImage: t }} />
          ))}
        </div>
      ) : null}
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-default leading-5 text-ink">{brief.title}</p>
        <IconButton aria-label="More" size="sm" className="-mt-1 -mr-1 size-6 opacity-0 group-hover/brief:opacity-100 [&_svg]:size-3.5" onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal />
        </IconButton>
      </div>
      <p className="text-cap text-ink-secondary">
        {brief.persona} · {brief.awareness}
      </p>
      {brief.stage === "generating" && typeof brief.progress === "number" ? (
        <Progress value={brief.progress} max={brief.slides ?? 8} size="sm" spectrum />
      ) : null}
      <div className="flex items-center gap-1.5 pt-0.5">
        <span className="text-tiny text-ink-disabled">
          {brief.format}
          {brief.slides ? ` · ${brief.slides} slides` : ""}
        </span>
        <span className="flex-1" />
        {brief.flags ? <Badge tone="caution">{brief.flags} flag</Badge> : null}
        {brief.date ? <Badge tone="positive">{brief.date}</Badge> : null}
        {brief.ai && brief.stage === "ideas" ? (
          <Badge tone="spectrum" dot={false}>
            AI
          </Badge>
        ) : null}
      </div>
    </div>
  );
}

export function BoardColumn({
  stage,
  count,
  onAdd,
  children,
}: {
  stage: (typeof stages)[number];
  count: number;
  onAdd?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-[168px] flex-1 flex-col gap-2">
      <header className="flex h-8 items-center gap-2 px-1">
        <span className="text-ui text-ink">{stage.label}</span>
        <span className="text-cap text-ink-disabled tabular-nums">{count}</span>
        <span className="flex-1" />
        {onAdd ? (
          <IconButton aria-label={`Add to ${stage.label}`} size="sm" className="size-6 [&_svg]:size-3.5" onClick={onAdd}>
            <Plus />
          </IconButton>
        ) : null}
      </header>
      <div className="flex flex-col gap-2">{children}</div>
      {count === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-nav border border-dashed border-line px-3 py-6 text-center">
          <span className="text-cap text-ink-secondary">Nothing {stage.label.toLowerCase()}</span>
          <span className="text-tiny text-ink-disabled">{stage.hint}</span>
        </div>
      ) : null}
    </section>
  );
}

export function Board({ briefs, onOpen, className }: { briefs: Brief[]; onOpen?: (b: Brief) => void; className?: string }) {
  return (
    <div className={cn("flex gap-4", className)}>
      {stages.map((s) => {
        const items = briefs.filter((b) => b.stage === s.id);
        return (
          <BoardColumn key={s.id} stage={s} count={items.length} onAdd={s.id === "ideas" || s.id === "briefed" ? () => {} : undefined}>
            {items.map((b) => (
              <BriefCard key={b.id} brief={b} onOpen={onOpen} />
            ))}
            {s.id === "ideas" && items.length ? (
              <button
                type="button"
                className="flex h-9 items-center justify-center gap-1.5 rounded-nav text-cap text-ink-secondary ring-1 ring-inset ring-line transition-colors hover:bg-[var(--state-hover)] hover:text-ink"
              >
                <Sparkles className="size-3.5" /> Suggest more ideas
              </button>
            ) : null}
          </BoardColumn>
        );
      })}
    </div>
  );
}
