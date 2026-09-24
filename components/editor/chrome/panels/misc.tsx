"use client";

import { useMutation, useQuery } from "convex/react";
import { Plus, Speech, Trash2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Chip, ChipRow } from "@/components/ui/chip";
import { MenuItem } from "@/components/ui/menu";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { MediaItem } from "@/convex/media";
import { useActiveOrg } from "@/lib/auth/useActiveOrg";
import { cn } from "@/lib/cn";
import { imageBlock, uid, videoBlock } from "@/lib/editor/factory";
import { primeMedia } from "@/lib/editor/media";
import { AUDIO_TRACKS, STOCK_PHOTOS, STOCK_VIDEOS, type StockItem } from "@/lib/editor/presets";
import { useEditor, useSelectedBlocks } from "@/lib/editor/store";
import { mediaKindOf, probeFile, uploadToStorage } from "@/lib/editor/upload";
import { formatTime, totalDuration } from "@/lib/editor/geometry";

import { Empty } from "./library";
import { PanelBody, PanelHeader, PanelPrimary, PanelSearch, PanelTabs } from "../LeftPanel";

/* ---------------------------------------------------------------- Stock --- */

export function StockPanel() {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"photos" | "videos">("photos");
  const addBlock = useEditor((s) => s.addBlock);
  const width = useEditor((s) => s.project.width);
  const height = useEditor((s) => s.project.height);

  const items = (tab === "photos" ? STOCK_PHOTOS : STOCK_VIDEOS).filter((i) => i.label.toLowerCase().includes(q.toLowerCase()));

  const add = (item: StockItem) => {
    const w = Math.round(width * 0.7);
    const h = Math.round(w * (item.kind === "video" ? 9 / 16 : 1.25));
    const geo = { x: (width - w) / 2, y: (height - h) / 2, w, h };
    addBlock(item.kind === "video" ? videoBlock({ src: item.src, ...geo }) : imageBlock({ src: item.src, ...geo }));
  };

  return (
    <>
      <PanelHeader>
        <PanelSearch value={q} onChange={setQ} placeholder="Search stock" />
      </PanelHeader>
      <PanelTabs value={tab} onChange={setTab} options={[{ value: "photos", label: "Photos" }, { value: "videos", label: "Videos" }]} />
      <PanelBody>
        <div className="grid grid-cols-2 gap-2">
          {items.map((i) => (
            <button key={i.id} type="button" className="group relative overflow-hidden rounded-[10px] bg-card" style={{ aspectRatio: i.kind === "video" ? "16 / 10" : "3 / 4" }} onClick={() => add(i)} title={i.label}>
              {/* eslint-disable-next-line @next/next/no-img-element -- remote stock thumbnails */}
              <img src={i.thumb} alt={i.label} loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
              {i.duration ? <span className="absolute right-1.5 bottom-1.5 rounded-[4px] bg-black/70 px-1.5 py-0.5 text-[10px] text-white">{formatTime(i.duration)}</span> : null}
            </button>
          ))}
        </div>
      </PanelBody>
    </>
  );
}

/* ---------------------------------------------------------------- Audio --- */

const MOODS = ["Calm", "Chill", "Fun", "Happy"];

