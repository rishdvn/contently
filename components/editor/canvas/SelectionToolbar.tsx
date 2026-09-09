"use client";

import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Copy,
  Crop,
  FlipHorizontal2,
  FlipVertical2,
  ImageDown,
  Lock,
  LockOpen,
  MoreHorizontal,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useLayoutEffect, useRef } from "react";

import { Menu, MenuDivider, MenuItem } from "@/components/ui/menu";
import { Tooltip } from "@/components/ui/tooltip";
import { useEditor, useSelectedBlocks } from "@/lib/editor/store";

/*
  The dark pill that rises above a selection, as in the reference: flip,
  duplicate, lock, delete, and an overflow for ordering. Positioned from the
  live DOM so it tracks rotation and zoom without knowing about either.
*/
export function SelectionToolbar({ container }: { container: HTMLDivElement | null }) {
  const selection = useEditor((s) => s.selection);
  const blocks = useSelectedBlocks();
  const interacting = useEditor((s) => s.interacting);
  const editing = useEditor((s) => s.editingTextId);
  const viewport = useEditor((s) => s.viewport);
  const project = useEditor((s) => s.project);
  const updateBlock = useEditor((s) => s.updateBlock);
  const duplicateBlocks = useEditor((s) => s.duplicateBlocks);
  const removeBlocks = useEditor((s) => s.removeBlocks);
  const reorder = useEditor((s) => s.reorder);
  const setBackground = useEditor((s) => s.setBackground);
  const setLeftTab = useEditor((s) => s.setLeftTab);
  const activeSlideId = useEditor((s) => s.activeSlideId);

  const ref = useRef<HTMLDivElement>(null);

  /* Position is written straight to the node after layout: it is derived from the DOM, not state. */
  useLayoutEffect(() => {
    const el = ref.current;
    const vp = container;
    if (!el || !vp) return;
    const vr = vp.getBoundingClientRect();
    const rects = selection
      .map((id) => vp.querySelector(`.block[data-block-id="${id}"]`)?.getBoundingClientRect())
      .filter(Boolean) as DOMRect[];
    if (!rects.length) {
      el.style.visibility = "hidden";
      return;
    }
    const top = Math.min(...rects.map((r) => r.top));
    const left = Math.min(...rects.map((r) => r.left));
    const right = Math.max(...rects.map((r) => r.right));
    const x = Math.min(Math.max((left + right) / 2 - vr.left, 160), vp.clientWidth - 160);
    el.style.left = `${x}px`;
    el.style.top = `${Math.max(8, top - vr.top - 52)}px`;
    el.style.visibility = "visible";
  }, [selection, viewport, project, container, interacting, blocks]);

  if (interacting || editing || !blocks.length) return null;

  const one = blocks.length === 1 ? blocks[0] : null;
  const allLocked = blocks.every((b) => b.locked);
  const ids = blocks.map((b) => b.id);

  return (
    <div
      ref={ref}
      className="selection-toolbar absolute flex items-center gap-0.5 rounded-[12px] bg-card p-1 shadow-overlay animate-pop"
      style={{ visibility: "hidden", transform: "translateX(-50%)", zIndex: "var(--z-floating-bar)" }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {one && (one.type === "image" || one.type === "video") ? (
        <>
          <ToolbarButton label="Replace" onClick={() => setLeftTab("uploads")}>
            <RefreshCw />
          </ToolbarButton>
          <ToolbarButton label={one.fit === "cover" ? "Fit inside" : "Fill frame"} onClick={() => updateBlock(one.id, { fit: one.fit === "cover" ? "contain" : "cover" })}>
            <Crop />
          </ToolbarButton>
          <Divider />
        </>
      ) : null}
      <ToolbarButton label="Flip horizontal" onClick={() => blocks.forEach((b) => updateBlock(b.id, { flipX: !b.flipX }))}>
        <FlipHorizontal2 />
      </ToolbarButton>
      <ToolbarButton label="Flip vertical" onClick={() => blocks.forEach((b) => updateBlock(b.id, { flipY: !b.flipY }))}>
        <FlipVertical2 />
      </ToolbarButton>
      <ToolbarButton label="Duplicate" onClick={() => duplicateBlocks(ids)}>
        <Copy />
      </ToolbarButton>
      <ToolbarButton label={allLocked ? "Unlock" : "Lock"} onClick={() => blocks.forEach((b) => updateBlock(b.id, { locked: !allLocked }))}>
        {allLocked ? <LockOpen /> : <Lock />}
      </ToolbarButton>
      <ToolbarButton label="Delete" onClick={() => removeBlocks(ids)}>
        <Trash2 />
      </ToolbarButton>
      <Divider />
      <Menu
        align="end"
        trigger={(p) => (
          <ToolbarButton label="More" {...p}>
            <MoreHorizontal />
          </ToolbarButton>
        )}
      >
        <MenuItem icon={<ArrowUpToLine />} onClick={() => ids.forEach((id) => reorder(id, "front"))}>
          Bring to front
        </MenuItem>
        <MenuItem icon={<ArrowUp />} shortcut="⌘]" onClick={() => ids.forEach((id) => reorder(id, "forward"))}>
          Bring forward
        </MenuItem>
        <MenuItem icon={<ArrowDown />} shortcut="⌘[" onClick={() => ids.forEach((id) => reorder(id, "backward"))}>
          Send backward
        </MenuItem>
        <MenuItem icon={<ArrowDownToLine />} onClick={() => ids.forEach((id) => reorder(id, "back"))}>
          Send to back
        </MenuItem>
        {one && one.type === "image" ? (
          <>
            <MenuDivider />
            <MenuItem
              icon={<ImageDown />}
              onClick={() => {
                setBackground(activeSlideId, { type: "image", src: one.src, focalX: one.focalX, focalY: one.focalY, adjustments: one.adjustments });
                removeBlocks([one.id]);
              }}
            >
              Set as background
            </MenuItem>
          </>
        ) : null}
      </Menu>
    </div>
  );
}

function ToolbarButton({
  label,
  children,
  ...props
}: React.ComponentProps<"button"> & { label: string }) {
  return (
    <Tooltip label={label} side="bottom">
      <button
        type="button"
        aria-label={label}
        className="flex size-8 items-center justify-center rounded-[8px] text-ink-secondary transition-colors hover:bg-[var(--state-hover)] hover:text-ink [&>svg]:size-4"
        {...props}
      >
        {children}
      </button>
    </Tooltip>
  );
}

function Divider() {
  return <div className="mx-0.5 h-4 w-px bg-line-strong" />;
}
