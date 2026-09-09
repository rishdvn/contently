"use client";

import { create } from "zustand";
import { temporal, type TemporalState } from "zundo";
import { useStoreWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/shallow";

import { cloneBlock, project as makeProject, slide as makeSlide, uid } from "./factory";
import {
  ASPECTS,
  type AspectId,
  type AudioTrack,
  type Background,
  type Block,
  type Project,
  type ProjectKind,
  type Slide,
  type Viewport,
} from "./types";

export type LeftTab =
  | "build"
  | "templates"
  | "blocks"
  | "text"
  | "stock"
  | "audio"
  | "brandkit"
  | "uploads"
  | "captions";

export type InspectorTab = "design" | "effects";

export type Upload = { id: string; kind: "image" | "video"; src: string; name: string };

type Tracked = { project: Project };

type EditorState = Tracked & {
  /* UI state — deliberately outside the undo history. */
  activeSlideId: string;
  selection: string[];
  editingTextId: string | null;
  leftTab: LeftTab | null;
  inspectorTab: InspectorTab;
  viewport: Viewport;
  interacting: boolean;
  spaceHeld: boolean;
  clipboard: Block[];
  uploads: Upload[];
  brandColors: string[];
  playing: boolean;
  time: number;
  muted: boolean;
  dialog: "export" | "share" | null;

  load: (p: Project) => void;
  newProject: (kind: ProjectKind) => Project;
  rename: (name: string) => void;
  setAspect: (aspect: AspectId) => void;

  setActiveSlide: (id: string) => void;
  addSlide: (afterId?: string) => string;
  duplicateSlide: (id: string) => void;
  removeSlide: (id: string) => void;
  moveSlide: (id: string, dir: -1 | 1) => void;
  updateSlide: (id: string, patch: Partial<Slide>) => void;
  setBackground: (slideId: string, bg: Background) => void;
  addAudio: (track: AudioTrack) => void;
  updateAudio: (id: string, patch: Partial<AudioTrack>) => void;
  removeAudio: (id: string) => void;

  addBlock: (block: Block, slideId?: string) => void;
  addBlocks: (blocks: Block[], slideId?: string) => void;
  updateBlock: (id: string, patch: Partial<Block>) => void;
  updateBlocks: (patches: Record<string, Partial<Block>>) => void;
  removeBlocks: (ids: string[]) => void;
  duplicateBlocks: (ids: string[]) => void;
  reorder: (id: string, action: "front" | "back" | "forward" | "backward") => void;
  copy: () => void;
  paste: () => void;

  select: (ids: string[], additive?: boolean) => void;
  clearSelection: () => void;
  setEditingText: (id: string | null) => void;
  setLeftTab: (tab: LeftTab | null) => void;
  setInspectorTab: (tab: InspectorTab) => void;
  setViewport: (v: Viewport | ((v: Viewport) => Viewport)) => void;
  setInteracting: (v: boolean) => void;
  setSpaceHeld: (v: boolean) => void;
  addUpload: (u: Upload) => void;
  addBrandColor: (c: string) => void;
  setPlaying: (v: boolean) => void;
  setTime: (t: number) => void;
  setMuted: (v: boolean) => void;
  setDialog: (d: EditorState["dialog"]) => void;
};

const touch = (p: Project): Project => ({ ...p, updatedAt: Date.now() });

function mapSlide(p: Project, slideId: string, fn: (s: Slide) => Slide): Project {
  return touch({ ...p, slides: p.slides.map((s) => (s.id === slideId ? fn(s) : s)) });
}

function mapBlocks(p: Project, fn: (b: Block, s: Slide) => Block): Project {
  return touch({
    ...p,
    slides: p.slides.map((s) => ({ ...s, blocks: s.blocks.map((b) => fn(b, s)) })),
  });
}

export function findBlock(p: Project, id: string): { block: Block; slide: Slide } | null {
  for (const s of p.slides) {
    const b = s.blocks.find((x) => x.id === id);
    if (b) return { block: b, slide: s };
  }
  return null;
}

const initial = makeProject("carousel");

/* Commits any pending (debounced) history entry. Called before undo/redo. */
export let flushHistory: () => void = () => {};

export function undo() {
  flushHistory();
  useEditor.temporal.getState().undo();
}

export function redo() {
  flushHistory();
  useEditor.temporal.getState().redo();
}

export const useEditor = create<EditorState>()(
  temporal(
    (set, get) => ({
      project: initial,
      activeSlideId: initial.slides[0].id,
      selection: [],
      editingTextId: null,
      leftTab: null,
      inspectorTab: "design",
      viewport: { x: 0, y: 0, zoom: 0.3 },
      interacting: false,
      spaceHeld: false,
      clipboard: [],
      uploads: [],
      brandColors: ["#f5f5f5", "#0a0909", "#6ee86e", "#ffd84d", "#ff9a3c", "#4cc7f0", "#f6c8dd"],
      playing: false,
      time: 0,
      muted: false,
      dialog: null,

      load: (p) =>
        set({
          project: p,
          activeSlideId: p.slides[0]?.id,
          selection: [],
          editingTextId: null,
          time: 0,
          playing: false,
        }),
      newProject: (kind) => {
        const p = makeProject(kind);
        get().load(p);
        return p;
      },
      rename: (name) => set((s) => ({ project: touch({ ...s.project, name }) })),
      setAspect: (aspect) =>
        set((s) => {
          const { w, h } = ASPECTS[aspect];
          const sx = w / s.project.width;
          const sy = h / s.project.height;
          /* Scale block positions with the artboard so layouts survive a ratio change. */
          const p = mapBlocks(
            { ...s.project, aspect, width: w, height: h },
            (b) => ({ ...b, x: b.x * sx, y: b.y * sy, w: b.w * sx, h: b.h * sy }),
          );
          return { project: p };
        }),

      setActiveSlide: (id) => set({ activeSlideId: id, selection: [], editingTextId: null }),
      addSlide: (afterId) => {
        const s = get();
        const idx = afterId ? s.project.slides.findIndex((x) => x.id === afterId) : s.project.slides.length - 1;
        const next = makeSlide({ name: `Slide ${s.project.slides.length + 1}` });
        const slides = [...s.project.slides];
        slides.splice(idx + 1, 0, next);
        set({ project: touch({ ...s.project, slides }), activeSlideId: next.id, selection: [] });
        return next.id;
      },
      duplicateSlide: (id) =>
        set((s) => {
          const idx = s.project.slides.findIndex((x) => x.id === id);
          if (idx < 0) return {};
          const src = s.project.slides[idx];
          const copy: Slide = {
            ...structuredClone(src),
            id: uid(),
            name: `${src.name} copy`,
            blocks: src.blocks.map((b) => ({ ...structuredClone(b), id: uid() })),
          };
          const slides = [...s.project.slides];
          slides.splice(idx + 1, 0, copy);
          return { project: touch({ ...s.project, slides }), activeSlideId: copy.id, selection: [] };
        }),
      removeSlide: (id) =>
        set((s) => {
          if (s.project.slides.length <= 1) return {};
          const idx = s.project.slides.findIndex((x) => x.id === id);
          const slides = s.project.slides.filter((x) => x.id !== id);
          const nextActive = slides[Math.max(0, idx - 1)].id;
          return { project: touch({ ...s.project, slides }), activeSlideId: nextActive, selection: [] };
        }),
      moveSlide: (id, dir) =>
        set((s) => {
          const idx = s.project.slides.findIndex((x) => x.id === id);
          const to = idx + dir;
          if (idx < 0 || to < 0 || to >= s.project.slides.length) return {};
          const slides = [...s.project.slides];
          [slides[idx], slides[to]] = [slides[to], slides[idx]];
          return { project: touch({ ...s.project, slides }) };
        }),
      updateSlide: (id, patch) => set((s) => ({ project: mapSlide(s.project, id, (sl) => ({ ...sl, ...patch })) })),
      setBackground: (slideId, bg) =>
        set((s) => ({ project: mapSlide(s.project, slideId, (sl) => ({ ...sl, background: bg })) })),
      addAudio: (track) => set((s) => ({ project: touch({ ...s.project, audio: [...s.project.audio, track] }) })),
      updateAudio: (id, patch) =>
        set((s) => ({
          project: touch({ ...s.project, audio: s.project.audio.map((a) => (a.id === id ? { ...a, ...patch } : a)) }),
        })),
      removeAudio: (id) =>
        set((s) => ({ project: touch({ ...s.project, audio: s.project.audio.filter((a) => a.id !== id) }) })),

      addBlock: (block, slideId) => get().addBlocks([block], slideId),
      addBlocks: (blocks, slideId) =>
        set((s) => {
          const target = slideId ?? s.activeSlideId;
          const withTiming = blocks.map((b) => {
            const sl = s.project.slides.find((x) => x.id === target);
            return sl && s.project.kind === "video" ? { ...b, end: Math.min(b.end, sl.duration) } : b;
          });
          return {
            project: mapSlide(s.project, target, (sl) => ({ ...sl, blocks: [...sl.blocks, ...withTiming] })),
            selection: withTiming.map((b) => b.id),
            editingTextId: null,
          };
        }),
      updateBlock: (id, patch) =>
        set((s) => ({ project: mapBlocks(s.project, (b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)) })),
      updateBlocks: (patches) =>
        set((s) => ({
          project: mapBlocks(s.project, (b) => (patches[b.id] ? ({ ...b, ...patches[b.id] } as Block) : b)),
        })),
      removeBlocks: (ids) =>
        set((s) => {
          const gone = new Set(ids);
          return {
            project: touch({
              ...s.project,
              slides: s.project.slides.map((sl) => ({ ...sl, blocks: sl.blocks.filter((b) => !gone.has(b.id)) })),
            }),
            selection: s.selection.filter((id) => !gone.has(id)),
            editingTextId: s.editingTextId && gone.has(s.editingTextId) ? null : s.editingTextId,
          };
        }),
      duplicateBlocks: (ids) =>
        set((s) => {
          const created: string[] = [];
          const p = touch({
            ...s.project,
            slides: s.project.slides.map((sl) => {
              const copies = sl.blocks.filter((b) => ids.includes(b.id)).map((b) => cloneBlock(b));
              created.push(...copies.map((c) => c.id));
              return copies.length ? { ...sl, blocks: [...sl.blocks, ...copies] } : sl;
            }),
          });
          return { project: p, selection: created };
        }),
      reorder: (id, action) =>
        set((s) => {
          const hit = findBlock(s.project, id);
          if (!hit) return {};
          const blocks = [...hit.slide.blocks];
          const i = blocks.indexOf(hit.block);
          blocks.splice(i, 1);
          const to =
            action === "front"
              ? blocks.length
              : action === "back"
                ? 0
                : action === "forward"
                  ? Math.min(blocks.length, i + 1)
                  : Math.max(0, i - 1);
          blocks.splice(to, 0, hit.block);
          return { project: mapSlide(s.project, hit.slide.id, (sl) => ({ ...sl, blocks })) };
        }),
      copy: () => {
        const s = get();
        const blocks = s.selection.map((id) => findBlock(s.project, id)?.block).filter(Boolean) as Block[];
        if (blocks.length) set({ clipboard: structuredClone(blocks) });
      },
      paste: () => {
        const s = get();
        if (!s.clipboard.length) return;
        const copies = s.clipboard.map((b) => cloneBlock(b));
        set({ clipboard: copies.map((c) => structuredClone(c)) });
        get().addBlocks(copies);
      },

      select: (ids, additive) =>
        set((s) => {
          if (!additive) return { selection: ids, editingTextId: null };
          const next = new Set(s.selection);
          ids.forEach((id) => (next.has(id) ? next.delete(id) : next.add(id)));
          return { selection: [...next], editingTextId: null };
        }),
      clearSelection: () => set({ selection: [], editingTextId: null }),
      setEditingText: (id) => set({ editingTextId: id, selection: id ? [id] : get().selection }),
      setLeftTab: (tab) => set({ leftTab: tab }),
      setInspectorTab: (tab) => set({ inspectorTab: tab }),
      setViewport: (v) => set((s) => ({ viewport: typeof v === "function" ? v(s.viewport) : v })),
      setInteracting: (v) => set({ interacting: v }),
      setSpaceHeld: (v) => set({ spaceHeld: v }),
      addUpload: (u) => set((s) => ({ uploads: [u, ...s.uploads] })),
      addBrandColor: (c) => set((s) => (s.brandColors.includes(c) ? {} : { brandColors: [...s.brandColors, c] })),
      setPlaying: (v) => set({ playing: v }),
      setTime: (t) => set({ time: Math.max(0, t) }),
      setMuted: (v) => set({ muted: v }),
      setDialog: (d) => set({ dialog: d }),
    }),
    {
      partialize: (s): Tracked => ({ project: s.project }),
      equality: (a, b) => a.project === b.project,
      limit: 200,
      /*
        Coalesce rapid edits — a slider drag, typing — into one history entry.
        Without this, undo would step back one pixel at a time.
      */
      handleSet: (handleSet) => {
        /* zundo's declared type is setState's, but at runtime it hands over its 4-arg _handleSet. */
        type Args = [pastState: Tracked, replace: boolean | undefined, currentState: Tracked, deltaState?: Partial<Tracked> | null];
        const commit = handleSet as unknown as (...args: Args) => void;
        let timer: ReturnType<typeof setTimeout> | null = null;
        let first: Tracked | null = null;
        let latest: Args | null = null;
        flushHistory = () => {
          if (timer) clearTimeout(timer);
          if (first !== null && latest) commit(first, latest[1], latest[2], latest[3]);
          first = null;
          latest = null;
          timer = null;
        };
        return (pastState, replace, currentState, deltaState) => {
          const past = pastState as Tracked;
          if (first === null) first = past;
          latest = [past, replace as boolean | undefined, currentState, deltaState];
          if (timer) clearTimeout(timer);
          timer = setTimeout(flushHistory, 400);
        };
      },
    },
  ),
);

export function useTemporal<T>(selector: (s: TemporalState<Tracked>) => T): T {
  return useStoreWithEqualityFn(useEditor.temporal, selector, shallow);
}

/* Convenience selectors. */
export const useProject = () => useEditor((s) => s.project);
export const useActiveSlide = () =>
  useEditor((s) => s.project.slides.find((x) => x.id === s.activeSlideId) ?? s.project.slides[0]);
export const useSelectedBlocks = () =>
  useStoreWithEqualityFn(
    useEditor,
    (s) => s.selection.map((id) => findBlock(s.project, id)?.block).filter(Boolean) as Block[],
    shallow,
  );
