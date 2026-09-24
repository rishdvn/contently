"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";

import { useToast } from "@/components/ui/toast";
import { useActiveOrg } from "@/lib/auth/useActiveOrg";
import { project as makeProject } from "@/lib/editor/factory";
import { googleFontsHref } from "@/lib/editor/fonts";
import { useCreateProject, useProject, useSaveProject, type ProjectLoad } from "@/lib/editor/persistence";
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
  `/editor/new?kind=video` creates a project in the active org and redirects to
  its real id. The hub creates before it navigates, so this is for the deep
  links that have nothing to create from yet: bookmarks, scripts, and the
  template "Create" button once templates exist.
*/
const NEW = "new";

/*
  The Studio. One full-bleed canvas with chrome floating over it: rail and
  flyout left, command pill top, inspector right, strip or timeline bottom.
  Nothing is docked and nothing draws a border — surfaces separate by value.
*/
export function Editor({ projectId, kind }: { projectId: string; kind?: string }) {
  const isNew = projectId === NEW;
  const load = useProject(isNew ? null : projectId);
  const loaded = useEditor((s) => s.project.id === projectId);

  useCreateOnDemand(isNew, kind);
  useLoadIntoStore(projectId, load);
  useAutosave(projectId);
  usePlayback();
  useHotkeys();

  const leftTab = useEditor((s) => s.leftTab);
  const bottom = useBottomInset();
  /*
    The chrome is laid out as the reference does it: rail and inspector run
    from the top edge, the timeline spans the full width beneath everything,
    and the top bar centres in whatever canvas is left between the two.
  */
  const panelRight = LEFT_PANEL_X + LEFT_PANEL_WIDTH + 12;
  const insets = {
    left: leftTab ? panelRight : LEFT_PANEL_X,
    right: INSPECTOR_WIDTH + 24,
    top: 60,
    bottom,
  };

  if (!loaded) return <div className="fixed inset-0 bg-canvas" />;

  return (
    <div className="fixed inset-0 overflow-hidden bg-canvas text-ink">
      <link rel="stylesheet" href={googleFontsHref()} crossOrigin="anonymous" />
      <Viewport insets={insets}>
        <TopBar left={insets.left} right={insets.right} />
        <Rail top={insets.top} bottom={bottom} />
        <LeftPanel bottom={bottom} />
        <Inspector bottom={bottom} />
        <Bottom left={leftTab ? panelRight : 12} right={12} />
      </Viewport>
      <ExportDialog />
      <ShareDialog />
    </div>
  );
}

/*
  `/editor/new?kind=…`: make the document, then stand on its real id and let
  the query below deliver it, the same as every other way in. Loading it
  straight into the store would save a round trip and open a window in which
  the query's answer arrives on top of whatever had been typed.
*/
function useCreateOnDemand(isNew: boolean, kind?: string) {
  const router = useRouter();
  const toast = useToast();
  const createProject = useCreateProject();
  const { orgId, isLoaded } = useActiveOrg();
  const started = useRef(false);

  useEffect(() => {
    if (!isNew || started.current || !isLoaded) return;
    if (!orgId) {
      /* Nothing owns a project on a personal account; the hub says so. */
      toast({ title: "Choose an organisation first", description: "Projects belong to the organisation you are working in." });
      router.replace("/");
      return;
    }
    started.current = true;
    const k = KINDS.includes(kind as ProjectKind) ? (kind as ProjectKind) : "carousel";
    const document = makeProject(k);
    createProject(document)
      .then((id) => router.replace(`/editor/${id}`))
      .catch((error: unknown) => {
        console.error(error);
        started.current = false;
        toast({ title: "Couldn't create that project", description: "Check your connection and try again." });
        router.replace("/");
      });
  }, [isNew, kind, orgId, isLoaded, createProject, router, toast]);
}

/*
  Put the stored document in the store, once. The query stays live and fires
  again on every autosave — including this tab's own — so reloading from it
  would throw away whatever has been typed since and reset the undo history.
  Editing from two places at once is out of scope for V1.

  An id that resolves to nothing is the end of the road for this route: say so
  and go back to the hub. That covers a deleted project, a mistyped link, and a
  project belonging to an organisation other than the active one.
*/
function useLoadIntoStore(projectId: string, load: ProjectLoad) {
  const router = useRouter();
  const toast = useToast();
  const loadedFor = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (load.status !== "ready" || loadedFor.current === projectId) return;
    loadedFor.current = projectId;
    useEditor.getState().load(load.project);
  }, [projectId, load]);

  useEffect(() => {
    if (load.status !== "missing") return;
    toast({ title: "That project isn't in this organisation", description: "It may have been deleted, or it belongs to another organisation." });
    router.replace("/");
  }, [load.status, router, toast]);
}

/* Persist the document a beat after it last changed. */
function useAutosave(projectId: string) {
  const save = useSaveProject();
  const toast = useToast();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const persist = () => {
      timer = null;
      const { project } = useEditor.getState();
      /* The store still holds the previous document for a beat after a route
         change; only this route's project is ours to write. */
      if (project.id !== projectId) return;
      save(project).catch((error: unknown) => {
        console.error(error);
        toast({ title: "Changes couldn't be saved", description: "They are still here in the tab. Check your connection." });
      });
    };

    const unsub = useEditor.subscribe((s, prev) => {
      if (s.project === prev.project || s.project.id !== projectId) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(persist, 500);
    });

    return () => {
      unsub();
      /* Leaving within the debounce window is the one case where the timer
         would take an edit with it. */
      if (timer) {
        clearTimeout(timer);
        persist();
      }
    };
  }, [projectId, save, toast]);
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