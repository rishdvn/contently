"use client";

import { ConvexHttpClient } from "convex/browser";
import { useEffect, useRef, useState } from "react";

import { Artboard } from "@/components/editor/canvas/Artboard";
import { api } from "@/convex/_generated/api";
import { renderVideo, slideToBlob, type VideoQuality } from "@/lib/editor/export";
import { googleFontsHref } from "@/lib/editor/fonts";
import { waitForPaintableMedia } from "@/lib/editor/media";
import { useEditor } from "@/lib/editor/store";
import type { Project } from "@/lib/editor/types";

import { base64Slice, errorMessage as message, loadFonts, settle } from "./settle";

/*
  The page the render worker drives.

  It is the studio's canvas with everything else taken away: one artboard, at
  document scale, on a route with no chrome and no Clerk session. The worker
  opens it with a token from `convex/render.ts`, waits for `status: "ready"`,
  and then calls the bridge below to get bytes out.

  Everything the finished file is made of comes from code the studio already
  uses — `Artboard` paints it, `lib/editor/export.ts` rasterises it — because a
  second renderer is a second set of pixels, and "the download and the API
  return different images" is not a bug anyone can act on.

  The contract with the worker is `window.contently`, mirrored in
  `workers/render/src/bridge.ts`. Change one and change the other.
*/

export type RenderStatus = "loading" | "ready" | "error";

export type RenderBridge = {
  status: RenderStatus;
  error: string | null;
  project: { id: string; name: string; kind: string; width: number; height: number; slides: { id: string; name: string; duration: number }[] } | null;
  /* 0–1 while a video is encoding, so a long job can say something. */
  progress: number;
  /* Rasterise one scene. Resolves with the number of bytes staged for `read`. */
  png(scene: number, scale?: number): Promise<number>;
  /* Encode the whole project. Resolves with the number of bytes staged. */
  mp4(options?: { fps?: number; quality?: VideoQuality; scale?: number }): Promise<number>;
  /*
    The staged file, base64, in slices. A render is megabytes and the only way
    across the CDP connection is a string, so the worker reads it in pieces
    rather than asking for one string the size of the video.
  */
  read(offset: number, length: number): string;
  clear(): void;
};

declare global {
  interface Window {
    contently?: RenderBridge;
  }
}

/* Rendering has a fixed device scale and no session; one client per page, made
   here rather than taken from the provider, which holds every query until Clerk
   hands it a token that is never coming. */
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

type Load =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; project: Project };

