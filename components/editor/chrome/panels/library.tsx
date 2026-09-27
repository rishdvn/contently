"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ArrowLeft, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { ProjectStage, useProjectClock } from "@/components/hub/ProjectPreview";
import { Button } from "@/components/ui/button";
import { Chip, ChipRow } from "@/components/ui/chip";
import { Dialog, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { api } from "@/convex/_generated/api";
import { aspectRatioOf, BLOCK_CATEGORIES, listBlocks, placementFor, useBlockPreview, type AnyBlockDefinition } from "@/lib/blocks";
import { cn } from "@/lib/cn";
import { componentBlock, textBlock } from "@/lib/editor/factory";
import {
  SHAPES,
  TEXT_CATEGORIES,
  TEXT_PRESETS,
  shapeFor,
  textFromPreset,
  type TextPreset,
} from "@/lib/editor/presets";
import { useEditor } from "@/lib/editor/store";
import { highlightStyle, textStyle } from "@/lib/editor/style";
import type { Project, ShapeKind, Slide } from "@/lib/editor/types";

import { cameraRef } from "../../canvas/Viewport";

import { CategoryList, LEFT_PANEL_WIDTH, PanelBody, PanelHeader, PanelPrimary, PanelSearch } from "../LeftPanel";

/* ------------------------------------------------------------ Templates --- */

/*
  The studio's Templates flyout, after Butter's: a grid of templates; clicking
  one opens its scenes; hovering a scene plays it; "Add all scenes" appends
  every scene, clicking one appends just that one. In an image project a
  template's scenes are alternatives for the one slide instead.

  Templates come from Convex (`convex/templates.ts`, `docs/templates.md`). The
  author's own organisation's drafts are listed too, marked, so a template can
  be tried here before it is published.
*/
export function TemplatesPanel() {
  const [open, setOpen] = useState<string | null>(null);
  return open ? <TemplateDetail id={open} onBack={() => setOpen(null)} /> : <TemplateGrid onOpen={setOpen} />;
}

type TemplateCard = FunctionReturnType<typeof api.templates.list>[number];

const KIND_LABEL: Record<string, string> = { video: "Video", carousel: "Carousel", image: "Image" };

function TemplateGrid({ onOpen }: { onOpen: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const all = useQuery(api.templates.list, { drafts: true });

  /* The chips are whatever categories the library uses, most used first. */
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of all ?? []) for (const c of t.categories) counts.set(c, (counts.get(c) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => c);
  }, [all]);

  const needle = q.trim().toLowerCase();
  const list = (all ?? []).filter(
    (t) => (!cat || t.categories.includes(cat)) && (!needle || `${t.name} ${t.tags.join(" ")} ${t.categories.join(" ")} ${t.kind}`.toLowerCase().includes(needle)),
  );
  /* Two columns filled in turn, so posters of different aspects stack as a masonry. */
  const columns = [list.filter((_, i) => i % 2 === 0), list.filter((_, i) => i % 2 === 1)];

  return (
    <>
      <PanelHeader>
        <PanelSearch value={q} onChange={setQ} placeholder="Search templates" />
      </PanelHeader>
      {categories.length ? (
        <div className="flex items-center gap-2 px-3 pb-2">
          <ChipRow className="min-w-0 [scrollbar-width:none]">
            {categories.map((c) => (
              <Chip key={c} selected={cat === c} onClick={() => setCat(cat === c ? null : c)} className="h-7 px-3 text-cap capitalize">
                {c}
              </Chip>
            ))}
          </ChipRow>
        </div>
      ) : null}
      <PanelBody>
        {all === undefined ? (
          <div className="grid grid-cols-2 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="aspect-[4/5] animate-pulse rounded-[12px] bg-card" />
            ))}
          </div>
        ) : list.length ? (
          <div className="flex gap-2">
            {columns.map((col, i) => (
              <div key={i} className="flex min-w-0 flex-1 flex-col gap-3">
                {col.map((t) => (
                  <TemplateTile key={t.id} t={t} onOpen={() => onOpen(t.id)} />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <Empty>{all.length ? "No templates match." : "No templates yet."}</Empty>
        )}
      </PanelBody>
    </>
  );
}

/*
  A template's poster; while the pointer is over it, the template itself plays
  in its place (the document is fetched on first hover). Pointer state rather
  than `:hover`, which does not fire for every pointer.
*/
function TemplateTile({ t, onOpen }: { t: TemplateCard; onOpen: () => void }) {
  const [hover, setHover] = useState(false);
  const doc = useQuery(api.templates.get, hover ? { id: t.id } : "skip");
  const n = t.scenes.length;
  const unit = t.kind === "video" ? "scene" : "slide";
  return (
    <button type="button" className="group flex flex-col gap-1.5 text-left" onClick={onOpen} onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)} aria-label={`Open ${t.name}`}>
      <div className="relative w-full overflow-hidden rounded-[12px] bg-card ring-1 ring-transparent transition-shadow group-hover:ring-line-strong" style={{ aspectRatio: `${t.width} / ${t.height}` }}>
        {t.poster ? (
          // eslint-disable-next-line @next/next/no-img-element -- a Convex storage URL at tile size
          <img src={t.poster} alt="" draggable={false} className="absolute inset-0 size-full object-cover" />
        ) : null}
        {hover && doc ? <HoverPlay project={doc.document as Project} /> : null}
        {!t.published ? <span className="absolute top-1.5 left-1.5 rounded-[6px] bg-black/60 px-1.5 py-0.5 text-cap text-white">Draft</span> : null}
      </div>
      <div className="flex flex-col gap-0.5 px-0.5">
        <span className="truncate text-cap text-ink">{t.name}</span>
        <span className="flex items-center gap-1.5 text-[10px] text-ink-secondary">
          <span className="rounded-[4px] bg-card px-1 py-px">{KIND_LABEL[t.kind] ?? t.kind}</span>
          {n} {unit}
          {n === 1 ? "" : "s"}
        </span>
      </div>
    </button>
  );
}

/* A document playing from the start, filling its container, for as long as it is mounted. */
function HoverPlay({ project }: { project: Project }) {
  const clock = useProjectClock(project, true);
  return <ProjectStage project={project} clock={clock} className="absolute inset-0" />;
}

function TemplateDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const t = useQuery(api.templates.get, { id });
  const kind = useEditor((s) => s.project.kind);
  const insertScenes = useEditor((s) => s.insertScenes);
  const replaceSlide = useEditor((s) => s.replaceSlide);
  const [confirming, setConfirming] = useState<number | null>(null);

  const doc = t?.document as Project | undefined;
  /* Image projects are one slide: a template's scenes are alternatives for it, not additions. */
  const single = kind === "image";

  const named = (scene: Slide): Slide => ({ ...scene, name: t && doc && doc.slides.length > 1 ? `${t.name} — ${scene.name}` : (t?.name ?? scene.name) });
  const from = doc ? { width: doc.width, height: doc.height } : undefined;
  const reveal = (ids: string[]) => {
    const p = useEditor.getState().project;
    /* Carousels lay slides side by side on the canvas; bring the first new one to the middle. */
    if (p.kind === "carousel") requestAnimationFrame(() => cameraRef.current?.centerSlide(p.slides.findIndex((x) => x.id === ids[0])));
  };
  const addAll = () => {
    if (!doc) return;
    reveal(insertScenes(doc.slides.map(named), undefined, from));
  };
  const pick = (index: number) => {
    if (!doc) return;
    if (single) {
      setConfirming(index);
      return;
    }
    reveal(insertScenes([named(doc.slides[index])], undefined, from));
  };
  const replace = () => {
    if (!doc || confirming === null) return;
    replaceSlide(useEditor.getState().activeSlideId, doc.slides[confirming], from);
    setConfirming(null);
  };

  return (
    <>
      <PanelHeader>
        <div className="min-w-0 flex-1">
          <button type="button" className="flex h-7 items-center gap-1 rounded-[6px] pr-2 pl-1 text-ui text-ink-secondary hover:bg-[var(--state-hover)] hover:text-ink [&>svg]:size-3.5" onClick={onBack}>
            <ArrowLeft /> Back
          </button>
        </div>
      </PanelHeader>
      <div className="flex flex-col gap-3 px-3 pb-3">
        <div className="flex flex-col gap-0.5 px-0.5">
          <div className="truncate text-panels text-ink">{t?.name ?? "\u00a0"}</div>
          <div className="text-cap text-ink-secondary">{t && doc ? `${KIND_LABEL[t.kind] ?? t.kind} · ${doc.width} × ${doc.height} px` : "\u00a0"}</div>
        </div>
        {single ? (
          <div className="text-cap text-ink-secondary">Pick a scene to use on this slide.</div>
        ) : (
          <button
            type="button"
            disabled={!doc}
            className="flex h-10 items-center justify-center rounded-[10px] bg-ink text-ui text-canvas transition-colors hover:bg-white disabled:bg-raised disabled:text-ink-disabled"
            onClick={addAll}
          >
            {doc ? (doc.slides.length > 1 ? "Add all scenes" : "Add scene") : "Loading…"}
          </button>
        )}
      </div>
      <PanelBody>
        {t === null ? <Empty>This template is no longer available.</Empty> : null}
        {doc && t ? (
          <div className="grid grid-cols-2 gap-1.5">
            {doc.slides.map((scene, i) => (
              <SceneTile key={scene.id} project={doc} scene={scene} poster={t.scenePosters[i] ?? null} index={i} onPick={() => pick(i)} />
            ))}
          </div>
        ) : null}
      </PanelBody>
      <Dialog open={confirming !== null} onClose={() => setConfirming(null)} size="sm">
        <DialogHeader title="Replace this slide?" description="Its content is swapped for the template's scene. Undo brings it back." onClose={() => setConfirming(null)} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setConfirming(null)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={replace}>
            Replace
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}

/*
  One scene of a template: its poster, its length, and on hover a ring, a "+"
  and the scene itself playing, as Butter's scene cards do.
*/
function SceneTile({ project, scene, poster, index, onPick }: { project: Project; scene: Slide; poster: string | null; index: number; onPick: () => void }) {
  const [hover, setHover] = useState(false);
  const one = useMemo(() => ({ ...project, slides: [scene] }), [project, scene]);
  const clock = useProjectClock(one, hover && project.kind === "video");
  const label = project.kind === "video" ? `${Math.round(scene.duration * 10) / 10}s` : `${index + 1}`;
  return (
    <button
      type="button"
      aria-label={`Add ${scene.name}`}
      className="relative overflow-hidden rounded-[6px] bg-card ring-2 ring-transparent transition-shadow hover:ring-ink data-[hover=true]:ring-ink"
      data-hover={hover}
      style={{ aspectRatio: `${project.width} / ${project.height}` }}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onClick={onPick}
    >
      {poster && !hover ? (
        // eslint-disable-next-line @next/next/no-img-element -- a Convex storage URL at tile size
        <img src={poster} alt="" draggable={false} className="absolute inset-0 size-full object-cover" />
      ) : (
        <ProjectStage project={one} clock={clock} className="absolute inset-0" />
      )}
      <span className="absolute right-1.5 bottom-1.5 rounded-[4px] bg-black/60 px-1 py-px text-[10px] text-white">{label}</span>
      {hover ? (
        <span className="absolute top-1/2 left-1/2 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white [&>svg]:size-4">
          <Plus />
        </span>
      ) : null}
    </button>
  );
}

/* --------------------------------------------------------------- Blocks --- */

const STICKERS = ["✨", "🔥", "💡", "❤️", "⭐️", "👉", "✅", "💬", "🎯", "🛒", "📌", "🎁"];

export function BlocksPanel() {
  const [tab, setTab] = useState<"creator" | "butter">("creator");
  const addBlock = useEditor((s) => s.addBlock);
  const width = useEditor((s) => s.project.width);
  const height = useEditor((s) => s.project.height);

  const addShape = (k: ShapeKind) => addBlock(shapeFor(k, width, height));
  const addSticker = (s: string) =>
    addBlock(textBlock({ text: s, fontFamily: "Inter", fontSize: 200, x: width / 2 - 130, y: height / 2 - 130, w: 260, h: 260 }));

  return (
    <>
      <PanelHeader>
        <div className="flex min-w-0 flex-1 items-baseline gap-3">
          {(["creator", "butter"] as const).map((t) => (
            <button key={t} type="button" className={cn("truncate text-panels transition-colors", tab === t ? "text-ink" : "text-ink-disabled hover:text-ink-secondary")} onClick={() => setTab(t)}>
              {t === "creator" ? "Creator Blocks" : "Contently Blocks"}
            </button>
          ))}
        </div>
      </PanelHeader>
      <div className="flex items-center gap-1 px-3 pb-2">
        {SHAPES.slice(0, 6).map((s) => (
          <Tooltip key={s.kind} label={s.label} side="bottom">
            <button type="button" aria-label={s.label} className="flex size-8 items-center justify-center rounded-[8px] text-ink-secondary hover:bg-[var(--state-hover)] hover:text-ink" onClick={() => addShape(s.kind)}>
              <ShapeGlyph kind={s.kind} size={14} />
            </button>
          </Tooltip>
        ))}
      </div>
      <PanelBody>
        <CatalogBlocks />
        <div className="mb-1.5 text-cap text-ink-secondary">Shapes</div>
        <div className="grid grid-cols-3 gap-2">
          {SHAPES.map((s) => (
            <button
              key={s.kind}
              type="button"
              className="flex aspect-square flex-col items-center justify-center gap-2 rounded-[14px] bg-card text-ink-secondary transition-colors hover:bg-raised hover:text-ink"
              onClick={() => addShape(s.kind)}
            >
              <ShapeGlyph kind={s.kind} size={38} />
              <span className="text-[10px] tracking-wide">{s.label}</span>
            </button>
          ))}
          {STICKERS.map((s) => (
            <button key={s} type="button" className="flex aspect-square items-center justify-center rounded-[14px] bg-card text-[40px] transition-colors hover:bg-raised" onClick={() => addSticker(s)} aria-label={`Sticker ${s}`}>
              {s}
            </button>
          ))}
        </div>
      </PanelBody>
    </>
  );
}

/*
  The registered catalog, by category. A skeleton until the Blocks panel ticket
  gives it search, chips and animated previews: each tile paints the block's
  poster frame live, through the same renderer as the canvas.
*/
function CatalogBlocks() {
  const addBlock = useEditor((s) => s.addBlock);
  const width = useEditor((s) => s.project.width);
  const height = useEditor((s) => s.project.height);
  const add = (def: AnyBlockDefinition) => addBlock(componentBlock(def.id, def.defaults, { ...placementFor(def, width, height), end: def.defaultDuration }));

  return (
    <>
      {BLOCK_CATEGORIES.map((cat) => {
        const defs = listBlocks(cat);
        if (!defs.length) return null;
        return (
          <section key={cat} className="mb-4">
            <div className="mb-1.5 text-cap text-ink-secondary">{cat}</div>
            <div className="grid grid-cols-2 gap-2">
              {defs.map((def) => (
                <button key={def.id} type="button" aria-label={`Add ${def.name}`} className="group flex flex-col gap-1.5 text-left" onClick={() => add(def)}>
                  <BlockThumb def={def} />
                  <span className="px-0.5 text-cap text-ink-secondary transition-colors group-hover:text-ink">{def.name}</span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

/*
  A block at tile size. With generated previews (`scripts/block-previews.ts`)
  the tile shows the poster and plays the preview while the pointer is over it
  — pointer state rather than `:hover`, which does not fire for every pointer.
  Without them it paints the poster frame live: laid out at phone width, then
  scaled down to fit.
*/
function BlockThumb({ def }: { def: AnyBlockDefinition }) {
  /* Two columns across the panel's padded width. Computed here, not at module scope: LeftPanel imports this file. */
  const tile = (LEFT_PANEL_WIDTH - 24 - 8) / 2;
  const box = { w: tile, h: tile };
  const preview = useBlockPreview(def.id);
  const [hover, setHover] = useState(false);
  if (preview.poster) {
    return (
      <div
        className="relative overflow-hidden rounded-[12px] bg-card ring-1 ring-transparent transition-shadow group-hover:ring-line-strong"
        style={{ width: box.w, height: box.h }}
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => setHover(false)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a Convex storage URL at tile size */}
        <img src={preview.poster} alt="" draggable={false} className="absolute inset-0 size-full object-cover" />
        {hover && preview.video ? <video src={preview.video} autoPlay muted loop playsInline className="absolute inset-0 size-full object-cover" /> : null}
      </div>
    );
  }
  const w = 390;
  const h = w / aspectRatioOf(def);
  const scale = Math.min((box.w - 24) / w, (box.h - 24) / h);
  const progress = def.poster?.progress ?? 1;
  return (
    <div className="relative flex items-center justify-center overflow-hidden rounded-[12px] bg-card ring-1 ring-transparent transition-shadow group-hover:ring-line-strong" style={{ width: box.w, height: box.h }}>
      <div className="pointer-events-none shrink-0" style={{ width: w * scale, height: h * scale }}>
        <div style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          {def.render(def.defaults, { mode: "static", progress, time: progress * def.defaultDuration, duration: def.defaultDuration, width: w, height: h })}
        </div>
      </div>
    </div>
  );
}

const SHAPE_PATHS: Record<ShapeKind, React.ReactNode> = {
  rect: <rect x="2" y="2" width="20" height="20" rx="4" />,
  ellipse: <circle cx="12" cy="12" r="10" />,
  triangle: <polygon points="12,2 22,22 2,22" strokeLinejoin="round" />,
  star: <polygon points="12,2 14.8,8.6 22,9.3 16.5,14 18.2,21 12,17.3 5.8,21 7.5,14 2,9.3 9.2,8.6" strokeLinejoin="round" />,
  diamond: <polygon points="12,2 22,12 12,22 2,12" strokeLinejoin="round" />,
  hexagon: <polygon points="7,3 17,3 22,12 17,21 7,21 2,12" strokeLinejoin="round" />,
  line: <line x1="3" y1="12" x2="21" y2="12" strokeLinecap="round" />,
  arrow: (
    <>
      <line x1="3" y1="12" x2="19" y2="12" strokeLinecap="round" />
      <polyline points="14,7 19,12 14,17" strokeLinejoin="round" strokeLinecap="round" />
    </>
  ),
};

export function ShapeGlyph({ kind, size }: { kind: ShapeKind; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      {SHAPE_PATHS[kind]}
    </svg>
  );
}

/* ----------------------------------------------------------------- Text --- */

export function TextPanel() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof TEXT_CATEGORIES)[number]>("Instagram");
  const addBlock = useEditor((s) => s.addBlock);
  const width = useEditor((s) => s.project.width);
  const height = useEditor((s) => s.project.height);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle) return TEXT_PRESETS.filter((p) => `${p.label} ${p.category} ${p.preview.text}`.toLowerCase().includes(needle));
    return TEXT_PRESETS.filter((p) => p.category === cat);
  }, [q, cat]);

  const add = (p: TextPreset) => addBlock(textFromPreset(p, width, height));

  return (
    <>
      <PanelHeader>
        <PanelSearch value={q} onChange={setQ} placeholder="Search text styles" />
      </PanelHeader>
      <PanelPrimary onClick={() => add(TEXT_PRESETS.find((p) => p.id === "heading")!)}>Add Standard Text</PanelPrimary>
      <div className="flex min-h-0 flex-1 gap-2 px-3 pb-3">
        <div className="min-h-0 overflow-y-auto [scrollbar-width:none]">
          <CategoryList value={cat} onChange={(c) => { setCat(c); setQ(""); }} options={TEXT_CATEGORIES} />
        </div>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          <div className="mb-1.5 text-cap text-ink-secondary">{q ? "Results" : cat}</div>
          <div className="grid grid-cols-2 gap-1.5">
            {list.map((p) => (
              <button
                key={p.id}
                type="button"
                title={p.label}
                className="flex aspect-square items-center justify-center overflow-hidden rounded-[10px] bg-card p-2 transition-colors hover:bg-raised"
                style={{ background: p.preview.bg }}
                onClick={() => add(p)}
              >
                <PresetPreview preset={p} />
              </button>
            ))}
          </div>
          {!list.length ? <Empty>No styles match.</Empty> : null}
        </div>
      </div>
    </>
  );
}

/* A preset rendered at thumbnail scale, using the same style pipeline as the canvas. */
function PresetPreview({ preset }: { preset: TextPreset }) {
  const b = textBlock({ x: 0, y: 0, w: 100, ...preset.block, text: preset.preview.text });
  const scale = Math.min(1, 16 / b.fontSize);
  const base = textStyle({ ...b, fontSize: Math.max(9, b.fontSize * scale), letterSpacing: b.letterSpacing * scale });
  const hl = highlightStyle(b);
  const style: React.CSSProperties = {
    ...base,
    textShadow: base.textShadow ? scaleShadow(base.textShadow, scale) : undefined,
    WebkitTextStroke: b.stroke ? `${Math.max(0.6, b.stroke.width * scale)}px ${b.stroke.color}` : undefined,
    textAlign: "center",
    lineHeight: hl ? b.lineHeight + 0.35 : b.lineHeight,
    maxWidth: "100%",
    wordBreak: "keep-all",
    overflowWrap: "normal",
  };
  const hlSmall = hl ? { ...hl, padding: `${(b.highlight!.padding * scale * 0.45).toFixed(1)}px ${(b.highlight!.padding * scale).toFixed(1)}px`, borderRadius: b.highlight!.radius * scale } : undefined;
  return (
    <span style={style} className="block">
      {hlSmall ? <span style={hlSmall}>{preset.preview.text}</span> : preset.preview.text}
    </span>
  );
}

function scaleShadow(shadow: string, k: number) {
  return shadow.replace(/(-?[\d.]+)px/g, (_, n) => `${(parseFloat(n) * k).toFixed(1)}px`);
}

export function Empty({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-[10px] bg-card px-3 py-6 text-center text-cap text-ink-secondary", className)}>{children}</div>;
}
