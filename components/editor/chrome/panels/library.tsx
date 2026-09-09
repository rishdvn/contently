"use client";

import { Plus, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

import { Chip, ChipRow } from "@/components/ui/chip";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { textBlock } from "@/lib/editor/factory";
import {
  SHAPES,
  TEMPLATE_CATEGORIES,
  TEMPLATES,
  TEXT_CATEGORIES,
  TEXT_PRESETS,
  shapeFor,
  textFromPreset,
  type TextPreset,
} from "@/lib/editor/presets";
import { useEditor } from "@/lib/editor/store";
import { highlightStyle, textStyle } from "@/lib/editor/style";
import type { ShapeKind } from "@/lib/editor/types";

import { CategoryList, PanelBody, PanelHeader, PanelPrimary, PanelSearch } from "../LeftPanel";

/* ------------------------------------------------------------ Templates --- */

export function TemplatesPanel() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const updateSlide = useEditor((s) => s.updateSlide);
  const addSlide = useEditor((s) => s.addSlide);
  const activeSlideId = useEditor((s) => s.activeSlideId);
  const width = useEditor((s) => s.project.width);
  const height = useEditor((s) => s.project.height);
  const clearSelection = useEditor((s) => s.clearSelection);

  const list = TEMPLATES.filter((t) => (!cat || t.category === cat) && t.label.toLowerCase().includes(q.toLowerCase()));

  const apply = (id: string, asNew: boolean) => {
    const t = TEMPLATES.find((x) => x.id === id)!;
    const target = asNew ? addSlide(activeSlideId) : activeSlideId;
    updateSlide(target, t.build(width, height));
    clearSelection();
  };

  return (
    <>
      <PanelHeader>
        <PanelSearch value={q} onChange={setQ} placeholder="Search templates" />
      </PanelHeader>
      <div className="flex items-center gap-2 px-3 pb-2">
        <button type="button" aria-label="Filters" className="flex size-8 shrink-0 items-center justify-center rounded-[8px] text-ink-secondary hover:bg-[var(--state-hover)] hover:text-ink [&>svg]:size-4">
          <SlidersHorizontal />
        </button>
        <ChipRow className="min-w-0 [scrollbar-width:none]">
          {TEMPLATE_CATEGORIES.map((c) => (
            <Chip key={c} selected={cat === c} onClick={() => setCat(cat === c ? null : c)} className="h-7 px-3 text-cap">
              {c}
            </Chip>
          ))}
        </ChipRow>
      </div>
      <PanelBody>
        <div className="grid grid-cols-2 gap-2">
          {list.map((t) => (
            <div key={t.id} className="group relative">
              <button
                type="button"
                className="block w-full overflow-hidden rounded-[12px] ring-1 ring-transparent transition-shadow hover:ring-line-strong"
                style={{ aspectRatio: `${width} / ${height}`, background: t.swatch }}
                onClick={() => apply(t.id, false)}
                title="Apply to this slide"
              >
                <span className="absolute inset-x-0 bottom-0 scrim px-2.5 pt-8 pb-2 text-left text-cap text-white">{t.label}</span>
              </button>
              <Tooltip label="Add as new slide" side="left" className="absolute top-1.5 right-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  aria-label="Add as new slide"
                  className="flex size-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 [&>svg]:size-3.5"
                  onClick={() => apply(t.id, true)}
                >
                  <Plus />
                </button>
              </Tooltip>
            </div>
          ))}
        </div>
        {!list.length ? <Empty>No templates match.</Empty> : null}
      </PanelBody>
    </>
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
        <Chip selected className="h-8 gap-1.5 px-3 text-cap">
          <Plus className="size-3.5" /> Build
        </Chip>
        {SHAPES.slice(0, 6).map((s) => (
          <Tooltip key={s.kind} label={s.label} side="bottom">
            <button type="button" aria-label={s.label} className="flex size-8 items-center justify-center rounded-[8px] text-ink-secondary hover:bg-[var(--state-hover)] hover:text-ink" onClick={() => addShape(s.kind)}>
              <ShapeGlyph kind={s.kind} size={14} />
            </button>
          </Tooltip>
        ))}
      </div>
      <PanelBody>
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
        {tab === "butter" ? <Empty className="mt-4">Code-built motion blocks aren&rsquo;t available in this build.</Empty> : null}
      </PanelBody>
    </>
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
          <div className="grid grid-cols-3 gap-1.5">
            {list.map((p) => (
              <button
                key={p.id}
                type="button"
                title={p.label}
                className="flex aspect-square items-center justify-center overflow-hidden rounded-[10px] bg-card p-1.5 transition-colors hover:bg-raised"
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
  const scale = Math.min(1, 26 / b.fontSize);
  const base = textStyle({ ...b, fontSize: Math.max(9, b.fontSize * scale), letterSpacing: b.letterSpacing * scale });
  const hl = highlightStyle(b);
  const style: React.CSSProperties = {
    ...base,
    textShadow: base.textShadow ? scaleShadow(base.textShadow, scale) : undefined,
    WebkitTextStroke: b.stroke ? `${Math.max(0.6, b.stroke.width * scale)}px ${b.stroke.color}` : undefined,
    textAlign: "center",
    lineHeight: hl ? b.lineHeight + 0.35 : b.lineHeight,
    maxWidth: "100%",
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
