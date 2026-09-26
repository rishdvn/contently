"use client";

import { useEffect } from "react";

import { shapeFor, textFromPreset, TEXT_PRESETS } from "@/lib/editor/presets";
import { redo, undo, useEditor } from "@/lib/editor/store";
import type { ProjectKind } from "@/lib/editor/types";

import { cameraRef } from "./canvas/Viewport";

const isEditable = (el: EventTarget | null) => {
  const n = el as HTMLElement | null;
  if (!n) return false;
  const tag = n.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || n.isContentEditable;
};

type EditorState = ReturnType<typeof useEditor.getState>;

type Ctx = { mod: boolean; state: EditorState };

export type ShortcutArea = "Canvas" | "Selection" | "Arrange" | "View" | "Playback" | "General";

/* Reading order of the sheet: what you do most often first. */
export const SHORTCUT_AREAS: ShortcutArea[] = ["Canvas", "Selection", "Arrange", "View", "Playback", "General"];

export type ShortcutId =
  | "general.escape"
  | "general.shortcuts"
  | "general.undo"
  | "general.redo"
  | "playback.toggle"
  | "view.pan"
  | "selection.copy"
  | "canvas.paste"
  | "selection.duplicate"
  | "selection.group"
  | "selection.ungroup"
  | "canvas.selectAll"
  | "arrange.front"
  | "arrange.forward"
  | "arrange.backward"
  | "arrange.back"
  | "view.zoomIn"
  | "view.zoomOut"
  | "view.zoomActual"
  | "view.fit"
  | "selection.delete"
  | "selection.nudge"
  | "selection.nudgeFar"
  | "canvas.addText"
  | "canvas.addRect"
  | "canvas.addEllipse"
  | "canvas.addLine";

export type Shortcut = {
  id: ShortcutId;
  area: ShortcutArea;
  label: string;
  /*
    One chip per element, canonical first: menus and tooltips print `keys[0]`,
    the sheet prints them all. ⌘ stands for Ctrl off macOS — the handler takes
    either, and the sheet says so.
  */
  keys: string[];
  /** Project kinds the binding applies to. Absent means all of them. */
  kinds?: ProjectKind[];
  /** Runs before the "is the user typing?" guard, so it works in a field too. */
  global?: boolean;
  preventDefault?: boolean;
  match: (e: KeyboardEvent, ctx: Ctx) => boolean;
  run: (e: KeyboardEvent, ctx: Ctx) => void;
};

const key = (e: KeyboardEvent, k: string) => e.key.toLowerCase() === k;

