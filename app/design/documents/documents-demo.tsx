"use client";

import { useMemo, useState } from "react";

import { DocEditor } from "@/components/patterns/editor";
import {
  BrandCard,
  DocArtifactCard,
  DocTable,
  FreshnessPill,
  OwnerMark,
  PendingDiffPanel,
  QuickFilters,
  ReviewCard,
  StatusPill,
  TypeIcon,
} from "@/components/patterns/documents";
import { Badge } from "@/components/ui/badge";
import { docTypes, statusLabels } from "@/lib/documents/registry";
import { buildSeed } from "@/lib/documents/seed";
import type { DocStatus, DocType, Document } from "@/lib/documents/types";

import { Page, PageHeader, Row, Section } from "../_doc";

/*
  The document layer, laid out as a system rather than as an app: the marks,
  the list, the cards, the body, and the agent's two ways of talking about a
  document. Everything here is drawn from the same seed the product runs on,
  so this page is also the quickest way to see what a type looks like filled.
*/

const noop = () => undefined;

const types: DocType[] = ["brand_core", "product_facts", "visual_system", "research_snapshot", "persona", "content_strategy", "brief"];
const statuses: DocStatus[] = ["draft", "in_review", "active", "published", "generating", "archived"];

export function DocumentsDemo() {
  const now = useMemo(() => new Date(), []);
  const seed = useMemo(() => buildSeed(now), [now]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const byId = (id: string) => seed.docs.find((d) => d.id === id)!;
  const persona = byId("doc_persona_p1");
  const productFacts = byId("doc_product_facts");
  const brief = seed.docs.find((d) => d.type === "brief")!;
  const research = seed.docs.filter((d) => d.type === "research_snapshot").slice(0, 3);
  const tableDocs = [...research, persona, byId("doc_strategy_ig"), brief];

  const freshnessSamples: Document[] = [
    { ...persona, freshness: { kind: "verified", until: new Date(now.getTime() + 40 * 864e5).toISOString() } },
    { ...persona, freshness: { kind: "expired", until: new Date(now.getTime() - 3 * 864e5).toISOString() } },
    { ...persona, freshness: { kind: "outdated", note: "Pricing changed in September", by: "user" } },
    { ...persona, freshness: { kind: "refresh_requested", at: now.toISOString() } },
    { ...persona, freshness: { kind: "unverified" } },
  ];

  const review = {
    title: "Pick the hook; I'll write the rest around it",
    fields: [],
    choices: ["3 things to do at 9:40pm that aren't your phone", "the kit that did not stay with the kids", "twenty minutes. no oven. done tonight."],
    chosen: null,
    resolved: false,
  };

  return (
    <Page>
      <PageHeader
        eyebrow="Patterns"
        title="Documents"
        lede="Seven document types, one anatomy. A document is Markdown with frontmatter to the agent and a Tiptap body to the person; the patterns below are the marks, lists, cards and editor that make both true at once."
        note="Drawn from the Terra Clays seed. Status and freshness are separate axes on purpose: a document can be active and expired."
      />

      <Section id="marks" title="Marks" rule="Type is a glyph on a muted hue and appears nowhere else — never on text. Status is a Badge. Freshness only exists on living documents, and reads as quiet text until something is wrong.">
        <Row label="Type">
          {types.map((t) => (
            <span key={t} className="inline-flex items-center gap-2 text-cap text-ink-secondary">
              <TypeIcon type={t} /> {docTypes[t].label}
            </span>
          ))}
        </Row>
        <Row label="Status">
          {statuses.map((s) => (
            <StatusPill key={s} status={s} />
          ))}
        </Row>
        <Row label="Freshness">
          {freshnessSamples.map((d, i) => (
            <FreshnessPill key={i} doc={d} now={now} />
          ))}
        </Row>
        <Row label="Owner">
          <OwnerMark doc={persona} withName />
          <OwnerMark doc={{ ...persona, createdBy: "user", owner: "Hannah M" }} withName />
        </Row>
      </Section>

      <Section id="list" title="List" rule="Stage 0. Quick filters answer the four questions people actually ask of a library — what needs me, what is stale, what is running, what is unused. The table groups by type by default so seven kinds read as one system with a key.">
        <QuickFilters counts={{ needs_review: 2, stale: 1, generating: 0, unused: 3 }} active={["needs_review"]} onToggle={noop} />
        <DocTable
          docs={tableDocs}
          allDocs={seed.docs}
          relations={seed.relations}
          now={now}
          groupBy="type"
          selected={selected}
          onSelectedChange={setSelected}
          actions={{ onOpen: noop, onPeek: noop, onChat: noop }}
        />
      </Section>

      <Section id="brand" title="Brand cards" rule="The Brand tab is three cards, not a table, because there are exactly three and each is always-on context. The card shows the section outline so a glance says whether the document is filled, and carries Verify and Refresh because freshness is the whole job here.">
        <div className="grid gap-4 md:grid-cols-2">
          <BrandCard type="product_facts" doc={productFacts} now={now} onOpen={noop} onCreate={noop} onRefresh={noop} onVerify={noop} />
          <BrandCard type="visual_system" doc={undefined} now={now} onOpen={noop} onCreate={noop} onRefresh={noop} onVerify={noop} />
        </div>
      </Section>

      <Section id="body" title="Body" rule="One Tiptap editor draws the document read-only and editable, so nothing moves when Edit is switched on. Headings carry ids for the contents rail and for agent patches; Angle, Pillar and Hypothesis are blocks with stable anchors other documents can point at; citations and mentions are chips that resolve on hover.">
        <div className="rounded-nav bg-canvas p-8">
          <DocEditor
            body={{ type: "doc", content: persona.body.content.slice(0, 14) }}
            revision={0}
            editable={false}
            citations={seed.citations}
            mentionables={seed.docs.map((d) => ({ id: d.id, label: d.title.split(" — ")[0], detail: docTypes[d.type].label, type: d.type, hue: docTypes[d.type].hue }))}
            onAskAbout={noop}
          />
        </div>
      </Section>

      <Section id="agent" title="Agent turns" rule="The agent's three utterances about a document. A review card asks one structured question before writing. An artifact card is the document appearing in the thread. A pending diff is a living document's proposed change, accepted or rejected per section — the agent never overwrites Brand.">
        <div className="grid gap-4 lg:grid-cols-2">
          <ReviewCard review={review} onResolve={noop} />
          <div className="flex flex-col gap-3">
            <DocArtifactCard doc={brief} onOpen={noop} />
            <DocArtifactCard doc={{ ...brief, status: "generating" }} active onOpen={noop} />
          </div>
        </div>
        {productFacts.pendingDiff ? <PendingDiffPanel doc={productFacts} diff={productFacts.pendingDiff} now={now} onResolve={noop} onResolveAll={noop} /> : null}
      </Section>

      <Section id="vocabulary" title="Vocabulary" rule="Words the surfaces share. Each maps to one field on the document, and each is used the same way in the list, the rail, the Ask modal and the agent's messages.">
        <dl className="grid gap-x-8 gap-y-3 text-default sm:grid-cols-[max-content_1fr]">
          {(
            [
              ["Living", "Brand Core, Product Facts, Visual System, Persona, Strategy. Has freshness; refreshed by diff."],
              ["Snapshot", "Research and Brief. Dated evidence or a dated plan; never refreshed, only superseded."],
              ["Anchor", "A heading id or block id. What a relation, a citation or a patch points at."],
              ["Patch", "The agent rewrote one section. Highlighted for a moment, versioned, undoable."],
              ["Pending diff", "A proposed change to a living document, waiting for a person."],
              ["Agent view", "The document as the skills read it: frontmatter plus Markdown."],
            ] as const
          ).map(([term, def]) => (
            <div key={term} className="contents">
              <dt className="text-ink">{term}</dt>
              <dd className="text-ink-secondary">{def}</dd>
            </div>
          ))}
        </dl>
        <Row label="Statuses">
          {statuses.map((s) => (
            <Badge key={s}>{statusLabels[s]}</Badge>
          ))}
        </Row>
      </Section>
    </Page>
  );
}
