"use client";

import { LayoutTemplate, X } from "lucide-react";

import { useUserFlag } from "@/lib/auth/useUserFlag";
import { useEditor } from "@/lib/editor/store";

/*
  The first blank project a person opens points at the Templates tab, which is
  the fastest way from an empty canvas to something worth editing. It sits
  beside the tab it names, goes the moment the canvas has anything on it or a
  flyout is open, and once dismissed — or once Templates has been opened from
  it — it never comes back, on any machine (`users.flags`).
*/
export function TemplatesHint() {
  const dismissed = useUserFlag("templatesHintDismissed");
  const blank = useEditor((s) => s.project.slides.every((slide) => slide.blocks.length === 0) && s.project.audio.length === 0);
  const flyout = useEditor((s) => s.leftTab !== null);
  const setLeftTab = useEditor((s) => s.setLeftTab);

  if (dismissed.value !== false || !blank || flyout) return null;

  return (
    <div role="note" aria-label="Tip" className="absolute top-1.5 left-[calc(100%+12px)] flex w-[248px] items-start gap-3 rounded-[12px] bg-raised p-3 shadow-overlay" style={{ zIndex: "var(--z-floating-bar)" }}>
      {/* The arrow, pointing back at the tab. */}
      <span aria-hidden className="absolute top-5 -left-1 size-2.5 rotate-45 rounded-[2px] bg-raised" />
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-card text-ink [&>svg]:size-4">
        <LayoutTemplate />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-ui text-ink">Add a scene from a template</div>
        <p className="mt-1 text-cap text-ink-secondary">Finished scenes you can drop in and make your own.</p>
        <button
          type="button"
          className="mt-2.5 h-7 rounded-[8px] bg-ink px-2.5 text-cap text-canvas transition-colors hover:bg-white"
          onClick={() => {
            dismissed.set(true);
            setLeftTab("templates");
          }}
        >
          Show templates
        </button>
      </div>
      <button type="button" aria-label="Dismiss tip" className="-mt-1 -mr-1 flex size-6 shrink-0 items-center justify-center rounded-[6px] text-ink-secondary transition-colors hover:bg-[var(--state-hover)] hover:text-ink" onClick={() => dismissed.set(true)}>
        <X className="size-3.5" />
      </button>
    </div>
  );
}
