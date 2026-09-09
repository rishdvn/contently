"use client";

import {
  Captions,
  Hammer,
  LayoutTemplate,
  MoreHorizontal,
  Music,
  Palette,
  Shapes,
  Sparkles,
  Type,
  Upload,
} from "lucide-react";

import { cn } from "@/lib/cn";
import { useEditor, type LeftTab } from "@/lib/editor/store";

import { Panel } from "../controls";

export const RAIL_TABS: { id: LeftTab; label: string; icon: React.ReactNode }[] = [
  { id: "build", label: "Build", icon: <Hammer /> },
  { id: "templates", label: "Templates", icon: <LayoutTemplate /> },
  { id: "blocks", label: "Blocks", icon: <Shapes /> },
  { id: "text", label: "Text", icon: <Type /> },
  { id: "stock", label: "Stock", icon: <Sparkles /> },
  { id: "audio", label: "Audio", icon: <Music /> },
  { id: "brandkit", label: "BrandKit", icon: <Palette /> },
  { id: "uploads", label: "Uploads", icon: <Upload /> },
  { id: "captions", label: "Captions", icon: <Captions /> },
];

/*
  The narrow rail on the far left: glyph over a tiny label, vertically
  centred, with the active tab picked out by a raised fill. Clicking the
  active tab closes its panel, as in the reference.
*/
export function Rail() {
  const tab = useEditor((s) => s.leftTab);
  const setLeftTab = useEditor((s) => s.setLeftTab);
  return (
    <Panel className="absolute top-1/2 left-2 flex w-12 -translate-y-1/2 flex-col items-center gap-0.5 py-2">
      {RAIL_TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-pressed={tab === t.id}
          onClick={() => setLeftTab(tab === t.id ? null : t.id)}
          className={cn(
            "flex w-10 flex-col items-center gap-1 rounded-[10px] py-1.5 transition-colors outline-none",
            tab === t.id ? "bg-raised text-ink" : "text-ink-secondary hover:bg-[var(--state-hover)] hover:text-ink",
          )}
        >
          <span className="[&>svg]:size-[18px]">{t.icon}</span>
          <span className="text-[9px] leading-none tracking-[0.3px]">{t.label}</span>
        </button>
      ))}
      <button type="button" aria-label="More" className="mt-1 flex size-8 items-center justify-center rounded-[10px] text-ink-secondary hover:bg-[var(--state-hover)] hover:text-ink [&>svg]:size-4">
        <MoreHorizontal />
      </button>
    </Panel>
  );
}
