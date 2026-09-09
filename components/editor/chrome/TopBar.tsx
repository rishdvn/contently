"use client";

import {
  ChevronDown,
  CircleHelp,
  Maximize,
  MessageCircle,
  Redo2,
  Smartphone,
  Undo2,
} from "lucide-react";
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
  Top chrome: identity on the left, a floating command pill in the centre.
  Mirrors the reference — undo/redo · ratio · quality · zoom · comments · help
  · Share · Export — with the export split button carrying the only filled
  treatment on the bar.
*/
export function TopBar() {
  return (
    <>
      <div className="pointer-events-auto absolute top-3.5 left-4 flex items-center gap-2.5">
        <Link href="/" className="flex size-6 items-center justify-center rounded-[6px] bg-ink text-canvas" aria-label="Home">
          <span className="text-[13px] font-semibold italic leading-none">C</span>
        </Link>
        <ProjectName />
      </div>
      <Panel className="absolute top-2 left-1/2 flex h-11 -translate-x-1/2 items-center gap-0.5 px-1.5">
        <HistoryButtons />
        <Divider />
        <AspectPicker />
        <QualityPicker />
        <ZoomPicker />
        <Divider />
        <Tooltip label="Comments" side="bottom">
          <button type="button" className={iconBtn} aria-label="Comments">
            <MessageCircle />
          </button>
        </Tooltip>
        <Tooltip label="Help" side="bottom">
          <button type="button" className={iconBtn} aria-label="Help">
            <CircleHelp />
          </button>
        </Tooltip>
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

function QualityPicker() {
  const [q, setQ] = useState("High");
  return (
    <Menu
      trigger={(p) => (
        <button type="button" className={textBtn} {...p}>
          {q}
          <ChevronDown className="!size-3 text-ink-disabled" />
        </button>
      )}
    >
      {["Best", "High", "Medium", "Low"].map((o) => (
        <MenuItem key={o} onClick={() => setQ(o)} className={cn(o === q && "bg-[var(--state-selected)]")}>
          {o}
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
      <div className={cn("ml-0.5 flex h-8 items-stretch overflow-hidden rounded-[8px] ring-1 ring-line-strong", dialog === "export" && "bg-[var(--state-selected)]")}>
        <button type="button" data-flyout-trigger className="px-3 text-ui text-ink transition-colors hover:bg-[var(--state-hover)]" onClick={() => toggle("export")}>
          Export
        </button>
        <Menu
          align="end"
          trigger={(p) => (
            <button type="button" className="flex w-7 items-center justify-center border-l border-line-strong text-ink-secondary transition-colors hover:bg-[var(--state-hover)] hover:text-ink" aria-label="Export options" {...p}>
              <ChevronDown className="size-3.5" />
            </button>
          )}
        >
          <MenuItem onClick={() => setDialog("export")}>Export image…</MenuItem>
          <MenuItem onClick={() => setDialog("export")}>Export all slides…</MenuItem>
        </Menu>
      </div>
    </>
  );
}
