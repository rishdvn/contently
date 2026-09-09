"use client";

import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Crop,
  Italic,
  Layers2,
  MousePointerClick,
  RotateCcw,
  Scan,
  Sparkles,
  Trash2,
  Underline,
  X,
} from "lucide-react";
import { useState } from "react";

import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { imageBlock } from "@/lib/editor/factory";
import { FONTS, WEIGHT_LABELS, fontDef, nearestWeight } from "@/lib/editor/fonts";
import { BG_COLORS, BG_GRADIENTS, TEXT_PRESETS, textFromPreset } from "@/lib/editor/presets";
import { useActiveSlide, useEditor, useSelectedBlocks } from "@/lib/editor/store";
import { gradientCss } from "@/lib/editor/style";
import {
  NEUTRAL_ADJUSTMENTS,
  type Animation,
  type Block,
  type Effect,
  type EffectKind,
  type ImageBlock,
  type ShapeBlock,
  type TextBlock,
  type VideoBlock,
} from "@/lib/editor/types";

import {
  Card,
  CardButton,
  ColorField,
  Group,
  IconToggle,
  NumberField,
  Panel,
  Row,
  Section,
  Segmented,
  Select,
  SliderField,
  TextField,
} from "../controls";

export const INSPECTOR_WIDTH = 300;

const TYPE_LABEL: Record<Block["type"], string> = { text: "Text", image: "Image", video: "Video", shape: "Shape" };

