"use client";

import { Plus, Speech, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Chip, ChipRow } from "@/components/ui/chip";
import { cn } from "@/lib/cn";
import { imageBlock, uid, videoBlock } from "@/lib/editor/factory";
import { AUDIO_TRACKS, STOCK_PHOTOS, STOCK_VIDEOS, type StockItem } from "@/lib/editor/presets";
import { useEditor, useSelectedBlocks } from "@/lib/editor/store";
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

export function UploadsPanel() {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "videos" | "images">("all");
  const [over, setOver] = useState(false);
  const uploads = useEditor((s) => s.uploads);
  const addUpload = useEditor((s) => s.addUpload);
  const addBlock = useEditor((s) => s.addBlock);
  const updateBlock = useEditor((s) => s.updateBlock);
  const selected = useSelectedBlocks();
  const width = useEditor((s) => s.project.width);
  const height = useEditor((s) => s.project.height);
  const input = useRef<HTMLInputElement>(null);

  const ingest = (files: FileList | File[]) => {
    for (const f of Array.from(files)) {
      const kind = f.type.startsWith("video/") ? "video" : f.type.startsWith("image/") ? "image" : null;
      if (!kind) continue;
      addUpload({ id: uid(), kind, src: URL.createObjectURL(f), name: f.name });
    }
  };

  /* Placing an upload replaces the selected media block if there is exactly one. */
  const place = (u: { kind: "image" | "video"; src: string }) => {
    const one = selected.length === 1 ? selected[0] : null;
    if (one && (one.type === "image" || one.type === "video") && one.type === u.kind) return updateBlock(one.id, { src: u.src });
    const w = Math.round(width * 0.7);
    const h = Math.round(w * (u.kind === "video" ? 9 / 16 : 1));
    const geo = { x: (width - w) / 2, y: (height - h) / 2, w, h };
    addBlock(u.kind === "video" ? videoBlock({ src: u.src, ...geo }) : imageBlock({ src: u.src, ...geo }));
  };

  const list = uploads.filter((u) => (tab === "all" || (tab === "videos" ? u.kind === "video" : u.kind === "image")) && u.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PanelHeader>
        <PanelSearch value={q} onChange={setQ} placeholder="Search uploads" />
      </PanelHeader>
      <PanelPrimary onClick={() => input.current?.click()}>
        <Upload /> Upload files
      </PanelPrimary>
      <input ref={input} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => e.target.files && ingest(e.target.files)} />
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
            ingest(e.dataTransfer.files);
          }}
        >
          {list.length ? (
            <div className="grid grid-cols-3 gap-1.5">
              {list.map((u) => (
                <button key={u.id} type="button" className="aspect-square overflow-hidden rounded-[8px] bg-card" onClick={() => place(u)} title={u.name}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
                  {u.kind === "image" ? <img src={u.src} alt={u.name} className="size-full object-cover" /> : <video src={u.src} muted className="size-full object-cover" />}
                </button>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-cap text-ink-secondary">Drag and drop your files to upload</div>
          )}
        </div>
        {selected.length === 1 && (selected[0].type === "image" || selected[0].type === "video") ? <p className="mt-2 text-[11px] text-ink-disabled">Click an upload to replace the selected media.</p> : null}
      </PanelBody>
    </>
  );
}

export { Empty };
