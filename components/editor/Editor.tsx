"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";

import { project as makeProject } from "@/lib/editor/factory";
import { googleFontsHref } from "@/lib/editor/fonts";
import { loadProject, saveProject } from "@/lib/editor/persistence";
import { useEditor } from "@/lib/editor/store";
import type { ProjectKind } from "@/lib/editor/types";

import { Viewport } from "./canvas/Viewport";
import { Bottom, useBottomInset } from "./chrome/Bottom";
import { Inspector, INSPECTOR_WIDTH } from "./chrome/Inspector";
import { LeftPanel, LEFT_PANEL_WIDTH, LEFT_PANEL_X } from "./chrome/LeftPanel";
import { Rail } from "./chrome/Rail";
import { TopBar } from "./chrome/TopBar";
import { ExportDialog } from "./dialogs/ExportDialog";
import { ShareDialog } from "./dialogs/ShareDialog";
import { useHotkeys } from "./useHotkeys";

const KINDS: ProjectKind[] = ["image", "carousel", "video"];

/*
  The Studio. One full-bleed canvas with chrome floating over it: rail and
  flyout left, command pill top, inspector right, strip or timeline bottom.
  Nothing is docked and nothing draws a border — surfaces separate by value.
*/
export function Editor({ projectId, kind }: { projectId: string; kind?: string }) {
  const router = useRouter();
  const loaded = useEditor((s) => s.project.id === projectId);

  /*
    Resolve the project before first paint: stored, or freshly created from
    ?kind=. Layout timing means the default document is never seen.
  */
  useLayoutEffect(() => {
    if (useEditor.getState().project.id === projectId) return;
    const stored = loadProject(projectId);
    if (stored) {
      useEditor.getState().load(stored);
    } else {
      const k = KINDS.includes(kind as ProjectKind) ? (kind as ProjectKind) : "carousel";
      const p = { ...makeProject(k), id: projectId };
      useEditor.getState().load(p);
      saveProject(p);
      router.replace(`/editor/${projectId}`);
    }
  }, [projectId, kind, router]);

  useAutosave();
  usePlayback();
  useHotkeys();

  const leftTab = useEditor((s) => s.leftTab);
  const bottom = useBottomInset();
  const insets = {
    left: leftTab ? LEFT_PANEL_X + LEFT_PANEL_WIDTH + 8 : LEFT_PANEL_X,
    right: INSPECTOR_WIDTH + 16,
    top: 60,
    bottom,
  };

  if (!loaded) return <div className="fixed inset-0 bg-canvas" />;

  return (
    <div className="fixed inset-0 overflow-hidden bg-canvas text-ink">
      <link rel="stylesheet" href={googleFontsHref()} />
      <Viewport insets={insets}>
        <TopBar />
        <Rail />
        <LeftPanel />
        <Inspector bottom={bottom} />
        <Bottom left={insets.left} right={8} />
      </Viewport>
      <ExportDialog />
      <ShareDialog />
    </div>
  );
}

/* Persist the document a beat after it last changed. */
function useAutosave() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = useEditor.subscribe((s, prev) => {
      if (s.project === prev.project) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => saveProject(s.project), 500);
    });
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, []);
}

/*
  Transport. Advances the active scene's local clock; at the end of a scene it
  moves to the next one, and stops on the last frame of the project.
*/
function usePlayback() {
  const playing = useEditor((s) => s.playing);
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (!playing) {
      last.current = null;
      return;
    }
    let raf = 0;
    const tick = (now: number) => {
      const s = useEditor.getState();
      const dt = last.current === null ? 0 : (now - last.current) / 1000;
      last.current = now;
      const idx = s.project.slides.findIndex((x) => x.id === s.activeSlideId);
      const scene = s.project.slides[idx];
      if (!scene) return;
      const t = s.time + dt;
      if (t >= scene.duration) {
        const next = s.project.slides[idx + 1];
        if (next) {
          useEditor.setState({ activeSlideId: next.id, time: t - scene.duration, selection: [], editingTextId: null });
        } else {
          useEditor.setState({ time: scene.duration, playing: false });
          return;
        }
      } else {
        s.setTime(t);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
}