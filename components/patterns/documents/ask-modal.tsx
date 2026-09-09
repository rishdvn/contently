"use client";

import { ArrowUp, ArrowUpRight, Check, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AgentMark } from "@/components/ui/avatar";
import { Button, IconButton } from "@/components/ui/button";
import { Chip, ChipRow } from "@/components/ui/chip";
import { Dialog, DialogBody, DialogHeader, DialogIcon } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import { summarize, type Answer, type Patch } from "@/lib/documents/agent";
import { useStore } from "@/lib/documents/store";
import type { Document } from "@/lib/documents/types";

/*
  Stage 3's Ask modal. It is a modal and not a drawer because the founder is
  asking one question about the document she is looking at, not starting a
  conversation — the summary at the top answers the three questions she has
  before she types anything, and anything that would change the doc is shown
  as a patch she applies with one click. If it turns into a conversation,
  "Continue in chat" carries it to Stage 2 with the doc already in scope.
*/

type Turn = { role: "user"; text: string } | { role: "assistant"; answer: Answer; applied?: boolean };

type AskModalProps = {
  doc: Document;
  open: boolean;
  onClose: () => void;
  /** Pre-filled from "Ask about this" on a selection. */
  initialQuestion?: string | null;
  onContinueInChat: (question: string) => void;
  onCreateBrief: () => void;
};

/** Each opening is a fresh conversation, so the body remounts on open. */
export function AskModal(props: AskModalProps) {
  const [openings, setOpenings] = useState(0);
  const [wasOpen, setWasOpen] = useState(props.open);
  if (props.open !== wasOpen) {
    setWasOpen(props.open);
    if (props.open) setOpenings((n) => n + 1);
  }
  return (
    <Dialog open={props.open} onClose={props.onClose} size="lg" className="h-[min(640px,calc(100dvh-64px))]">
      <AskModalBody key={openings} {...props} />
    </Dialog>
  );
}

function AskModalBody({ doc, onClose, initialQuestion, onContinueInChat, onCreateBrief }: AskModalProps) {
  const store = useStore();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [value, setValue] = useState(initialQuestion ?? "");
  const [thinking, setThinking] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [turns, thinking]);

  const summary = summarize(doc, store.versions, store.relations, store.docs, store.now);

  const send = (q: string) => {
    if (!q.trim()) return;
    setTurns((t) => [...t, { role: "user", text: q }]);
    setValue("");
    setThinking(true);
    setTimeout(() => {
      const a = store.ask(doc.id, q);
      setThinking(false);
      setTurns((t) => [...t, { role: "assistant", answer: a }]);
      if (a.createBrief) {
        setTimeout(onCreateBrief, 500);
      }
    }, 600);
  };

  const apply = (i: number, patch: Patch) => {
    store.applyPatch(doc.id, patch);
    setTurns((t) => t.map((x, j) => (j === i && x.role === "assistant" ? { ...x, applied: true } : x)));
  };

  const lastQuestion = [...turns].reverse().find((t) => t.role === "user");

  return (
    <>
      <DialogHeader
        icon={
          <DialogIcon tone="spectrum">
            <Sparkles />
          </DialogIcon>
        }
        title={`Ask about ${doc.title.split(" — ")[0]}`}
        description="Answers are grounded in this document and its relations. Anything that changes it is applied as a patch you can see."
        onClose={onClose}
      />
      <DialogBody className="flex flex-col gap-4">
        <div className="grid gap-2 rounded-control bg-card p-3.5 text-cap leading-5 sm:grid-cols-3">
          <div>
            <p className="pb-0.5 text-tiny text-ink-disabled uppercase">Says</p>
            <p className="text-ink-secondary">{summary.says}</p>
          </div>
          <div>
            <p className="pb-0.5 text-tiny text-ink-disabled uppercase">Changed</p>
            <p className="text-ink-secondary">{summary.changed}</p>
          </div>
          <div>
            <p className="pb-0.5 text-tiny text-ink-disabled uppercase">Stale</p>
            <p className={cn(summary.stale.startsWith("Nothing") ? "text-ink-secondary" : "text-caution-ink")}>{summary.stale}</p>
          </div>
        </div>

        {turns.length === 0 ? (
          <ChipRow wrap>
            {["Summarize this", "Find gaps", "Check it against Brand Core", "What changed since the latest research?", doc.type === "brief" ? "Tighten the caption" : "Turn this into a brief"].map((s) => (
              <Chip key={s} onClick={() => send(s)} className="h-8 text-cap">
                {s}
              </Chip>
            ))}
          </ChipRow>
        ) : null}

        <div className="flex flex-col gap-4">
          {turns.map((t, i) =>
            t.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[80%] rounded-[16px] rounded-br-[6px] bg-card px-3.5 py-2 text-default text-ink">{t.text}</div>
              </div>
            ) : (
              <div key={i} className="grid grid-cols-[20px_1fr] gap-x-3">
                <AgentMark size="xs" className="mt-1" />
                <div className="flex flex-col gap-2 text-default leading-6 text-ink">
                  {t.answer.text.map((p, j) => (
                    <p key={j}>{p}</p>
                  ))}
                  {t.answer.patch ? (
                    <div className="flex items-center gap-2 rounded-control bg-card p-2.5 text-cap">
                      <span className="min-w-0 flex-1 truncate text-ink-secondary">
                        Patch · <span className="text-ink">{t.answer.patch.heading}</span>
                      </span>
                      {t.applied ? (
                        <span className="inline-flex items-center gap-1 text-positive">
                          <Check className="size-3.5" /> Applied
                        </span>
                      ) : (
                        <Button size="sm" variant="primary" onClick={() => apply(i, t.answer.patch!)}>
                          Apply
                        </Button>
                      )}
                    </div>
                  ) : null}
                  {t.answer.suggestions?.length && i === turns.length - 1 ? (
                    <ChipRow wrap>
                      {t.answer.suggestions.map((s) => (
                        <Chip key={s} onClick={() => send(s)} className="h-7 text-tiny">
                          {s}
                        </Chip>
                      ))}
                    </ChipRow>
                  ) : null}
                </div>
              </div>
            ),
          )}
          {thinking ? (
            <div className="grid grid-cols-[20px_1fr] gap-x-3">
              <AgentMark size="xs" active className="mt-1" />
              <p className="text-default text-ink-disabled">Reading the document…</p>
            </div>
          ) : null}
          <div ref={end} />
        </div>
      </DialogBody>
      <div className="flex flex-col gap-2 px-5 pb-5">
        <div className="flex items-end gap-2 rounded-[var(--radius-overlay)] bg-panel p-2 pl-3 ring-1 ring-line-strong">
          <textarea
            rows={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(value);
              }
            }}
            placeholder="Ask about this document…"
            aria-label="Question"
            autoFocus
            className="max-h-32 min-h-6 flex-1 resize-none bg-transparent py-1.5 text-default leading-6 text-ink outline-none placeholder:text-ink/50"
          />
          <IconButton aria-label="Send" variant="primary" size="sm" disabled={!value.trim() || thinking} onClick={() => send(value)}>
            <ArrowUp strokeWidth={2.25} />
          </IconButton>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-tiny text-ink-disabled">Enter to send · Shift+Enter for a new line</span>
          <Button variant="ghost" size="sm" className="text-ink-secondary" onClick={() => onContinueInChat(lastQuestion?.role === "user" ? lastQuestion.text : value)}>
            Continue in chat <ArrowUpRight />
          </Button>
        </div>
      </div>
    </>
  );
}