/*
  Every binding in the studio, in match order. One table so the handler, the
  shortcuts sheet and the labels in menus cannot drift apart: a menu asks for
  `shortcutKey("arrange.forward")` rather than spelling "]" out again.

  Matching the reference where it has an opinion and common editor conventions
  where it doesn't: Space plays in video projects and is hold-to-pan elsewhere;
  Escape steps out of text editing before it clears the selection.
*/
export const SHORTCUTS: Shortcut[] = [
  {
    id: "general.escape",
    area: "General",
    label: "Close, stop editing, clear selection",
    keys: ["Esc"],
    global: true,
    match: (e) => e.key === "Escape",
    run: (_e, { state: s }) => {
      if (s.dialog) return s.setDialog(null);
      if (s.editingTextId) return s.setEditingText(null);
      if (s.leftTab && !s.selection.length) return s.setLeftTab(null);
      s.clearSelection();
    },
  },
  {
    id: "general.shortcuts",
    area: "General",
    label: "Keyboard shortcuts",
    keys: ["?"],
    preventDefault: true,
    /* Shift+/ on a US layout reports "?"; the code check covers the rest. */
    match: (e, { mod }) => !mod && !e.altKey && (e.key === "?" || (e.shiftKey && e.code === "Slash")),
    run: (_e, { state: s }) => s.setDialog(s.dialog === "shortcuts" ? null : "shortcuts"),
  },
  {
    id: "playback.toggle",
    area: "Playback",
    label: "Play or pause",
    keys: ["Space"],
    kinds: ["video"],
    preventDefault: true,
    match: (e) => e.code === "Space",
    run: (e, { state: s }) => {
      if (!e.repeat) s.setPlaying(!s.playing);
    },
  },
  {
    id: "view.pan",
    area: "View",
    label: "Hold to pan the canvas",
    keys: ["Space"],
    kinds: ["image", "carousel"],
    preventDefault: true,
    match: (e) => e.code === "Space",
    run: (_e, { state: s }) => {
      if (!s.spaceHeld) s.setSpaceHeld(true);
    },
  },
  {
    id: "general.undo",
    area: "General",
    label: "Undo",
    keys: ["⌘Z"],
    preventDefault: true,
    match: (e, { mod }) => mod && !e.shiftKey && key(e, "z"),
    run: () => undo(),
  },
  {
    id: "general.redo",
    area: "General",
    label: "Redo",
    keys: ["⇧⌘Z", "⌘Y"],
    preventDefault: true,
    match: (e, { mod }) => mod && ((e.shiftKey && key(e, "z")) || key(e, "y")),
    run: () => redo(),
  },
  {
    id: "selection.duplicate",
    area: "Selection",
    label: "Duplicate",
    keys: ["⌘D"],
    preventDefault: true,
    match: (e, { mod }) => mod && key(e, "d"),
    run: (_e, { state: s }) => {
      if (s.selection.length) s.duplicateBlocks(s.selection);
    },
  },
  {
    id: "selection.group",
    area: "Selection",
    label: "Group",
    keys: ["⌘G"],
    preventDefault: true,
    match: (e, { mod }) => mod && !e.shiftKey && key(e, "g"),
    run: (_e, { state: s }) => {
      if (s.selection.length) s.groupBlocks(s.selection);
    },
  },
  {
    id: "selection.ungroup",
    area: "Selection",
    label: "Ungroup",
    keys: ["⇧⌘G"],
    preventDefault: true,
    match: (e, { mod }) => mod && e.shiftKey && key(e, "g"),
    run: (_e, { state: s }) => {
      if (s.selection.length) s.ungroupBlocks(s.selection);
    },
  },
  {
    id: "selection.copy",
    area: "Selection",
    label: "Copy",
    keys: ["⌘C"],
    match: (e, { mod }) => mod && key(e, "c"),
    run: (_e, { state: s }) => s.copy(),
  },
  {
    id: "canvas.paste",
    area: "Canvas",
    label: "Paste",
    keys: ["⌘V"],
    match: (e, { mod }) => mod && key(e, "v"),
    run: (_e, { state: s }) => s.paste(),
  },
  {
    id: "canvas.selectAll",
    area: "Canvas",
    label: "Select all layers",
    keys: ["⌘A"],
    preventDefault: true,
    match: (e, { mod }) => mod && key(e, "a"),
    run: (_e, { state: s }) => {
      const slide = s.project.slides.find((x) => x.id === s.activeSlideId);
      if (slide) s.select(slide.blocks.filter((b) => !b.locked).map((b) => b.id));
    },
  },
  {
    id: "arrange.front",
    area: "Arrange",
    label: "Bring to front",
    keys: ["⌘]"],
    preventDefault: true,
    match: (e, { mod, state }) => mod && e.key === "]" && state.selection.length > 0,
    run: (_e, { state: s }) => s.selection.forEach((id) => s.reorder(id, "front")),
  },
  {
    id: "arrange.forward",
    area: "Arrange",
    label: "Bring forward",
    keys: ["]"],
    preventDefault: true,
    match: (e, { mod, state }) => !mod && e.key === "]" && state.selection.length > 0,
    run: (_e, { state: s }) => s.selection.forEach((id) => s.reorder(id, "forward")),
  },
  {
    id: "arrange.backward",
    area: "Arrange",
    label: "Send backward",
    keys: ["["],
    preventDefault: true,
    match: (e, { mod, state }) => !mod && e.key === "[" && state.selection.length > 0,
    run: (_e, { state: s }) => s.selection.forEach((id) => s.reorder(id, "backward")),
  },
  {
    id: "arrange.back",
    area: "Arrange",
    label: "Send to back",
    keys: ["⌘["],
    preventDefault: true,
    match: (e, { mod, state }) => mod && e.key === "[" && state.selection.length > 0,
    run: (_e, { state: s }) => s.selection.forEach((id) => s.reorder(id, "back")),
  },
  {
    id: "view.zoomIn",
    area: "View",
    label: "Zoom in",
    keys: ["⌘+"],
    preventDefault: true,
    match: (e, { mod }) => mod && (e.key === "=" || e.key === "+"),
    run: () => cameraRef.current?.zoomBy(1.25),
  },
  {
    id: "view.zoomOut",
    area: "View",
    label: "Zoom out",
    keys: ["⌘−"],
    preventDefault: true,
    match: (e, { mod }) => mod && e.key === "-",
    run: () => cameraRef.current?.zoomBy(0.8),
  },
  {
    id: "view.zoomActual",
    area: "View",
    label: "Zoom to 100%",
    keys: ["⌘0"],
    preventDefault: true,
    match: (e, { mod }) => mod && e.key === "0",
    run: () => cameraRef.current?.zoomTo(1),
  },
  {
    id: "view.fit",
    area: "View",
    label: "Fit to screen",
    keys: ["⇧1"],
    /* Shift+1 is "!" on a US layout and something else elsewhere; take both. */
    match: (e, { mod }) => !mod && e.shiftKey && (e.key === "!" || e.code === "Digit1"),
    run: () => cameraRef.current?.fit(),
  },
  {
    id: "selection.delete",
    area: "Selection",
    label: "Delete",
    keys: ["⌫", "Del"],
    preventDefault: true,
    match: (e, { state }) => (e.key === "Delete" || e.key === "Backspace") && state.selection.length > 0,
    run: (_e, { state: s }) => s.removeBlocks(s.selection),
  },
  {
    id: "selection.nudge",
    area: "Selection",
    label: "Nudge by 1 px",
    keys: ["←", "→", "↑", "↓"],
    preventDefault: true,
    match: (e, { state }) => !e.shiftKey && e.key.startsWith("Arrow") && state.selection.length > 0,
    run: nudge,
  },
  {
    id: "selection.nudgeFar",
    area: "Selection",
    label: "Nudge by 10 px",
    keys: ["⇧←", "⇧→", "⇧↑", "⇧↓"],
    preventDefault: true,
    match: (e, { state }) => e.shiftKey && e.key.startsWith("Arrow") && state.selection.length > 0,
    run: nudge,
  },
  {
    id: "canvas.addText",
    area: "Canvas",
    label: "Add a heading",
    keys: ["T"],
    preventDefault: true,
    match: (e, { mod }) => !mod && !e.altKey && key(e, "t"),
    run: (_e, { state: s }) =>
      s.addBlock(textFromPreset(TEXT_PRESETS.find((p) => p.id === "heading") ?? TEXT_PRESETS[0], s.project.width, s.project.height)),
  },
  {
    id: "canvas.addRect",
    area: "Canvas",
    label: "Add a rectangle",
    keys: ["R"],
    preventDefault: true,
    match: (e, { mod }) => !mod && !e.altKey && key(e, "r"),
    run: (_e, { state: s }) => s.addBlock(shapeFor("rect", s.project.width, s.project.height)),
  },
  {
    id: "canvas.addEllipse",
    area: "Canvas",
    label: "Add an ellipse",
    keys: ["O"],
    preventDefault: true,
    match: (e, { mod }) => !mod && !e.altKey && key(e, "o"),
    run: (_e, { state: s }) => s.addBlock(shapeFor("ellipse", s.project.width, s.project.height)),
  },
  {
    id: "canvas.addLine",
    area: "Canvas",
    label: "Add a line",
    keys: ["L"],
    preventDefault: true,
    match: (e, { mod }) => !mod && !e.altKey && key(e, "l"),
    run: (_e, { state: s }) => s.addBlock(shapeFor("line", s.project.width, s.project.height)),
  },
];

