"use client";

import {
  AlertCircle,
  Check,
  ChevronRight,
  Copy,
  Loader2,
  RotateCcw,
  Scissors,
  ThumbsDown,
  ThumbsUp,
  Wrench,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { IconButton } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

import { ArtifactBlock } from "./artifact-block";
import type { Block, Transcript, Turn } from "./transcript";
import { toolLabel } from "./transcript";
import type { Artifact } from "./types";

/*
  The thread, rendered from the transcript view model.

  What Cursor, Devin and Codex share, and what this copies: the assistant has
  no bubble and no avatar — its prose is simply the page — while the user's
  message is a quiet filled block, so the two voices are told apart by shape
  rather than by colour or by alignment. Tool activity is folded into a single
  collapsible row with a summary ("6 steps · 42s") because the work matters
  less than the result; documents are inline blocks with a header, like a file
  in a diff view; and the streaming state is a caret at the end of the text,
  not a separate "typing" element.
*/

export type TranscriptHandlers = {
  onOpenArtifact?: (a: Artifact) => void;
  onGenerate?: (a: Artifact) => void;
  /** Kind-specific artifact previews; falls back to the summary. */
  renderPreview?: (a: Artifact) => ReactNode;
  onSuggest?: (text: string) => void;
};

export function Thread({ transcript, className, ...handlers }: { transcript: Transcript; className?: string } & TranscriptHandlers) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {transcript.turns.map((turn) =>
        turn.role === "user" ? <UserTurn key={turn.id} turn={turn} /> : <AssistantTurn key={turn.id} turn={turn} {...handlers} />,
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   User
   ------------------------------------------------------------------------ */

export function UserTurn({ turn }: { turn: Turn }) {
  const text = turn.blocks.map((b) => (b.kind === "text" ? b.text : "")).join("");
  return (
    <div className="flex flex-col gap-1.5 rounded-nav bg-card px-4 py-3">
      {turn.attachments?.length ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-cap text-ink-disabled">
          {turn.attachments.map((a) => (
            <span key={`${a.kind}:${a.label}`}>@{a.label}</span>
          ))}
        </div>
      ) : null}
      <p className="whitespace-pre-wrap text-default text-ink">{text}</p>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Assistant
   ------------------------------------------------------------------------ */

type Segment = { type: "activity"; blocks: Extract<Block, { kind: "tool" | "thinking" }>[] } | { type: "block"; block: Block };

/** Fold runs of tool/thinking blocks into one activity segment. */
function segment(blocks: Block[]): Segment[] {
  const out: Segment[] = [];
  for (const b of blocks) {
    if (b.kind === "tool" || b.kind === "thinking") {
      const last = out[out.length - 1];
      if (last?.type === "activity") last.blocks.push(b);
      else out.push({ type: "activity", blocks: [b] });
    } else out.push({ type: "block", block: b });
  }
  return out;
}

export function AssistantTurn({ turn, ...handlers }: { turn: Turn } & TranscriptHandlers) {
  const segments = segment(turn.blocks);
  const lastText = [...turn.blocks].reverse().find((b) => b.kind === "text");
  const showWorking = turn.streaming && !(lastText && lastText.kind === "text" && lastText.partial);

  return (
    <div className="group/turn flex flex-col gap-3 px-1">
      {segments.map((s, i) =>
        s.type === "activity" ? (
          <ActivityGroup key={s.blocks[0].id} blocks={s.blocks} live={turn.streaming && i === segments.length - 1} />
        ) : (
          <BlockView key={s.block.id} block={s.block} {...handlers} />
        ),
      )}
      {showWorking ? <Working /> : null}
      {!turn.streaming && turn.result ? <TurnFooter turn={turn} /> : null}
    </div>
  );
}

function BlockView({ block, onOpenArtifact, onGenerate, renderPreview }: { block: Block } & TranscriptHandlers) {
  switch (block.kind) {
    case "text":
      return <Prose text={block.text} partial={block.partial} />;
    case "artifact":
      return (
        <ArtifactBlock
          artifact={block.status === "running" ? { ...block.artifact, status: "generating" } : block.artifact}
          onOpen={onOpenArtifact}
          onGenerate={onGenerate}
          preview={block.status === "running" ? undefined : renderPreview?.(block.artifact)}
        />
      );
    case "error":
      return (
        <div className="flex items-start gap-2 rounded-control bg-critical-surface px-3 py-2.5 text-ui text-critical-ink">
          <AlertCircle className="mt-px size-3.5 shrink-0 text-critical" />
          <span>{block.message}</span>
        </div>
      );
    case "boundary":
      return (
        <div className="flex items-center gap-3 py-1 text-cap text-ink-disabled">
          <span className="h-px flex-1 bg-line" />
          <span className="flex items-center gap-1.5">
            <Scissors className="size-3" />
            Context compacted · {Math.round(block.preTokens / 1000)}k tokens
          </span>
          <span className="h-px flex-1 bg-line" />
        </div>
      );
    case "unknown":
      return (
        <details className="rounded-control bg-card px-3 py-2 text-cap text-ink-disabled">
          <summary className="cursor-pointer">Unrecognised event</summary>
          <pre className="overflow-x-auto pt-2 font-mono text-tiny">{JSON.stringify(block.raw, null, 2)}</pre>
        </details>
      );
    default:
      return null;
  }
}

/** Paragraph breaks only. Anything richer is a document and gets an artifact. */
export function Prose({ text, partial }: { text: string; partial?: boolean }) {
  const paras = text.split(/\n{2,}/);
  return (
    <div className="flex flex-col gap-3 text-default leading-[22px] text-ink">
      {paras.map((p, i) => (
        <p key={i} className="whitespace-pre-wrap">
          {renderInline(p)}
          {partial && i === paras.length - 1 ? <Caret /> : null}
        </p>
      ))}
    </div>
  );
}

/* Bold and inline code are enough for a strategist's prose. */
function renderInline(s: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith("**")) return <strong key={i} className="font-medium">{part.slice(2, -2)}</strong>;
    if (part.startsWith("`")) return <code key={i} className="rounded bg-raised px-1 py-0.5 font-mono text-ui">{part.slice(1, -1)}</code>;
    return part;
  });
}

function Caret() {
  return <span aria-hidden className="ml-0.5 inline-block h-[15px] w-[2px] translate-y-[2px] animate-caret rounded-sm bg-ink" />;
}

function Working() {
  return (
    <div className="flex items-center gap-2 text-ui text-ink-secondary">
      <span className="spectrum-fill size-1.5 animate-breathe rounded-full" />
      Working…
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Activity — tool calls and thinking, folded into a row
   ------------------------------------------------------------------------ */

export function ActivityGroup({ blocks, live }: { blocks: Extract<Block, { kind: "tool" | "thinking" }>[]; live: boolean }) {
  const [open, setOpen] = useState(false);
  const expanded = live || open;
  const runningAll = blocks.filter((b): b is Extract<Block, { kind: "tool" }> => b.kind === "tool" && b.status === "running");
  const running = runningAll[0];
  const errors = blocks.filter((b) => b.kind === "tool" && b.status === "error").length;
  const steps = blocks.filter((b) => b.kind === "tool").length;

  const summary = running
    ? runningAll.length > 1
      ? `Running ${runningAll.length} steps`
      : toolLabel(running)
    : steps === 0
      ? "Thought for a moment"
      : `${steps} step${steps === 1 ? "" : "s"}${errors ? ` · ${errors} failed` : ""}`;

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={expanded}
        className={cn(
          "group/act -mx-2 flex h-7 items-center gap-2 rounded-[8px] px-2 text-left text-ui outline-none",
          "text-ink-secondary transition-colors hover:bg-[var(--state-hover)] hover:text-ink focus-visible:bg-[var(--state-hover)]",
        )}
      >
        {running ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin" />
        ) : (
          <ChevronRight className={cn("size-3.5 shrink-0 text-ink-disabled transition-transform", expanded && "rotate-90")} />
        )}
        <span className="truncate">{summary}</span>
      </button>
      {expanded ? (
        <ul className="ml-[6px] flex flex-col border-l border-line pl-3.5 pt-0.5">
          {blocks.map((b) => (
            <li key={b.id}>
              {b.kind === "tool" ? <ToolRow block={b} /> : <ThinkingRow text={b.text} />}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ToolRow({ block }: { block: Extract<Block, { kind: "tool" }> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => block.result && setOpen((o) => !o)}
        className={cn(
          "flex h-7 items-center gap-2 text-left text-ui outline-none",
          block.status === "error" ? "text-critical" : "text-ink-secondary",
          block.result && "hover:text-ink",
        )}
      >
        {block.status === "running" ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin" />
        ) : block.status === "error" ? (
          <AlertCircle className="size-3.5 shrink-0" />
        ) : (
          <Wrench className="size-3.5 shrink-0 text-ink-disabled" />
        )}
        <span className="truncate">{toolLabel(block)}</span>
        {block.status === "done" ? <Check className="size-3 shrink-0 text-ink-disabled" /> : null}
      </button>
      {open && block.result ? (
        <pre className="mb-1.5 ml-5.5 max-h-40 overflow-y-auto rounded-[8px] bg-card px-2.5 py-2 font-mono text-cap leading-4 whitespace-pre-wrap text-ink-secondary">
          {block.result}
        </pre>
      ) : null}
    </div>
  );
}

function ThinkingRow({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex h-7 items-center gap-2 text-left text-ui text-ink-disabled hover:text-ink-secondary">
        <span className="size-3.5 shrink-0 text-center leading-none">·</span>
        <span className="italic">Thinking</span>
      </button>
      {open ? <p className="mb-1.5 ml-5.5 text-ui leading-[18px] text-ink-disabled italic">{text}</p> : null}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Footer — appears once the turn has a result
   ------------------------------------------------------------------------ */

function TurnFooter({ turn }: { turn: Turn }) {
  const r = turn.result!;
  const secs = Math.max(1, Math.round(r.durationMs / 1000));
  return (
    <div className="flex items-center gap-1 pt-0.5 text-cap text-ink-disabled">
      <span className="mr-2 tabular-nums">
        {r.isError ? "Stopped" : "Done"} · {secs}s
      </span>
      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/turn:opacity-100 focus-within:opacity-100">
        {[
          ["Copy", Copy],
          ["Good response", ThumbsUp],
          ["Bad response", ThumbsDown],
          ["Regenerate", RotateCcw],
        ].map(([label, Icon]) => {
          const I = Icon as typeof Copy;
          return (
            <Tooltip key={label as string} label={label as string}>
              <IconButton aria-label={label as string} size="sm" className="size-6 [&_svg]:size-3">
                <I />
              </IconButton>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Suggestions — follow-ups after a finished turn
   ------------------------------------------------------------------------ */

export function Suggestions({ items, onPick, className }: { items: string[]; onPick?: (t: string) => void; className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {items.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onPick?.(s)}
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-[8px] px-2.5 text-cap text-ink-secondary ring-1 ring-inset ring-line",
            "transition-colors hover:bg-[var(--state-hover)] hover:text-ink",
          )}
        >
          {s}
          <ChevronRight className="size-3 text-ink-disabled" />
        </button>
      ))}
    </div>
  );
}
