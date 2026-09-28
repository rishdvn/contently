"use client";

import { getFontEmbedCSS, toCanvas, toSvg } from "html-to-image";
import { ArrayBufferTarget, Muxer } from "mp4-muxer";

import { mediaUrl, waitForMedia, waitForPaintableMedia } from "./media";
import { useEditor } from "./store";
import { fadeLengths } from "./audio";
import { sceneOffsets, totalDuration } from "./geometry";
import type { AudioTrack, Project } from "./types";
import { zipStore, type ZipEntry } from "./zip";

export type ImageFormat = "png" | "jpeg";

function artboardNode(slideId: string) {
  return document.querySelector<HTMLElement>(`.artboard[data-slide-id="${slideId}"]`);
}

/*
  Rasterise one artboard as it currently stands. The node lives inside the
  zoomed world, so its clone is pinned to the origin and rendered at document
  size; `scale` multiplies that for 2x exports.

  The logical insets are pinned as well as `left`/`top`. The clone is given
  every computed property, `inset-inline` and `inset-block` included, and those
  come after the physical ones in its style block — so a carousel slide sitting
  at x = 1200 kept that offset and was painted outside the frame, leaving
  every slide after the first transparent.
*/
const captureOptions = (project: Project, fontEmbedCSS?: string) => ({
  width: project.width,
  height: project.height,
  cacheBust: false,
  fontEmbedCSS,
  style: { left: "0px", top: "0px", insetInlineStart: "0px", insetBlockStart: "0px", transform: "none" },
  filter: (el: HTMLElement) => !el.classList?.contains("moveable-control-box"),
});

export async function renderSlide(project: Project, slideId: string, scale = 1): Promise<HTMLCanvasElement> {
  const node = artboardNode(slideId);
  if (!node) throw new Error("Slide is not on the canvas");
  /*
    Media first. A document opened a moment ago is still turning its `media` ids
    into URLs, and rasterising now would bake in the placeholder rather than the
    photo — the export would look like the media had been lost.
  */
  await waitForMedia(project);
  await waitForPaintableMedia(node);
  return toCanvas(node, { ...captureOptions(project), pixelRatio: scale });
}

/*
  Frame capture for video: rasterise the SVG snapshot into one reused canvas.
  toCanvas allocates a fresh 1080×1920 canvas per call, and a few hundred of
  those in flight is enough to take the renderer down; one stage canvas keeps
  memory flat across a long render.
*/
async function paintFrame(project: Project, slideId: string, ctx: CanvasRenderingContext2D, fontEmbedCSS: string) {
  const node = artboardNode(slideId);
  if (!node) throw new Error("Scene left the canvas during export");
  const svg = await toSvg(node, captureOptions(project, fontEmbedCSS));
  const img = new Image();
  img.decoding = "sync";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Frame rasterisation failed"));
    img.src = svg;
  });
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.drawImage(img, 0, 0, ctx.canvas.width, ctx.canvas.height);
  img.src = "";
}

export async function slideToBlob(project: Project, slideId: string, format: ImageFormat, scale = 1): Promise<Blob> {
  const canvas = await renderSlide(project, slideId, scale);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Encoding failed"))), format === "png" ? "image/png" : "image/jpeg", 0.92),
  );
}

