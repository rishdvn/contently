"use client";

import { Bot, Clock, RefreshCw, ShieldCheck, ShieldOff, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Avatar, AgentMark } from "@/components/ui/avatar";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { docTypes, freshnessLabels, statusLabels, statusTone } from "@/lib/documents/registry";
import { daysUntil, effectiveFreshness, shortDate } from "@/lib/documents/selectors";
import type { DocStatus, DocType, Document, Freshness } from "@/lib/documents/types";

/*
  The small, repeated marks of the document layer. Each says one thing:
  what kind of document, where it is in its workflow, whether it can still be
  trusted, and who wrote it. They are kept apart on purpose — the PRD is
  explicit that freshness is orthogonal to status.
*/

/** Type glyph on its hue. The only place a type colour appears. */
export function TypeIcon({ type, size = "md", className }: { type: DocType; size?: "sm" | "md" | "lg"; className?: string }) {
  const meta = docTypes[type];
  const Icon = meta.icon;
  return (
    <span
      aria-label={meta.label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[8px] bg-raised",
        { sm: "size-6 [&>svg]:size-3.5", md: "size-8 [&>svg]:size-4", lg: "size-10 [&>svg]:size-[18px]" }[size],
        className,
      )}
      style={{ color: `var(--color-type-${meta.hue})` }}
    >
      <Icon />
    </span>
  );
}

export function TypeDot({ type, className }: { type: DocType; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", className)} style={{ background: `var(--color-type-${docTypes[type].hue})` }} />;
}

export function StatusPill({ status, className }: { status: DocStatus; className?: string }) {
  return (
    <Badge tone={statusTone[status]} className={className}>
      {statusLabels[status]}
    </Badge>
  );
}

const freshnessIcon: Record<Freshness["kind"], ReactNode> = {
  unverified: <ShieldOff />,
  verified: <ShieldCheck />,
  expired: <Clock />,
  outdated: <TriangleAlert />,
  refresh_requested: <RefreshCw className="animate-spin [animation-duration:2.4s]" />,
};

/** Living docs only. Reads as quiet text unless something is wrong. */
export function FreshnessPill({ doc, now, className }: { doc: Document; now: Date; className?: string }) {
  const f = effectiveFreshness(doc, now);
  if (!f) return null;
  const tone = f.kind === "verified" ? "positive" : f.kind === "expired" || f.kind === "outdated" ? "caution" : f.kind === "refresh_requested" ? "spectrum" : "neutral";
  let label: string = freshnessLabels[f.kind];
  if (f.kind === "verified") label = f.until ? `Verified · ${daysUntil(f.until, now)}d left` : "Verified";
  if (f.kind === "expired") label = `Expired ${shortDate(f.until)}`;
  return (
    <Tooltip label={f.kind === "outdated" && f.note ? f.note : freshnessLabels[f.kind]}>
      <Badge tone={tone} dot={false} className={cn("gap-1 [&_svg]:size-3", className)}>
        {freshnessIcon[f.kind]}
        {label}
      </Badge>
    </Tooltip>
  );
}

/** Agent or a person. The agent is the spectrum mark; hovering names the skill. */
export function OwnerMark({ doc, size = "sm", withName = false }: { doc: Document; size?: "xs" | "sm" | "md"; withName?: boolean }) {
  const agent = doc.createdBy === "agent";
  const mark = agent ? <AgentMark size={size} /> : <Avatar name={doc.owner} size={size} />;
  const label = agent ? `Agent · ${doc.skill ?? "skill"}` : doc.owner;
  return (
    <Tooltip label={label}>
      <span className="inline-flex items-center gap-1.5">
        {mark}
        {withName ? <span className="text-cap text-ink-secondary">{agent ? "Agent" : doc.owner}</span> : null}
      </span>
    </Tooltip>
  );
}

export function AgentChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-control bg-raised px-2 py-0.5 text-tiny text-ink-secondary [&>svg]:size-3">
      <Bot />
      {children}
    </span>
  );
}