export function AudioPanel() {
  const [mood, setMood] = useState<string | null>(null);
  const audio = useEditor((s) => s.project.audio);
  const kind = useEditor((s) => s.project.kind);
  const addAudio = useEditor((s) => s.addAudio);
  const list = AUDIO_TRACKS.filter((t) => !mood || t.mood.includes(mood));

  const add = (t: (typeof AUDIO_TRACKS)[number]) => {
    const total = totalDuration(useEditor.getState().project);
    addAudio({ id: uid(), title: t.title, start: 0, duration: Math.min(t.duration, total), volume: 80 });
  };

  return (
    <>
      <PanelHeader title="Audio" />
      <ChipRow className="px-3 pb-3 [scrollbar-width:none]">
        {MOODS.map((m) => (
          <Chip key={m} selected={mood === m} onClick={() => setMood(mood === m ? null : m)} className="h-7 px-3 text-cap">
            {m}
          </Chip>
        ))}
      </ChipRow>
      <PanelBody>
        <div className="flex flex-col gap-1">
          {list.map((t) => (
            <div key={t.id} className="group flex items-center gap-3 rounded-[10px] px-2 py-2 hover:bg-card">
              <div className="flex size-9 items-center justify-center rounded-[8px] bg-raised text-ink-secondary">
                <Speech className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-ui text-ink">{t.title}</div>
                <div className="truncate text-cap text-ink-secondary">{t.mood.join(" · ")}</div>
              </div>
              <span className="text-cap text-ink-disabled">{formatTime(t.duration)}</span>
              <button type="button" aria-label={`Add ${t.title}`} disabled={kind !== "video"} className="flex size-7 items-center justify-center rounded-full bg-raised text-ink opacity-0 transition-opacity group-hover:opacity-100 disabled:hidden" onClick={() => add(t)}>
                <Plus className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
        {kind !== "video" ? <p className="mt-3 text-cap text-ink-disabled">Audio tracks apply to video projects.</p> : audio.length ? <p className="mt-3 text-cap text-ink-secondary">{audio.length} track{audio.length > 1 ? "s" : ""} on the timeline.</p> : null}
      </PanelBody>
    </>
  );
}

/* -------------------------------------------------------------- Uploads --- */

/*
  The organisation's media library. Files go to Convex storage and a `media` row;
  the canvas references the row by id, so a project reopened next week still has
  its photos — which is what the object URLs this panel used to hand out could
  never do.

  Convex is configured everywhere the app really runs, but the provider
  deliberately renders without a client when it is not (see
  `ConvexClientProvider`), and a flyout is no place to throw.
*/
export function UploadsPanel() {
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    return (
      <>
        <PanelHeader title="Uploads" />
        <PanelBody>
          <Empty>Uploads need a Convex deployment. Set NEXT_PUBLIC_CONVEX_URL.</Empty>
        </PanelBody>
      </>
    );
  }
  return <UploadsLibrary />;
}

/* One file on its way up. Kept until it lands (the row then arrives in `list`)
   or fails, which is the only state worth staying on screen. */
type UploadJob = { id: string; name: string; progress: number; error?: string };

function UploadsLibrary() {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "videos" | "images">("all");
  const [over, setOver] = useState(false);
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [menu, setMenu] = useState<{ item: MediaItem; x: number; y: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const { orgId, isLoaded } = useActiveOrg();
  const items = useQuery(api.media.list, orgId ? { orgId } : "skip");
  const generateUploadUrl = useMutation(api.media.generateUploadUrl);
  const createMedia = useMutation(api.media.create);
  const removeMedia = useMutation(api.media.remove);

  const addBlock = useEditor((s) => s.addBlock);
  const updateBlock = useEditor((s) => s.updateBlock);
  const selected = useSelectedBlocks();
  const width = useEditor((s) => s.project.width);
  const height = useEditor((s) => s.project.height);

  /*
    Uploads run one at a time. Two large clips racing each other make the
    progress bars meaningless and neither finishes sooner, and a file only
    becomes a `media` row once its bytes and its poster are both up.
  */
  const ingest = async (files: FileList | File[]) => {
    if (!orgId) return;
    for (const file of Array.from(files)) {
      if (!mediaKindOf(file)) continue;
      const jobId = uid();
      const progress = (fraction: number) => setJobs((j) => j.map((x) => (x.id === jobId ? { ...x, progress: fraction } : x)));
      setJobs((j) => [...j, { id: jobId, name: file.name, progress: 0 }]);
      try {
        const probe = await probeFile(file);
        const storageId = await uploadToStorage(await generateUploadUrl({ orgId }), file, progress);
        const posterStorageId = probe.poster
          ? await uploadToStorage(await generateUploadUrl({ orgId }), probe.poster)
          : undefined;
        const row = await createMedia({
          orgId,
          kind: probe.kind,
          /* Storage ids are opaque strings to the browser; Convex validates them. */
          storageId: storageId as Id<"_storage">,
          posterStorageId: posterStorageId as Id<"_storage"> | undefined,
          width: probe.width,
          height: probe.height,
          duration: probe.duration,
          name: file.name,
        });
        /* The row's URL is already in hand, so a block placed now paints at once
           instead of waiting for the resolver to ask the same question. */
        primeMedia([row]);
        setJobs((j) => j.filter((x) => x.id !== jobId));
      } catch (error) {
        setJobs((j) => j.map((x) => (x.id === jobId ? { ...x, error: error instanceof Error ? error.message : "Upload failed" } : x)));
      }
    }
  };

  /* Placing media replaces the selected media block if there is exactly one. */
  const place = (item: MediaItem) => {
    if (!item.url) return;
    primeMedia([item]);
    const one = selected.length === 1 ? selected[0] : null;
    if (one && (one.type === "image" || one.type === "video") && one.type === item.kind) {
      return updateBlock(one.id, { mediaId: item.id, src: item.url });
    }
    /* Fit the media's own aspect inside 70% of the artboard, rather than
       stretching it into a square. */
    const ratio = item.width && item.height ? item.width / item.height : 1;
    let w = width * 0.7;
    let h = w / ratio;
    if (h > height * 0.7) {
      h = height * 0.7;
      w = h * ratio;
    }
    const geo = { x: Math.round((width - w) / 2), y: Math.round((height - h) / 2), w: Math.round(w), h: Math.round(h) };
    const common = { mediaId: item.id, src: item.url, ...geo };
    addBlock(item.kind === "video" ? videoBlock({ ...common, sourceDuration: item.duration }) : imageBlock(common));
  };

  const list = (items ?? []).filter(
    (m) => (tab === "all" || (tab === "videos" ? m.kind === "video" : m.kind === "image")) && m.name.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <>
      <PanelHeader>
        <PanelSearch value={q} onChange={setQ} placeholder="Search uploads" />
      </PanelHeader>
      <PanelPrimary onClick={() => input.current?.click()} disabled={!orgId}>
        <Upload /> Upload files
      </PanelPrimary>
      <input
        ref={input}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void ingest(e.target.files);
          /* Clear, so picking the same file twice in a row still fires. */
          e.target.value = "";
        }}
      />
      <PanelTabs value={tab} onChange={setTab} options={[{ value: "all", label: "All" }, { value: "videos", label: "Videos" }, { value: "images", label: "Images" }]} />
      <PanelBody>
        <div
          className={cn("flex flex-col gap-2 rounded-[12px] border border-dashed p-2 transition-colors", over ? "border-ink bg-card" : "border-line")}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            void ingest(e.dataTransfer.files);
          }}
        >
          {jobs.length ? (
            <div className="flex flex-col gap-1.5">
              {jobs.map((job) => (
                <UploadProgress key={job.id} job={job} onDismiss={() => setJobs((j) => j.filter((x) => x.id !== job.id))} />
              ))}
            </div>
          ) : null}
          {list.length ? (
            <div className="grid grid-cols-3 gap-1.5">
              {list.map((item) => (
                <MediaTile
                  key={item.id}
                  item={item}
                  onClick={() => place(item)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenu({ item, x: e.clientX, y: e.clientY });
                  }}
                />
              ))}
            </div>
          ) : items === undefined && orgId ? null : (
            <div className="py-10 text-center text-cap text-ink-secondary">
              {!isLoaded ? "Loading…" : !orgId ? "Pick an organisation to upload media to." : q ? "No uploads match." : "Drag and drop your files to upload"}
            </div>
          )}
        </div>
        {selected.length === 1 && (selected[0].type === "image" || selected[0].type === "video") ? <p className="mt-2 text-[11px] text-ink-disabled">Click an upload to replace the selected media.</p> : null}
      </PanelBody>
      {menu ? (
        <MediaMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          onRemove={() => {
            if (orgId) void removeMedia({ orgId, mediaId: menu.item.id as Id<"media"> });
            setMenu(null);
          }}
        />
      ) : null}
    </>
  );
}

