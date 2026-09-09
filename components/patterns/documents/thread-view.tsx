"use client";

import { ArrowUpRight, Check, Pencil, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ActionRow, AssistantMessage, ContextEcho, Steps, StreamingText, Suggestions, Thread as ThreadColumn, UserMessage } from "@/components/patterns/chat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GeneratingBar } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import { outline } from "@/lib/documents/markdown";
import { docTypes, typeSuffix } from "@/lib/documents/registry";
import type { Document, Message, ReviewField, Thread } from "@/lib/documents/types";

import { StatusPill, TypeDot, TypeIcon } from "./atoms";

/*
  Stage 1 and 2's conversation. The message primitives come from the chat
  pattern; what this adds is the document vocabulary — the artifact card is a
  document, the review card is the skill pausing for a decision, and a patch
  line names the section that changed so the founder can look at it.
*/

export function ThreadView({
  thread,
  docs,
  activeDocId,
  onOpenDoc,
  onSuggestion,
  onResolveReview,
  className,
}: {
  thread: Thread;
  docs: Document[];
  /** Doc shown in the Stage 2 pane, so its card reads as selected. */
  activeDocId?: string | null;
  onOpenDoc: (id: string, anchor?: string | null) => void;
  onSuggestion: (text: string) => void;
  onResolveReview: (messageId: string, result: { chosen?: number; fields?: ReviewField[] }) => void;
  className?: string;
}) {
  const end = useRef<HTMLDivElement>(null);
  const count = thread.messages.length;
  const streaming = thread.messages.some((m) => m.role === "assistant" && m.streaming);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: count > 2 ? "smooth" : "auto" });
  }, [count, streaming]);

  return (
    <ThreadColumn className={className}>
      {thread.messages.map((m, i) => (
        <MessageView
          key={m.id}
          message={m}
          docs={docs}
          activeDocId={activeDocId}
          last={i === thread.messages.length - 1}
          onOpenDoc={onOpenDoc}
          onSuggestion={onSuggestion}
          onResolveReview={(r) => onResolveReview(m.id, r)}
        />
      ))}
      <div ref={end} />
    </ThreadColumn>
  );
}

