"use client";

import { useMutation, useQuery } from "convex/react";
import { Clapperboard, Download, GalleryHorizontalEnd, Image as ImageIcon, LoaderCircle, Maximize, Pause, Play, Trash2, Volume2, VolumeX } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useToast } from "@/components/ui/toast";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { MediaItem } from "@/convex/media";
import { stockCategory } from "@/convex/stock/provider";
import { useActiveOrg } from "@/lib/auth/useActiveOrg";
import { cn } from "@/lib/cn";
import { imageBlock, project as makeProject, videoBlock } from "@/lib/editor/factory";
import { useCreateProject } from "@/lib/editor/persistence";
import type { Project } from "@/lib/editor/types";

import { MediaArt, mediaFacts } from "./MediaCard";
import { PreviewCloseButton, PreviewFact, PreviewOutlineButton, PreviewPanel, PreviewShell, PreviewTags } from "./PreviewModal";
import { formatClock, relativeTime } from "./ProjectPreview";

/*
  The Media page's enlarged preview: the photo or clip as large as fits, and a
  sidebar with what we know about it, the projects in this organisation that
  use it, and more like it. `initial` is the card that was clicked, so the
  preview paints at once while the details are fetched; opened from a link it
  waits for them instead.
*/
export function MediaPreview({ id, initial, onClose, onSwitch }: { id: string; initial?: MediaItem; onClose: () => void; onSwitch: (id: string) => void }) {
  const router = useRouter();
  const toast = useToast();
  const { orgId } = useActiveOrg();
  const details = useQuery(api.media.details, orgId ? { orgId, id } : "skip");
  const usedIn = useQuery(api.media.usedIn, orgId ? { orgId, mediaId: id } : "skip");
  const similar = useQuery(api.media.similar, orgId ? { orgId, mediaId: id } : "skip");
  const removeMedia = useMutation(api.media.remove);
  const createProject = useCreateProject();
  const [busy, setBusy] = useState<"create" | "download" | null>(null);
  const [confirming, setConfirming] = useState(false);

  const item: MediaItem | undefined = details ?? initial;
  const kindLabel = item?.kind === "video" ? "Video" : "Photo";

  if (details === null) {
    return (
      <PreviewShell label="Media preview" onClose={onClose} stage={() => <p className="text-default text-ink-secondary">This media isn&rsquo;t available.</p>}>
        <div className="flex shrink-0 gap-2">
          <PreviewCloseButton onClose={onClose} />
        </div>
      </PreviewShell>
    );
  }

  /* A project the size of its format with this media covering the first scene;
     a clip also sets the scene to its own length. */
  const startProject = async () => {
    if (!item?.url || busy) return;
    setBusy("create");
    try {
      const doc: Project = makeProject(item.kind === "video" ? "video" : "image");
      const scene = doc.slides[0];
      const common = { mediaId: item.id, src: item.url, x: 0, y: 0, w: doc.width, h: doc.height };
      if (item.kind === "video") {
        const length = Math.min(Math.max(Math.round((item.duration ?? scene.duration) * 10) / 10, 1), 60);
        scene.duration = length;
        scene.blocks = [videoBlock({ ...common, end: length, sourceDuration: item.duration })];
      } else {
        scene.blocks = [imageBlock(common)];
      }
      router.push(`/editor/${await createProject(doc)}`);
    } catch (error) {
      console.error(error);
      setBusy(null);
      toast({ title: "Couldn't create that project", description: "Check your connection and try again." });
    }
  };

  const download = async () => {
    if (!item?.url || busy) return;
    setBusy("download");
    try {
      await saveFile(item.url, item.name);
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!orgId || !item) return;
    await removeMedia({ orgId, mediaId: item.id as Id<"media"> });
    onClose();
  };

  const credit = item?.credit;
  const categories = (item?.categories ?? []).map((slug) => stockCategory(slug)?.name ?? slug);
  const labels = [...(item?.tags ?? []), ...(details?.aesthetics ?? [])];

  return (
    <PreviewShell label={`${item?.name ?? "Media"} preview`} onClose={onClose} stage={(area) => (item ? <MediaStage key={item.id} item={item} area={area} /> : <LoaderCircle className="size-6 animate-spin text-ink-secondary" />)}>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          aria-label="Download"
          title="Download"
          disabled={!item?.url || busy === "download"}
          onClick={download}
          className="flex h-9 flex-1 items-center justify-center rounded-[10px] bg-card text-ink transition-colors hover:bg-raised disabled:opacity-50"
        >
          {busy === "download" ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
        </button>
        <PreviewCloseButton onClose={onClose} />
      </div>

      <PreviewPanel>
        <div className="text-cap text-ink-secondary">
          {kindLabel} · {item?.source === "stock" ? "Our media" : "Your media"}
        </div>
        <div className="mt-1 text-[20px] leading-7 font-medium break-words text-ink">{item?.name ?? "…"}</div>
      </PreviewPanel>

      <button
        type="button"
        disabled={!item?.url || busy === "create"}
        onClick={startProject}
        className="flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-[10px] bg-white text-default text-canvas transition-colors hover:bg-[#e8e8e8] focus-visible:ring-2 focus-visible:ring-spectrum-amber focus-visible:outline-none disabled:opacity-60"
      >
        {busy === "create" ? <LoaderCircle className="size-4 animate-spin" /> : null}
        Use in new project
      </button>

      {details?.own ? (
        confirming ? (
          <PreviewPanel>
            <div className="text-ui text-ink">Delete from your library?</div>
            <p className="mt-1 text-cap text-ink-secondary">
              {usedIn?.length
                ? `${usedIn.length} project${usedIn.length > 1 ? "s use" : " uses"} it and will show it as missing.`
                : "No project uses it. This can't be undone."}
            </p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={remove} className="h-8 flex-1 rounded-[8px] bg-critical text-ui text-white transition-opacity hover:opacity-90">
                Delete
              </button>
              <button type="button" onClick={() => setConfirming(false)} className="h-8 flex-1 rounded-[8px] bg-raised text-ui text-ink transition-colors hover:bg-line-strong">
                Keep
              </button>
            </div>
          </PreviewPanel>
        ) : (
          <PreviewOutlineButton onClick={() => setConfirming(true)}>
            <Trash2 /> Delete
          </PreviewOutlineButton>
        )
      ) : null}

      {item ? (
        <PreviewPanel>
          <div className="text-ui text-ink">Info</div>
          <PreviewFact label="Size" value={`${item.width} × ${item.height}`} />
          {item.kind === "video" && item.duration ? <PreviewFact label="Length" value={mediaFacts(item)} /> : null}
          {item.source === "stock" ? (
            credit?.name || credit?.handle ? (
              <PreviewFact label="Creator" value={[credit.name, credit.handle ? `@${credit.handle}` : null].filter(Boolean).join(" · ")} />
            ) : null
          ) : details?.uploadedBy ? (
            <PreviewFact label="Uploaded by" value={details.uploadedBy} />
          ) : null}
          <PreviewFact label="Added" value={relativeTime(item.createdAt)} />
          {categories.length ? <PreviewTags label="Category" tags={categories} /> : null}
          {labels.length ? <PreviewTags label="Tags" tags={[...new Set(labels)]} /> : null}
        </PreviewPanel>
      ) : null}

      <PreviewPanel>
        <div className="text-ui text-ink">Used in</div>
        {usedIn === undefined ? (
          <p className="mt-2 text-cap text-ink-secondary">Looking…</p>
        ) : usedIn.length ? (
          <ul aria-label="Used in" className="mt-2 flex flex-col gap-0.5">
            {usedIn.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/editor/${p.id}`)}
                  className="-mx-1.5 flex w-[calc(100%+12px)] items-center gap-2 rounded-[8px] px-1.5 py-1.5 text-left transition-colors hover:bg-raised"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-[6px] bg-raised text-ink-secondary [&>svg]:size-3.5">
                    {p.kind === "video" ? <Clapperboard /> : p.kind === "carousel" ? <GalleryHorizontalEnd /> : <ImageIcon />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-ui text-ink">{p.name}</span>
                  <span className="shrink-0 text-tiny text-ink-secondary">{relativeTime(p.updatedAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-cap text-ink-secondary">Not in any of this organisation&rsquo;s projects yet.</p>
        )}
      </PreviewPanel>

      {similar?.length ? (
        <PreviewPanel>
          <div className="text-ui text-ink">Similar</div>
          <div aria-label="Similar" role="list" className="mt-3 grid grid-cols-2 gap-2">
            {similar.map((other) => (
              <button
                key={other.id}
                role="listitem"
                type="button"
                aria-label={`Preview ${other.name}`}
                onClick={() => onSwitch(other.id)}
                className="overflow-hidden rounded-[8px] outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
              >
                <MediaArt item={other} playing={false} sizes="120px" aspect={4 / 5} />
              </button>
            ))}
          </div>
        </PreviewPanel>
      ) : null}
    </PreviewShell>
  );
}

/*
  The media, fitted into the preview's area with breathing room and never past
  its own size. A clip plays with sound, looping, under the same controls as a
  project's preview: play, time, mute, fullscreen and a seek line.
*/
function MediaStage({ item, area }: { item: MediaItem; area: { w: number; h: number } }) {
  const pad = 24;
  const ratio = item.width && item.height ? item.width / item.height : 1;
  const width = Math.max(0, Math.min(area.w - pad * 2, (area.h - pad * 2) * ratio, item.width || Infinity));
  const frame = useRef<HTMLDivElement>(null);

  if (!item.url) return <p className="text-default text-ink-secondary">This file is missing from storage.</p>;

  return (
    <div ref={frame} className="relative shrink-0 overflow-hidden rounded-[12px] bg-black shadow-overlay" style={{ width, aspectRatio: ratio }} onClick={(e) => e.stopPropagation()}>
      {item.kind === "image" ? (
        <Image src={item.url} alt={item.name} fill sizes={`${Math.ceil(width)}px`} quality={75} className="object-contain" priority />
      ) : (
        <VideoStage item={item} onFullscreen={() => frame.current?.requestFullscreen?.().catch(() => {})} />
      )}
    </div>
  );
}

function VideoStage({ item, onFullscreen }: { item: MediaItem; onFullscreen: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState({ at: 0, total: item.duration ?? 0 });
  /* Tracked in JS rather than :hover so the controls also show for pointers that report no hover capability. */
  const [hover, setHover] = useState(false);
  const reveal = hover ? "opacity-100" : "opacity-0";

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== " ") return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const progress = time.total > 0 ? time.at / time.total : 0;

  return (
    <div className="absolute inset-0" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <video
        ref={video}
        src={item.url ?? undefined}
        poster={item.posterUrl ?? undefined}
        autoPlay
        loop
        playsInline
        muted={muted}
        className="size-full object-contain"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime({ at: e.currentTarget.currentTime, total: e.currentTarget.duration || time.total })}
        onClick={toggle}
      />
      <div className={cn("absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/70 to-transparent px-2 pt-6 pb-2 text-white transition-opacity duration-150", reveal)}>
        <button type="button" aria-label={playing ? "Pause" : "Play"} onClick={toggle} className="flex size-7 items-center justify-center rounded-[6px] hover:bg-white/15">
          {playing ? <Pause className="size-3.5 fill-current" /> : <Play className="size-3.5 translate-x-px fill-current" />}
        </button>
        <span className="text-cap tabular-nums">
          {formatClock(time.at)} / {formatClock(time.total)}
        </span>
        <span className="flex-1" />
        <button type="button" aria-label={muted ? "Unmute" : "Mute"} onClick={() => setMuted((m) => !m)} className="flex size-7 items-center justify-center rounded-[6px] hover:bg-white/15">
          {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
        </button>
        <button type="button" aria-label="Fullscreen" onClick={onFullscreen} className="flex size-7 items-center justify-center rounded-[6px] hover:bg-white/15">
          <Maximize className="size-3.5" />
        </button>
      </div>
      <div
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        tabIndex={0}
        className="absolute inset-x-0 bottom-0 h-[3px] cursor-pointer bg-white/25"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const v = video.current;
          if (v && time.total) v.currentTime = ((e.clientX - r.left) / r.width) * time.total;
        }}
      >
        <div className="h-full bg-white" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}

/*
  Save the file under a name that opens: a cross-origin `<a download>` is
  ignored, so the bytes are fetched and handed over as a blob, with the
  extension the file's type implies when its name has none (stock names are
  descriptions, not file names). If the fetch is refused, the file opens in a
  tab instead.
*/
async function saveFile(url: string, name: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(String(response.status));
    const blob = await response.blob();
    const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" }[blob.type];
    const filename = /\.[a-z0-9]{2,4}$/i.test(name) || !extension ? name : `${name}.${extension}`;
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}
