"use client";

import { Coins, Info, Mic, Paperclip, Plus, SendHorizontal, Speech, Upload, Wand2 } from "lucide-react";
import { useRef, useState } from "react";

import { Chip, ChipRow } from "@/components/ui/chip";
import { cn } from "@/lib/cn";
import { imageBlock, uid, videoBlock } from "@/lib/editor/factory";
import { FONTS } from "@/lib/editor/fonts";
import { AUDIO_TRACKS, STOCK_PHOTOS, STOCK_VIDEOS, type StockItem } from "@/lib/editor/presets";
import { useEditor, useSelectedBlocks } from "@/lib/editor/store";
import { formatTime, totalDuration } from "@/lib/editor/geometry";

import { Empty } from "./library";
import { PanelBody, PanelHeader, PanelPrimary, PanelSearch, PanelTabs } from "../LeftPanel";

/* ---------------------------------------------------------------- Build --- */

const SUGGESTIONS = ["Apple-style text animation", "Nokia 3310 effect", "Browser frame", "Glass text", "AI search bar", "Figma-style lower third intro"];

export function BuildPanel() {
  const [mode, setMode] = useState<"ai" | "code">("ai");
  const [prompt, setPrompt] = useState("");
  return (
    <>
      <PanelHeader
        title={
          <span className="flex items-center gap-2">
            <Wand2 className="size-4" /> Build with AI
          </span>
        }
        description="Describe a visual or tool, we'll write up the code and drop it in"
      >
        <span className="flex h-6 items-center gap-1 rounded-full bg-card px-2 text-cap text-ink">
          <Coins className="size-3" /> 150
        </span>
        <div className="flex h-6 items-center rounded-full bg-card p-0.5 text-cap">
          {(["ai", "code"] as const).map((m) => (
            <button key={m} type="button" className={cn("h-full rounded-full px-2 transition-colors", mode === m ? "bg-ink text-canvas" : "text-ink-secondary")} onClick={() => setMode(m)}>
              {m === "ai" ? "AI" : "Code"}
            </button>
          ))}
        </div>
      </PanelHeader>
      <PanelBody className="flex flex-col">
        <div className="flex-1" />
        <div className="mb-2 text-cap text-ink-secondary">Try one of these to get started:</div>
        <div className="flex flex-col">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" className="border-b border-line py-2 text-left text-ui text-ink transition-colors last:border-0 hover:text-ink-secondary" onClick={() => setPrompt(s)}>
              {s}
            </button>
          ))}
        </div>
        <p className="mt-4 text-[11px] leading-snug text-ink-disabled">
          Generation needs a model backend, which this build doesn&rsquo;t ship with. The prompt is kept so it can be wired up.
        </p>
      </PanelBody>
      <div className="p-3 pt-0">
        <div className="flex h-11 items-center gap-2 rounded-[12px] bg-card pr-1.5 pl-3">
          <Paperclip className="size-4 shrink-0 text-ink-secondary" />
          <input className="min-w-0 flex-1 bg-transparent text-ui text-ink placeholder:text-ink-disabled outline-none" placeholder="Type what you want to build…" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <button type="button" disabled={!prompt.trim()} aria-label="Send" className="flex size-8 items-center justify-center rounded-[8px] text-ink transition-colors hover:bg-[var(--state-hover)] disabled:text-ink-disabled">
            <SendHorizontal className="size-4" />
          </button>
        </div>
      </div>
    </>
  );
}

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
    addBlock(item.kind === "video" ? videoBlock({ src: item.src, radius: 24, ...geo }) : imageBlock({ src: item.src, radius: 24, ...geo }));
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
      <div className="grid grid-cols-2 gap-2 px-3 pb-3">
        <button type="button" className="flex h-9 items-center justify-center gap-2 rounded-[8px] bg-card text-ui text-ink hover:bg-raised">
          <Speech className="size-4" /> Text to speech
        </button>
        <button type="button" className="flex h-9 items-center justify-center gap-2 rounded-[8px] bg-card text-ui text-ink hover:bg-raised">
          <Mic className="size-4" /> Record audio
        </button>
      </div>
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

/* ------------------------------------------------------------- Brandkit --- */

