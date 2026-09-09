"use client";

import { PanelLeftClose, Search } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { useEditor } from "@/lib/editor/store";

import { Panel } from "../controls";
import { AudioPanel, BrandkitPanel, BuildPanel, CaptionsPanel, StockPanel, UploadsPanel } from "./panels/misc";
import { BlocksPanel, TemplatesPanel, TextPanel } from "./panels/library";

export const LEFT_PANEL_WIDTH = 320;
export const LEFT_PANEL_X = 62;

/*
  The flyout beside the rail. One shell, nine bodies. It is a floating surface
  like everything else: the canvas continues underneath it.
*/
export function LeftPanel() {
  const tab = useEditor((s) => s.leftTab);
  if (!tab) return null;
  return (
    <Panel
      className="absolute top-16 bottom-2 flex flex-col overflow-hidden"
      style={{ left: LEFT_PANEL_X, width: LEFT_PANEL_WIDTH }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {tab === "build" ? <BuildPanel /> : null}
      {tab === "templates" ? <TemplatesPanel /> : null}
      {tab === "blocks" ? <BlocksPanel /> : null}
      {tab === "text" ? <TextPanel /> : null}
      {tab === "stock" ? <StockPanel /> : null}
      {tab === "audio" ? <AudioPanel /> : null}
      {tab === "brandkit" ? <BrandkitPanel /> : null}
      {tab === "uploads" ? <UploadsPanel /> : null}
      {tab === "captions" ? <CaptionsPanel /> : null}
    </Panel>
  );
}

/* ---------------------------------------------------- shared pieces --- */

export function PanelHeader({ title, children, description }: { title?: ReactNode; children?: ReactNode; description?: ReactNode }) {
  const setLeftTab = useEditor((s) => s.setLeftTab);
  return (
    <div className="flex flex-col gap-2 px-3 pt-3 pb-2">
      <div className="flex items-center gap-2">
        {title ? <div className="min-w-0 flex-1 truncate text-panels text-ink">{title}</div> : null}
        {children}
        <button
          type="button"
          aria-label="Collapse panel"
          className="flex size-7 shrink-0 items-center justify-center rounded-[6px] text-ink-secondary hover:bg-[var(--state-hover)] hover:text-ink [&>svg]:size-4"
          onClick={() => setLeftTab(null)}
        >
          <PanelLeftClose />
        </button>
      </div>
      {description ? <p className="text-cap text-ink-secondary">{description}</p> : null}
    </div>
  );
}

export function PanelSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative min-w-0 flex-1">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-secondary" />
      <input
        className="h-8 w-full rounded-full bg-card pr-3 pl-8 text-ui text-ink placeholder:text-ink-disabled outline-none focus:ring-1 focus:ring-line-strong"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function PanelBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto px-3 pb-3", className)}>{children}</div>;
}

/* The white full-width primary action at the top of a panel ("Add Standard Text"). */
export function PanelPrimary({ children, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className="mx-3 mb-2 flex h-8 items-center justify-center gap-1.5 rounded-[8px] bg-ink text-ui text-canvas transition-colors hover:bg-white [&>svg]:size-3.5"
      {...props}
    >
      {children}
    </button>
  );
}

export function PanelTabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="flex items-center gap-4 px-3 pb-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={cn("pb-1 text-default transition-colors", o.value === value ? "border-b border-ink text-ink" : "border-b border-transparent text-ink-disabled hover:text-ink-secondary")}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function CategoryList<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: readonly T[] }) {
  return (
    <div className="flex w-[84px] shrink-0 flex-col gap-0.5">
      {options.map((c) => (
        <button
          key={c}
          type="button"
          className={cn(
            "rounded-[6px] px-2 py-1.5 text-left text-cap leading-tight transition-colors",
            c === value ? "bg-raised text-ink" : "text-ink-secondary hover:text-ink",
          )}
          onClick={() => onChange(c)}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
