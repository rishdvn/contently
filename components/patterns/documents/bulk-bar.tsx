"use client";

import { Archive, ChevronDown, MessageSquare, ShieldCheck, TriangleAlert, User, X } from "lucide-react";

import { Button, IconButton } from "@/components/ui/button";
import { Menu, MenuItem, MenuLabel } from "@/components/ui/menu";
import { Toolbar, ToolbarDivider } from "@/components/ui/toolbar";
import { statusLabels } from "@/lib/documents/registry";
import type { DocStatus } from "@/lib/documents/types";

/*
  Floats over the table once something is selected. It carries only the
  actions that make sense across a mixed selection; anything type-specific
  stays in the row menu. "Open in chat" is the one spectrum action because it
  hands the selection to the agent.
*/
export function BulkBar({
  count,
  statuses,
  livingCount,
  onStatus,
  onOwner,
  onVerify,
  onFlag,
  onArchive,
  onChat,
  onClear,
}: {
  count: number;
  /** Statuses the selected docs can move to (intersection of their enums). */
  statuses: DocStatus[];
  livingCount: number;
  onStatus: (s: DocStatus) => void;
  onOwner: (owner: string) => void;
  onVerify: () => void;
  onFlag: () => void;
  onArchive: () => void;
  onChat: () => void;
  onClear: () => void;
}) {
  if (count === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center" style={{ zIndex: "var(--z-floating-bar)" }}>
      <Toolbar className="pointer-events-auto animate-pop gap-1.5 pl-3.5">
        <span className="text-cap text-ink-secondary">
          <span className="text-ink">{count}</span> selected
        </span>
        <ToolbarDivider />
        <Menu
          trigger={(props) => (
            <Button variant="ghost" size="sm" {...props}>
              Status <ChevronDown className="size-3" />
            </Button>
          )}
        >
          <MenuLabel>Move to</MenuLabel>
          {statuses.map((s) => (
            <MenuItem key={s} onClick={() => onStatus(s)}>
              {statusLabels[s]}
            </MenuItem>
          ))}
          {!statuses.length ? <MenuItem disabled>No status shared by this selection</MenuItem> : null}
        </Menu>
        <Menu
          trigger={(props) => (
            <Button variant="ghost" size="sm" {...props}>
              <User /> Owner <ChevronDown className="size-3" />
            </Button>
          )}
        >
          {["Hanna Moore", "Agent", "Sam Ortiz"].map((o) => (
            <MenuItem key={o} onClick={() => onOwner(o)}>
              {o}
            </MenuItem>
          ))}
        </Menu>
        {livingCount > 0 ? (
          <>
            <Button variant="ghost" size="sm" onClick={onVerify}>
              <ShieldCheck /> Verify
            </Button>
            <Button variant="ghost" size="sm" onClick={onFlag}>
              <TriangleAlert /> Flag
            </Button>
          </>
        ) : null}
        <Button variant="ghost" size="sm" onClick={onArchive} className="text-ink-secondary hover:text-critical">
          <Archive /> Archive
        </Button>
        <ToolbarDivider />
        <Button variant="spectrum" size="sm" onClick={onChat}>
          <MessageSquare /> Open in chat
        </Button>
        <IconButton aria-label="Clear selection" size="sm" onClick={onClear}>
          <X />
        </IconButton>
      </Toolbar>
    </div>
  );
}