/*
  A carousel as one download: every slide in the order it posts, named `01.png`,
  `02.png`, … so a file browser lists them that way too. Every slide is on the
  canvas at once, so nothing has to be switched to paint the next one.
*/
export async function slidesToZip(project: Project, format: ImageFormat, scale = 1, onProgress?: (p: number) => void): Promise<Blob> {
  const extension = format === "png" ? "png" : "jpg";
  const digits = Math.max(2, String(project.slides.length).length);
  const entries: ZipEntry[] = [];
  for (const [i, slide] of project.slides.entries()) {
    const blob = await slideToBlob(project, slide.id, format, scale);
    entries.push({ name: `${String(i + 1).padStart(digits, "0")}.${extension}`, data: new Uint8Array(await blob.arrayBuffer()) });
    onProgress?.((i + 1) / project.slides.length);
  }
  return new Blob([zipStore(entries)], { type: "application/zip" });
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

/*
  Media inside the artboard is seeked by the store's clock; wait for it to land.
  A scene that has just been mounted needs a longer grace period: its <video>
  elements are still fetching, and painting before they have a frame would bake
  black into the file. Per-frame waits stay short so a stalled stream cannot
  hang the export.
*/
async function settleMedia(node: HTMLElement, budgetMs: number) {
  const videos = Array.from(node.querySelectorAll("video"));
  const deadline = performance.now() + budgetMs;
  while (performance.now() < deadline && videos.some((v) => v.seeking || v.readyState < 2)) {
    await new Promise((r) => setTimeout(r, 16));
  }
}

/*
  The web fonts every scene uses, as one stylesheet for `paintFrame`. A video
  has only its active scene on the canvas, so asking the first scene's node
  (as `getFontEmbedCSS` would) misses a typeface that first appears later, and
  that scene is painted in the fallback. Each scene is shown once instead and
  the families its artboard computes — text and catalog blocks alike, since
  blocks stay mounted outside their in and out points — are put on one probe
  for html-to-image to embed from.
*/
async function sceneFontEmbedCSS(project: Project): Promise<string> {
  const families = new Set<string>();
  for (const scene of project.slides) {
    useEditor.setState({ activeSlideId: scene.id, time: 0 });
    await nextFrame();
    await nextFrame();
    const node = artboardNode(scene.id);
    if (!node) continue;
    for (const el of [node, ...node.querySelectorAll<HTMLElement>("*")]) families.add(getComputedStyle(el).fontFamily);
  }
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;left:-10000px;top:0;visibility:hidden";
  probe.style.fontFamily = [...families][0] ?? "";
  for (const family of families) {
    const span = probe.appendChild(document.createElement("span"));
    span.style.fontFamily = family;
  }
  document.body.appendChild(probe);
  try {
    return await getFontEmbedCSS(probe);
  } finally {
    probe.remove();
  }
}

/* -------------------------------------------------------------- audio --- */

const AUDIO_RATE = 48_000;
const AUDIO_CHANNELS = 2;

/* How a lane track's file is found. The studio resolves library audio to a live
   URL; anywhere without a session (the render route) falls back to `src`. */
export type AudioUrlResolver = (track: AudioTrack) => Promise<string>;

const savedUrl: AudioUrlResolver = async (track) => track.src ?? "";

/* One thing to hear in the mix: a lane track, or the soundtrack of a video
   block. Times are on the project timeline. */
type MixSource = {
  title: string;
  url: () => Promise<string>;
  start: number;
  end: number;
  offset: number;
  volume: number;
  fadeIn?: number;
  fadeOut?: number;
  /* Lane audio is the point of the track, so failing to load it fails the
     export. A clip's sound is incidental — plenty of clips have no audio
     stream at all — so a clip that cannot be decoded is simply silent. */
  required: boolean;
};

function mixSources(project: Project, resolve: AudioUrlResolver): MixSource[] {
  const total = totalDuration(project);
  const sources: MixSource[] = project.audio
    .filter((t) => !t.muted && t.volume > 0 && t.duration > 0 && t.start < total)
    .map((t) => ({
      title: t.title,
      url: () => resolve(t),
      start: t.start,
      end: Math.min(t.start + t.duration, total),
      offset: t.offset ?? 0,
      volume: t.volume,
      fadeIn: t.fadeIn,
      fadeOut: t.fadeOut,
      required: true,
    }));
  const offsets = sceneOffsets(project);
  project.slides.forEach((slide, i) => {
    for (const block of slide.blocks) {
      if (block.type !== "video" || block.muted || block.hidden || block.volume <= 0) continue;
      const start = offsets[i] + Math.max(0, block.start);
      const end = offsets[i] + Math.min(block.end, slide.duration);
      if (end <= start) continue;
      sources.push({
        title: block.name ?? "Video",
        url: async () => (block.mediaId ? (mediaUrl(block.mediaId) ?? block.src) : block.src),
        start,
        end,
        offset: block.trimStart,
        volume: block.volume,
        required: false,
      });
    }
  });
  return sources;
}

/*
  Everything audible, mixed down offline: every unmuted lane track and every
  unmuted video block decoded, placed at its start, cut to its offset and
  length, scaled by its volume and — for lane tracks — ramped by its fades, the
  envelope `fadeGain` gives playback, scheduled on a gain node. The studio's
  own mute button is monitoring and is ignored here; a muted track or clip is
  left out. Null when there is nothing to hear.

  A lane track whose file cannot be fetched or decoded fails the export, named:
  a video that quietly lost its music is worse than one that did not render.
*/
export async function mixAudio(project: Project, resolve: AudioUrlResolver = savedUrl, signal?: AbortSignal): Promise<AudioBuffer | null> {
  const total = totalDuration(project);
  const sources = mixSources(project, resolve);
  if (!sources.length || total <= 0) return null;

  const ctx = new OfflineAudioContext(AUDIO_CHANNELS, Math.ceil(total * AUDIO_RATE), AUDIO_RATE);
  let scheduled = 0;
  for (const track of sources) {
    if (signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
    let buffer: AudioBuffer;
    try {
      const url = await track.url();
      if (!url) throw new Error("no file");
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      buffer = await ctx.decodeAudioData(await response.arrayBuffer());
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      if (!track.required) continue;
      throw new Error(`Couldn't load the audio "${track.title}". Check your connection, or remove it from the timeline.`);
    }

    const { start, end } = track;
    const volume = Math.min(Math.max(track.volume / 100, 0), 1);
    const { fadeIn, fadeOut } = fadeLengths({ ...track, duration: end - start });
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(fadeIn > 0 ? 0 : volume, start);
    if (fadeIn > 0) gain.gain.linearRampToValueAtTime(volume, start + fadeIn);
    if (fadeOut > 0) {
      gain.gain.setValueAtTime(volume, end - fadeOut);
      gain.gain.linearRampToValueAtTime(0, end);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gain).connect(ctx.destination);
    source.start(start, track.offset, end - start);
    scheduled++;
  }
  return scheduled ? ctx.startRendering() : null;
}

/* AAC where the browser can encode it — it plays everywhere — and Opus, which
   every WebCodecs browser can, otherwise. */
async function audioCodec(): Promise<{ config: AudioEncoderConfig; muxer: "aac" | "opus" } | null> {
  if (typeof AudioEncoder === "undefined") return null;
  const candidates: { config: AudioEncoderConfig; muxer: "aac" | "opus" }[] = [
    { config: { codec: "mp4a.40.2", sampleRate: AUDIO_RATE, numberOfChannels: AUDIO_CHANNELS, bitrate: 192_000 }, muxer: "aac" },
    { config: { codec: "opus", sampleRate: AUDIO_RATE, numberOfChannels: AUDIO_CHANNELS, bitrate: 160_000 }, muxer: "opus" },
  ];
  for (const candidate of candidates) {
    try {
      if ((await AudioEncoder.isConfigSupported(candidate.config)).supported) return candidate;
    } catch {
      /* An unknown codec string throws in some browsers rather than answering. */
    }
  }
  return null;
}

/* The mix, encoded in 20 ms slices. */
async function encodeAudio(mix: AudioBuffer, config: AudioEncoderConfig, muxer: Muxer<ArrayBufferTarget>) {
  let failure: Error | null = null;
  const encoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: (e) => (failure = e),
  });
  encoder.configure(config);
  const slice = Math.round(AUDIO_RATE / 50);
  const channels = Array.from({ length: AUDIO_CHANNELS }, (_, c) => mix.getChannelData(Math.min(c, mix.numberOfChannels - 1)));
  try {
    for (let at = 0; at < mix.length; at += slice) {
      if (failure) throw failure;
      const frames = Math.min(slice, mix.length - at);
      const planar = new Float32Array(frames * AUDIO_CHANNELS);
      channels.forEach((data, c) => planar.set(data.subarray(at, at + frames), c * frames));
      const data = new AudioData({
        format: "f32-planar",
        sampleRate: AUDIO_RATE,
        numberOfFrames: frames,
        numberOfChannels: AUDIO_CHANNELS,
        timestamp: Math.round((at / AUDIO_RATE) * 1_000_000),
        data: planar,
      });
      encoder.encode(data);
      data.close();
      while (encoder.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 2));
    }
    await encoder.flush();
    if (failure) throw failure;
  } finally {
    if (encoder.state !== "closed") encoder.close();
  }
}

