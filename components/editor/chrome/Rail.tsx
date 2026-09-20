"use client";

import { LayoutTemplate, MoreVertical, Music, Shapes, Sparkles, Type, Upload } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { create } from "zustand";

import { MenuItem } from "@/components/ui/menu";
import { cn } from "@/lib/cn";
import { useEditor, type LeftTab } from "@/lib/editor/store";

import { Panel } from "../controls";

export const RAIL_TABS: { id: LeftTab; label: string; icon: React.ReactNode }[] = [
  { id: "templates", label: "Templates", icon: <LayoutTemplate /> },
  { id: "blocks", label: "Blocks", icon: <Shapes /> },
  { id: "text", label: "Text", icon: <Type /> },
  { id: "stock", label: "Stock", icon: <Sparkles /> },
  { id: "audio", label: "Audio", icon: <Music /> },
  { id: "uploads", label: "Uploads", icon: <Upload /> },
];

/* Index of the first workspace tab; the reference rules a hairline between the two groups. */
const WORKSPACE_START = 5;

/* Geometry used to decide how many tabs fit before the rest go under ⋮. */
const ITEM_H = 53;
const RULE_H = 9;
const MORE_H = 36;
const PAD_Y = 12;

/*
  Hovering a rail tab peeks its panel; clicking pins it. The peek is chrome
  state shared between the rail and the flyout, so it lives here rather than
  in the document store. Timers give the pointer room to travel from the tab
  to the panel without the peek collapsing in between.
*/
type Peek = {
  tab: LeftTab | null;
  open: (tab: LeftTab) => void;
  hold: () => void;
  release: () => void;
  clear: () => void;
};

let openTimer: ReturnType<typeof setTimeout> | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;
const cancel = () => {
  if (openTimer) clearTimeout(openTimer);
  if (closeTimer) clearTimeout(closeTimer);
  openTimer = closeTimer = null;
};

export const usePeek = create<Peek>((set) => ({
  tab: null,
  open: (tab) => {
    cancel();
    openTimer = setTimeout(() => set({ tab }), 120);
  },
  hold: () => {
    if (closeTimer) clearTimeout(closeTimer);
    closeTimer = null;
  },
  release: () => {
    if (openTimer) clearTimeout(openTimer);
    openTimer = null;
    closeTimer = setTimeout(() => set({ tab: null }), 260);
  },
  clear: () => {
    cancel();
    set({ tab: null });
  },
}));

/*
  The narrow rail on the far left: glyph over a tiny label. It centres in the
  canvas area above the timeline while it fits; when the timeline grows it
  anchors below the top bar and folds the tabs that no longer fit into a ⋮
  menu, exactly as the reference does.
*/
export function Rail({ top, bottom }: { top: number; bottom: number }) {
  const tab = useEditor((s) => s.leftTab);
  const setLeftTab = useEditor((s) => s.setLeftTab);
  const peek = usePeek((s) => s.tab);
  const openPeek = usePeek((s) => s.open);
  const releasePeek = usePeek((s) => s.release);
  const clearPeek = usePeek((s) => s.clear);
  const [avail, setAvail] = useState(1200);
  const [more, setMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const measure = () => setAvail(window.innerHeight - top - bottom - 16);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [top, bottom]);

  useEffect(() => {
    if (!more) return;
    const onDown = (e: PointerEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMore(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMore(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [more]);

  const fits = (n: number) => PAD_Y + n * ITEM_H + (n > WORKSPACE_START ? RULE_H : 0) + MORE_H;
  let visible = RAIL_TABS.length;
  while (visible > 2 && fits(visible) > avail) visible--;
  const shown = RAIL_TABS.slice(0, visible);
  const hidden = RAIL_TABS.slice(visible);
  const centred = fits(RAIL_TABS.length) <= avail;

  const pick = (id: LeftTab) => {
    clearPeek();
    setLeftTab(tab === id ? null : id);
    setMore(false);
  };

  return (
    <Panel
      className={cn("absolute left-3 flex w-[60px] flex-col items-center py-1.5", centred && "-translate-y-1/2")}
      style={centred ? { top: `calc((100% - ${bottom}px) / 2)` } : { top: top + 8 }}
      onPointerLeave={releasePeek}
    >
      {shown.map((t, i) => (
        <Fragment key={t.id}>
          {i === WORKSPACE_START ? <div className="my-1 h-px w-8 bg-line-strong" /> : null}
          <button
            type="button"
            aria-pressed={tab === t.id}
            onPointerEnter={() => tab !== t.id && openPeek(t.id)}
            onClick={() => pick(t.id)}
            className={cn(
              "flex w-[52px] flex-col items-center gap-[5px] rounded-[10px] py-2 transition-colors outline-none",
              tab === t.id ? "bg-raised text-ink" : peek === t.id ? "bg-[var(--state-hover)] text-ink" : "text-ink-secondary hover:bg-[var(--state-hover)] hover:text-ink",
            )}
          >
            <span className="[&>svg]:size-[22px] [&>svg]:stroke-[1.5]">{t.icon}</span>
            <span className="text-[10px] leading-none tracking-[0.2px]">{t.label}</span>
          </button>
        </Fragment>
      ))}
      <div ref={moreRef} className="relative mt-1">
        <button
          type="button"
          aria-label={hidden.length ? `${hidden.length} more tools` : "More"}
          aria-expanded={more}
          onClick={() => setMore((m) => !m)}
          className={cn(
            "flex h-8 w-[52px] items-center justify-center rounded-[10px] text-ink-secondary transition-colors hover:bg-[var(--state-hover)] hover:text-ink [&>svg]:size-4",
            more && "bg-[var(--state-hover)] text-ink",
          )}
        >
          <MoreVertical />
        </button>
        {more ? (
          <div role="menu" className="absolute bottom-0 left-[calc(100%+10px)] min-w-[160px] rounded-control bg-panel p-1.5 shadow-overlay animate-pop" style={{ zIndex: "var(--z-floating-bar)" }}>
            {hidden.length ? (
              hidden.map((t) => (
                <MenuItem key={t.id} icon={t.icon} onClick={() => pick(t.id)}>
                  {t.label}
                </MenuItem>
              ))
            ) : (
              <div className="px-2.5 py-1.5 text-cap text-ink-secondary">Everything fits</div>
            )}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
