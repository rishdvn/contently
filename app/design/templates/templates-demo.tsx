"use client";

import { Search } from "lucide-react";
import { useState } from "react";

import { BriefFromTemplateDialog, TemplateGrid, type Template } from "@/components/patterns/templates";
import { Chip, ChipRow, TextTab } from "@/components/ui/chip";
import { SearchInput } from "@/components/ui/input";

import { AppFrame, AppHeader } from "../_app-shell";
import { Page, PageHeader, Section } from "../_doc";

const g = (a: string, b: string) => `linear-gradient(160deg,${a},${b})`;

const templates: Template[] = [
  { id: "1", title: "Myth → mechanism", format: "Carousel", slides: 8, hook: "Question", art: g("#f6d5c4", "#c98f74"), category: "Educational", popular: true },
  { id: "2", title: "Failed solution", format: "Carousel", slides: 7, hook: "Confession", art: g("#2a2a2a", "#151515"), category: "Story" },
  { id: "3", title: "Before / after, honestly", format: "Carousel", slides: 6, hook: "Contrast", art: g("#d8e6c8", "#7f9d63"), category: "Proof", popular: true },
  { id: "4", title: "Old way vs. new way", format: "Carousel", slides: 8, hook: "Contrast", art: g("#e7d9f5", "#9b7fc4"), category: "Contrast" },
  { id: "5", title: "Three things nobody says", format: "Carousel", slides: 5, hook: "List", art: g("#fbe3c9", "#d59a5c"), category: "Listicle" },
  { id: "6", title: "Review, unpacked", format: "Carousel", slides: 6, hook: "Quote", art: g("#cfe3f5", "#6d97c2"), category: "Proof" },
  { id: "7", title: "Day 1 → day 30", format: "Carousel", slides: 8, hook: "Timeline", art: g("#f2d2dc", "#c66f8c"), category: "Story" },
  { id: "8", title: "The mirror moment", format: "Carousel", slides: 6, hook: "Scene", art: g("#e6dcd0", "#a08b74"), category: "Story" },
];

const categories = ["All", "Educational", "Story", "Proof", "Contrast", "Listicle"] as const;

export function TemplatesDemo() {
  const [cat, setCat] = useState<(typeof categories)[number]>("All");
  const [kind, setKind] = useState<"carousels" | "static">("carousels");
  const [using, setUsing] = useState<Template | null>(null);
  const shown = cat === "All" ? templates : templates.filter((t) => t.category === cat);

  return (
    <Page wide>
      <PageHeader
        eyebrow="Patterns"
        title="Templates"
        lede="The shortcut around the chat. A template is a brief with the blanks left in — format, slide structure, hook shape. Using one opens a short form and hands the result to the model. The grid is the reference's templates browser on our primitives, which is why it looks like the Parity page."
        note="Composed from: Thumbnail, TextTab, Chip, SearchInput, Badge, Dialog, Select, RadioGroup, Stepper, Field."
      />

      <Section title="The surface" rule="Search, kind tabs, category chips, grid. Hovering a template shows the one action. That action opens the brief form.">
        <AppFrame active="templates">
          <AppHeader crumbs={["Templates"]} />
          <div className="flex flex-col gap-4 px-6 pb-6">
            <div className="flex items-end justify-between gap-4">
              <div className="flex items-center gap-5">
                <TextTab active={kind === "carousels"} onClick={() => setKind("carousels")}>
                  Carousels
                </TextTab>
                <TextTab active={kind === "static"} onClick={() => setKind("static")}>
                  Static
                </TextTab>
              </div>
              <SearchInput placeholder="Search templates" leading={<Search />} className="h-9 w-[320px] bg-field" />
            </div>
            <ChipRow>
              {categories.map((c) => (
                <Chip key={c} selected={cat === c} onClick={() => setCat(c)} className="h-7 px-3 text-cap">
                  {c}
                </Chip>
              ))}
            </ChipRow>
            <TemplateGrid templates={shown} onUse={setUsing} />
          </div>
        </AppFrame>
        <BriefFromTemplateDialog
          template={using}
          onClose={() => setUsing(null)}
          personas={[
            { value: "p1", label: "The Burned Professional", detail: "28–35, tried harsh prescriptions" },
            { value: "p2", label: "The Bride", detail: "25–35, wedding in 6 months" },
            { value: "p4", label: "The Skeptic", detail: "Burned by miracle serums" },
          ]}
          angles={[
            { value: "a1", label: "Your dermatologist wrecked your skin", detail: "New mechanism" },
            { value: "a2", label: "Your wedding photos last forever", detail: "Fear / warning" },
            { value: "a3", label: "Why what you've tried keeps failing", detail: "Failed solution" },
          ]}
        />
      </Section>

      <Section title="Template → brief" rule="Four fields, all Controls primitives, and one spectrum action. The form promises what it costs — about forty seconds of model time — so the user knows what the ring means before pressing it.">
        <p className="text-default text-ink-secondary">Hover a template above and press “Use template” to open it.</p>
      </Section>
    </Page>
  );
}
