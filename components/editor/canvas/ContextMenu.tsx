"use client";

import { ArrowDown, ArrowUp, ChevronsDown, ChevronsUp, ClipboardPaste, Copy, CopyPlus, Lock, LockOpen, Trash2, Type } from "lucide-react";
import { useEffect, useState } from "react";

import { MenuDivider, MenuItem } from "@/components/ui/menu";
import { textFromPreset, TEXT_PRESETS } from "@/lib/editor/presets";
import { findBlock, useEditor } from "@/lib/editor/store";

type Target = { x: number; y: number; blockId: string | null; slideId: string | null };

/*
  Right-click on the canvas. Blocks get the layer verbs; empty artboard gets
  paste and add. Positioned in viewport coordinates and closed by any
  pointer-down elsewhere, Escape, or choosing an item.
*/
export function ContextMenu({ container }: { container: HTMLDivElement | null }) {
  const [target, setTarget] = useState<Target | null>(null);

  useEffect(() => {
    if (!container) return;
    const onContext = (e: MouseEvent) => {
      e.preventDefault();
      const el = e.target as HTMLElement;
      if (el.closest(".selection-toolbar, .gizmo, [role='dialog'], [role='menu']")) return;
      const block = el.closest<HTMLElement>(".block");
      const artboard = el.closest<HTMLElement>(".artboard");
      const rect = container.getBoundingClientRect();
      const s = useEditor.getState();
      if (block?.dataset.blockId) {
        if (!s.selection.includes(block.dataset.blockId)) s.select([block.dataset.blockId]);
        if (artboard?.dataset.slideId && artboard.dataset.slideId !== s.activeSlideId) useEditor.setState({ activeSlideId: artboard.dataset.slideId });
      } else if (artboard?.dataset.slideId) {
        s.setActiveSlide(artboard.dataset.slideId);
      } else {
        setTarget(null);
        return;
      }
      setTarget({ x: e.clientX - rect.left, y: e.clientY - rect.top, blockId: block?.dataset.blockId ?? null, slideId: artboard?.dataset.slideId ?? null });
    };
    container.addEventListener("contextmenu", onContext);
    return () => container.removeEventListener("contextmenu", onContext);
  }, [container]);

  useEffect(() => {
    if (!target) return;
    const close = (e: Event) => {
      if ((e.target as HTMLElement).closest(".context-menu")) return;
      setTarget(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setTarget(null);
    document.addEventListener("pointerdown", close, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [target]);

  if (!target || !container) return null;

  const s = useEditor.getState();
  const ids = target.blockId ? (s.selection.includes(target.blockId) ? s.selection : [target.blockId]) : [];
  const one = target.blockId ? findBlock(s.project, target.blockId)?.block : null;
  const x = Math.min(target.x, container.clientWidth - 220);
  const y = Math.min(target.y, container.clientHeight - 320);

  return (
    <div
      role="menu"
      className="context-menu absolute min-w-[200px] rounded-control bg-panel p-1.5 shadow-overlay animate-pop"
      style={{ left: x, top: y, zIndex: "var(--z-floating-bar)" }}
      onClick={() => setTarget(null)}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {one ? (
        <>
          <MenuItem icon={<Copy />} shortcut="⌘C" onClick={() => s.copy()}>
            Copy
          </MenuItem>
          <MenuItem icon={<ClipboardPaste />} shortcut="⌘V" disabled={!s.clipboard.length} onClick={() => s.paste()}>
            Paste
          </MenuItem>
          <MenuItem icon={<CopyPlus />} shortcut="⌘D" onClick={() => s.duplicateBlocks(ids)}>
            Duplicate
          </MenuItem>
          <MenuDivider />
          <MenuItem icon={<ChevronsUp />} shortcut="⌘]" onClick={() => ids.forEach((id) => s.reorder(id, "front"))}>
            Bring to front
          </MenuItem>
          <MenuItem icon={<ArrowUp />} shortcut="]" onClick={() => ids.forEach((id) => s.reorder(id, "forward"))}>
            Bring forward
          </MenuItem>
          <MenuItem icon={<ArrowDown />} shortcut="[" onClick={() => ids.forEach((id) => s.reorder(id, "backward"))}>
            Send backward
          </MenuItem>
          <MenuItem icon={<ChevronsDown />} shortcut="⌘[" onClick={() => ids.forEach((id) => s.reorder(id, "back"))}>
            Send to back
          </MenuItem>
          <MenuDivider />
          <MenuItem icon={one.locked ? <LockOpen /> : <Lock />} onClick={() => ids.forEach((id) => s.updateBlock(id, { locked: !one.locked }))}>
            {one.locked ? "Unlock" : "Lock"}
          </MenuItem>
          <MenuItem icon={<Trash2 />} shortcut="⌫" destructive onClick={() => s.removeBlocks(ids)}>
            Delete
          </MenuItem>
        </>
      ) : (
        <>
          <MenuItem icon={<ClipboardPaste />} shortcut="⌘V" disabled={!s.clipboard.length} onClick={() => s.paste()}>
            Paste
          </MenuItem>
          <MenuItem
            icon={<Type />}
            shortcut="T"
            onClick={() => s.addBlock(textFromPreset(TEXT_PRESETS.find((p) => p.id === "heading") ?? TEXT_PRESETS[0], s.project.width, s.project.height), target.slideId ?? undefined)}
          >
            Add text
          </MenuItem>
          <MenuItem
            shortcut="⌘A"
            onClick={() => {
              const slide = s.project.slides.find((sl) => sl.id === target.slideId);
              if (slide) s.select(slide.blocks.filter((b) => !b.locked).map((b) => b.id));
            }}
          >
            Select all
          </MenuItem>
        </>
      )}
    </div>
  );
}
