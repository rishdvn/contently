"use client";

import { AlertTriangle, Eye, EyeOff, GripVertical, Image as ImageIcon, Lock, Plus, Type } from "lucide-react";
import type { ReactNode } from "react";

import { IconButton } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/*
  The Editor: one carousel, one slide at a time.

  Three columns around a canvas, in the order a person works: what slide am I
  on (strip, left), what does it look like (canvas, centre), what can I change
  (inspector, right). Tools live on a floating toolbar over the canvas rather
  than in a ribbon, so the slide is the biggest thing on screen. The rail on
  the far left switches what the inspector offers — build, layouts, text,
  media — and nothing else moves when it does.
*/

export type Layer = {
  id: string;
  kind: "text" | "image" | "shape";
  name: string;
  hidden?: boolean;
  locked?: boolean;
};

export type Slide = {
  id: string;
  art: string;
  headline?: string;
  body?: string;
  layers: Layer[];
  flag?: string;
};

export function SlideStrip({
  slides,
  current,
  onSelect,
  onAdd,
  className,
}: {
  slides: Slide[];
  current: string;
  onSelect: (id: string) => void;
  onAdd?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex w-[92px] shrink-0 flex-col gap-2 p-3", className)}>
      {slides.map((s, i) => {
        const active = s.id === current;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            aria-current={active ? "true" : undefined}
            className={cn(
              "group/slide relative aspect-[4/5] w-full overflow-hidden rounded-[8px] outline-none transition-shadow",
              active ? "ring-2 ring-ink ring-offset-2 ring-offset-panel" : "ring-1 ring-line hover:ring-line-strong",
            )}
            style={{ backgroundImage: s.art }}
          >
            <span className="absolute bottom-1 left-1.5 rounded-[4px] bg-black/50 px-1 text-tiny text-white tabular-nums">{i + 1}</span>
            {s.flag ? (
              <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-caution text-canvas">
                <AlertTriangle className="size-2.5" strokeWidth={2.5} />
              </span>
            ) : null}
          </button>
        );
      })}
      {onAdd ? (
        <button
          type="button"
          onClick={onAdd}
          className="flex aspect-[4/5] w-full items-center justify-center rounded-[8px] text-ink-disabled ring-1 ring-inset ring-line transition-colors hover:bg-[var(--state-hover)] hover:text-ink"
          aria-label="Add slide"
        >
          <Plus className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

/** The slide at working size. Text layers render as real text so the type can be judged. */
export function Canvas({ slide, zoom = 1, className, children }: { slide: Slide; zoom?: number; className?: string; children?: ReactNode }) {
  return (
    <div className={cn("relative flex flex-1 items-center justify-center p-8", className)}>
      <div
        className="relative aspect-[4/5] w-[360px] overflow-hidden rounded-[6px] shadow-overlay"
        style={{ backgroundImage: slide.art, transform: `scale(${zoom})` }}
      >
        <div className="scrim absolute inset-x-0 bottom-0 flex flex-col gap-2 p-6 pt-16">
          {slide.headline ? <p className="text-[26px] leading-[1.1] font-medium tracking-tight text-white">{slide.headline}</p> : null}
          {slide.body ? <p className="text-default leading-5 text-white/80">{slide.body}</p> : null}
        </div>
        {slide.flag ? (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-[6px] bg-caution px-2 py-1 text-tiny text-canvas">
            <AlertTriangle className="size-3" /> {slide.flag}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

const layerIcons = { text: Type, image: ImageIcon, shape: GripVertical };

export function LayerList({ layers, current, onSelect }: { layers: Layer[]; current?: string; onSelect?: (id: string) => void }) {
  return (
    <ul className="flex flex-col">
      {layers.map((l) => {
        const Icon = layerIcons[l.kind];
        const active = l.id === current;
        return (
          <li key={l.id}>
            <div
              onClick={() => onSelect?.(l.id)}
              className={cn(
                "group/layer flex h-8 cursor-pointer items-center gap-2 rounded-[8px] px-2 text-ui",
                active ? "bg-[var(--state-selected)] text-ink" : "text-ink-secondary hover:bg-[var(--state-hover)] hover:text-ink",
                l.hidden && "opacity-50",
              )}
            >
              <Icon className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{l.name}</span>
              <span className="flex items-center opacity-0 group-hover/layer:opacity-100">
                <IconButton aria-label={l.hidden ? "Show" : "Hide"} size="sm" className="size-6 [&_svg]:size-3">
                  {l.hidden ? <EyeOff /> : <Eye />}
                </IconButton>
                <IconButton aria-label={l.locked ? "Unlock" : "Lock"} size="sm" className={cn("size-6 [&_svg]:size-3", l.locked && "opacity-100")}>
                  <Lock />
                </IconButton>
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function Inspector({ className, children }: { className?: string; children: ReactNode }) {
  return <aside className={cn("flex w-[264px] shrink-0 flex-col gap-5 border-l border-line p-4", className)}>{children}</aside>;
}

export function InspectorGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-cap text-ink-disabled">{label}</span>
      {children}
    </div>
  );
}
