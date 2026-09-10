"use client";

import { Columns3, Filter, List, Plus, Sparkles } from "lucide-react";
import { useState } from "react";

import { Board, BriefCard, stages, type Brief } from "@/components/patterns/board";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip, ChipRow } from "@/components/ui/chip";
import { Illustration } from "@/components/ui/imagery";
import { SegmentedControl } from "@/components/ui/segmented";
import { Table, TableBody, TableHead, Td, Th, Tr } from "@/components/ui/table";

import { AppFrame, AppHeader } from "../_app-shell";
import { Page, PageHeader, Section } from "../_doc";

const art = {
  a: "linear-gradient(160deg,#f6d5c4,#c98f74)",
  b: "linear-gradient(160deg,#2a2a2a,#151515)",
  c: "linear-gradient(160deg,#d8e6c8,#7f9d63)",
  d: "linear-gradient(160deg,#e7d9f5,#9b7fc4)",
  e: "linear-gradient(160deg,#fbe3c9,#d59a5c)",
};

const briefs: Brief[] = [
  { id: "1", stage: "ideas", title: "What your derm didn't say about barriers", persona: "Burned Professional", awareness: "Product-aware", format: "Carousel", ai: true },
  { id: "2", stage: "ideas", title: "The 7am mirror, honestly", persona: "Burned Professional", awareness: "Problem-aware", format: "Carousel", ai: true },
  { id: "3", stage: "ideas", title: "Six months out: the skin timeline", persona: "Bride", awareness: "Solution-aware", format: "Carousel" },
  { id: "4", stage: "briefed", title: "Why does your prescription burn more than your acne?", persona: "Burned Professional", awareness: "Problem-aware", format: "Carousel", slides: 8 },
  { id: "5", stage: "briefed", title: "The mirror test", persona: "Burned Professional", awareness: "Problem-aware", format: "Carousel", slides: 6 },
  { id: "6", stage: "generating", title: "Your wedding photos last forever", persona: "Bride", awareness: "Solution-aware", format: "Carousel", slides: 8, progress: 5, thumbnails: [art.d, art.a, art.b, art.b] },
  { id: "7", stage: "review", title: "Prescription vs. barrier — v2", persona: "Burned Professional", awareness: "Problem-aware", format: "Carousel", slides: 8, flags: 1, thumbnails: [art.a, art.d, art.c, art.e] },
  { id: "8", stage: "scheduled", title: "Three things a barrier cream can't do", persona: "Skeptic", awareness: "Solution-aware", format: "Carousel", slides: 7, date: "Thu 14", thumbnails: [art.c, art.e, art.a, art.b] },
];

export function BoardDemo() {
  const [view, setView] = useState<"board" | "list">("board");
  const [persona, setPersona] = useState<string | null>(null);
  const shown = persona ? briefs.filter((b) => b.persona === persona) : briefs;

  return (
    <Page wide>
      <PageHeader
        eyebrow="Patterns"
        title="Board"
        lede="Briefs moving from idea to scheduled post. Columns are the product's pipeline and never change; every card is the same BriefCard whether a person or the model wrote it. The list view is the same data in a Table."
        note="Composed from: SegmentedControl, Chip, Button, Badge, Progress, Table, EmptyState / Illustration."
      />

      <Section title="The surface" rule="Header carries the view switch, filters and the two ways to add work — by hand, or by asking the model for a batch.">
        <AppFrame active="board">
          <AppHeader crumbs={["Board", "Vitamin C — Q4"]}>
            <SegmentedControl
              size="sm"
              value={view}
              onChange={setView}
              options={[
                { value: "board", label: "Board", icon: <Columns3 /> },
                { value: "list", label: "List", icon: <List /> },
              ]}
            />
            <Button variant="ghost" size="sm">
              <Filter /> Filter
            </Button>
            <Button size="sm">
              <Plus /> New brief
            </Button>
            <Button variant="spectrum" size="sm">
              <Sparkles /> Generate batch
            </Button>
          </AppHeader>

          <div className="flex items-center gap-3 px-5 pb-3">
            <ChipRow>
              <Chip selected={persona === null} onClick={() => setPersona(null)} className="h-7 px-3 text-cap">
                All personas
              </Chip>
              {["Burned Professional", "Bride", "Skeptic"].map((p) => (
                <Chip key={p} selected={persona === p} onClick={() => setPersona(p)} className="h-7 px-3 text-cap">
                  {p}
                </Chip>
              ))}
            </ChipRow>
            <span className="ml-auto text-cap text-ink-disabled">{shown.length} briefs</span>
          </div>

          <div className="flex-1 px-5 pb-5">
            {view === "board" ? (
              <Board briefs={shown} />
            ) : (
              <Table>
                <TableHead>
                  <Th>Brief</Th>
                  <Th>Stage</Th>
                  <Th>Persona</Th>
                  <Th>Awareness</Th>
                  <Th align="right">Slides</Th>
                </TableHead>
                <TableBody>
                  {shown.map((b) => (
                    <Tr key={b.id} onClick={() => {}}>
                      <Td className="max-w-[360px] truncate">{b.title}</Td>
                      <Td>
                        <Badge tone={b.stage === "scheduled" ? "positive" : b.stage === "review" ? "caution" : "neutral"}>{stages.find((s) => s.id === b.stage)?.label}</Badge>
                      </Td>
                      <Td muted>{b.persona}</Td>
                      <Td muted>{b.awareness}</Td>
                      <Td align="right">{b.slides ?? "—"}</Td>
                    </Tr>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </AppFrame>
      </Section>

      <Section title="The card" rule="Title, persona × awareness, format. Artwork appears once slides exist and is the only colour. Generating shows a spectrum progress bar; review shows the flag count; scheduled shows the date.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <BriefCard brief={briefs[0]} />
          <BriefCard brief={briefs[3]} />
          <BriefCard brief={briefs[5]} />
          <BriefCard brief={briefs[6]} />
        </div>
      </Section>

      <Section title="Empty board" rule="One sentence about what will appear, and the one action that makes it appear. The columns are already there so the shape of the work is visible before any work exists.">
        <AppFrame active="board" className="min-h-[380px]">
          <AppHeader crumbs={["Board", "New product"]} />
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5 pb-8 text-center">
            <Illustration name="empty-board" />
            <div className="flex flex-col gap-1">
              <p className="text-panels text-ink">No briefs yet</p>
              <p className="max-w-sm text-default text-ink-secondary">Ask for a strategy in chat, or pick a template. The first batch lands in Ideas.</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm">Browse templates</Button>
              <Button variant="spectrum" size="sm">
                <Sparkles /> Suggest ideas
              </Button>
            </div>
          </div>
        </AppFrame>
      </Section>
    </Page>
  );
}
