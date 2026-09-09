"use client";

import { useEffect } from "react";

import { shapeFor, textFromPreset, TEXT_PRESETS } from "@/lib/editor/presets";
import { redo, undo, useEditor } from "@/lib/editor/store";

import { cameraRef } from "./canvas/Viewport";

const isEditable = (el: EventTarget | null) => {
  const n = el as HTMLElement | null;
  if (!n) return false;
  const tag = n.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || n.isContentEditable;
};

/*
  Keyboard model, matching the reference where it has one and common editor
  conventions where it doesn't: Space plays in video projects and is hold-to-pan
  elsewhere; Escape steps out of text editing before it clears selection.
*/
export function useHotkeys() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const s = useEditor.getState();
      const mod = e.metaKey || e.ctrlKey;

      if (e.key === "Escape") {
        if (s.dialog) return s.setDialog(null);
        if (s.editingTextId) return s.setEditingText(null);
        if (s.leftTab && !s.selection.length) return s.setLeftTab(null);
        return s.clearSelection();
      }

      if (isEditable(e.target)) return;

      if (e.code === "Space") {
        e.preventDefault();
        if (s.project.kind === "video") {
          if (!e.repeat) s.setPlaying(!s.playing);
        } else if (!s.spaceHeld) {
          s.setSpaceHeld(true);
        }
        return;
      }

      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        return e.shiftKey ? redo() : undo();
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        return redo();
      }
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        return s.selection.length && s.duplicateBlocks(s.selection);
      }
      if (mod && e.key.toLowerCase() === "c") return s.copy();
      if (mod && e.key.toLowerCase() === "v") return s.paste();
      if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        const slide = s.project.slides.find((x) => x.id === s.activeSlideId);
        return slide && s.select(slide.blocks.filter((b) => !b.locked).map((b) => b.id));
      }
      if (mod && (e.key === "]" || e.key === "[")) {
        e.preventDefault();
        return s.selection.forEach((id) => s.reorder(id, e.key === "]" ? "forward" : "backward"));
      }
      if (mod && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        return cameraRef.current?.zoomBy(1.25);
      }
      if (mod && e.key === "-") {
        e.preventDefault();
        return cameraRef.current?.zoomBy(0.8);
      }
      if (mod && e.key === "0") {
        e.preventDefault();
        return cameraRef.current?.zoomTo(1);
      }
      if (e.shiftKey && e.key === "!") return cameraRef.current?.fit();

      if (e.key === "Delete" || e.key === "Backspace") {
        if (s.selection.length) {
          e.preventDefault();
          s.removeBlocks(s.selection);
        }
        return;
      }

      if (e.key.startsWith("Arrow") && s.selection.length) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        const patches: Record<string, { x: number; y: number }> = {};
        for (const sl of s.project.slides)
          for (const b of sl.blocks)
            if (s.selection.includes(b.id) && !b.locked) patches[b.id] = { x: b.x + dx, y: b.y + dy };
        return s.updateBlocks(patches);
      }

      if (mod || e.altKey) return;
      const { width, height } = s.project;
      if (e.key === "t") return s.addBlock(textFromPreset(TEXT_PRESETS.find((p) => p.id === "heading")!, width, height));
      if (e.key === "r") return s.addBlock(shapeFor("rect", width, height));
      if (e.key === "o") return s.addBlock(shapeFor("ellipse", width, height));
      if (e.key === "l") return s.addBlock(shapeFor("line", width, height));
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
