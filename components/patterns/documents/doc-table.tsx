"use client";

import { Archive, ArrowUpRight, Copy, Eye, MessageSquare, MoreHorizontal, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { Fragment, useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { GeneratingBar } from "@/components/ui/feedback";
import { Menu, MenuDivider, MenuItem } from "@/components/ui/menu";
import { cn } from "@/lib/cn";
import { useMediaQuery } from "@/lib/use-media-query";
import { brandTypes, docTypeOrder, docTypes, statusLabels, typeSuffix } from "@/lib/documents/registry";
import { incoming, outgoing, relativeTime } from "@/lib/documents/selectors";
import type { DocStatus, Document, Relation } from "@/lib/documents/types";

import { FreshnessPill, OwnerMark, StatusPill, TypeIcon } from "./atoms";

/*
  Stage 0's centre. A table rather than cards because the founder's question
  here is "which of these needs me" — that is a scan down one column, not a
  read across many tiles. Grouping is a view setting, not a filter: the same
  rows, arranged.
*/

export type GroupBy = "none" | "type" | "status" | "persona";

export type DocTableActions = {
  onOpen: (id: string) => void;
  onPeek?: (id: string) => void;
  onChat?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onVerify?: (id: string) => void;
  onFlag?: (id: string) => void;
  onRefresh?: (id: string) => void;
  onArchive?: (id: string) => void;
};

export function DocTable({
  docs,
  relations,
  allDocs,
  now,
  groupBy = "none",
  selected,
  onSelectedChange,
  actions,
  dense: denseProp = false,
  className,
}: {
  docs: Document[];
  relations: Relation[];
  /** For resolving related titles; defaults to `docs`. */
  allDocs?: Document[];
  now: Date;
  groupBy?: GroupBy;
  selected?: Set<string>;
  onSelectedChange?: (next: Set<string>) => void;
  actions: DocTableActions;
  /** Drops the Freshness and Owner columns. Also applied automatically below the lg breakpoint. */
  dense?: boolean;
  className?: string;
}) {
  const wide = useMediaQuery("(min-width: 1024px)");
  const dense = denseProp || !wide;
  const all = allDocs ?? docs;
  const selectable = Boolean(selected && onSelectedChange);
  /* Exact, because a colSpan wider than the row makes fixed layout invent empty columns. */
  const columnCount = (selectable ? 1 : 0) + 4 + (dense ? 0 : 2);

  const groups = useMemo(() => {
    if (groupBy === "none") return [{ key: "all", label: null as string | null, docs }];
    if (groupBy === "type") {
      return docTypeOrder
        .map((t) => ({ key: t, label: docTypes[t].plural, docs: docs.filter((d) => d.type === t) }))
        .filter((g) => g.docs.length);
    }
    if (groupBy === "status") {
      const order: DocStatus[] = ["generating", "draft", "in_review", "ready", "in_production", "active", "published", "used", "archived"];
      return order.map((s) => ({ key: s, label: statusLabels[s], docs: docs.filter((d) => d.status === s) })).filter((g) => g.docs.length);
    }
    /* persona: docs that target a persona sit under it; the rest under "No persona". */
    const personas = all.filter((d) => d.type === "persona" && d.status !== "archived");
    const seen = new Set<string>();
    const out = personas.map((p) => {
      const ids = new Set(relations.filter((r) => r.to === p.id && (r.type === "targets_persona" || r.type === "uses_angle")).map((r) => r.from));
      const rows = docs.filter((d) => ids.has(d.id) || d.id === p.id);
      rows.forEach((d) => seen.add(d.id));
      return { key: p.id, label: p.title, docs: rows };
    });
    const rest = docs.filter((d) => !seen.has(d.id));
    if (rest.length) out.push({ key: "none", label: "No persona", docs: rest });
    return out.filter((g) => g.docs.length);
  }, [docs, all, relations, groupBy]);

  const allIds = docs.map((d) => d.id);
  const allSelected = selectable && allIds.length > 0 && allIds.every((id) => selected!.has(id));
  const someSelected = selectable && allIds.some((id) => selected!.has(id));

  const toggle = (id: string, on: boolean) => {
    if (!selectable) return;
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    onSelectedChange!(next);
  };

  return (
    <div className={cn("overflow-x-auto rounded-nav bg-panel", className)}>
      <table className="w-full min-w-[560px] table-fixed border-collapse text-default">
        <thead>
          <tr className="text-left text-cap text-ink-disabled">
            {selectable ? (
              <th className="w-10 px-3 py-2.5">
                <Checkbox
                  aria-label="Select all"
                  checked={allSelected}
                  indeterminate={!allSelected && someSelected}
                  onCheckedChange={(on) => onSelectedChange!(on ? new Set(allIds) : new Set())}
                />
              </th>
            ) : null}
            <th className="px-3 py-2.5 font-normal">Document</th>
            <th className="w-[112px] px-3 py-2.5 font-normal">Status</th>
            {!dense ? <th className="w-[176px] px-3 py-2.5 font-normal">Freshness · Related</th> : null}
            {!dense ? <th className="w-[60px] px-3 py-2.5 font-normal">Owner</th> : null}
            <th className="w-[84px] px-3 py-2.5 font-normal">Updated</th>
            <th className="w-[72px] px-3 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <Fragment key={g.key}>
              {g.label ? (
                <tr>
                  <td colSpan={columnCount} className="border-t border-line bg-canvas/40 px-3 pt-3 pb-1.5 text-cap text-ink-secondary">
                    <span className="text-ink">{g.label}</span> <span className="text-ink-disabled">· {g.docs.length}</span>
                  </td>
                </tr>
              ) : null}
              {g.docs.map((d) => (
                <Row
                  key={d.id}
                  doc={d}
                  all={all}
                  relations={relations}
                  now={now}
                  dense={dense}
                  selectable={selectable}
                  selected={selected?.has(d.id) ?? false}
                  onToggle={(on) => toggle(d.id, on)}
                  actions={actions}
                />
              ))}
            </Fragment>
          ))}
          {docs.length === 0 ? (
            <tr>
              <td colSpan={columnCount} className="px-3 py-14 text-center text-default text-ink-disabled">
                Nothing matches these filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function Row({
  doc,
  all,
  relations,
  now,
  dense,
  selectable,
  selected,
  onToggle,
  actions,
}: {
  doc: Document;
  all: Document[];
  relations: Relation[];
  now: Date;
  dense: boolean;
  selectable: boolean;
  selected: boolean;
  onToggle: (on: boolean) => void;
  actions: DocTableActions;
}) {
  const living = docTypes[doc.type].living;
  const generating = doc.status === "generating";
  const related = [...outgoing(relations, doc.id), ...incoming(relations, doc.id)]
    .map((r) => all.find((d) => d.id === (r.from === doc.id ? r.to : r.from)))
    .filter((d): d is Document => Boolean(d) && !brandTypes.includes(d!.type));
  const uniqueRelated = related.filter((d, i) => related.findIndex((x) => x.id === d.id) === i);
  const shortTitle = doc.title.split(" — ")[0];
  const rest = doc.title.split(" — ").slice(1).join(" — ");

  return (
    <tr
      onClick={() => actions.onOpen(doc.id)}
      className={cn(
        "group/row relative cursor-pointer border-t border-line transition-colors duration-100 hover:bg-[var(--state-hover)]",
        selected && "bg-[var(--state-selected)] hover:bg-[var(--state-selected)]",
      )}
    >
      {selectable ? (
        <td className="px-3 py-2.5 align-middle" onClick={(e) => e.stopPropagation()}>
          <Checkbox aria-label={`Select ${shortTitle}`} checked={selected} onCheckedChange={onToggle} className={cn(!selected && "opacity-40 group-hover/row:opacity-100")} />
        </td>
      ) : null}
      <td className="px-3 py-2.5 align-middle">
        <div className="flex items-center gap-3">
          <TypeIcon type={doc.type} size="sm" />
          <div className="flex min-w-0 flex-col">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-default text-ink">
                {shortTitle}
                {rest ? <span className="text-ink-secondary"> — {rest}</span> : null}
              </span>
              {doc.pendingDiff ? (
                <Badge tone="caution" dot={false} className="shrink-0">
                  {doc.pendingDiff.sections.length} proposed
                </Badge>
              ) : null}
            </div>
            <span className="truncate text-cap text-ink-disabled">{typeSuffix(doc.type, doc.subtype)}</span>
          </div>
        </div>
        {generating ? <GeneratingBar className="absolute inset-x-0 bottom-0 h-px rounded-none" /> : null}
      </td>
      <td className="px-3 py-2.5 align-middle">
        <StatusPill status={doc.status} />
      </td>
      {!dense ? (
        <td className="px-3 py-2.5 align-middle">
          {living ? (
            <FreshnessPill doc={doc} now={now} />
          ) : uniqueRelated.length ? (
            <span className="flex flex-wrap gap-1">
              {uniqueRelated.slice(0, 2).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    actions.onOpen(r.id);
                  }}
                  className="inline-flex max-w-[110px] items-center gap-1 truncate rounded-control bg-raised px-2 py-0.5 text-tiny text-ink-secondary hover:text-ink"
                >
                  <span className="size-1.5 shrink-0 rounded-full" style={{ background: `var(--color-type-${docTypes[r.type].hue})` }} />
                  <span className="truncate">{r.title.split(" — ")[0]}</span>
                </button>
              ))}
              {uniqueRelated.length > 2 ? <span className="text-tiny text-ink-disabled">+{uniqueRelated.length - 2}</span> : null}
            </span>
          ) : (
            <span className="text-cap text-ink-disabled">—</span>
          )}
        </td>
      ) : null}
      {!dense ? (
        <td className="px-3 py-2.5 align-middle">
          <OwnerMark doc={doc} />
        </td>
      ) : null}
      <td className="px-3 py-2.5 align-middle text-cap text-ink-secondary whitespace-nowrap">{relativeTime(doc.updatedAt, now)}</td>
      <td className="px-2 py-2.5 align-middle" onClick={(e) => e.stopPropagation()}>
        {/* Quiet until the row is hovered, but never hidden: the affordance has to be findable. */}
        <div className="flex items-center justify-end gap-0.5 text-ink-disabled transition-colors group-hover/row:text-ink-secondary focus-within:text-ink [&:has([aria-expanded=true])]:text-ink [&_button]:text-current">
          {actions.onPeek ? (
            <IconButton aria-label="Peek" size="sm" onClick={() => actions.onPeek!(doc.id)}>
              <Eye />
            </IconButton>
          ) : null}
          <Menu
            align="end"
            trigger={(props) => (
              <IconButton aria-label="More" size="sm" {...props}>
                <MoreHorizontal />
              </IconButton>
            )}
          >
            <MenuItem icon={<ArrowUpRight />} onClick={() => actions.onOpen(doc.id)}>
              Open
            </MenuItem>
            {actions.onChat ? (
              <MenuItem icon={<MessageSquare />} onClick={() => actions.onChat!(doc.id)}>
                Open in chat
              </MenuItem>
            ) : null}
            {actions.onDuplicate ? (
              <MenuItem icon={<Copy />} onClick={() => actions.onDuplicate!(doc.id)}>
                Duplicate
              </MenuItem>
            ) : null}
            {living ? (
              <>
                <MenuDivider />
                {actions.onVerify ? (
                  <MenuItem icon={<ShieldCheck />} onClick={() => actions.onVerify!(doc.id)}>
                    Verify for 90 days
                  </MenuItem>
                ) : null}
                {actions.onFlag ? (
                  <MenuItem icon={<TriangleAlert />} onClick={() => actions.onFlag!(doc.id)}>
                    Flag as outdated
                  </MenuItem>
                ) : null}
                {actions.onRefresh ? (
                  <MenuItem icon={<RefreshCw />} onClick={() => actions.onRefresh!(doc.id)}>
                    Request refresh
                  </MenuItem>
                ) : null}
              </>
            ) : null}
            {actions.onArchive && !brandTypes.includes(doc.type) && doc.status !== "archived" ? (
              <>
                <MenuDivider />
                <MenuItem icon={<Archive />} destructive onClick={() => actions.onArchive!(doc.id)}>
                  Archive
                </MenuItem>
              </>
            ) : null}
          </Menu>
        </div>
      </td>
    </tr>
  );
}
