"use client";

import {
  Captions,
  Hammer,
  LayoutTemplate,
  MoreVertical,
  Music,
  Palette,
  Shapes,
  Sparkles,
  Type,
  Upload,
} from "lucide-react";

import { Fragment } from "react";

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
export function Rail({ bottom }: { bottom: number }) {
  const tab = useEditor((s) => s.leftTab);
  const setLeftTab = useEditor((s) => s.setLeftTab);
  return (
    <Panel
      className="absolute left-3 flex w-[60px] -translate-y-1/2 flex-col items-center py-1.5"
      /* Centred in the canvas area that remains above the timeline, not the whole window. */
      style={{ top: `calc((100% - ${bottom}px) / 2)` }}
    >
      {RAIL_TABS.map((t, i) => (
        <Fragment key={t.id}>
          {i === WORKSPACE_START ? <div className="my-1 h-px w-8 bg-line-strong" /> : null}
          <button
            type="button"
            aria-pressed={tab === t.id}
            onClick={() => setLeftTab(tab === t.id ? null : t.id)}
            className={cn(
              "flex w-[52px] flex-col items-center gap-[5px] rounded-[10px] py-2 transition-colors outline-none",
              tab === t.id ? "bg-raised text-ink" : "text-ink-secondary hover:bg-[var(--state-hover)] hover:text-ink",
            )}
          >
            <span className="[&>svg]:size-[22px] [&>svg]:stroke-[1.5]">{t.icon}</span>
            <span className="text-[10px] leading-none tracking-[0.2px]">{t.label}</span>
          </button>
        </Fragment>
      ))}
      <button type="button" aria-label="More" className="mt-1 flex h-8 w-[52px] items-center justify-center rounded-[10px] text-ink-secondary hover:bg-[var(--state-hover)] hover:text-ink [&>svg]:size-4">
        <MoreVertical />
      </button>
    </Panel>
  );
}

/* Index of the first workspace tab; the reference rules a hairline between the two groups. */
const WORKSPACE_START = 6;
