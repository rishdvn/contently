"use client";

import { useState } from "react";

import { ArtifactBlock, ArtifactDrawer, ArtifactStack, artifactKinds, type Artifact, type ArtifactKind } from "@/components/patterns/chat";
import { Doc, DocFacts, DocList, DocQuote, DocSection } from "@/components/patterns/docs/doc";
import { PersonaDoc } from "@/components/patterns/docs/persona-doc";
import { CoverageMatrix, StrategyDoc } from "@/components/patterns/docs/strategy-doc";
import { Button } from "@/components/ui/button";

import { Page, PageHeader, Row, Section } from "../_doc";
import { artifacts, burnedPersona, q4Strategy } from "../chat/data";

const order: ArtifactKind[] = ["persona", "angle", "strategy", "research", "brief", "carousel"];

export function ArtifactsDemo() {
  const [open, setOpen] = useState<Artifact | null>(null);

  return (
    <Page>
      <PageHeader
        eyebrow="Patterns"
        title="Artifacts"
        lede="What the model makes. Six kinds, one shape: a hairline block with a header that names the object and a body that previews it. The header opens the drawer; the drawer shows the document; the document is where editing starts."
        note="Kinds are declared once in the artifact registry (tool name → kind). The reducer, the block and the drawer all read from it."
      />

      <Section title="The block" rule="Header: kind icon, title, kind label, draft badge. Actions appear on hover. Body: summary and facts by default; briefs and carousels add a slide strip; a strategy shows its matrix.">
        <div className="grid gap-3 lg:grid-cols-2">
          {order.map((k) => {
            const a = Object.values(artifacts).find((x) => x.kind === k && x.status !== "generating")!;
            return (
              <ArtifactBlock
                key={k}
                artifact={a}
                onOpen={setOpen}
                onGenerate={() => {}}
                preview={
                  k === "strategy" ? (
                    <CoverageMatrix personas={q4Strategy.personas} pains={q4Strategy.pains} cells={q4Strategy.cells} compact />
                  ) : undefined
                }
              />
            );
          })}
        </div>
      </Section>

      <Section title="States" rule="Generating is the same block with a shimmer body, so the thread does not reflow when the result lands. Draft carries the spectrum badge — the only colour in the block — until a person accepts it.">
        <div className="grid gap-3 lg:grid-cols-3">
          <ArtifactBlock artifact={artifacts.generating} />
          <ArtifactBlock artifact={artifacts.burned} onOpen={setOpen} />
          <ArtifactBlock artifact={{ ...artifacts.burned, status: "ready" }} onOpen={setOpen} />
        </div>
        <Row label="Kinds">
          {order.map((k) => {
            const Icon = artifactKinds[k].icon;
            return (
              <span key={k} className="inline-flex items-center gap-1.5 text-cap text-ink-secondary">
                <Icon className="size-3.5" /> {artifactKinds[k].label}
              </span>
            );
          })}
        </Row>
      </Section>

      <Section title="A batch" rule="Several artifacts from one turn stack with a small gap and no wrapper. The count is in the prose above them, not in a group header.">
        <div className="max-w-[640px]">
          <ArtifactStack>
            <ArtifactBlock artifact={artifacts.brief} onOpen={setOpen} />
            <ArtifactBlock
              artifact={{ id: "b2", kind: "brief", title: "The mirror test", summary: "Carousel, 6 slides. Problem-aware; the 7am mirror as the moment of choice.", meta: ["Carousel", "6 slides", "Instagram"], status: "ready" }}
              onOpen={setOpen}
            />
            <ArtifactBlock artifact={artifacts.generating} />
          </ArtifactStack>
        </div>
      </Section>

      <Section title="The drawer" rule="Where a block opens. A drawer, not a page, because the conversation is the document's context; not a dialog, because most openings are a glance. Header and footer are fixed per kind; only the body changes.">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setOpen(artifacts.burned)}>Open persona</Button>
          <Button onClick={() => setOpen(artifacts.strategy)}>Open strategy</Button>
          <Button onClick={() => setOpen(artifacts.research)}>Open research</Button>
        </div>
        <ArtifactDrawer artifact={open} open={open !== null} onClose={() => setOpen(null)} onGenerate={() => setOpen(null)} generateLabel={open?.kind === "strategy" ? "Generate briefs" : "Draft angles"}>
          {open?.kind === "persona" ? <PersonaDoc data={burnedPersona} /> : null}
          {open?.kind === "strategy" ? <StrategyDoc data={q4Strategy} /> : null}
          {open?.kind === "research" ? (
            <Doc>
              <DocSection label="What we looked at">
                <DocFacts facts={[["Accounts", "Glossier, The Ordinary, Drunk Elephant"], ["Window", "Last 30 days"], ["Posts", "184"]]} />
              </DocSection>
              <DocSection label="Patterns">
                <DocList items={["Social proof carries 61% of posts — testimonials and creator duets.", "Before/after is 22% and almost entirely 'glow' framing.", "No one is running a new-mechanism angle. The gap is open."]} />
              </DocSection>
              <DocSection label="Representative line">
                <DocQuote>“My derm put me on tret and I&rsquo;ve never looked worse. Is this normal??” — 1.2k likes, r/SkincareAddiction</DocQuote>
              </DocSection>
            </Doc>
          ) : null}
        </ArtifactDrawer>
      </Section>

      <Section title="Document views" rule="Each kind has one document component built from the Doc primitives — section, quote, list, facts — so a new kind is a new arrangement, not new typography.">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-nav bg-panel p-6">
            <PersonaDoc data={burnedPersona} />
          </div>
          <div className="rounded-nav bg-panel p-6">
            <StrategyDoc data={q4Strategy} />
          </div>
        </div>
      </Section>
    </Page>
  );
}