export function RenderStage({ projectId, token, scene }: { projectId: string; token: string; scene?: number }) {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!convexUrl) {
        if (alive) setLoad({ status: "error", message: "NEXT_PUBLIC_CONVEX_URL is not set on this deployment" });
        return;
      }
      if (!token) {
        if (alive) setLoad({ status: "error", message: "A render token is required" });
        return;
      }
      try {
        const row = await new ConvexHttpClient(convexUrl).query(api.render.document, { projectId, token });
        if (!alive) return;
        const project = row.document as unknown as Project;
        useEditor.getState().load(project);
        if (scene !== undefined && project.slides[scene]) useEditor.setState({ activeSlideId: project.slides[scene].id });
        setLoad({ status: "ready", project });
      } catch (error) {
        if (alive) setLoad({ status: "error", message: message(error) });
      }
    })();
    return () => {
      alive = false;
    };
  }, [projectId, token, scene]);

  const project = load.status === "ready" ? load.project : null;
  const root = useRef<HTMLDivElement>(null);

  /* The bridge exists from the first paint so a worker that arrives early can
     read `status` instead of polling for the property itself. */
  useBridge(project, load.status === "error" ? load.message : null, ready, root, { projectId, token });

  useEffect(() => {
    if (!project) return;
    let alive = true;
    void (async () => {
      await loadFonts(project);
      await settle();
      if (root.current) await waitForPaintableMedia(root.current);
      await settle();
      if (alive) setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [project]);

  const activeSlideId = useEditor((s) => s.activeSlideId);
  const slide = project?.slides.find((s) => s.id === activeSlideId) ?? project?.slides[0];

  return (
    <div ref={root} className="fixed inset-0 overflow-hidden bg-[#1d1d1d]" data-render-status={load.status === "error" ? "error" : ready ? "ready" : "loading"}>
      {/* The studio's typefaces, loaded the same way it loads them. */}
      <link rel="stylesheet" href={googleFontsHref()} crossOrigin="anonymous" />
      {/*
        Nothing moves on its own here. Every animation this product has is a
        function of `progress`, driven by the timeline; a CSS transition left
        running would put a different frame in the file depending on how long
        the page took to load.
      */}
      <style>{`*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}`}</style>
      {project && slide ? (
        <Artboard slide={slide} width={project.width} height={project.height} x={0} y={0} interactive={false} />
      ) : null}
      {/* For the person who opened a worker's URL to see what it saw. */}
      {load.status === "error" ? <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-ui text-ink-secondary">{load.message}</p> : null}
    </div>
  );
}

/*
  Publishes `window.contently`. A ref rather than state for the staged file: it
  is bytes on their way out of the page, nothing renders from it, and a render
  that re-rendered the tree for every megabyte would be measuring itself.
*/
function useBridge(
  project: Project | null,
  error: string | null,
  ready: boolean,
  root: React.RefObject<HTMLDivElement | null>,
  /* The render's own authorisation, for the one call the MP4 path makes back to Convex. */
  auth: { projectId: string; token: string },
) {
  const staged = useRef<Uint8Array | null>(null);
  const progress = useRef(0);

  useEffect(() => {
    const showScene = async (index: number) => {
      const p = useEditor.getState().project;
      const slide = p.slides[index];
      if (!slide) throw new Error(`This project has no scene ${index}`);
      useEditor.setState({ activeSlideId: slide.id, time: 0 });
      await settle();
      if (root.current) await waitForPaintableMedia(root.current);
      await settle();
      return slide;
    };

    const stage = async (blob: Blob) => {
      staged.current = new Uint8Array(await blob.arrayBuffer());
      return staged.current.length;
    };

    const bridge: RenderBridge = {
      status: error ? "error" : ready ? "ready" : "loading",
      error,
      project: project
        ? {
            id: project.id,
            name: project.name,
            kind: project.kind,
            width: project.width,
            height: project.height,
            slides: project.slides.map((s) => ({ id: s.id, name: s.name, duration: s.duration })),
          }
        : null,
      get progress() {
        return progress.current;
      },
      png: async (scene, scale = 1) => {
        const p = useEditor.getState().project;
        const slide = await showScene(scene);
        return await stage(await slideToBlob(p, slide.id, "png", scale));
      },
      mp4: async (options) => {
        const p = useEditor.getState().project;
        progress.current = 0;
        /* Library audio at live URLs, asked for now rather than at load: a
           signature can lapse while a job waits in the queue. Without an answer
           the saved URL is tried, and the export names a track that fails. */
        const live = p.audio.some((t) => t.trackId) && convexUrl ? await new ConvexHttpClient(convexUrl).action(api.render.audioUrls, { projectId: auth.projectId, token: auth.token }).catch(() => ({}) as Record<string, string>) : {};
        const blob = await renderVideo(p, {
          audioUrl: async (track) => (track.trackId ? live[track.trackId] : undefined) ?? track.src ?? "",
          fps: options?.fps ?? 30,
          quality: options?.quality ?? "high",
          scale: options?.scale,
          onProgress: (value) => {
            progress.current = value;
          },
        });
        return await stage(blob);
      },
      read: (offset, length) => {
        if (!staged.current) throw new Error("Nothing has been rendered yet");
        return base64Slice(staged.current, offset, length);
      },
      clear: () => {
        staged.current = null;
      },
    };

    window.contently = bridge;
    return () => {
      if (window.contently === bridge) delete window.contently;
    };
  }, [project, error, ready, root, auth.projectId, auth.token]);
}
