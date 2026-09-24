"use client";

import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowDown,
  ArrowUp,
  ChevronsDown,
  ChevronsUp,
  ClipboardPaste,
  Copy,
  CopyPlus,
  Group,
  Lock,
  LockOpen,
  Trash2,
  Type,
  Ungroup,
} from "lucide-react";
import { useEffect, useState } from "react";

import { MenuDivider, MenuItem } from "@/components/ui/menu";
import { textFromPreset, TEXT_PRESETS } from "@/lib/editor/presets";
import { findBlock, useEditor } from "@/lib/editor/store";
import type { Block } from "@/lib/editor/types";

import { shortcutKey } from "../useHotkeys";

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
    /* Escape closes the menu only; stop it before the hotkeys would also clear the selection. */
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setTarget(null);
    };
    document.addEventListener("pointerdown", close, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", close, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [target]);

  if (!target || !container) return null;

  const s = useEditor.getState();
  const ids = target.blockId ? (s.selection.includes(target.blockId) ? s.selection : [target.blockId]) : [];
  const one = target.blockId ? findBlock(s.project, target.blockId)?.block : null;
  const grouped = ids.some((id) => findBlock(s.project, id)?.block.groupId);
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
          <MenuItem icon={<Copy />} shortcut={shortcutKey("selection.copy")} onClick={() => s.copy()}>
            Copy
          </MenuItem>
          <MenuItem icon={<ClipboardPaste />} shortcut={shortcutKey("canvas.paste")} disabled={!s.clipboard.length} onClick={() => s.paste()}>
            Paste
          </MenuItem>
          <MenuItem icon={<CopyPlus />} shortcut={shortcutKey("selection.duplicate")} onClick={() => s.duplicateBlocks(ids)}>
            Duplicate
          </MenuItem>
          <MenuDivider />
          <MenuItem icon={<ChevronsUp />} shortcut={shortcutKey("arrange.front")} onClick={() => ids.forEach((id) => s.reorder(id, "front"))}>
            Bring to front
          </MenuItem>
          <MenuItem icon={<ArrowUp />} shortcut={shortcutKey("arrange.forward")} onClick={() => ids.forEach((id) => s.reorder(id, "forward"))}>
            Bring forward
          </MenuItem>
          <MenuItem icon={<ArrowDown />} shortcut={shortcutKey("arrange.backward")} onClick={() => ids.forEach((id) => s.reorder(id, "backward"))}>
            Send backward
          </MenuItem>
          <MenuItem icon={<ChevronsDown />} shortcut={shortcutKey("arrange.back")} onClick={() => ids.forEach((id) => s.reorder(id, "back"))}>
            Send to back
          </MenuItem>
          <MenuDivider />
          {(
            [
              ["Align left", <AlignStartVertical key="l" />, () => ({ x: 0 })],
              ["Align center", <AlignCenterVertical key="c" />, (b: Block) => ({ x: (s.project.width - b.w) / 2 })],
              ["Align right", <AlignEndVertical key="r" />, (b: Block) => ({ x: s.project.width - b.w })],
              ["Align top", <AlignStartHorizontal key="t" />, () => ({ y: 0 })],
              ["Align middle", <AlignCenterHorizontal key="m" />, (b: Block) => ({ y: (s.project.height - b.h) / 2 })],
              ["Align bottom", <AlignEndHorizontal key="b" />, (b: Block) => ({ y: s.project.height - b.h })],
            ] as const
          ).map(([label, icon, fn]) => (
            <MenuItem
              key={label}
              icon={icon}
              onClick={() => {
                const patches: Record<string, Partial<Block>> = {};
                ids.forEach((id) => {
                  const b = findBlock(s.project, id)?.block;
                  if (b && !b.locked) patches[id] = fn(b);
                });
                s.updateBlocks(patches);
              }}
            >
              {label}
            </MenuItem>
          ))}
          <MenuDivider />
          {ids.length > 1 && !grouped ? (
            <MenuItem icon={<Group />} shortcut={shortcutKey("selection.group")} onClick={() => s.groupBlocks(ids)}>
              Group
            </MenuItem>
          ) : null}
          {grouped ? (
            <MenuItem icon={<Ungroup />} shortcut={shortcutKey("selection.ungroup")} onClick={() => s.ungroupBlocks(ids)}>
              Ungroup
            </MenuItem>
          ) : null}
          <MenuItem icon={one.locked ? <LockOpen /> : <Lock />} onClick={() => ids.forEach((id) => s.updateBlock(id, { locked: !one.locked }))}>
            {one.locked ? "Unlock" : "Lock"}
          </MenuItem>
          <MenuItem icon={<Trash2 />} shortcut={shortcutKey("selection.delete")} destructive onClick={() => s.removeBlocks(ids)}>
            Delete
          </MenuItem>
        </>
      ) : (
        <>
          <MenuItem icon={<ClipboardPaste />} shortcut={shortcutKey("canvas.paste")} disabled={!s.clipboard.length} onClick={() => s.paste()}>
            Paste
          </MenuItem>
          <MenuItem
            icon={<Type />}
            shortcut={shortcutKey("canvas.addText")}
            onClick={() => s.addBlock(textFromPreset(TEXT_PRESETS.find((p) => p.id === "heading") ?? TEXT_PRESETS[0], s.project.width, s.project.height), target.slideId ?? undefined)}
          >
            Add text
          </MenuItem>
          <MenuItem
            shortcut={shortcutKey("canvas.selectAll")}
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