function MessageView({
  message: m,
  docs,
  activeDocId,
  last,
  onOpenDoc,
  onSuggestion,
  onResolveReview,
}: {
  message: Message;
  docs: Document[];
  activeDocId?: string | null;
  last: boolean;
  onOpenDoc: (id: string, anchor?: string | null) => void;
  onSuggestion: (text: string) => void;
  onResolveReview: (result: { chosen?: number; fields?: ReviewField[] }) => void;
}) {
  if (m.role === "user") {
    const ctx = m.context.map((id) => docs.find((d) => d.id === id)).filter((d): d is Document => Boolean(d));
    return (
      <UserMessage
        author={{ name: "Hanna Moore" }}
        context={
          ctx.length
            ? ctx.map((d) => (
                <ContextEcho key={d.id} icon={<TypeDot type={d.type} />}>
                  {d.title.split(" — ")[0]}
                </ContextEcho>
              ))
            : undefined
        }
      >
        {m.text}
      </UserMessage>
    );
  }

  const artifacts = (m.artifacts ?? []).map((id) => docs.find((d) => d.id === id)).filter((d): d is Document => Boolean(d));
  const running = Boolean(m.streaming);

  return (
    <AssistantMessage streaming={running} actions={!running}>
      {m.steps?.length ? (
        <Steps
          summary={m.stepsSummary ?? m.steps.map((s) => s.label).join(" → ")}
          items={m.steps.map((s) => ({ label: s.label, done: s.state === "done" }))}
          running={running && m.steps.some((s) => s.state === "running")}
        />
      ) : null}
      {m.text.map((p, i) => (running && i === m.text.length - 1 && !m.review && !artifacts.length ? <StreamingText key={i}>{p}</StreamingText> : <p key={i}>{p}</p>))}
      {running && m.text.length === 0 ? <StreamingText>Thinking</StreamingText> : null}

      {m.review ? <ReviewCard review={m.review} onResolve={onResolveReview} /> : null}

      {artifacts.length ? (
        <div className={cn("grid gap-2", artifacts.length > 1 && "sm:grid-cols-2")}>
          {artifacts.map((d) => (
            <DocArtifactCard key={d.id} doc={d} active={d.id === activeDocId} onOpen={() => onOpenDoc(d.id)} />
          ))}
        </div>
      ) : null}

      {m.patches?.length ? (
        <ul className="flex flex-col gap-1">
          {m.patches.map((p, i) => {
            const d = docs.find((x) => x.id === p.docId);
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => onOpenDoc(p.docId, p.anchor)}
                  className="inline-flex items-center gap-2 rounded-control bg-card px-3 py-1.5 text-cap text-ink-secondary hover:bg-raised hover:text-ink"
                >
                  <Pencil className="size-3.5" />
                  <span>
                    {p.text}
                    {d ? <span className="text-ink-disabled"> · v{d.version}</span> : null}
                  </span>
                  <ArrowUpRight className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {m.suggestions?.length && last && !running ? (
        <ActionRow>
          <Suggestions items={m.suggestions} onPick={onSuggestion} />
        </ActionRow>
      ) : null}
    </AssistantMessage>
  );
}

/* --------------------------------------------------------- artifact card --- */

export function DocArtifactCard({ doc, active = false, onOpen, className }: { doc: Document; active?: boolean; onOpen: () => void; className?: string }) {
  const generating = doc.status === "generating";
  const heads = outline(doc.body).filter((h) => h.level === 2);
  const meta = docTypes[doc.type];
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group/card relative flex w-full flex-col overflow-hidden rounded-[var(--radius-overlay)] bg-card text-left outline-none",
        "transition-colors duration-150 hover:bg-raised focus-visible:ring-2 focus-visible:ring-ink/25",
        active && "ring-1 ring-line-strong",
        className,
      )}
    >
      <div className="flex items-start gap-3.5 p-4">
        <TypeIcon type={doc.type} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-default text-ink">{doc.title}</span>
            {generating ? (
              <Badge tone="spectrum" dot={false} className="shrink-0">
                Generating
              </Badge>
            ) : (
              <StatusPill status={doc.status} className="shrink-0" />
            )}
          </div>
          <p className="line-clamp-2 text-cap leading-4 text-ink-secondary">
            {heads.length ? heads.map((h) => h.text).join(" · ") : generating ? "Opening the document shell…" : "Empty"}
          </p>
          <p className="truncate pt-0.5 text-tiny text-ink-disabled">
            <span className="text-ink-secondary">{typeSuffix(doc.type, doc.subtype)}</span>
            <span className="mx-1.5">·</span>
            {heads.length}/{meta.sections.length} sections
            {doc.version ? (
              <>
                <span className="mx-1.5">·</span>v{doc.version}
              </>
            ) : null}
          </p>
        </div>
        <span className="flex size-8 shrink-0 items-center justify-center text-ink-disabled transition-colors group-hover/card:text-ink">
          <ArrowUpRight className="size-4" />
        </span>
      </div>
      {generating ? <GeneratingBar className="rounded-none" /> : null}
    </button>
  );
}

/* ----------------------------------------------------------- review card --- */

type Review = NonNullable<Extract<Message, { role: "assistant" }>["review"]>;

export function ReviewCard({ review, onResolve }: { review: Review; onResolve: (result: { chosen?: number; fields?: ReviewField[] }) => void }) {
  const [fields, setFields] = useState<ReviewField[]>(review.fields);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [chosen, setChosen] = useState<number | null>(review.chosen ?? null);

  const setItems = (label: string, items: string[]) => setFields((f) => f.map((x) => (x.label === label ? { ...x, items } : x)));

  if (review.resolved) {
    return (
      <div className="flex flex-col gap-2 rounded-control bg-card p-3.5">
        <p className="inline-flex items-center gap-1.5 text-cap text-ink-secondary">
          <Check className="size-3.5 text-positive" /> {review.title}
        </p>
        {review.choices && review.chosen !== null && review.chosen !== undefined ? (
          <p className="text-default text-ink">“{review.choices[review.chosen]}”</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {review.fields.map((f) => (
              <div key={f.label}>
                <p className="pb-1 text-tiny text-ink-disabled uppercase">{f.label}</p>
                <ul className="flex flex-col gap-0.5 text-cap text-ink-secondary">
                  {f.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-overlay)] bg-card p-4 spectrum-edge">
      <p className="text-default text-ink">{review.title}</p>
      {review.choices ? (
        <ol className="flex flex-col gap-1.5">
          {review.choices.map((c, i) => (
            <li key={c}>
              <button
                type="button"
                onClick={() => setChosen(i)}
                aria-pressed={chosen === i}
                className={cn(
                  "flex w-full items-start gap-3 rounded-control px-3 py-2.5 text-left text-default transition-colors",
                  chosen === i ? "bg-ink text-canvas" : "bg-raised text-ink hover:bg-line-strong",
                )}
              >
                <span className={cn("mt-0.5 font-mono text-tiny", chosen === i ? "text-canvas/70" : "text-ink-disabled")}>{i + 1}</span>
                <span className="flex-1">“{c}”</span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {fields.map((f) => (
            <div key={f.label} className="flex flex-col gap-1.5">
              <p className="text-tiny text-ink-disabled uppercase">{f.label}</p>
              <ul className="flex flex-col gap-1">
                {f.items.map((it) => (
                  <li key={it} className="group/it flex items-start gap-1.5 rounded-[8px] bg-raised px-2 py-1.5 text-cap leading-4 text-ink">
                    <span className="flex-1">{it}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${it}`}
                      onClick={() => setItems(f.label, f.items.filter((x) => x !== it))}
                      className="mt-px flex size-4 shrink-0 items-center justify-center rounded text-ink-disabled opacity-0 hover:text-ink group-hover/it:opacity-100"
                    >
                      <X className="size-3" />
                    </button>
                  </li>
                ))}
              </ul>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = (drafts[f.label] ?? "").trim();
                  if (!v) return;
                  setItems(f.label, [...f.items, v]);
                  setDrafts((d) => ({ ...d, [f.label]: "" }));
                }}
                className="flex items-center gap-1"
              >
                <input
                  value={drafts[f.label] ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [f.label]: e.target.value }))}
                  placeholder="Add…"
                  aria-label={`Add to ${f.label}`}
                  className="h-7 min-w-0 flex-1 rounded-[8px] bg-field px-2 text-cap text-ink outline-none placeholder:text-ink-disabled focus:ring-1 focus:ring-line-strong"
                />
                <button type="submit" aria-label={`Add to ${f.label}`} className="flex size-7 items-center justify-center rounded-[8px] text-ink-secondary hover:bg-[var(--state-hover)] hover:text-ink">
                  <Plus className="size-3.5" />
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-tiny text-ink-disabled">{review.choices ? "Pick one; the brief is written around it." : "Edit anything that reads wrong, then continue."}</span>
        <Button
          variant="primary"
          size="sm"
          disabled={review.choices ? chosen === null : fields.some((f) => !f.items.length)}
          onClick={() => onResolve(review.choices ? { chosen: chosen ?? 0 } : { fields })}
        >
          {review.choices ? "Write the brief" : "Looks right — write it"}
        </Button>
      </div>
    </div>
  );
}
