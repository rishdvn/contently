"use client";

import { Images, LayoutTemplate, Redo2, Send, Sparkles, Type, Undo2, Wand2 } from "lucide-react";
import { useState } from "react";

import { Canvas, Inspector, InspectorGroup, LayerList, SlideStrip, type Slide } from "@/components/patterns/editor";
import { Alert } from "@/components/ui/alert";
import { Button, IconButton } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/input";
import { RailItem } from "@/components/ui/nav";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { TabBar } from "@/components/ui/tabs";
import { Toolbar, ToolbarDivider } from "@/components/ui/toolbar";

import { AppFrame, AppHeader } from "../_app-shell";
import { Page, PageHeader, Section } from "../_doc";

const g = (a: string, b: string) => `linear-gradient(160deg,${a},${b})`;

const slides: Slide[] = [
  { id: "1", art: g("#f6d5c4", "#c98f74"), headline: "Why does your prescription burn more than your acne?", body: "Swipe →", layers: [{ id: "l1", kind: "text", name: "Headline" }, { id: "l2", kind: "text", name: "Swipe cue" }, { id: "l3", kind: "image", name: "Serum on marble", locked: true }] },
  { id: "2", art: g("#2a2a2a", "#151515"), headline: "Tretinoin thins the barrier before it clears anything.", layers: [{ id: "l4", kind: "text", name: "Headline" }, { id: "l5", kind: "shape", name: "Rule" }] },
  { id: "3", art: g("#d8e6c8", "#7f9d63"), headline: "A thinner barrier loses water faster.", body: "That's the sting.", layers: [{ id: "l6", kind: "text", name: "Headline" }, { id: "l7", kind: "text", name: "Body" }] },
  { id: "4", art: g("#e7d9f5", "#9b7fc4"), headline: "Vitamin C cures barrier damage in 14 days.", flag: "Claim not allowed", layers: [{ id: "l8", kind: "text", name: "Headline" }, { id: "l9", kind: "image", name: "Diagram" }] },
  { id: "5", art: g("#fbe3c9", "#d59a5c"), headline: "What we do instead: 15%, buffered, morning only.", layers: [{ id: "l10", kind: "text", name: "Headline" }] },
  { id: "6", art: g("#cfe3f5", "#6d97c2"), headline: "Maya, day 30.", body: "No filter. Consented.", layers: [{ id: "l11", kind: "text", name: "Headline" }, { id: "l12", kind: "image", name: "UGC still" }] },
  { id: "7", art: g("#f2d2dc", "#c66f8c"), headline: "Your skin isn't failing. The routine was.", layers: [{ id: "l13", kind: "text", name: "Headline" }] },
  { id: "8", art: g("#1d1d1d", "#3a3a3a"), headline: "Start gently. Link in bio.", layers: [{ id: "l14", kind: "text", name: "Headline" }, { id: "l15", kind: "text", name: "CTA" }] },
];

