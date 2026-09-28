"use client";

import { useConvex } from "convex/react";
import { Check, Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { trackUrl } from "@/lib/editor/audio";
import { canEncodeVideo, download, renderVideo, safeName, slidesToZip, slideToBlob, type ImageFormat, type VideoQuality } from "@/lib/editor/export";
import { useEditor } from "@/lib/editor/store";

import { Card, Select, TextField } from "../controls";
import { Flyout, FlyoutRow, FlyoutTabs, PrimaryButton } from "./Flyout";

type Tab = "video" | "image" | "gif";

const VIDEO_FORMATS: { value: VideoQuality; label: string }[] = [
  { value: "high", label: "High Quality (MP4)" },
  { value: "best", label: "Best Quality (MP4, Slower)" },
  { value: "medium", label: "Smaller File (MP4)" },
];

export function ExportDialog() {
  return (
    <Flyout id="export" title="Export">
      <ExportBody />
    </Flyout>
  );
}

/* Mounted only while the flyout is open, so every open starts clean. */
function ExportBody() {
  const convex = useConvex();
  const project = useEditor((s) => s.project);
  const rename = useEditor((s) => s.rename);
  const activeSlideId = useEditor((s) => s.activeSlideId);
  const isVideo = project.kind === "video";

  const [tab, setTab] = useState<Tab>(isVideo ? "video" : "image");
  const [quality, setQuality] = useState<VideoQuality>("high");
  const [fps, setFps] = useState(30);
  const [format, setFormat] = useState<ImageFormat>("png");
  const [scale, setScale] = useState(1);
  const [range, setRange] = useState<"current" | "all">(project.kind === "carousel" ? "all" : "current");
  const [busy, setBusy] = useState<null | { label: string; progress: number }>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const finish = () => {
    setBusy(null);
    setDone(true);
    setTimeout(() => setDone(false), 1800);
  };

  const exportImages = async () => {
    setError(null);
    setBusy({ label: "Rendering…", progress: 0 });
    try {
      /* A whole carousel is one ZIP of its slides in order; anything else is the
         one slide or scene on the canvas. */
      if (project.kind === "carousel" && range === "all") {
        const zip = await slidesToZip(project, format, scale, (p) => setBusy({ label: "Rendering…", progress: p }));
        download(zip, `${safeName(project.name)}.zip`);
      } else {
        const slide = project.slides.find((s) => s.id === activeSlideId) ?? project.slides[0];
        download(await slideToBlob(project, slide.id, format, scale), `${safeName(project.name)}.${format === "png" ? "png" : "jpg"}`);
      }
      finish();
    } catch (e) {
      setBusy(null);
      setError(e instanceof Error ? e.message : "Export failed");
    }
  };

  const exportVideo = async () => {
    setError(null);
    abort.current = new AbortController();
    setBusy({ label: "Rendering video…", progress: 0 });
    try {
      const blob = await renderVideo(project, {
        fps,
        quality,
        signal: abort.current.signal,
        /* Library audio at a live URL: a saved Soundstripe link may have
           expired since the track was added. */
        audioUrl: (track) => trackUrl(convex, track),
        onProgress: (p) => setBusy({ label: "Rendering video…", progress: p }),
      });
      download(blob, `${safeName(project.name)}.mp4`);
      finish();
    } catch (e) {
      setBusy(null);
      if (!(e instanceof DOMException && e.name === "AbortError")) setError(e instanceof Error ? e.message : "Export failed");
    }
  };

  const tabs: { value: Tab; label: string; disabled?: boolean }[] = isVideo
    ? [
        { value: "video", label: "Video" },
        { value: "image", label: "Image" },
        { value: "gif", label: "Gif" },
      ]
    : [{ value: "image", label: "Image" }];

  return (
    <>
      <Card className="flex flex-col gap-1 px-2.5 pt-2 pb-2.5">
        <span className="text-cap text-ink-secondary">Project Name</span>
        <TextField value={project.name} onCommit={(v) => v.trim() && rename(v.trim())} className="h-7 bg-transparent px-0 text-default focus:ring-0" />
      </Card>

      <FlyoutTabs value={tab} onChange={setTab} options={tabs} />

      {tab === "video" ? (
        <>
          <FlyoutRow label="Format">
            <Select value={quality} onChange={(e) => setQuality(e.target.value as VideoQuality)} className="h-7 bg-transparent">
              {VIDEO_FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
          </FlyoutRow>
          <FlyoutRow label="Frame Rate">
            <Select value={fps} onChange={(e) => setFps(Number(e.target.value))} className="h-7 bg-transparent">
              {[24, 30, 60].map((f) => (
                <option key={f} value={f}>
                  {f} fps
                </option>
              ))}
            </Select>
          </FlyoutRow>
          {!canEncodeVideo() ? <p className="px-0.5 text-cap text-caution">Video encoding needs Chrome or Edge.</p> : null}
          <Action busy={busy} done={done} label="Export Video" onClick={exportVideo} disabled={!canEncodeVideo()} onCancel={() => abort.current?.abort()} />
        </>
      ) : null}

      {tab === "image" ? (
        <>
          <FlyoutRow label="Format">
            <Select value={format} onChange={(e) => setFormat(e.target.value as ImageFormat)} className="h-7 bg-transparent">
              <option value="png">PNG</option>
              <option value="jpeg">JPG</option>
            </Select>
          </FlyoutRow>
          <FlyoutRow label="Size">
            <Select value={scale} onChange={(e) => setScale(Number(e.target.value))} className="h-7 bg-transparent">
              <option value={1}>
                {project.width} × {project.height}
              </option>
              <option value={2}>
                {project.width * 2} × {project.height * 2}
              </option>
            </Select>
          </FlyoutRow>
          {project.kind === "carousel" ? (
            <FlyoutRow label="Slides">
              <Select value={range} onChange={(e) => setRange(e.target.value as "current" | "all")} className="h-7 bg-transparent">
                <option value="all">All {project.slides.length} slides (ZIP)</option>
                <option value="current">Current slide</option>
              </Select>
            </FlyoutRow>
          ) : null}
          <Action busy={busy} done={done} label={isVideo ? "Export Frame" : range === "all" && project.kind === "carousel" ? "Export Slides" : "Export Image"} onClick={exportImages} />
        </>
      ) : null}

      {tab === "gif" ? (
        <>
          <p className="px-0.5 py-1 text-cap text-ink-secondary">Animated GIF export is not available yet. Export as MP4 and convert, or export a frame as an image.</p>
          <PrimaryButton disabled>Export Gif</PrimaryButton>
        </>
      ) : null}

      {error ? <p className="px-0.5 text-cap text-critical">{error}</p> : null}
    </>
  );
}

function Action({
  busy,
  done,
  label,
  onClick,
  disabled,
  onCancel,
}: {
  busy: null | { label: string; progress: number };
  done: boolean;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  onCancel?: () => void;
}) {
  if (busy) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="relative h-9 overflow-hidden rounded-[8px] bg-raised">
          <div className="absolute inset-y-0 left-0 bg-ink/20 transition-[width]" style={{ width: `${Math.round(busy.progress * 100)}%` }} />
          <div className="relative flex h-full items-center justify-center gap-2 text-ui text-ink">
            {busy.label} {Math.round(busy.progress * 100)}%
          </div>
        </div>
        {onCancel ? (
          <button type="button" className="self-center text-cap text-ink-secondary hover:text-ink" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    );
  }
  return (
    <PrimaryButton onClick={onClick} disabled={disabled}>
      {done ? <Check className="size-4" /> : <Download className="size-4" />}
      {done ? "Saved" : label}
    </PrimaryButton>
  );
}