export function BrandkitPanel() {
  const colors = useEditor((s) => s.brandColors);
  const addBrandColor = useEditor((s) => s.addBrandColor);
  const selected = useSelectedBlocks();
  const updateBlock = useEditor((s) => s.updateBlock);
  const setBackground = useEditor((s) => s.setBackground);
  const activeSlideId = useEditor((s) => s.activeSlideId);
  const uploads = useEditor((s) => s.uploads);
  const setLeftTab = useEditor((s) => s.setLeftTab);

  /* A brand colour applies to whatever is selected; with nothing selected it recolours the slide. */
  const applyColor = (c: string) => {
    if (!selected.length) return setBackground(activeSlideId, { type: "color", color: c });
    for (const b of selected) {
      if (b.type === "text") updateBlock(b.id, { color: c, gradient: undefined });
      else if (b.type === "shape") updateBlock(b.id, { fill: c, gradient: undefined });
      else updateBlock(b.id, { overlay: { color: c, opacity: 40 } });
    }
  };
  const applyFont = (family: string) => selected.forEach((b) => b.type === "text" && updateBlock(b.id, { fontFamily: family }));

  return (
    <>
      <PanelHeader title="Brandkit" />
      <PanelBody className="flex flex-col gap-4">
        <div>
          <SectionTitle>Colors</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => (
              <button key={c} type="button" aria-label={c} title={c} className="size-9 rounded-[10px] ring-1 ring-white/10 transition-transform hover:scale-105" style={{ background: c }} onClick={() => applyColor(c)} />
            ))}
            <label className="flex size-9 cursor-pointer items-center justify-center rounded-[10px] bg-card text-ink-secondary hover:text-ink" aria-label="Add colour">
              <Plus className="size-4" />
              <input type="color" className="sr-only" onChange={(e) => addBrandColor(e.target.value)} />
            </label>
          </div>
          <p className="mt-2 text-[11px] text-ink-disabled">{selected.length ? "Click a colour to apply it to the selection." : "Click a colour to set the slide background."}</p>
        </div>
        <div>
          <SectionTitle>Fonts</SectionTitle>
          <div className="flex flex-col">
            {FONTS.map((f) => (
              <button key={f.family} type="button" className="flex h-9 items-center justify-between rounded-[8px] px-2 text-left hover:bg-card disabled:opacity-60" style={{ fontFamily: `"${f.family}"` }} onClick={() => applyFont(f.family)} disabled={!selected.some((b) => b.type === "text")}>
                <span className="text-[15px] text-ink">{f.family}</span>
                <span className="font-sans text-cap text-ink-disabled">{f.category}</span>
              </button>
            ))}
          </div>
        </div>
        {(["Logos", "Cutout Images", "Photography", "Videos"] as const).map((group) => (
          <div key={group}>
            <SectionTitle trailing={<Upload className="size-3.5" />}>{group}</SectionTitle>
            <div className="grid grid-cols-3 gap-1.5">
              {uploads
                .filter((u) => (group === "Videos" ? u.kind === "video" : u.kind === "image"))
                .slice(0, 3)
                .map((u) => (
                  <div key={u.id} className="aspect-square overflow-hidden rounded-[8px] bg-card">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
                    {u.kind === "image" ? <img src={u.src} alt="" className="size-full object-cover" /> : <video src={u.src} muted className="size-full object-cover" />}
                  </div>
                ))}
              <button type="button" className="aspect-square rounded-[8px] bg-[repeating-conic-gradient(#1d1d1d_0_25%,#151515_0_50%)] bg-[length:12px_12px] text-ink-disabled hover:text-ink" onClick={() => setLeftTab("uploads")} aria-label={`Add ${group}`}>
                <Plus className="mx-auto size-4" />
              </button>
            </div>
          </div>
        ))}
      </PanelBody>
    </>
  );
}

function SectionTitle({ children, trailing }: { children: React.ReactNode; trailing?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between text-ui text-ink">
      <span className="flex items-center gap-1.5">
        {children} <Info className="size-3 text-ink-disabled" />
      </span>
      {trailing ? <span className="text-ink-secondary">{trailing}</span> : null}
    </div>
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
    const geo = { x: (width - w) / 2, y: (height - h) / 2, w, h, radius: 24 };
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

/* ------------------------------------------------------------- Captions --- */

const CAPTION_STYLES = ["Featured", "Karaoke", "Block", "Handwritten", "Glow", "My Captions"];
const SAMPLES: { text: string; style: React.CSSProperties }[] = [
  { text: "Here we go", style: { fontFamily: "Playfair Display", fontSize: 15 } },
  { text: "Here we go", style: { fontFamily: "Anton", fontSize: 14, textTransform: "uppercase", WebkitTextStroke: "0.6px #000" } },
  { text: "Here we go", style: { fontFamily: "Caveat", fontSize: 18, color: "#6ee86e" } },
  { text: "Here we go", style: { fontFamily: "Inter", fontWeight: 700, fontSize: 13, background: "#ffd84d", color: "#000", padding: "2px 6px", borderRadius: 4 } },
  { text: "Here we go", style: { fontFamily: "Poppins", fontWeight: 600, fontSize: 13, color: "#ffd84d" } },
  { text: "HERE WE GO", style: { fontFamily: "Inter", fontWeight: 800, fontSize: 12, background: "#a78bfa", color: "#fff", padding: "2px 6px", borderRadius: 4 } },
  { text: "Here we go", style: { fontFamily: "Space Mono", fontSize: 12, color: "#f5f5f5" } },
  { text: "Here we go", style: { fontFamily: "Pacifico", fontSize: 14, textShadow: "0 0 8px #ff4fd8" } },
  { text: "HERE WE GO", style: { fontFamily: "Bebas Neue", fontSize: 18, letterSpacing: 1 } },
];

export function CaptionsPanel() {
  const [cat, setCat] = useState("Featured");
  return (
    <>
      <PanelHeader
        title={
          <span className="flex items-center gap-1.5">
            Captions <Info className="size-3.5 text-ink-disabled" />
          </span>
        }
        description="Select media and a style, then generate."
      />
      <div className="flex min-h-0 flex-1 gap-2 px-3">
        <div className="flex w-[84px] shrink-0 flex-col gap-0.5">
          {CAPTION_STYLES.map((c) => (
            <button key={c} type="button" className={cn("rounded-[6px] px-2 py-1.5 text-left text-cap", c === cat ? "bg-raised text-ink" : "text-ink-secondary hover:text-ink")} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mb-1.5 text-cap text-ink-secondary">{cat}</div>
          <div className="grid grid-cols-3 gap-1.5">
            {SAMPLES.map((s, i) => (
              <div key={i} className="flex aspect-square items-center justify-center rounded-[10px] bg-card p-1 text-center text-ink">
                <span style={s.style}>{s.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2 p-3">
        <button type="button" className="h-9 rounded-[8px] bg-card text-ui text-ink hover:bg-raised">
          Add media
        </button>
        <button type="button" disabled className="h-9 rounded-[8px] bg-raised text-ui text-ink-disabled">
          Generate captions
        </button>
        <p className="text-[11px] text-ink-disabled">Auto-captioning needs a transcription backend; not connected in this build.</p>
      </div>
    </>
  );
}

export { Empty };
