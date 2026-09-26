import { ArrowDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import { Page, PageHeader, Section } from "../_doc";

export const metadata = {
  title: "Hierarchy · Contently design",
};

const layers: {
  name: string;
  path: string;
  role: string;
  mayImport: string;
  examples: string;
}[] = [
  {
    name: "Tokens",
    path: "app/globals.css",
    role: "Every colour, radius, type role, shadow, motion curve and z-index. CSS custom properties exposed as Tailwind utilities.",
    mayImport: "nothing",
    examples: "bg-panel · text-cap · rounded-control · shadow-overlay · --z-modal",
  },
  {
    name: "Primitives",
    path: "components/ui/*",
    role: "Single-purpose elements with variants and no knowledge of the product. Mobbin's Control, View, Overlay and Imagery categories all live here.",
    mayImport: "tokens · other primitives",
    examples: "Button · Input · Chip · Badge · Dialog · Menu · Popover · Avatar",
  },
  {
    name: "Patterns",
    path: "components/patterns/*",
    role: "Compositions that know what a persona or an artifact is. Built only from primitives. One folder per product surface.",
    mayImport: "tokens · primitives · other patterns",
    examples: "Composer · ContextPill · ArtifactCard · CoverageMatrix · BriefCard",
  },
  {
    name: "Surfaces",
    path: "app/**",
    role: "Routes. They fetch data, hold state and arrange patterns. They add layout, never style.",
    mayImport: "anything",
    examples: "/chat · /ideas · /content · /calendar · /documents · /editor",
  },
];

const rules: [string, string][] = [
  [
    "A layer imports downward only.",
    "Primitives never import patterns; patterns never import from app. The lint rule below fails the build if they do.",
  ],
  [
    "Buttons in a dialog are Button.",
    "A composite renders the primitive with a variant. It may set size and variant; it may not restyle. If a variant is missing, add it to the primitive so every surface gets it.",
  ],
  [
    "Colour comes from tokens, never from a literal.",
    "No hex values or arbitrary Tailwind colours outside globals.css. A new colour is a new token with a name and a rule for when it is used.",
  ],
  [
    "One component per concept.",
    "Not ChatButton and BoardButton. Not a second chip because the composer wanted a pill — ContextPill is a different concept (it changes what the model knows), which is why it exists.",
  ],
  [
    "Variants over wrappers.",
    "If two surfaces need the same element to look slightly different, that is a variant on the primitive, not a wrapper in each surface.",
  ],
  [
    "className is for layout.",
    "Consumers may pass margin, width and grid placement. If a consumer is passing colour or radius, the primitive is missing a variant.",
  ],
  [
    "Patterns are the unit of product design.",
    "When a designer asks 'what does a brief look like in Ideas', the answer is a pattern, documented here, used by exactly one surface.",
  ],
];

export default function HierarchyPage() {
  return (
    <Page>
      <PageHeader
        title="Hierarchy"
        lede="Four layers, each allowed to import only from the layers beneath it. The rule is what keeps a button in a modal the same button as the one on the page — and it is enforced by the linter, not by convention."
        note="This is the standard atomic-design shape reduced to what a small team can hold in their head: tokens, primitives, patterns, surfaces. There is no 'organisms' layer because in practice it becomes a dumping ground."
      />

      <Section
        id="layers"
        title="The four layers"
        rule="Read top to bottom as 'is built from'. A surface is built from patterns, a pattern from primitives, a primitive from tokens."
      >
        <div className="flex flex-col gap-1.5">
          {[...layers].reverse().map((l, i) => (
            <div key={l.name} className="flex flex-col gap-1.5">
              <div className="grid gap-x-6 gap-y-1 rounded-[var(--radius-overlay)] bg-panel p-5 sm:grid-cols-[160px_1fr]">
                <div className="flex flex-col gap-1">
                  <span className="text-titles text-ink">{l.name}</span>
                  <span className="font-mono text-cap text-ink-disabled">{l.path}</span>
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-default text-ink-secondary">{l.role}</p>
                  <p className="text-cap text-ink-disabled">
                    <span className="text-ink-secondary">May import:</span> {l.mayImport}
                  </p>
                  <p className="font-mono text-cap text-ink-disabled">{l.examples}</p>
                </div>
              </div>
              {i < layers.length - 1 ? (
                <ArrowDown className="mx-auto size-4 text-ink-disabled" />
              ) : null}
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="rules"
        title="Rules"
        rule="Each rule exists because breaking it has a specific, observed cost. They are ordered by how often they are broken."
      >
        <ol className="flex flex-col divide-y divide-line">
          {rules.map(([title, body], i) => (
            <li key={title} className="grid gap-x-6 gap-y-1 py-4 sm:grid-cols-[32px_1fr]">
              <span className="font-mono text-cap text-ink-disabled">{String(i + 1).padStart(2, "0")}</span>
              <div className="flex flex-col gap-1">
                <span className="text-default text-ink">{title}</span>
                <p className="text-default text-ink-secondary">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        id="enforcement"
        title="Enforcement"
        rule="Convention decays. Three mechanisms keep the layers honest without anyone having to remember them."
      >
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            [
              "Import boundaries",
              "eslint.config.mjs",
              "no-restricted-imports per directory: components/ui may not import patterns or app; components/patterns may not import app. Runs in `npm run lint` and CI.",
            ],
            [
              "Class merging",
              "lib/cn.ts",
              "tailwind-merge knows the custom type and radius groups, so a consumer's className can override layout without producing two conflicting classes.",
            ],
            [
              "One proving ground",
              "/design",
              "Every element renders here in every state before it is used anywhere. If it is not on these pages it does not exist.",
            ],
          ].map(([title, where, body]) => (
            <div key={title} className="flex flex-col gap-2 rounded-[var(--radius-overlay)] bg-panel p-5">
              <span className="text-default text-ink">{title}</span>
              <span className="font-mono text-cap text-ink-disabled">{where}</span>
              <p className="text-cap leading-4 text-ink-secondary">{body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="adding"
        title="Adding an element"
        rule="The checklist for a new primitive or pattern. Most of it is deciding which layer it belongs to."
      >
        <ol className="flex flex-col gap-2.5">
          {[
            ["Name the concept, not the place.", "ContextPill, not ComposerChip."],
            ["Pick the layer.", "Does it know what a persona is? Pattern. Otherwise primitive."],
            ["Check Mobbin's taxonomy.", "If it maps to an existing category, it goes in that nav group with that name."],
            ["Write the rule first.", "One paragraph: what it is for, what it is not for, and the one thing that would make it look wrong."],
            ["Render every state on /design.", "Rest, hover, focus, active, disabled, loading, empty, error, overflow."],
            ["Compose, don't restyle.", "If you had to pass a colour class to a primitive, stop and add a variant."],
          ].map(([t, b], i) => (
            <li key={t} className="flex items-start gap-3">
              <Badge dot={false} className="mt-0.5 shrink-0">
                {i + 1}
              </Badge>
              <p className="text-default text-ink-secondary">
                <span className="text-ink">{t}</span> {b}
              </p>
            </li>
          ))}
        </ol>
      </Section>
    </Page>
  );
}
