"use client";

import { toCanvas } from "html-to-image";
import { ArrayBufferTarget, Muxer } from "mp4-muxer";

import { useEditor } from "./store";
import type { Project } from "./types";

export type ImageFormat = "png" | "jpeg";

function artboardNode(slideId: string) {
  return document.querySelector<HTMLElement>(`.artboard[data-slide-id="${slideId}"]`);
}

/*
  Rasterise one artboard as it currently stands. The node lives inside the
  zoomed world, so its clone is pinned to the origin and rendered at document
  size; `scale` multiplies that for 2x exports.
*/
export async function renderSlide(project: Project, slideId: string, scale = 1): Promise<HTMLCanvasElement> {
  const node = artboardNode(slideId);
  if (!node) throw new Error("Slide is not on the canvas");
  return toCanvas(node, {
    width: project.width,
    height: project.height,
    pixelRatio: scale,
    cacheBust: false,
    style: { left: "0px", top: "0px", transform: "none" },
    filter: (el) => !(el as HTMLElement).classList?.contains("moveable-control-box"),
  });
}

export async function slideToBlob(project: Project, slideId: string, format: ImageFormat, scale = 1): Promise<Blob> {
  const canvas = await renderSlide(project, slideId, scale);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Encoding failed"))), format === "png" ? "image/png" : "image/jpeg", 0.92),
  );
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const safeName = (s: string) => s.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "export";

/* -------------------------------------------------------------- video --- */

export type VideoQuality = "high" | "best" | "medium";

const BITRATE: Record<VideoQuality, number> = { medium: 4_000_000, high: 9_000_000, best: 16_000_000 };

export const canEncodeVideo = () => typeof window !== "undefined" && "VideoEncoder" in window && "VideoFrame" in window;

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/* Media inside the artboard is seeked by the store's clock; wait for it to land. */
async function settleMedia(node: HTMLElement) {
  const videos = Array.from(node.querySelectorAll("video"));
  const deadline = performance.now() + 400;
  while (performance.now() < deadline && videos.some((v) => v.seeking || v.readyState < 2)) {
    await new Promise((r) => setTimeout(r, 16));
  }
}

/*
  Offline render: step the timeline one frame at a time, rasterise the scene
  and hand it to WebCodecs, then mux into a fragmented-free MP4 in memory.
  Not real-time, so the result is smooth regardless of machine speed.
*/
export async function renderVideo(
  project: Project,
  opts: { fps: number; quality: VideoQuality; onProgress?: (p: number) => void; signal?: AbortSignal },
): Promise<Blob> {
  if (!canEncodeVideo()) throw new Error("This browser cannot encode video. Try Chrome or Edge.");
  const width = project.width - (project.width % 2);
  const height = project.height - (project.height % 2);

  const codecs = ["avc1.640033", "avc1.64002a", "avc1.640028", "avc1.4d0028", "avc1.42e01f"];
  let codec: string | null = null;
  for (const c of codecs) {
    const { supported } = await VideoEncoder.isConfigSupported({ codec: c, width, height, bitrate: BITRATE[opts.quality], framerate: opts.fps });
    if (supported) {
      codec = c;
      break;
    }
  }
  if (!codec) throw new Error("No supported H.264 profile for this size");

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width, height },
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  });
  let encodeError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => (encodeError = e),
  });
  encoder.configure({ codec, width, height, bitrate: BITRATE[opts.quality], framerate: opts.fps, latencyMode: "quality" });

  const store = useEditor.getState();
  const restore = { activeSlideId: store.activeSlideId, time: store.time, playing: store.playing, selection: store.selection };
  useEditor.setState({ playing: false, selection: [], editingTextId: null });

  const total = project.slides.reduce((a, s) => a + s.duration, 0);
  const frames = Math.max(1, Math.round(total * opts.fps));
  const stage = document.createElement("canvas");
  stage.width = width;
  stage.height = height;
  const ctx = stage.getContext("2d")!;

  try {
    let frame = 0;
    let elapsed = 0;
    for (const scene of project.slides) {
      const sceneFrames = Math.round(scene.duration * opts.fps);
      for (let i = 0; i < sceneFrames && frame < frames; i++, frame++) {
        if (opts.signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
        if (encodeError) throw encodeError;
        useEditor.setState({ activeSlideId: scene.id, time: i / opts.fps });
        await nextFrame();
        await nextFrame();
        const node = artboardNode(scene.id);
        if (!node) throw new Error("Scene left the canvas during export");
        await settleMedia(node);
        const canvas = await renderSlide(project, scene.id, 1);
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(canvas, 0, 0, width, height);
        const vf = new VideoFrame(stage, { timestamp: Math.round((elapsed + i / opts.fps) * 1_000_000), duration: Math.round(1_000_000 / opts.fps) });
        encoder.encode(vf, { keyFrame: frame % (opts.fps * 2) === 0 });
        vf.close();
        /* Keep the encoder queue bounded so memory stays flat on long renders. */
        while (encoder.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 5));
        opts.onProgress?.((frame + 1) / frames);
      }
      elapsed += scene.duration;
    }
    await encoder.flush();
    encoder.close();
    muxer.finalize();
    const { buffer } = muxer.target;
    return new Blob([buffer], { type: "video/mp4" });
  } finally {
    if (encoder.state !== "closed") encoder.close();
    useEditor.setState(restore);
  }
}