/*
  Offline render: step the timeline one frame at a time, rasterise the scene
  and hand it to WebCodecs, then mux into a fragmented-free MP4 in memory.
  Not real-time, so the result is smooth regardless of machine speed.
*/
export async function renderVideo(
  project: Project,
  opts: {
    fps: number;
    quality: VideoQuality;
    onProgress?: (p: number) => void;
    signal?: AbortSignal;
    audioUrl?: AudioUrlResolver;
    /* Output size as a multiple of the artboard, as for stills. The block
       previews encode at half size; the studio always exports at 1. */
    scale?: number;
  },
): Promise<Blob> {
  if (!canEncodeVideo()) throw new Error("This browser cannot encode video. Try Chrome or Edge.");
  /* As in `renderSlide`: no frame is painted before its media has a URL. */
  await waitForMedia(project);
  /* H.264 wants even dimensions. */
  const even = (n: number) => Math.max(2, Math.round(n) - (Math.round(n) % 2));
  const width = even(project.width * (opts.scale ?? 1));
  const height = even(project.height * (opts.scale ?? 1));

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

  /* The audio is mixed before the first frame: the muxer has to know about the
     track when it is made, and a mix that fails should fail before minutes of
     rasterising, not after. */
  const mix = await mixAudio(project, opts.audioUrl, opts.signal);
  const codecForAudio = mix ? await audioCodec() : null;
  if (mix && !codecForAudio) throw new Error("This browser cannot encode audio. Try Chrome or Edge.");

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width, height },
    audio: codecForAudio ? { codec: codecForAudio.muxer, numberOfChannels: AUDIO_CHANNELS, sampleRate: AUDIO_RATE } : undefined,
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  });
  if (mix && codecForAudio) await encodeAudio(mix, codecForAudio.config, muxer);
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
  /* willReadFrequently keeps the stage in system memory, where VideoFrame reads it cheaply. */
  const ctx = stage.getContext("2d", { willReadFrequently: true })!;

  try {
    const fontEmbedCSS = await sceneFontEmbedCSS(project);
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
        await settleMedia(node, i === 0 ? 10_000 : 600);
        await paintFrame(project, scene.id, ctx, fontEmbedCSS);
        const vf = new VideoFrame(stage, { timestamp: Math.round((elapsed + i / opts.fps) * 1_000_000), duration: Math.round(1_000_000 / opts.fps) });
        encoder.encode(vf, { keyFrame: frame % (opts.fps * 2) === 0 });
        vf.close();
        /* Keep the encoder queue short so memory stays flat on long renders. */
        while (encoder.encodeQueueSize > 2) await new Promise((r) => setTimeout(r, 5));
        if (frame % 15 === 14) await encoder.flush();
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
