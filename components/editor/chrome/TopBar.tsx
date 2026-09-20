"use client";

import { ChevronDown, Maximize, Redo2, Smartphone, Undo2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Menu, MenuItem } from "@/components/ui/menu";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { redo, undo, useEditor, useTemporal } from "@/lib/editor/store";
import { ASPECTS, type AspectId } from "@/lib/editor/types";

import { cameraRef } from "../canvas/Viewport";
import { Panel } from "../controls";

/*
  Top chrome: identity on the left, a floating command pill in the centre —
  undo/redo · ratio · zoom · Share · Export. Every control on the bar acts on
  the project; the reference's comments, help and export-preset affordances are
  out of scope for V1 and are not stubbed here.
*/
export function TopBar({ left, right }: { left: number; right: number }) {
  return (
    <>
      <div className="pointer-events-auto absolute top-3.5 left-4 flex items-center gap-2.5">
        <Link href="/" className="flex size-6 items-center justify-center rounded-[6px] bg-ink text-canvas" aria-label="Home">
          <span className="text-[13px] font-semibold italic leading-none">C</span>
        </Link>
        <ProjectName />
      </div>
      <Panel className="absolute top-2 flex h-11 -translate-x-1/2 items-center gap-0.5 px-1.5" style={{ left: `calc(${left}px + (100% - ${left + right}px) / 2)` }}>
        <HistoryButtons />
        <Divider />
        <AspectPicker />
        <ZoomPicker />
        <Divider />
        <ShareExport />
      </Panel>
    </>
  );
}

const iconBtn =
  "flex size-8 items-center justify-center rounded-[8px] text-ink-secondary transition-colors hover:bg-[var(--state-hover)] hover:text-ink disabled:pointer-events-none disabled:text-ink-disabled [&>svg]:size-4";

const textBtn =
  "flex h-8 items-center gap-1 rounded-[8px] px-2 text-ui text-ink-secondary transition-colors hover:bg-[var(--state-hover)] hover:text-ink [&>svg]:size-3.5";

function Divider() {
  return <div className="mx-1 h-4 w-px bg-line-strong" />;
}

function ProjectName() {
  const name = useEditor((s) => s.project.name);
  const rename = useEditor((s) => s.rename);
  const [draft, setDraft] = useState(name);
  const [seen, setSeen] = useState(name);
  if (name !== seen) {
    setSeen(name);
    setDraft(name);
  }
  return (
    <input
      aria-label="Project name"
      className="h-7 min-w-[80px] rounded-[6px] bg-transparent px-1.5 text-ui text-ink outline-none hover:bg-[var(--state-hover)] focus:bg-card"
      style={{ width: `${Math.max(8, draft.length + 1)}ch` }}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft.trim() && draft !== name && rename(draft.trim())}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

function HistoryButtons() {
  const canUndo = useTemporal((t) => t.pastStates.length > 0);
  const canRedo = useTemporal((t) => t.futureStates.length > 0);
  return (
    <>
      <Tooltip label="Undo (⌘Z)" side="bottom">
        <button type="button" className={iconBtn} disabled={!canUndo} onClick={undo} aria-label="Undo">
          <Undo2 />
        </button>
      </Tooltip>
      <Tooltip label="Redo (⇧⌘Z)" side="bottom">
        <button type="button" className={iconBtn} disabled={!canRedo} onClick={redo} aria-label="Redo">
          <Redo2 />
        </button>
      </Tooltip>
    </>
  );
}

function AspectPicker() {
  const aspect = useEditor((s) => s.project.aspect);
  const setAspect = useEditor((s) => s.setAspect);
  return (
    <Menu
      trigger={(p) => (
        <button type="button" className={textBtn} {...p}>
          <Smartphone />
          {aspect}
          <ChevronDown className="!size-3 text-ink-disabled" />
        </button>
      )}
    >
      {(Object.keys(ASPECTS) as AspectId[]).map((a) => (
        <MenuItem key={a} onClick={() => setAspect(a)} shortcut={a} className={cn(a === aspect && "bg-[var(--state-selected)]")}>
          {ASPECTS[a].label}
        </MenuItem>
      ))}
    </Menu>
  );
}

function ZoomPicker() {
  const zoom = useEditor((s) => s.viewport.zoom);
  return (
    <>
      <Menu
        trigger={(p) => (
          <button type="button" className={cn(textBtn, "min-w-[62px] justify-center")} {...p}>
            {Math.round(zoom * 100)}%
            <ChevronDown className="!size-3 text-ink-disabled" />
          </button>
        )}
      >
        {[0.25, 0.5, 1, 2].map((z) => (
          <MenuItem key={z} onClick={() => cameraRef.current?.zoomTo(z)} className={cn(Math.abs(z - zoom) < 0.005 && "bg-[var(--state-selected)]")}>
            {z * 100}%
          </MenuItem>
        ))}
        <MenuItem onClick={() => cameraRef.current?.fit()} shortcut="⇧1">
          Fit to screen
        </MenuItem>
      </Menu>
      <Tooltip label="Fit to screen" side="bottom">
        <button type="button" className={iconBtn} onClick={() => cameraRef.current?.fit()} aria-label="Fit to screen">
          <Maximize />
        </button>
      </Tooltip>
    </>
  );
}

function ShareExport() {
  const dialog = useEditor((s) => s.dialog);
  const setDialog = useEditor((s) => s.setDialog);
  const toggle = (d: "share" | "export") => setDialog(dialog === d ? null : d);
  return (
    <>
      <button type="button" data-flyout-trigger className={cn(textBtn, "text-ink", dialog === "share" && "bg-[var(--state-selected)]")} onClick={() => toggle("share")}>
        Share
      </button>
      {/* One button, not a split one: the dialog already carries format, size and range. */}
      <button
        type="button"
        data-flyout-trigger
        className={cn("ml-0.5 flex h-8 items-center rounded-[8px] px-3 text-ui text-ink ring-1 ring-line-strong transition-colors hover:bg-[var(--state-hover)]", dialog === "export" && "bg-[var(--state-selected)]")}
        onClick={() => toggle("export")}
      >
        Export
      </button>
    </>
  );
}
