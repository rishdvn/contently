"use client";

import { useEffect, useRef, useState } from "react";

import { Artboard } from "@/components/editor/canvas/Artboard";
import { BLOCK_PREVIEW, definitionFingerprint, getBlock, listBlocks, placementFor } from "@/lib/blocks";
import { renderVideo, slideToBlob } from "@/lib/editor/export";
import { componentBlock, project as makeProject, slide as makeSlide } from "@/lib/editor/factory";
import { googleFontsHref } from "@/lib/editor/fonts";
import { waitForPaintableMedia } from "@/lib/editor/media";
import { useEditor } from "@/lib/editor/store";
import type { Project } from "@/lib/editor/types";

import type { RenderBridge } from "./RenderStage";
import { base64Slice, loadFonts, settle } from "./settle";

/*
  `/render/stage` — the render page with no project of its own. A script puts a
  document on it through the bridge and takes files off it, the same way the
  render worker uses `/render/<projectId>`:

  - `scripts/block-previews.ts` stages each registered block (`loadBlock`) and
    takes a poster PNG and a preview MP4;
  - `scripts/template-posters.ts` stages a template's document (`load`) and
    takes a PNG per scene (`still`).

  It is the render worker's bridge (`RenderBridge`, so the worker's `drain`
  reads from it unchanged) plus the three members below. Nothing is fetched:
  what is painted is whatever the caller passed in, or the block catalog that
  shipped in this build, so the route needs no token.
*/

export type StageBlock = {
  id: string;
  name: string;
  category: string;
  /* `definitionFingerprint`: the definition's data, for the preview hash. */
  fingerprint: string;
};

export type StageBridge = RenderBridge & {
  /* The catalog as registered in this build. */
  blocks: StageBlock[];
  spec: typeof BLOCK_PREVIEW;
  /* Put a document on the stage. Resolves once its fonts and media can be painted. */
  load(project: Project): Promise<void>;
  /* Put one block on the stage as its picker preview shows it: `static` for the
     poster (an image project), `video` for the preview (a video project). */
  loadBlock(id: string, mode: "static" | "video"): Promise<void>;
  /* `png` at a moment in the scene rather than its start: a video scene's
     poster, taken once its blocks have arrived. Ignored by stills projects. */
  still(scene: number, time: number, scale?: number): Promise<number>;
};

/* A one-block project laid out by `BLOCK_PREVIEW`. */
export function blockPreviewProject(id: string, mode: "static" | "video"): Project {
  const def = getBlock(id);
  if (!def) throw new Error(`No block registered as "${id}"`);
  const size = BLOCK_PREVIEW.artboard;
  const base = makeProject(mode === "video" ? "video" : "image", def.name);
  const block = componentBlock(def.id, def.defaults, { ...placementFor(def, size, size), start: 0, end: BLOCK_PREVIEW.duration, name: def.name });
  return {
    ...base,
    aspect: "1:1",
    width: size,
    height: size,
    slides: [makeSlide({ name: def.name, background: { type: "color", color: BLOCK_PREVIEW.background }, blocks: [block], duration: BLOCK_PREVIEW.duration })],
  };
}

export function Stage() {
  const root = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const project = useEditor((s) => s.project);
  const activeSlideId = useEditor((s) => s.activeSlideId);
  const slide = project.slides.find((s) => s.id === activeSlideId) ?? project.slides[0];

  useEffect(() => {
    let staged: Uint8Array | null = null;
    let progress = 0;
    let current: Project | null = null;

    const stage = async (blob: Blob) => {
      staged = new Uint8Array(await blob.arrayBuffer());
      return staged.length;
    };

    const show = async (p: Project) => {
      useEditor.getState().load(p);
      current = p;
      setLoaded(true);
      await loadFonts(p);
      await settle();
      /* `loadFonts` knows the text blocks' faces; a catalog block asks for its
         own only once it is laid out, which is now. */
      await document.fonts.ready;
      if (root.current) await waitForPaintableMedia(root.current);
      await settle();
    };

    const showScene = async (index: number, time = 0) => {
      const p = useEditor.getState().project;
      const scene = p.slides[index];
      if (!current || !scene) throw new Error(`Nothing staged has a scene ${index}`);
      useEditor.setState({ activeSlideId: scene.id, time });
      await settle();
      if (root.current) await waitForPaintableMedia(root.current);
      await settle();
      return { p, scene };
    };

    const bridge: StageBridge = {
      status: "ready",
      error: null,
      get project() {
        return current
          ? { id: current.id, name: current.name, kind: current.kind, width: current.width, height: current.height, slides: current.slides.map((s) => ({ id: s.id, name: s.name, duration: s.duration })) }
          : null;
      },
      get progress() {
        return progress;
      },
      blocks: listBlocks().map((def) => ({ id: def.id, name: def.name, category: def.category, fingerprint: definitionFingerprint(def) })),
      spec: BLOCK_PREVIEW,
      load: (p) => show(p),
      loadBlock: (id, mode) => show(blockPreviewProject(id, mode)),
      png: async (index, scale = 1) => {
        const { p, scene } = await showScene(index);
        return await stage(await slideToBlob(p, scene.id, "png", scale));
      },
      still: async (index, time, scale = 1) => {
        const { p, scene } = await showScene(index, time);
        return await stage(await slideToBlob(p, scene.id, "png", scale));
      },
      mp4: async (options) => {
        if (!current) throw new Error("Nothing is staged");
        progress = 0;
        const blob = await renderVideo(useEditor.getState().project, {
          fps: options?.fps ?? 30,
          quality: options?.quality ?? "high",
          scale: options?.scale,
          onProgress: (value) => {
            progress = value;
          },
        });
        return await stage(blob);
      },
      read: (offset, length) => {
        if (!staged) throw new Error("Nothing has been rendered yet");
        return base64Slice(staged, offset, length);
      },
      clear: () => {
        staged = null;
      },
    };

    window.contently = bridge;
    return () => {
      if (window.contently === bridge) delete window.contently;
    };
  }, []);

  return (
    <div ref={root} className="fixed inset-0 overflow-hidden bg-[#1d1d1d]" data-render-status="ready">
      <link rel="stylesheet" href={googleFontsHref()} crossOrigin="anonymous" />
      {/* As on `/render/<projectId>`: nothing moves except by `progress`. */}
      <style>{`*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}`}</style>
      {loaded && slide ? <Artboard slide={slide} width={project.width} height={project.height} x={0} y={0} interactive={false} /> : null}
    </div>
  );
}
