"use client";

import { useConvex, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Check, Cloud, Download, Film, Image as ImageIcon, ImageOff, Images, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { relativeTime } from "@/components/hub/ProjectPreview";
import { errorMessage } from "@/components/render/settle";
import { Tooltip } from "@/components/ui/tooltip";
import { api } from "@/convex/_generated/api";
import { useActiveOrg } from "@/lib/auth/useActiveOrg";
import { cn } from "@/lib/cn";
import { trackUrl } from "@/lib/editor/audio";
import { canEncodeVideo, CodecUnsupportedError, download, renderVideo, safeName, slidesToZip, slideToBlob, type ImageFormat, type VideoQuality } from "@/lib/editor/export";
import { totalDuration } from "@/lib/editor/geometry";
import { findMissingMedia, type MissingMediaItem } from "@/lib/editor/media";
import { useSaveProject } from "@/lib/editor/persistence";
import { useEditor } from "@/lib/editor/store";
import type { Project } from "@/lib/editor/types";

import { Card, Segmented, Select, TextField } from "../controls";
import { Flyout, FlyoutRow, FlyoutTabs, PrimaryButton } from "./Flyout";

type Tab = "video" | "image" | "gif";
type Target = "browser" | "cloud";
type RenderFormat = "png" | "carousel-zip" | "mp4";
type ExportJob = FunctionReturnType<typeof api.render.recentExports>[number];

const VIDEO_FORMATS: { value: VideoQuality; label: string }[] = [
  { value: "high", label: "High Quality (MP4)" },
  { value: "best", label: "Best Quality (MP4, Slower)" },
  { value: "medium", label: "Smaller File (MP4)" },
];

/* Past this a video renders in the cloud by default: an in-tab encode of a long
   video holds the tab for minutes, and the worker does it with the tab closed. */
const CLOUD_FROM_SECONDS = 30;

type Busy = { label: string; progress: number; cancel?: () => void };
type Failure = { message: string; codec?: boolean };

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
  const { orgId } = useActiveOrg();
  const save = useSaveProject();
  const enqueue = useMutation(api.render.enqueue);
  const record = useMutation(api.render.recordBrowserExport);
  const project = useEditor((s) => s.project);
  const rename = useEditor((s) => s.rename);
  const activeSlideId = useEditor((s) => s.activeSlideId);
  const isVideo = project.kind === "video";
  const encodes = canEncodeVideo();

  const [tab, setTab] = useState<Tab>(isVideo ? "video" : "image");
  const [quality, setQuality] = useState<VideoQuality>("high");
  const [fps, setFps] = useState(30);
  const [imageFormat, setImageFormat] = useState<ImageFormat>("png");
  const [scale, setScale] = useState(1);
  const [range, setRange] = useState<"current" | "all">(project.kind === "carousel" ? "all" : "current");
  const [targetChoice, setTargetChoice] = useState<Target | null>(null);
  const [busy, setBusy] = useState<Busy | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<Failure | null>(null);
  const [cloudJobId, setCloudJobId] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const missing = useMissingMedia(project);
  const cloudJob = useQuery(api.render.job, orgId && cloudJobId ? { orgId, jobId: cloudJobId } : "skip");
  const history = useQuery(api.render.recentExports, orgId ? { orgId, projectId: project.id } : "skip");

  useEffect(() => () => abort.current?.abort(), []);

  /* What the current tab and settings make, and whether the worker can make it
     too. A frame of a video is the one thing it cannot: it renders a scene's
     first frame, not the one under the playhead. */
  const sceneIndex = Math.max(0, project.slides.findIndex((s) => s.id === activeSlideId));
  const zip = project.kind === "carousel" && range === "all";
  const wanted: { format: RenderFormat; scene?: number; cloud: boolean } =
    tab === "video"
      ? { format: "mp4", cloud: true }
      : zip
        ? { format: "carousel-zip", cloud: true }
        : { format: "png", scene: project.kind === "image" ? undefined : sceneIndex, cloud: !isVideo };
  const long = totalDuration(project) > CLOUD_FROM_SECONDS;
  const cloudByDefault = tab === "video" && (long || !encodes);
  const target: Target = wanted.cloud ? (targetChoice ?? (cloudByDefault ? "cloud" : "browser")) : "browser";
  /* The worker writes PNG only. */
  const format: ImageFormat = target === "cloud" ? "png" : imageFormat;
  const extension = tab === "video" ? "mp4" : zip ? "zip" : format === "png" ? "png" : "jpg";
  const fileName = `${safeName(project.name)}.${extension}`;

  const finish = () => {
    setBusy(null);
    setDone(true);
    setTimeout(() => setDone(false), 1800);
    /* History only: the file is already in the person's downloads. */
    if (orgId) {
      void record({ orgId, projectId: project.id, format: wanted.format, fileName, scene: wanted.scene, scale: tab === "video" ? undefined : scale, fps: tab === "video" ? fps : undefined }).catch(() => {});
    }
  };

  const fail = (e: unknown) => {
    setBusy(null);
    if (e instanceof DOMException && e.name === "AbortError") return;
    setError({ message: errorMessage(e) || "Export failed", codec: e instanceof CodecUnsupportedError });
  };

  const exportImages = async () => {
    setError(null);
    const controller = new AbortController();
    abort.current = controller;
    setBusy({ label: "Rendering…", progress: 0 });
    try {
      /* A whole carousel is one ZIP of its slides in order; anything else is the
         one slide or scene on the canvas. */
      if (zip) {
        const onProgress = (p: number) => setBusy({ label: "Rendering…", progress: p, cancel: () => controller.abort() });
        download(await slidesToZip(project, format, scale, onProgress, controller.signal), fileName);
      } else {
        download(await slideToBlob(project, project.slides[sceneIndex].id, format, scale), fileName);
      }
      finish();
    } catch (e) {
      fail(e);
    }
  };

  const exportVideo = async () => {
    setError(null);
    const controller = new AbortController();
    abort.current = controller;
    const cancel = () => controller.abort();
    setBusy({ label: "Rendering video…", progress: 0, cancel });
    try {
      const blob = await renderVideo(project, {
        fps,
        quality,
        signal: controller.signal,
        /* Library audio at a live URL: a saved Soundstripe link may have
           expired since the track was added. */
        audioUrl: (track) => trackUrl(convex, track),
        onProgress: (p) => setBusy({ label: "Rendering video…", progress: p, cancel }),
      });
      download(blob, fileName);
      finish();
    } catch (e) {
      fail(e);
    }
  };

  const renderInCloud = async () => {
    if (!orgId) return;
    setError(null);
    setTargetChoice("cloud");
    setBusy({ label: "Sending to the cloud…", progress: 0 });
    try {
      /* The worker renders the saved document, so save what is on screen first
         rather than trusting the autosave to have caught up. */
      await save(useEditor.getState().project);
      const id = await enqueue({
        orgId,
        projectId: project.id,
        format: wanted.format,
        scene: wanted.scene,
        scale: tab === "video" ? undefined : scale,
        fps: tab === "video" ? fps : undefined,
      });
      setBusy(null);
      setCloudJobId(id);
    } catch (e) {
      fail(e);
    }
  };

  const tabs: { value: Tab; label: string; disabled?: boolean }[] = isVideo
    ? [
        { value: "video", label: "Video" },
        { value: "image", label: "Image" },
        { value: "gif", label: "Gif" },
      ]
    : [{ value: "image", label: "Image" }];

  const targetRow = wanted.cloud ? (
    <FlyoutRow label="Render">
      <Segmented
        value={target}
        onChange={(t) => {
          setTargetChoice(t);
          setError(null);
        }}
        options={[
          { value: "browser", label: "Browser" },
          { value: "cloud", label: "Cloud" },
        ]}
        className="w-[164px]"
      />
    </FlyoutRow>
  ) : null;

  /* A cloud render this dialog asked for, until it is dismissed. */
  const watching = cloudJobId ? cloudJob : null;
  const action = watching ? (
    <CloudJobStatus job={watching} orgId={orgId} onDismiss={() => setCloudJobId(null)} onRetry={renderInCloud} />
  ) : target === "cloud" ? (
    <Action busy={busy} done={false} label="Render in cloud" icon={<Cloud className="size-4" />} onClick={renderInCloud} disabled={!orgId} />
  ) : tab === "video" ? (
    <Action busy={busy} done={done} label="Export Video" onClick={exportVideo} disabled={!encodes} />
  ) : (
    <Action busy={busy} done={done} label={isVideo ? "Export Frame" : zip ? "Export Slides" : "Export Image"} onClick={exportImages} />
  );

  return (
    <>
      <Card className="flex flex-col gap-1 px-2.5 pt-2 pb-2.5">
        <span className="text-cap text-ink-secondary">Project Name</span>
        <TextField value={project.name} onCommit={(v) => v.trim() && rename(v.trim())} className="h-7 bg-transparent px-0 text-default focus:ring-0" />
      </Card>

      <FlyoutTabs
        value={tab}
        onChange={(t) => {
          setTab(t);
          setError(null);
        }}
        options={tabs}
      />

      {tab !== "gif" && missing.length ? <MissingMediaWarning items={missing} /> : null}

      {tab === "video" ? (
        <>
          {target === "browser" ? (
            <FlyoutRow label="Format">
              <Select value={quality} onChange={(e) => setQuality(e.target.value as VideoQuality)} className="h-7 bg-transparent">
                {VIDEO_FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </FlyoutRow>
          ) : null}
          <FlyoutRow label="Frame Rate">
            <Select value={fps} onChange={(e) => setFps(Number(e.target.value))} className="h-7 bg-transparent">
              {[24, 30, 60].map((f) => (
                <option key={f} value={f}>
                  {f} fps
                </option>
              ))}
            </Select>
          </FlyoutRow>
          {targetRow}
          {target === "cloud" && targetChoice === null ? (
            <p className="px-0.5 text-cap text-ink-secondary">{encodes ? `Longer than ${CLOUD_FROM_SECONDS} s, so it renders in the cloud and this tab stays free.` : "This browser can't encode video, so it renders in the cloud."}</p>
          ) : null}
          {target === "browser" && !encodes ? <p className="px-0.5 text-cap text-caution">This browser can&apos;t encode video. Render it in the cloud instead.</p> : null}
          {action}
        </>
      ) : null}

      {tab === "image" ? (
        <>
          <FlyoutRow label="Format">
            <Select value={format} onChange={(e) => setImageFormat(e.target.value as ImageFormat)} className="h-7 bg-transparent">
              <option value="png">PNG</option>
              <option value="jpeg" disabled={target === "cloud"}>
                JPG
              </option>
            </Select>
          </FlyoutRow>
          <FlyoutRow label="Size">
            <Select value={scale} onChange={(e) => setScale(Number(e.target.value))} className="h-7 bg-transparent">
              {[1, 2].map((s) => (
                <option key={s} value={s}>
                  {s}× · {project.width * s} × {project.height * s}
                </option>
              ))}
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
          {targetRow}
          {action}
        </>
      ) : null}

      {tab === "gif" ? (
        <>
          <p className="px-0.5 py-1 text-cap text-ink-secondary">Animated GIF export is not available yet. Export as MP4 and convert, or export a frame as an image.</p>
          <PrimaryButton disabled>Export Gif</PrimaryButton>
        </>
      ) : null}

      {error ? (
        <div className="flex flex-col gap-1.5 rounded-[8px] bg-raised px-2.5 py-2" role="alert">
          <p className="text-cap text-critical">{error.message}</p>
          {error.codec && wanted.cloud ? (
            <button type="button" className="flex items-center gap-1.5 self-start text-cap text-ink hover:underline" onClick={renderInCloud}>
              <Cloud className="size-3.5" />
              Render in the cloud instead
            </button>
          ) : null}
        </div>
      ) : null}

      <ExportHistory jobs={history} orgId={orgId} projectName={safeName(project.name)} />
    </>
  );
}

/* The document's unloadable media, checked again whenever the document changes.
   Probes are remembered per URL, so a re-check after an edit is instant. */
function useMissingMedia(project: Project): MissingMediaItem[] {
  const [found, setFound] = useState<{ project: Project; items: MissingMediaItem[] } | null>(null);
  useEffect(() => {
    let alive = true;
    void findMissingMedia(project).then((items) => {
      if (alive) setFound({ project, items });
    });
    return () => {
      alive = false;
    };
  }, [project]);
  return found?.project === project ? found.items : [];
}

/* Media the export will leave out, each a way to the block to replace it. */
function MissingMediaWarning({ items }: { items: MissingMediaItem[] }) {
  const setActiveSlide = useEditor((s) => s.setActiveSlide);
  const select = useEditor((s) => s.select);
  return (
    <div className="flex flex-col gap-1 rounded-[8px] bg-raised px-2.5 py-2" role="status" aria-label="Missing media">
      <p className="flex items-center gap-1.5 text-cap text-caution">
        <ImageOff className="size-3.5 shrink-0" />
        {items.length === 1 ? "1 file can't be loaded" : `${items.length} files can't be loaded`} and will be left out.
      </p>
      <ul className="flex flex-col">
        {items.map((item) => (
          <li key={`${item.slideId}:${item.blockId ?? "background"}`}>
            <button
              type="button"
              className="w-full truncate py-0.5 text-left text-cap text-ink-secondary hover:text-ink"
              onClick={() => {
                setActiveSlide(item.slideId);
                if (item.blockId) select([item.blockId], false, true);
              }}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Action({
  busy,
  done,
  label,
  icon,
  onClick,
  disabled,
}: {
  busy: Busy | null;
  done: boolean;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  if (busy) return <Progress label={busy.label} progress={busy.progress} onCancel={busy.cancel} />;
  return (
    <PrimaryButton onClick={onClick} disabled={disabled}>
      {done ? <Check className="size-4" /> : (icon ?? <Download className="size-4" />)}
      {done ? "Saved" : label}
    </PrimaryButton>
  );
}

/* A bar with a label in it. No `progress` is a render with no measure yet: the
   bar sweeps instead of sitting at zero. */
function Progress({ label, progress, onCancel }: { label: string; progress?: number; onCancel?: () => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative h-9 overflow-hidden rounded-[8px] bg-raised" role="progressbar" aria-label={label} aria-valuenow={progress === undefined ? undefined : Math.round(progress * 100)}>
        {progress === undefined ? (
          <div className="absolute inset-y-0 w-1/3 animate-pulse bg-ink/15" style={{ left: "33%" }} />
        ) : (
          <div className="absolute inset-y-0 left-0 bg-ink/20 transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
        )}
        <div className="relative flex h-full items-center justify-center gap-2 text-ui text-ink">
          {label}
          {progress === undefined ? null : ` ${Math.round(progress * 100)}%`}
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

/* Files come from Convex storage, another origin, where `<a download>` is
   ignored and the browser would open the video in place of the studio. */
async function downloadFrom(url: string, name: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status})`);
  download(await response.blob(), name);
}

/* The cloud render this dialog started: waiting, rendering, then its file. */
function CloudJobStatus({ job, orgId, onDismiss, onRetry }: { job: ExportJob | null | undefined; orgId: string | null | undefined; onDismiss: () => void; onRetry: () => void }) {
  const cancel = useMutation(api.render.cancel);
  const [fetching, setFetching] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  if (!job) return <Progress label="Sending to the cloud…" />;
  if (job.status === "queued") {
    const ahead = job.queuePosition ?? 0;
    return (
      <Progress
        label={ahead ? `Queued · ${ahead} ahead` : "Queued · next up"}
        onCancel={orgId ? () => void cancel({ orgId, jobId: job.id }).then(onDismiss, () => {}) : undefined}
      />
    );
  }
  if (job.status === "running") {
    return (
      <div className="flex flex-col gap-1.5">
        <Progress label="Rendering in the cloud…" progress={job.progress} />
        <p className="px-0.5 text-center text-cap text-ink-secondary">You can close this; it will be under Recent exports.</p>
      </div>
    );
  }
  if (job.status === "failed") {
    return (
      <div className="flex flex-col gap-1.5 rounded-[8px] bg-raised px-2.5 py-2" role="alert">
        <p className="text-cap text-critical">{job.error === "Cancelled" ? "Cancelled." : `The cloud render failed: ${job.error ?? "no reason given"}`}</p>
        <button type="button" className="self-start text-cap text-ink hover:underline" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }
  const fetchAll = async () => {
    setFetching(true);
    setFailure(null);
    try {
      for (const output of job.outputs) if (output.url) await downloadFrom(output.url, output.name);
      onDismiss();
    } catch (e) {
      setFailure(errorMessage(e));
    } finally {
      setFetching(false);
    }
  };
  return (
    <div className="flex flex-col gap-1.5">
      <PrimaryButton onClick={fetchAll} disabled={fetching}>
        <Download className="size-4" />
        {fetching ? "Downloading…" : `Download ${job.outputs.length === 1 ? job.outputs[0].name : `${job.outputs.length} files`}`}
      </PrimaryButton>
      {failure ? <p className="px-0.5 text-cap text-critical">{failure}</p> : null}
    </div>
  );
}

const FORMAT_ICON: Record<RenderFormat, typeof Film> = { mp4: Film, "carousel-zip": Images, png: ImageIcon };
const FORMAT_EXTENSION: Record<RenderFormat, string> = { mp4: "mp4", "carousel-zip": "zip", png: "png" };

/* The project's last few exports, from this browser or the cloud. Cloud renders
   keep their files, so they can be fetched again from here. */
function ExportHistory({ jobs, orgId, projectName }: { jobs: ExportJob[] | undefined; orgId: string | null | undefined; projectName: string }) {
  const cancel = useMutation(api.render.cancel);
  if (!jobs?.length) return null;
  return (
    <Card className="flex flex-col gap-0.5 p-1.5" aria-label="Recent exports">
      <span className="px-1 pt-0.5 pb-1 text-cap text-ink-secondary">Recent exports</span>
      {jobs.map((job) => {
        const Icon = FORMAT_ICON[job.format];
        const name = job.fileName ?? job.outputs[0]?.name ?? `${projectName}.${FORMAT_EXTENSION[job.format]}`;
        const when = relativeTime(job.finishedAt ?? job.createdAt);
        const detail =
          job.status === "queued"
            ? `Queued${job.queuePosition ? ` · ${job.queuePosition} ahead` : ""}`
            : job.status === "running"
              ? `Rendering${job.progress === undefined ? "…" : ` ${Math.round(job.progress * 100)}%`}`
              : job.status === "failed"
                ? job.error === "Cancelled"
                  ? "Cancelled"
                  : `Failed · ${job.error ?? "no reason given"}`
                : `${job.browser ? "This browser" : "Cloud"} · ${when}`;
        return (
          <div key={job.id} className="flex h-10 items-center gap-2 rounded-[8px] px-1">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-[6px] bg-raised text-ink-secondary">
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-cap text-ink">{name}</div>
              <div className={cn("truncate text-[11px] leading-4", job.status === "failed" && job.error !== "Cancelled" ? "text-critical" : "text-ink-secondary")} title={job.error}>
                {detail}
              </div>
            </div>
            {job.status === "done" && !job.browser && job.outputs.some((o) => o.url) ? (
              <Tooltip label="Download">
                <button
                  type="button"
                  aria-label={`Download ${name}`}
                  className="flex size-7 items-center justify-center rounded-[6px] text-ink-secondary hover:bg-[var(--state-hover)] hover:text-ink"
                  onClick={() => void Promise.all(job.outputs.map((o) => (o.url ? downloadFrom(o.url, o.name) : null))).catch(() => {})}
                >
                  <Download className="size-3.5" />
                </button>
              </Tooltip>
            ) : null}
            {job.status === "queued" && orgId ? (
              <Tooltip label="Cancel">
                <button
                  type="button"
                  aria-label={`Cancel ${name}`}
                  className="flex size-7 items-center justify-center rounded-[6px] text-ink-secondary hover:bg-[var(--state-hover)] hover:text-ink"
                  onClick={() => void cancel({ orgId, jobId: job.id }).catch(() => {})}
                >
                  <X className="size-3.5" />
                </button>
              </Tooltip>
            ) : null}
          </div>
        );
      })}
    </Card>
  );
}
