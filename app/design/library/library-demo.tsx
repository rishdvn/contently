"use client";

import { Download, FolderPlus, MessageSquare, Search, Trash2, Upload, X } from "lucide-react";
import { useState } from "react";

import { AssetWall, assetSources, type Asset } from "@/components/patterns/library";
import { Button, IconButton } from "@/components/ui/button";
import { Chip, ChipRow } from "@/components/ui/chip";
import { Illustration } from "@/components/ui/imagery";
import { SearchInput } from "@/components/ui/input";
import { Toolbar, ToolbarDivider } from "@/components/ui/toolbar";

import { AppFrame, AppHeader } from "../_app-shell";
import { Page, PageHeader, Section } from "../_doc";

const g = (a: string, b: string) => `linear-gradient(160deg,${a},${b})`;

const assets: Asset[] = [
  { id: "1", title: "Serum on marble", ratio: "4:5", art: g("#f6d5c4", "#c98f74"), source: "product", meta: "Sept shoot · 1080×1350" },
  { id: "2", title: "Maya, day 30", ratio: "9:16", art: g("#d8e6c8", "#7f9d63"), source: "ugc", meta: "Consented · 15s still" },
  { id: "3", title: "Prescription vs. barrier — slide 1", ratio: "4:5", art: g("#e7d9f5", "#9b7fc4"), source: "generated", meta: "From brief · v2" },
  { id: "4", title: "Before / after 07", ratio: "1:1", art: g("#fbe3c9", "#d59a5c"), source: "before-after", meta: "Consented" },
  { id: "5", title: "Texture macro", ratio: "16:9", art: g("#cfe3f5", "#6d97c2"), source: "product" },
  { id: "6", title: "Wordmark on bone", ratio: "1:1", art: g("#efe9e1", "#cfc6b8"), source: "brand" },
  { id: "7", title: "The mirror test — slide 3", ratio: "4:5", art: g("#f2d2dc", "#c66f8c"), source: "generated" },
  { id: "8", title: "Bathroom shelf, morning", ratio: "9:16", art: g("#e6dcd0", "#a08b74"), source: "ugc" },
  { id: "9", title: "Bottle, top-down", ratio: "1:1", art: g("#2a2a2a", "#151515"), source: "product" },
  { id: "10", title: "Before / after 12", ratio: "4:5", art: g("#dfe7d3", "#8fa07a"), source: "before-after" },
  { id: "11", title: "Barrier diagram", ratio: "16:9", art: g("#d9d3f0", "#7d74b5"), source: "generated" },
  { id: "12", title: "Palette swatches", ratio: "4:5", art: g("#f1e3d9", "#b9977f"), source: "brand" },
];

export function LibraryDemo() {
  const [filter, setFilter] = useState<(typeof assetSources)[number]["id"]>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const shown = filter === "all" ? assets : assets.filter((a) => a.source === filter);
  const toggle = (a: Asset) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(a.id)) n.delete(a.id);
      else n.add(a.id);
      return n;
    });

  return (
    <Page wide>
      <PageHeader
        eyebrow="Patterns"
        title="Library"
        lede="Every asset the brand owns and everything the model has made, on one wall. A masonry rather than a grid because assets come in every ratio and cropping is the one thing a library must not do. Chrome appears on hover; selection is a ring; the only persistent mark is the spectrum badge on generated work."
        note="Composed from: Thumbnail, Chip, SearchInput, Button, Toolbar (selection bar), Badge, Illustration."
      />

      <Section title="The surface" rule="Search and source filters up top, the wall below. Selecting one tile puts the wall in selection mode and floats a toolbar with what you can do to many at once.">
        <AppFrame active="library">
          <AppHeader crumbs={["Library", "Glow Labs"]}>
            <Button variant="ghost" size="sm">
              <FolderPlus /> New collection
            </Button>
            <Button size="sm">
              <Upload /> Upload
            </Button>
          </AppHeader>
          <div className="flex flex-wrap items-center gap-3 px-5 pb-4">
            <SearchInput placeholder="Search assets" leading={<Search />} className="h-8 w-[280px] bg-field text-cap" />
            <ChipRow>
              {assetSources.map((s) => (
                <Chip key={s.id} selected={filter === s.id} onClick={() => setFilter(s.id)} className="h-7 px-3 text-cap">
                  {s.label}
                </Chip>
              ))}
            </ChipRow>
            <span className="ml-auto text-cap text-ink-disabled">{shown.length} assets</span>
          </div>
          <div className="relative flex-1 px-5 pb-5">
            <AssetWall assets={shown} selected={selected} onToggle={toggle} />
            {selected.size ? (
              <div className="pointer-events-none sticky bottom-4 flex justify-center pt-4">
                <Toolbar className="pointer-events-auto">
                  <span className="px-2 text-cap text-ink tabular-nums">{selected.size} selected</span>
                  <ToolbarDivider />
                  <Button variant="ghost" size="sm">
                    <MessageSquare /> Attach to chat
                  </Button>
                  <Button variant="ghost" size="sm">
                    <FolderPlus /> Collection
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Download /> Download
                  </Button>
                  <ToolbarDivider />
                  <IconButton aria-label="Delete" size="sm" className="text-critical hover:text-critical">
                    <Trash2 />
                  </IconButton>
                  <IconButton aria-label="Clear selection" size="sm" onClick={() => setSelected(new Set())}>
                    <X />
                  </IconButton>
                </Toolbar>
              </div>
            ) : null}
          </div>
        </AppFrame>
      </Section>

      <Section title="Empty library" rule="Two ways in: upload, or let the model pull from a connected source. Generated work arrives here on its own once the first carousel renders.">
        <AppFrame active="library" className="min-h-[360px]">
          <AppHeader crumbs={["Library", "New workspace"]} />
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5 pb-8 text-center">
            <Illustration name="empty-library" />
            <div className="flex flex-col gap-1">
              <p className="text-panels text-ink">Nothing on the wall yet</p>
              <p className="max-w-sm text-default text-ink-secondary">Upload product photography and UGC, or connect a folder. Generated slides land here automatically.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm">
                Connect a folder
              </Button>
              <Button variant="primary" size="sm">
                <Upload /> Upload assets
              </Button>
            </div>
          </div>
        </AppFrame>
      </Section>
    </Page>
  );
}