function UploadProgress({ job, onDismiss }: { job: UploadJob; onDismiss: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-[8px] bg-card px-2 py-1.5">
      <div className="min-w-0 flex-1">
        <div className="truncate text-cap text-ink">{job.name}</div>
        {job.error ? (
          <div className="truncate text-[11px] text-critical">{job.error}</div>
        ) : (
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-raised">
            <div className="h-full rounded-full bg-ink transition-[width] duration-150" style={{ width: `${Math.round(job.progress * 100)}%` }} />
          </div>
        )}
      </div>
      {job.error ? (
        <button type="button" aria-label={`Dismiss ${job.name}`} className="flex size-5 shrink-0 items-center justify-center rounded-full text-ink-secondary hover:text-ink" onClick={onDismiss}>
          <X className="size-3" />
        </button>
      ) : (
        <span className="shrink-0 text-[11px] text-ink-secondary">{Math.round(job.progress * 100)}%</span>
      )}
    </div>
  );
}

/*
  A tile in the grid. Videos play on hover, driven from pointer events rather
  than `:hover` because the VNC desktop the visuals are checked on reports no
  hover capability and the CSS variant never fires there.
*/
function MediaTile({ item, onClick, onContextMenu }: { item: MediaItem; onClick: () => void; onContextMenu: (e: React.MouseEvent) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  return (
    <button
      type="button"
      className="group relative aspect-square overflow-hidden rounded-[8px] bg-card"
      onClick={onClick}
      onContextMenu={onContextMenu}
      onPointerEnter={() => video.current?.play().catch(() => {})}
      onPointerLeave={() => {
        const v = video.current;
        if (!v) return;
        v.pause();
        v.currentTime = 0;
      }}
      title={item.name}
    >
      {!item.url ? (
        <span className="flex size-full items-center justify-center text-[10px] text-ink-disabled">Unavailable</span>
      ) : item.kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element -- Convex storage URL, sized by the grid
        <img src={item.url} alt={item.name} loading="lazy" className="size-full object-cover" />
      ) : (
        <video ref={video} src={item.url} poster={item.posterUrl ?? undefined} muted loop playsInline preload="metadata" className="size-full object-cover" />
      )}
      {item.duration ? <span className="absolute right-1 bottom-1 rounded-[4px] bg-black/70 px-1 py-0.5 text-[10px] text-white">{formatTime(item.duration)}</span> : null}
    </button>
  );
}

/*
  Right-click on a tile. Portaled to the body and placed in viewport
  coordinates: the panel clips its overflow, so a menu rendered inside it would
  be cut off at the edge.
*/
function MediaMenu({ x, y, onClose, onRemove }: { x: number; y: number; onClose: () => void; onRemove: () => void }) {
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest(".media-menu")) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  return createPortal(
    <div
      role="menu"
      className="media-menu fixed min-w-[180px] rounded-control bg-panel p-1.5 shadow-overlay animate-pop"
      style={{ left: Math.min(x, window.innerWidth - 200), top: Math.min(y, window.innerHeight - 80), zIndex: "var(--z-floating-bar)" }}
    >
      <MenuItem icon={<Trash2 />} destructive onClick={onRemove}>
        Remove from library
      </MenuItem>
    </div>,
    document.body,
  );
}

export { Empty };