export function EditorDemo() {
  const [current, setCurrent] = useState("4");
  const [layer, setLayer] = useState<string | undefined>("l8");
  const [tool, setTool] = useState<"build" | "layouts" | "text" | "media">("build");
  const [tab, setTab] = useState<"slide" | "layers">("layers");
  const [opacity, setOpacity] = useState(100);
  const [size, setSize] = useState(26);
  const [font, setFont] = useState("grotesk");
  const [safe, setSafe] = useState(true);
  const slide = slides.find((s) => s.id === current)!;

  return (
    <Page wide>
      <PageHeader
        eyebrow="Patterns"
        title="Editor"
        lede="One carousel, one slide at a time. Three columns in the order a person works — which slide, what it looks like, what can change — with the tools floating over the canvas so the slide is the biggest thing on screen. Compliance flags travel with the slide, from the strip to the canvas to the inspector."
        note="Composed from: RailItem, Toolbar, TabBar, Slider, Select, Switch, Field / Textarea, Alert, Button."
      />

      <Section title="The surface" rule="Rail · strip · canvas · inspector. Nothing here is new: the rail is the Views rail, the toolbar is the Views toolbar, and every field in the inspector is a Controls primitive.">
        <AppFrame active="editor">
          <AppHeader crumbs={["Board", "Prescription vs. barrier — v2", "Editing"]}>
            <Button variant="ghost" size="sm">
              Preview
            </Button>
            <Button size="sm">Save</Button>
          </AppHeader>
          <div className="flex min-h-[620px] flex-1 border-t border-line">
            <div className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-line py-3">
              {(
                [
                  ["build", Wand2, "Build"],
                  ["layouts", LayoutTemplate, "Layouts"],
                  ["text", Type, "Text"],
                  ["media", Images, "Media"],
                ] as const
              ).map(([id, Icon, label]) => (
                <RailItem key={id} icon={<Icon />} active={tool === id} onClick={() => setTool(id)} className="w-12 text-[10px]">
                  {label}
                </RailItem>
              ))}
            </div>

            <SlideStrip slides={slides} current={current} onSelect={setCurrent} onAdd={() => {}} className="border-r border-line" />

            <div className="relative flex min-w-0 flex-1 flex-col bg-canvas/50">
              <div className="flex justify-center pt-4">
                <Toolbar>
                  <IconButton aria-label="Undo" size="sm">
                    <Undo2 />
                  </IconButton>
                  <IconButton aria-label="Redo" size="sm">
                    <Redo2 />
                  </IconButton>
                  <ToolbarDivider />
                  <Button variant="ghost" size="sm">
                    4:5
                  </Button>
                  <Button variant="ghost" size="sm">
                    92%
                  </Button>
                  <ToolbarDivider />
                  <Button variant="ghost" size="sm">
                    <Sparkles /> Rewrite slide
                  </Button>
                  <Button variant="spectrum" size="sm">
                    <Send /> Schedule
                  </Button>
                </Toolbar>
              </div>
              <Canvas slide={slide} zoom={0.92} />
            </div>

            <Inspector>
              <TabBar
                value={tab}
                onChange={setTab}
                tabs={[
                  { value: "slide", label: "Slide" },
                  { value: "layers", label: "Layers", count: slide.layers.length },
                ]}
              />
              {slide.flag ? (
                <div className="flex flex-col gap-2">
                  <Alert tone="caution" title={slide.flag}>
                    The legal guide does not allow &ldquo;cures&rdquo;. Try &ldquo;calms&rdquo; or &ldquo;supports&rdquo;.
                  </Alert>
                  <Button size="sm" className="self-start">
                    <Sparkles /> Rephrase with the model
                  </Button>
                </div>
              ) : null}
              {tab === "layers" ? (
                <InspectorGroup label="Layers">
                  <LayerList layers={slide.layers} current={layer} onSelect={setLayer} />
                </InspectorGroup>
              ) : null}
              <InspectorGroup label={tab === "layers" ? "Selected layer" : "Slide"}>
                {tab === "layers" ? (
                  <>
                    <Field label="Text">
                      <Textarea rows={3} defaultValue={slide.headline} className="min-h-0 text-ui" />
                    </Field>
                    <Select
                      value={font}
                      onChange={setFont}
                      size="sm"
                      options={[
                        { value: "grotesk", label: "Die Grotesk A" },
                        { value: "serif", label: "Editorial New" },
                        { value: "mono", label: "Diatype Mono" },
                      ]}
                    />
                    <Slider label="Size" value={size} onChange={setSize} min={12} max={64} format={(v) => `${v}px`} />
                    <Slider label="Opacity" value={opacity} onChange={setOpacity} format={(v) => `${v}%`} />
                  </>
                ) : (
                  <>
                    <Select value="4:5" onChange={() => {}} size="sm" options={[{ value: "4:5", label: "4:5 · Instagram" }, { value: "9:16", label: "9:16 · TikTok" }, { value: "1:1", label: "1:1 · Square" }]} />
                    <Switch checked={safe} onCheckedChange={setSafe} label="Safe zones" description="Show platform UI overlays" />
                  </>
                )}
              </InspectorGroup>
            </Inspector>
          </div>
        </AppFrame>
      </Section>

      <Section title="Flags travel" rule="A compliance flag is one fact shown three ways at once: a dot on the slide in the strip, a tag on the canvas, and an Alert with the fix in the inspector. Fixing it in any one place clears all three.">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2 rounded-nav bg-card p-4">
            <span className="text-cap text-ink-disabled">strip</span>
            <div className="w-16">
              <SlideStrip slides={[slides[3]]} current="4" onSelect={() => {}} className="w-16 p-0" />
            </div>
          </div>
          <div className="flex flex-col gap-2 rounded-nav bg-card p-4">
            <span className="text-cap text-ink-disabled">canvas</span>
            <div className="flex items-center gap-1.5 self-start rounded-[6px] bg-caution px-2 py-1 text-tiny text-canvas">Claim not allowed</div>
          </div>
          <div className="flex flex-col gap-2 rounded-nav bg-card p-4">
            <span className="text-cap text-ink-disabled">inspector</span>
            <Alert tone="caution" title="Claim not allowed">
              Try &ldquo;calms&rdquo;.
            </Alert>
          </div>
        </div>
      </Section>
    </Page>
  );
}
