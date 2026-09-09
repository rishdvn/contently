"use client";

import { Bookmark, ChevronDown, Filter as FilterIcon, Rows3, Sparkles, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Chip, ChipRow } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Menu, MenuDivider, MenuItem, MenuLabel } from "@/components/ui/menu";
import { cn } from "@/lib/cn";
import { docTypes, statusLabels, workTypes } from "@/lib/documents/registry";
import { filterLabel, filtersFromQuery, sameFilter } from "@/lib/documents/selectors";
import type { DocStatus, Document, Filter, QuickFilter, SavedFilter } from "@/lib/documents/types";

import type { GroupBy } from "./doc-table";

/*
  Filtering has two entry points and one representation. Quick filters are the
  four questions the founder asks every morning; the agent field takes a
  sentence. Both produce chips, and chips are the only thing that filters —
  so what is applied is always visible and always removable.
*/

const quickLabels: Record<QuickFilter, string> = {
  needs_review: "Needs review",
  stale: "Stale",
  generating: "Generating",
  unused: "Unused",
};

export function QuickFilters({
  counts,
  active,
  onToggle,
  className,
}: {
  counts: Record<QuickFilter, number>;
  active: QuickFilter[];
  onToggle: (q: QuickFilter) => void;
  className?: string;
}) {
  return (
    <ChipRow className={className}>
      {(Object.keys(quickLabels) as QuickFilter[]).map((q) => (
        <Chip key={q} selected={active.includes(q)} onClick={() => onToggle(q)} className="h-8 text-cap">
          {quickLabels[q]}
          <span className={cn("text-tiny", active.includes(q) ? "text-canvas/70" : "text-ink-disabled")}>{counts[q]}</span>
        </Chip>
      ))}
    </ChipRow>
  );
}

export function FilterChips({
  filters,
  docs,
  onRemove,
  onClear,
}: {
  filters: Filter[];
  docs: Document[];
  onRemove: (f: Filter) => void;
  onClear: () => void;
}) {
  if (!filters.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {filters.map((f) => (
        <span key={`${f.kind}:${f.value}`} className="inline-flex h-7 items-center gap-1 rounded-control bg-ink pr-1 pl-2.5 text-cap text-canvas">
          <span className="text-canvas/60">{f.kind === "quick" || f.kind === "text" ? "" : `${f.kind} · `}</span>
          {filterLabel(f, docs)}
          <button type="button" aria-label={`Remove ${filterLabel(f, docs)}`} onClick={() => onRemove(f)} className="ml-0.5 flex size-5 items-center justify-center rounded hover:bg-canvas/15">
            <X className="size-3" />
          </button>
        </span>
      ))}
      <button type="button" onClick={onClear} className="px-1.5 text-cap text-ink-secondary hover:text-ink">
        Clear
      </button>
    </div>
  );
}

/** "All briefs for P1 that haven't been used" → chips. */
export function AskFilter({ docs, onFilters, className }: { docs: Document[]; onFilters: (f: Filter[]) => void; className?: string }) {
  const [value, setValue] = useState("");
  const [miss, setMiss] = useState(false);
  const submit = () => {
    const f = filtersFromQuery(value, docs);
    if (!f.length) {
      setMiss(true);
      setTimeout(() => setMiss(false), 1800);
      return;
    }
    onFilters(f);
    setValue("");
  };
  return (
    <div className={cn("relative", className)}>
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder={miss ? "Try a type, a status or a persona — “unused briefs for P1”" : "Ask for a view: “briefs for P1 that haven't been used”"}
        leading={<Sparkles />}
        aria-label="Ask the agent for a filtered view"
        className={cn("h-8.5 pr-16 text-ui", miss && "border-caution")}
      />
      {value.trim() ? (
        <Button size="sm" variant="primary" onClick={submit} className="absolute top-1/2 right-1 h-6.5 -translate-y-1/2 px-2.5 text-tiny">
          Apply
        </Button>
      ) : null}
    </div>
  );
}

export function FilterMenus({
  filters,
  onAdd,
  groupBy,
  onGroupBy,
  savedFilters,
  onApplySaved,
  onSaveCurrent,
  onDeleteSaved,
}: {
  filters: Filter[];
  onAdd: (f: Filter) => void;
  groupBy: GroupBy;
  onGroupBy: (g: GroupBy) => void;
  savedFilters: SavedFilter[];
  onApplySaved: (s: SavedFilter) => void;
  onSaveCurrent: () => void;
  onDeleteSaved: (id: string) => void;
}) {
  const has = (f: Filter) => filters.some((g) => sameFilter(f, g));
  const statuses: DocStatus[] = ["draft", "in_review", "ready", "in_production", "active", "published", "used", "generating"];
  const groupLabel: Record<GroupBy, string> = { none: "No grouping", type: "Group by type", status: "Group by status", persona: "Group by persona" };
  return (
    <div className="flex items-center gap-1">
      <Menu
        trigger={(props) => (
          <Button variant="ghost" size="sm" {...props}>
            <FilterIcon /> Filter <ChevronDown className="size-3" />
          </Button>
        )}
      >
        <MenuLabel>Type</MenuLabel>
        {workTypes.map((t) => (
          <MenuItem key={t} disabled={has({ kind: "type", value: t })} onClick={() => onAdd({ kind: "type", value: t })}>
            {docTypes[t].plural}
          </MenuItem>
        ))}
        <MenuDivider />
        <MenuLabel>Status</MenuLabel>
        {statuses.map((s) => (
          <MenuItem key={s} disabled={has({ kind: "status", value: s })} onClick={() => onAdd({ kind: "status", value: s })}>
            {statusLabels[s]}
          </MenuItem>
        ))}
        <MenuDivider />
        <MenuLabel>Owner</MenuLabel>
        <MenuItem onClick={() => onAdd({ kind: "owner", value: "agent" })}>By Agent</MenuItem>
        <MenuItem onClick={() => onAdd({ kind: "owner", value: "user" })}>By me</MenuItem>
      </Menu>
      <Menu
        trigger={(props) => (
          <Button variant="ghost" size="sm" {...props}>
            <Rows3 /> {groupLabel[groupBy]} <ChevronDown className="size-3" />
          </Button>
        )}
      >
        {(Object.keys(groupLabel) as GroupBy[]).map((g) => (
          <MenuItem key={g} onClick={() => onGroupBy(g)}>
            {groupLabel[g]}
          </MenuItem>
        ))}
      </Menu>
      <Menu
        align="end"
        trigger={(props) => (
          <Button variant="ghost" size="sm" {...props}>
            <Bookmark /> Views <ChevronDown className="size-3" />
          </Button>
        )}
      >
        {savedFilters.length ? <MenuLabel>Saved</MenuLabel> : null}
        {savedFilters.map((s) => (
          <div key={s.id} className="group/sv flex items-center">
            <MenuItem onClick={() => onApplySaved(s)} className="flex-1">
              {s.label}
            </MenuItem>
            <button
              type="button"
              aria-label={`Delete view ${s.label}`}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteSaved(s.id);
              }}
              className="mr-1 flex size-6 items-center justify-center rounded text-ink-disabled opacity-0 hover:text-ink group-hover/sv:opacity-100"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
        {savedFilters.length ? <MenuDivider /> : null}
        <MenuItem icon={<Bookmark />} disabled={!filters.length} onClick={onSaveCurrent}>
          Save current filters as a view
        </MenuItem>
      </Menu>
    </div>
  );
}
