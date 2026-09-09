"use client";

import { ArrowUpRight, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { outline } from "@/lib/documents/markdown";
import { docTypes } from "@/lib/documents/registry";
import { relativeTime } from "@/lib/documents/selectors";
import type { DocType, Document } from "@/lib/documents/types";

import { FreshnessPill, StatusPill, TypeIcon } from "./atoms";

/*
  The Brand tab shows three cards, one per living type. A card rather than a
  row because each is singular: there is one Brand Core, and the question is
  not "which one" but "is it current". The card leads with freshness and the
  pending-diff count for the same reason.
*/
export function BrandCard({
  type,
  doc,
  now,
  onOpen,
  onCreate,
  onRefresh,
  onVerify,
  className,
}: {
  type: DocType;
  doc: Document | undefined;
  now: Date;
  onOpen: (id: string) => void;
  onCreate: (type: DocType) => void;
  onRefresh: (id: string) => void;
  onVerify: (id: string) => void;
  className?: string;
}) {
  const meta = docTypes[type];
  const heads = doc ? outline(doc.body).filter((h) => h.level === 2) : [];
  const refreshing = doc?.freshness?.kind === "refresh_requested";

  return (
    <article
      className={cn("flex flex-col gap-4 rounded-card bg-panel p-6", className)}
      style={{ boxShadow: `inset 3px 0 0 var(--color-type-${meta.hue})` }}
    >
      <header className="flex items-start gap-3">
        <TypeIcon type={type} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-titles text-ink">{meta.label}</h2>
          <p className="text-cap leading-4 text-ink-secondary">{meta.intent}</p>
        </div>
      </header>

      {doc ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={doc.status} />
            <FreshnessPill doc={doc} now={now} />
            {doc.pendingDiff ? (
              <Badge tone="caution" dot={false}>
                {doc.pendingDiff.sections.length} proposed change{doc.pendingDiff.sections.length === 1 ? "" : "s"}
              </Badge>
            ) : null}
            <span className="text-tiny text-ink-disabled">
              v{doc.version} · {relativeTime(doc.updatedAt, now)}
            </span>
          </div>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-cap text-ink-secondary">
            {heads.slice(0, 8).map((h) => (
              <li key={h.id} className="truncate">
                <button type="button" onClick={() => onOpen(doc.id)} className="truncate text-left hover:text-ink">
                  {h.text}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
            <Button variant="primary" onClick={() => onOpen(doc.id)}>
              Open <ArrowUpRight />
            </Button>
            <Button variant="ghost" onClick={() => onVerify(doc.id)} disabled={doc.freshness?.kind === "verified"}>
              <ShieldCheck /> Verify
            </Button>
            <Button variant="ghost" onClick={() => onRefresh(doc.id)} disabled={refreshing}>
              <RefreshCw className={cn(refreshing && "animate-spin")} /> {refreshing ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-default text-ink-secondary">Not written yet. The {meta.skill} skill reads {meta.needs.toLowerCase()}</p>
          <div className="mt-auto pt-1">
            <Button variant="spectrum" onClick={() => onCreate(type)}>
              <Sparkles /> Write it with the agent
            </Button>
          </div>
        </>
      )}
    </article>
  );
}