/*
  Context-sensitive properties, top right. Title + close, Design / Effects
  tabs, then a stack of cards. Groups that can be switched off carry a switch
  on their header row, exactly as the reference does for Overlay, Shadow, etc.
*/
export function Inspector({ bottom }: { bottom: number }) {
  const blocks = useSelectedBlocks();
  const tab = useEditor((s) => s.inspectorTab);
  const setTab = useEditor((s) => s.setInspectorTab);
  const clearSelection = useEditor((s) => s.clearSelection);
  const slide = useActiveSlide();

  const one = blocks.length === 1 ? blocks[0] : null;
  const title = one ? TYPE_LABEL[one.type] : blocks.length > 1 ? `${blocks.length} elements` : slide.name;

  return (
    <Panel className="absolute top-16 right-2 flex flex-col overflow-hidden" style={{ width: INSPECTOR_WIDTH, bottom }} onPointerDown={(e) => e.stopPropagation()}>
      <div className="flex flex-col gap-1.5 px-2.5 pt-2.5 pb-2">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Close" className="flex size-7 items-center justify-center rounded-[6px] text-ink-secondary hover:bg-[var(--state-hover)] hover:text-ink" onClick={clearSelection}>
            <X className="size-4" />
          </button>
          <div className="min-w-0 flex-1 truncate text-default text-ink">{title}</div>
          {one ? (
            <Tooltip label="Layer" side="bottom">
              <span className="flex size-7 items-center justify-center text-ink-disabled">
                <Layers2 className="size-4" />
              </span>
            </Tooltip>
          ) : null}
        </div>
        {blocks.length ? (
          <div className="flex items-center gap-1 pl-1">
            {(["design", "effects"] as const).map((t) => (
              <button key={t} type="button" className={cn("h-6 rounded-[6px] px-2 text-cap transition-colors", tab === t ? "bg-raised text-ink" : "text-ink-secondary hover:text-ink")} onClick={() => setTab(t)}>
                {t === "design" ? "Design" : "Effects"}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-2 pb-2">
        {!blocks.length ? (
          <SlideProperties />
        ) : tab === "effects" ? (
          <EffectsTab blocks={blocks} />
        ) : one ? (
          <>
            {one.type === "text" ? <TextProperties b={one} /> : null}
            {one.type === "image" || one.type === "video" ? <MediaProperties b={one} /> : null}
            {one.type === "shape" ? <ShapeProperties b={one} /> : null}
            <CommonProperties blocks={[one]} />
          </>
        ) : (
          <>
            <Card className="px-3 py-3 text-cap text-ink-secondary">
              <MousePointerClick className="mb-1.5 size-4" />
              Properties apply to every selected element. Double-click one to edit it alone.
            </Card>
            <CommonProperties blocks={blocks} />
          </>
        )}
      </div>
    </Panel>
  );
}

/* --------------------------------------------------------------- slide --- */

function SlideProperties() {
  const slide = useActiveSlide();
  const project = useEditor((s) => s.project);
  const updateSlide = useEditor((s) => s.updateSlide);
  const setBackground = useEditor((s) => s.setBackground);
  const duplicateSlide = useEditor((s) => s.duplicateSlide);
  const removeSlide = useEditor((s) => s.removeSlide);
  const addBlock = useEditor((s) => s.addBlock);
  const setLeftTab = useEditor((s) => s.setLeftTab);
  const bg = slide.background;

  const hooks = TEXT_PRESETS.filter((p) => p.category === "TikTok Hooks");
  const generateText = () => addBlock(textFromPreset(hooks[Math.floor(Math.random() * hooks.length)], project.width, project.height));

  return (
    <>
      <Card className="p-2">
        <TextField value={slide.name} onCommit={(name) => updateSlide(slide.id, { name })} aria-label="Slide name" />
      </Card>
      <Tooltip label="Inserts a hook from the text library" side="bottom" className="w-full">
        <CardButton className="h-10 w-full bg-card hover:bg-raised" onClick={generateText}>
          <Sparkles /> Generate text
        </CardButton>
      </Tooltip>

      <Section label="Background">
        <Segmented
          value={bg.type}
          onChange={(t) => {
            if (t === "color") setBackground(slide.id, { type: "color", color: bg.type === "color" ? bg.color : "#111111" });
            if (t === "gradient") setBackground(slide.id, { type: "gradient", gradient: BG_GRADIENTS[0] });
            if (t === "image") setLeftTab("uploads");
          }}
          options={[
            { value: "color", label: "Color" },
            { value: "gradient", label: "Gradient" },
            { value: "image", label: "Image" },
          ]}
        />
        {bg.type === "color" ? <ColorField value={bg.color} onChange={(c) => setBackground(slide.id, { type: "color", color: c })} presets={BG_COLORS} /> : null}
        {bg.type === "gradient" ? (
          <>
            <div className="grid grid-cols-4 gap-1.5">
              {BG_GRADIENTS.map((g, i) => (
                <button key={i} type="button" aria-label={`Gradient ${i + 1}`} className={cn("h-9 rounded-[8px] ring-1 ring-white/10", gradientCss(g) === gradientCss(bg.gradient) && "ring-2 ring-ink")} style={{ background: gradientCss(g) }} onClick={() => setBackground(slide.id, { type: "gradient", gradient: g })} />
              ))}
            </div>
            <GradientEditor value={bg.gradient} onChange={(g) => setBackground(slide.id, { type: "gradient", gradient: g })} />
          </>
        ) : null}
        {bg.type === "image" ? (
          <>
            <div className="flex items-center gap-2">
              <div className="size-14 shrink-0 overflow-hidden rounded-[8px] bg-raised">
                {/* eslint-disable-next-line @next/next/no-img-element -- user media */}
                {bg.src ? <img src={bg.src} alt="" className="size-full object-cover" /> : null}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <CardButton onClick={() => setLeftTab("uploads")}>Replace</CardButton>
                <CardButton
                  onClick={() => {
                    addBlock(imageBlock({ src: bg.src, x: 0, y: 0, w: project.width, h: project.height, focalX: bg.focalX, focalY: bg.focalY, adjustments: bg.adjustments }));
                    setBackground(slide.id, { type: "color", color: "#111111" });
                  }}
                >
                  Detach Background
                </CardButton>
              </div>
            </div>
            <Row>
              <NumberField label="X" value={bg.focalX} min={0} max={100} onChange={(v) => setBackground(slide.id, { ...bg, focalX: v })} suffix="%" />
              <NumberField label="Y" value={bg.focalY} min={0} max={100} onChange={(v) => setBackground(slide.id, { ...bg, focalY: v })} suffix="%" />
            </Row>
            <AdjustmentSliders value={bg.adjustments} onChange={(a) => setBackground(slide.id, { ...bg, adjustments: a })} />
          </>
        ) : null}
      </Section>

      {project.kind === "video" ? (
        <Section label="Duration">
          <NumberField label="Duration" value={slide.duration} min={1} max={120} step={0.5} suffix="s" onChange={(v) => updateSlide(slide.id, { duration: v })} />
        </Section>
      ) : null}

      {project.kind === "carousel" ? (
        <Section label="Slide">
          <Row>
            <CardButton onClick={() => duplicateSlide(slide.id)}>Duplicate</CardButton>
            <CardButton disabled={project.slides.length <= 1} onClick={() => removeSlide(slide.id)} className="text-critical hover:bg-critical-surface">
              <Trash2 /> Delete
            </CardButton>
          </Row>
        </Section>
      ) : null}
    </>
  );
}

/* ---------------------------------------------------------------- text --- */

function TextProperties({ b }: { b: TextBlock }) {
  const updateBlock = useEditor((s) => s.updateBlock);
  const brand = useEditor((s) => s.brandColors);
  const set = (patch: Partial<TextBlock>) => updateBlock(b.id, patch);
  const def = fontDef(b.fontFamily);
  const [fillMode, setFillMode] = useState<"solid" | "gradient">(b.gradient ? "gradient" : "solid");

  return (
    <>
      <Card className="flex flex-col gap-1.5 p-2">
        <Select value={b.fontFamily} onChange={(e) => set({ fontFamily: e.target.value, fontWeight: nearestWeight(e.target.value, b.fontWeight) })} style={{ fontFamily: `"${b.fontFamily}"` }}>
          {FONTS.map((f) => (
            <option key={f.family} value={f.family} style={{ fontFamily: `"${f.family}"` }}>
              {f.family}
            </option>
          ))}
        </Select>
        <div className="flex items-center gap-1.5">
          <Select className="min-w-0 flex-1" value={b.fontWeight} onChange={(e) => set({ fontWeight: Number(e.target.value) })}>
            {def.weights.map((w) => (
              <option key={w} value={w}>
                {WEIGHT_LABELS[w] ?? w}
              </option>
            ))}
          </Select>
          <IconToggle pressed={b.fontWeight >= 700} aria-label="Bold" onClick={() => set({ fontWeight: b.fontWeight >= 700 ? nearestWeight(b.fontFamily, 400) : nearestWeight(b.fontFamily, 700) })}>
            <Bold />
          </IconToggle>
          <IconToggle pressed={b.italic} aria-label="Italic" onClick={() => set({ italic: !b.italic })}>
            <Italic />
          </IconToggle>
          <IconToggle pressed={b.underline} aria-label="Underline" onClick={() => set({ underline: !b.underline })}>
            <Underline />
          </IconToggle>
        </div>
        <div className="flex items-center justify-between pl-1">
          <span className="text-ui text-ink-secondary">Paragraph</span>
          <div className="flex items-center gap-0.5">
            {(
              [
                ["left", <AlignLeft key="l" />],
                ["center", <AlignCenter key="c" />],
                ["right", <AlignRight key="r" />],
                ["justify", <AlignJustify key="j" />],
              ] as const
            ).map(([v, icon]) => (
              <IconToggle key={v} pressed={b.textAlign === v} aria-label={`Align ${v}`} className="size-7 bg-transparent" onClick={() => set({ textAlign: v })}>
                {icon}
              </IconToggle>
            ))}
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-1.5 p-2">
        <div className="flex items-center justify-between pl-1">
          <span className="text-ui text-ink-secondary">Color</span>
          <Segmented
            className="h-6 w-[130px]"
            value={fillMode}
            onChange={(m) => {
              setFillMode(m);
              set({ gradient: m === "gradient" ? (b.gradient ?? { angle: 45, stops: ["#6ee86e", "#ffd84d", "#ff9a3c"] }) : undefined });
            }}
            options={[
              { value: "solid", label: "Solid" },
              { value: "gradient", label: "Gradient" },
            ]}
          />
        </div>
        {fillMode === "gradient" && b.gradient ? (
          <GradientEditor value={b.gradient} onChange={(g) => set({ gradient: g })} />
        ) : (
          <ColorField value={b.color} onChange={(c) => set({ color: c })} presets={brand} />
        )}
        <SliderField label="Size" value={Math.round(b.fontSize)} min={8} max={400} onChange={(v) => set({ fontSize: v })} />
      </Card>

      <Group label="Spacing">
        <SliderField label="Line height" value={b.lineHeight} min={0.7} max={2.5} step={0.05} onChange={(v) => set({ lineHeight: v })} />
        <SliderField label="Letter spacing" value={b.letterSpacing} min={-10} max={40} step={0.5} onChange={(v) => set({ letterSpacing: v })} />
        <Segmented
          value={b.textTransform}
          onChange={(v) => set({ textTransform: v })}
          options={[
            { value: "none", label: "Aa" },
            { value: "uppercase", label: "AA" },
            { value: "lowercase", label: "aa" },
            { value: "capitalize", label: "Aa Bb" },
          ]}
        />
      </Group>

      <Group label="Background" enabled={!!b.highlight} onEnabledChange={(on) => set({ highlight: on ? { color: b.color === "#ffffff" ? "#0a0909" : "#ffffff", padding: 16, radius: 10 } : undefined })} defaultOpen>
        {b.highlight ? (
          <>
            <ColorField value={b.highlight.color} onChange={(c) => set({ highlight: { ...b.highlight!, color: c } })} presets={brand} allowAlpha />
            <Row>
              <NumberField label="Pad" value={b.highlight.padding} min={0} max={120} onChange={(v) => set({ highlight: { ...b.highlight!, padding: v } })} />
              <NumberField label="Radius" value={b.highlight.radius} min={0} max={999} onChange={(v) => set({ highlight: { ...b.highlight!, radius: v } })} />
            </Row>
          </>
        ) : null}
      </Group>

      <Group label="Outline" enabled={!!b.stroke} onEnabledChange={(on) => set({ stroke: on ? { color: "#0a0909", width: 2 } : undefined })} defaultOpen>
        {b.stroke ? (
          <>
            <ColorField value={b.stroke.color} onChange={(c) => set({ stroke: { ...b.stroke!, color: c } })} presets={brand} />
            <SliderField label="Width" value={b.stroke.width} min={0.5} max={20} step={0.5} onChange={(v) => set({ stroke: { ...b.stroke!, width: v } })} />
          </>
        ) : null}
      </Group>

      <ShadowGroup shadow={b.shadow} onChange={(s) => set({ shadow: s })} presets={brand} />

      <Group label="Glow" enabled={!!b.glow} onEnabledChange={(on) => set({ glow: on ? { color: "#ff4fd8", blur: 24 } : undefined })} defaultOpen>
        {b.glow ? (
          <>
            <ColorField value={b.glow.color} onChange={(c) => set({ glow: { ...b.glow!, color: c } })} presets={brand} />
            <SliderField label="Blur" value={b.glow.blur} min={0} max={80} onChange={(v) => set({ glow: { ...b.glow!, blur: v } })} />
          </>
        ) : null}
      </Group>
    </>
  );
}

/* --------------------------------------------------------------- media --- */

function MediaProperties({ b }: { b: ImageBlock | VideoBlock }) {
  const updateBlock = useEditor((s) => s.updateBlock);
  const removeBlocks = useEditor((s) => s.removeBlocks);
  const setBackground = useEditor((s) => s.setBackground);
  const setLeftTab = useEditor((s) => s.setLeftTab);
  const activeSlideId = useEditor((s) => s.activeSlideId);
  const brand = useEditor((s) => s.brandColors);
  const set = (patch: Partial<Omit<ImageBlock, "type"> & Omit<VideoBlock, "type">>) => updateBlock(b.id, patch as Partial<Block>);
  const [cropping, setCropping] = useState(false);
  const neutral = JSON.stringify(b.adjustments) === JSON.stringify(NEUTRAL_ADJUSTMENTS);

  return (
    <>
      <Card className="flex flex-col gap-2 p-2">
        <div className="pl-1 text-ui text-ink-secondary">Image or Video</div>
        <div className="flex items-start gap-2">
          <button type="button" className="size-14 shrink-0 overflow-hidden rounded-[8px] bg-raised" onClick={() => setLeftTab("uploads")} title="Replace">
            {/* eslint-disable-next-line @next/next/no-img-element -- user media */}
            {b.src ? b.type === "image" ? <img src={b.src} alt="" className="size-full object-cover" /> : <video src={b.src} muted className="size-full object-cover" /> : null}
          </button>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <CardButton onClick={() => setCropping((c) => !c)} aria-pressed={cropping}>
              <Crop /> Crop
            </CardButton>
            <Tooltip label="Needs an image-segmentation backend" side="bottom" className="w-full">
              <CardButton disabled className="w-full">
                Remove BG
              </CardButton>
            </Tooltip>
          </div>
        </div>
        {cropping ? (
          <>
            <Segmented value={b.fit} onChange={(v) => set({ fit: v })} options={[{ value: "cover", label: "Fill" }, { value: "contain", label: "Fit" }]} />
            {b.fit === "cover" ? (
              <Row>
                <NumberField label="X" value={b.focalX} min={0} max={100} suffix="%" onChange={(v) => set({ focalX: v })} />
                <NumberField label="Y" value={b.focalY} min={0} max={100} suffix="%" onChange={(v) => set({ focalY: v })} />
              </Row>
            ) : null}
          </>
        ) : null}
        {b.type === "image" ? (
          <CardButton
            onClick={() => {
              setBackground(activeSlideId, { type: "image", src: b.src, focalX: b.focalX, focalY: b.focalY, adjustments: b.adjustments });
              removeBlocks([b.id]);
            }}
          >
            Set as Background
          </CardButton>
        ) : null}
      </Card>

      {b.type === "video" ? (
        <Section label="Playback">
          <Row>
            <Segmented value={b.muted ? "muted" : "sound"} onChange={(v) => set({ muted: v === "muted" })} options={[{ value: "sound", label: "Sound" }, { value: "muted", label: "Muted" }]} />
            <Segmented value={b.loop ? "loop" : "once"} onChange={(v) => set({ loop: v === "loop" })} options={[{ value: "loop", label: "Loop" }, { value: "once", label: "Once" }]} />
          </Row>
          {!b.muted ? <SliderField label="Volume" value={b.volume} onChange={(v) => set({ volume: v })} suffix="%" /> : null}
          <NumberField label="Trim start" value={b.trimStart} min={0} max={Math.max(0, (b.sourceDuration ?? 600) - 0.5)} step={0.1} suffix="s" onChange={(v) => set({ trimStart: v })} />
        </Section>
      ) : null}

      <Group label="Color Adjustment" enabled={!neutral} onEnabledChange={(on) => set({ adjustments: on ? { ...NEUTRAL_ADJUSTMENTS, saturate: 110 } : { ...NEUTRAL_ADJUSTMENTS } })} defaultOpen>
        <AdjustmentSliders value={b.adjustments} onChange={(a) => set({ adjustments: a })} />
      </Group>

      <Group label="Overlay" enabled={!!b.overlay} onEnabledChange={(on) => set({ overlay: on ? { color: "#0a0909", opacity: 35 } : undefined })} defaultOpen>
        {b.overlay ? (
          <>
            <ColorField value={b.overlay.color} onChange={(c) => set({ overlay: { ...b.overlay!, color: c } })} presets={brand} />
            <SliderField label="Opacity" value={b.overlay.opacity} onChange={(v) => set({ overlay: { ...b.overlay!, opacity: v } })} suffix="%" />
          </>
        ) : null}
      </Group>

      <Group label="Borders and Rounding" enabled={b.radius > 0 || !!b.border} onEnabledChange={(on) => set(on ? { radius: 32, border: { width: 0, color: "#ffffff" } } : { radius: 0, border: undefined })} defaultOpen>
        <SliderField label="Rounding" value={b.radius} min={0} max={Math.round(Math.min(b.w, b.h) / 2)} onChange={(v) => set({ radius: v })} />
        <SliderField label="Border" value={b.border?.width ?? 0} min={0} max={60} onChange={(v) => set({ border: { color: b.border?.color ?? "#ffffff", width: v } })} />
        {b.border?.width ? <ColorField value={b.border.color} onChange={(c) => set({ border: { ...b.border!, color: c } })} presets={brand} /> : null}
      </Group>

      <ShadowGroup shadow={b.shadow} onChange={(s) => set({ shadow: s })} presets={brand} />
    </>
  );
}

/* --------------------------------------------------------------- shape --- */

function ShapeProperties({ b }: { b: ShapeBlock }) {
  const updateBlock = useEditor((s) => s.updateBlock);
  const brand = useEditor((s) => s.brandColors);
  const set = (patch: Partial<ShapeBlock>) => updateBlock(b.id, patch);
  const thin = b.shape === "line" || b.shape === "arrow";
  const [fillMode, setFillMode] = useState<"solid" | "gradient">(b.gradient ? "gradient" : "solid");
  return (
    <>
      {!thin ? (
        <Card className="flex flex-col gap-1.5 p-2">
          <div className="flex items-center justify-between pl-1">
            <span className="text-ui text-ink-secondary">Fill</span>
            <Segmented
              className="h-6 w-[130px]"
              value={fillMode}
              onChange={(m) => {
                setFillMode(m);
                set({ gradient: m === "gradient" ? (b.gradient ?? { angle: 160, stops: ["#6ee86e", "#2f9e4f"] }) : undefined });
              }}
              options={[{ value: "solid", label: "Solid" }, { value: "gradient", label: "Gradient" }]}
            />
          </div>
          {fillMode === "gradient" && b.gradient ? <GradientEditor value={b.gradient} onChange={(g) => set({ gradient: g })} /> : <ColorField value={b.fill} onChange={(c) => set({ fill: c })} presets={brand} allowAlpha />}
        </Card>
      ) : null}
      <Group label={thin ? "Line" : "Stroke"} enabled={!!b.stroke} onEnabledChange={(on) => set({ stroke: on ? { color: "#f5f5f5", width: 8 } : undefined })} defaultOpen>
        {b.stroke ? (
          <>
            <ColorField value={b.stroke.color} onChange={(c) => set({ stroke: { ...b.stroke!, color: c } })} presets={brand} />
            <SliderField label="Width" value={b.stroke.width} min={1} max={80} onChange={(v) => set({ stroke: { ...b.stroke!, width: v } })} />
          </>
        ) : null}
      </Group>
      {b.shape === "rect" ? (
        <Section label="Rounding">
          <SliderField label="Radius" value={b.radius} min={0} max={Math.round(Math.min(b.w, b.h) / 2)} onChange={(v) => set({ radius: v })} />
        </Section>
      ) : null}
      <ShadowGroup shadow={b.shadow} onChange={(s) => set({ shadow: s })} presets={brand} />
    </>
  );
}

/* -------------------------------------------------------------- common --- */

function CommonProperties({ blocks }: { blocks: Block[] }) {
  const updateBlock = useEditor((s) => s.updateBlock);
  const updateBlocks = useEditor((s) => s.updateBlocks);
  const project = useEditor((s) => s.project);
  const slide = useActiveSlide();
  const b = blocks[0];
  const many = blocks.length > 1;
  const setAll = (fn: (b: Block) => Partial<Block>) => updateBlocks(Object.fromEntries(blocks.map((x) => [x.id, fn(x)])));

  return (
    <>
      <Section
        label="Position"
        trailing={
          <div className="flex items-center gap-0.5">
            <Tooltip label="Reset rotation" side="bottom">
              <button type="button" aria-label="Reset rotation" className="flex size-6 items-center justify-center rounded-[6px] text-ink-secondary hover:bg-[var(--state-hover)] hover:text-ink" onClick={() => setAll(() => ({ rotation: 0 }))}>
                <RotateCcw className="size-3.5" />
              </button>
            </Tooltip>
            <Tooltip label="Centre on slide" side="bottom">
              <button
                type="button"
                aria-label="Centre on slide"
                className="flex size-6 items-center justify-center rounded-[6px] text-ink-secondary hover:bg-[var(--state-hover)] hover:text-ink"
                onClick={() => setAll((x) => ({ x: (project.width - x.w) / 2, y: (project.height - x.h) / 2 }))}
              >
                <Scan className="size-3.5" />
              </button>
            </Tooltip>
          </div>
        }
      >
        {!many ? (
          <>
            <Row>
              <NumberField label="X" value={Math.round(b.x)} onChange={(v) => updateBlock(b.id, { x: v })} />
              <NumberField label="Y" value={Math.round(b.y)} onChange={(v) => updateBlock(b.id, { y: v })} />
              <NumberField label="Angle" value={Math.round(b.rotation)} step={1} suffix="°" onChange={(v) => updateBlock(b.id, { rotation: ((v % 360) + 360) % 360 })} />
            </Row>
            <Row>
              <NumberField label="W" value={Math.round(b.w)} min={1} onChange={(v) => updateBlock(b.id, { w: v })} />
              {b.type !== "text" ? <NumberField label="H" value={Math.round(b.h)} min={1} onChange={(v) => updateBlock(b.id, { h: v })} /> : null}
            </Row>
          </>
        ) : null}
        <SliderField label="Opacity" value={b.opacity} onChange={(v) => setAll(() => ({ opacity: v }))} suffix="%" />
      </Section>

      {project.kind === "video" ? (
        <>
          <Section label="Animation">
            <Segmented<Animation>
              value={b.animation}
              onChange={(v) => setAll(() => ({ animation: v }))}
              options={[
                { value: "none", label: "None" },
                { value: "pan", label: "Pan" },
                { value: "zoom", label: "Zoom" },
                { value: "fade", label: "Fade" },
                { value: "rise", label: "Rise" },
              ]}
            />
          </Section>
          <Section label="Duration">
            <NumberField label="Duration" value={round1(b.end - b.start)} min={0.1} step={0.1} suffix="s" onChange={(v) => setAll((x) => ({ end: Math.min(slide.duration, x.start + v) }))} />
            <Row>
              <NumberField label="Start" value={round1(b.start)} min={0} max={slide.duration} step={0.1} suffix="s" onChange={(v) => setAll((x) => ({ start: Math.min(v, x.end - 0.1) }))} />
              <NumberField label="End" value={round1(b.end)} min={0} max={slide.duration} step={0.1} suffix="s" onChange={(v) => setAll((x) => ({ end: Math.max(v, x.start + 0.1) }))} />
            </Row>
          </Section>
        </>
      ) : null}
    </>
  );
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function ShadowGroup({ shadow, onChange, presets }: { shadow?: Block["shadow"]; onChange: (s: Block["shadow"]) => void; presets: string[] }) {
  return (
    <Group label="Shadow" enabled={!!shadow} onEnabledChange={(on) => onChange(on ? { color: "rgba(0,0,0,0.45)", x: 0, y: 12, blur: 32 } : undefined)} defaultOpen>
      {shadow ? (
        <>
          <ColorField value={shadow.color} onChange={(c) => onChange({ ...shadow, color: c })} presets={presets} allowAlpha />
          <Row>
            <NumberField label="X" value={shadow.x} onChange={(v) => onChange({ ...shadow, x: v })} />
            <NumberField label="Y" value={shadow.y} onChange={(v) => onChange({ ...shadow, y: v })} />
            <NumberField label="Blur" value={shadow.blur} min={0} onChange={(v) => onChange({ ...shadow, blur: v })} />
          </Row>
        </>
      ) : null}
    </Group>
  );
}

function AdjustmentSliders({ value, onChange }: { value: ImageBlock["adjustments"]; onChange: (a: ImageBlock["adjustments"]) => void }) {
  const set = (k: keyof ImageBlock["adjustments"], v: number) => onChange({ ...value, [k]: v });
  return (
    <>
      <SliderField label="Brightness" value={value.brightness} min={0} max={200} onChange={(v) => set("brightness", v)} />
      <SliderField label="Contrast" value={value.contrast} min={0} max={200} onChange={(v) => set("contrast", v)} />
      <SliderField label="Saturation" value={value.saturate} min={0} max={200} onChange={(v) => set("saturate", v)} />
      <SliderField label="Hue" value={value.hue} min={-180} max={180} suffix="°" onChange={(v) => set("hue", v)} />
      <SliderField label="Grayscale" value={value.grayscale} min={0} max={100} onChange={(v) => set("grayscale", v)} />
      <SliderField label="Blur" value={value.blur} min={0} max={40} onChange={(v) => set("blur", v)} />
    </>
  );
}

function GradientEditor({ value, onChange }: { value: NonNullable<TextBlock["gradient"]>; onChange: (g: NonNullable<TextBlock["gradient"]>) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="h-6 rounded-[6px]" style={{ background: gradientCss(value) }} />
      {value.stops.map((c, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className="min-w-0 flex-1">
            <ColorField value={c} onChange={(nc) => onChange({ ...value, stops: value.stops.map((s, j) => (j === i ? nc : s)) })} />
          </div>
          {value.stops.length > 2 ? (
            <button type="button" aria-label="Remove stop" className="flex size-7 items-center justify-center rounded-[6px] text-ink-secondary hover:text-critical" onClick={() => onChange({ ...value, stops: value.stops.filter((_, j) => j !== i) })}>
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
      ))}
      <Row>
        <NumberField label="Angle" value={value.angle} suffix="°" onChange={(v) => onChange({ ...value, angle: ((v % 360) + 360) % 360 })} />
        {value.stops.length < 4 ? <CardButton className="h-8" onClick={() => onChange({ ...value, stops: [...value.stops, "#ffffff"] })}>Add stop</CardButton> : null}
      </Row>
    </div>
  );
}

/* ------------------------------------------------------------- effects --- */

const EFFECT_LIST: { kind: EffectKind; label: string; preview: React.CSSProperties }[] = [
  { kind: "tint", label: "Tint", preview: { background: "linear-gradient(135deg,#ff9a3c,#ff4fd8)", mixBlendMode: "multiply" } },
  { kind: "blur", label: "Blur", preview: { backdropFilter: "blur(3px)" } },
  { kind: "grain", label: "Grain", preview: { backgroundImage: "radial-gradient(rgba(255,255,255,.35) 0.6px, transparent 0.7px)", backgroundSize: "3px 3px" } },
  { kind: "halftone", label: "Halftone", preview: { backgroundImage: "radial-gradient(circle, rgba(0,0,0,.9) 1.6px, transparent 1.8px)", backgroundSize: "6px 6px" } },
];

function EffectsTab({ blocks }: { blocks: Block[] }) {
  const updateBlock = useEditor((s) => s.updateBlock);
  const [picking, setPicking] = useState(false);
  const [choice, setChoice] = useState<EffectKind | "none">("none");
  const b = blocks[0];

  const setEffects = (effects: Effect[]) => blocks.forEach((x) => updateBlock(x.id, { effects }));
  const apply = () => {
    if (choice !== "none" && !b.effects.some((e) => e.kind === choice)) {
      setEffects([...b.effects, { kind: choice, amount: 50, color: choice === "tint" ? "#ff9a3c" : undefined }]);
    }
    setPicking(false);
  };

  return (
    <>
      <Group label={TYPE_LABEL[b.type]} defaultOpen>
        {b.effects.map((e) => (
          <Card key={e.kind} className="flex flex-col gap-1.5 bg-raised p-2">
            <div className="flex items-center justify-between">
              <span className="text-ui text-ink capitalize">{e.kind}</span>
              <button type="button" aria-label={`Remove ${e.kind}`} className="flex size-6 items-center justify-center rounded-[6px] text-ink-secondary hover:text-critical" onClick={() => setEffects(b.effects.filter((x) => x.kind !== e.kind))}>
                <Trash2 className="size-3.5" />
              </button>
            </div>
            <SliderField label="Amount" value={e.amount} onChange={(v) => setEffects(b.effects.map((x) => (x.kind === e.kind ? { ...x, amount: v } : x)))} suffix="%" />
            {e.kind === "tint" ? <ColorField value={e.color ?? "#ff9a3c"} onChange={(c) => setEffects(b.effects.map((x) => (x.kind === e.kind ? { ...x, color: c } : x)))} /> : null}
          </Card>
        ))}
        {b.effects.length === 0 && !picking ? <p className="px-1 text-cap text-ink-secondary">No effects yet.</p> : null}
        {!picking ? <CardButton onClick={() => setPicking(true)}>Add Effect</CardButton> : null}
      </Group>
      {picking ? (
        <Card className="flex flex-col gap-3 p-3">
          <div className="text-default text-ink">Add Effect</div>
          <div className="grid grid-cols-3 gap-1.5">
            <EffectTile label="None" selected={choice === "none"} onClick={() => setChoice("none")} />
            {EFFECT_LIST.map((e) => (
              <EffectTile key={e.kind} label={e.label} selected={choice === e.kind} onClick={() => setChoice(e.kind)} preview={e.preview} />
            ))}
          </div>
          <Row>
            <CardButton onClick={() => setPicking(false)}>Cancel</CardButton>
            <CardButton className="bg-ink text-canvas hover:bg-white" onClick={apply}>
              Apply
            </CardButton>
          </Row>
        </Card>
      ) : null}
    </>
  );
}

function EffectTile({ label, selected, onClick, preview }: { label: string; selected: boolean; onClick: () => void; preview?: React.CSSProperties }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={cn("flex flex-col items-center gap-1 rounded-[10px] p-1 ring-1 transition-shadow", selected ? "ring-ink" : "ring-transparent hover:ring-line-strong")}>
      <div className="relative aspect-square w-full overflow-hidden rounded-[8px] bg-[linear-gradient(135deg,#f6c8dd,#4cc7f0)]">
        {preview ? <div className="absolute inset-0" style={preview} /> : null}
      </div>
      <span className="text-[10px] text-ink-secondary">{label}</span>
    </button>
  );
}