/* Locked blocks stay put; everything else in the selection moves together. */
function nudge(e: KeyboardEvent, { state: s }: Ctx) {
  const step = e.shiftKey ? 10 : 1;
  const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
  const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
  const patches: Record<string, { x: number; y: number }> = {};
  for (const sl of s.project.slides)
    for (const b of sl.blocks) if (s.selection.includes(b.id) && !b.locked) patches[b.id] = { x: b.x + dx, y: b.y + dy };
  s.updateBlocks(patches);
}

const byId = new Map(SHORTCUTS.map((s) => [s.id, s]));

export function shortcut(id: ShortcutId): Shortcut {
  return byId.get(id)!;
}

/** The label a menu, tooltip or button prints for a binding, e.g. "⌘]". */
export function shortcutKey(id: ShortcutId): string {
  return shortcut(id).keys[0];
}

export function useHotkeys() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const state = useEditor.getState();
      const ctx: Ctx = { mod: e.metaKey || e.ctrlKey, state };
      /* The sheet is a real modal: only the global bindings reach past it. */
      const inert = isEditable(e.target) || state.dialog === "shortcuts";

      for (const s of SHORTCUTS) {
        if (inert && !s.global) continue;
        if (s.kinds && !s.kinds.includes(state.project.kind)) continue;
        if (!s.match(e, ctx)) continue;
        if (s.preventDefault) e.preventDefault();
        s.run(e, ctx);
        return;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") useEditor.getState().setSpaceHeld(false);
    };
    const onBlur = () => useEditor.getState().setSpaceHeld(false);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);
}
