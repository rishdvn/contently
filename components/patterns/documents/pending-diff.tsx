"use client";

import { Check, GitCompareArrows, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/documents/selectors";
import type { Document, PendingDiff as PendingDiffData } from "@/lib/documents/types";

/*
  Living documents are never overwritten by a skill. A refresh lands here, as
  a proposed diff the founder accepts or rejects one section at a time. The
  panel sits above the body so the doc beneath stays the truth until she says
  otherwise.
*/
export function PendingDiffPanel({
  doc,
  diff,
  now,
  onResolve,
  onResolveAll,
}: {
  doc: Document;
  diff: PendingDiffData;
  now: Date;
  onResolve: (anchor: string, accept: boolean) => void;
  onResolveAll: (accept: boolean) => void;
}) {
  return (
    <section aria-label="Proposed changes" className="flex flex-col gap-3 rounded-nav bg-caution-surface p-4 text-caution-ink">
      <header className="flex items-start gap-3">
        <GitCompareArrows className="mt-0.5 size-4 shrink-0 text-caution" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-default">
            The agent proposed {diff.sections.length} change{diff.sections.length === 1 ? "" : "s"} to {doc.title.split(" — ")[0]}
          </p>
          <p className="text-cap opacity-80">
            {diff.summary} · {relativeTime(diff.proposedAt, now)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button size="sm" variant="ghost" className="text-caution-ink hover:text-ink" onClick={() => onResolveAll(false)}>
            Reject all
          </Button>
          <Button size="sm" variant="primary" onClick={() => onResolveAll(true)}>
            Accept all
          </Button>
        </div>
      </header>
      <ul className="flex flex-col gap-2">
        {diff.sections.map((s) => (
          <li key={s.anchor} className="flex flex-col gap-2 rounded-control bg-canvas/50 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-cap text-ink">{s.heading}</span>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" aria-label={`Reject change to ${s.heading}`} onClick={() => onResolve(s.anchor, false)} className="h-7 px-2 text-ink-secondary hover:text-critical">
                  <X /> Reject
                </Button>
                <Button size="sm" variant="secondary" aria-label={`Accept change to ${s.heading}`} onClick={() => onResolve(s.anchor, true)} className="h-7 px-2">
                  <Check /> Accept
                </Button>
              </div>
            </div>
            <div className="grid gap-2 text-cap leading-5 sm:grid-cols-2">
              <p className="rounded-[8px] bg-critical-surface/70 px-2.5 py-2 text-critical-ink line-through decoration-critical-ink/40">{s.before || "—"}</p>
              <p className="rounded-[8px] bg-positive-surface/70 px-2.5 py-2 text-positive-ink">{s.after}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
