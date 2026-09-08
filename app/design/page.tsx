import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { Page, PageHeader, Section } from "./_doc";

export const metadata = {
  title: "Tokens · Contently design",
};

const surfaceTokens = [
  ["canvas", "#0a0909", "Page background. Near-black, very slightly warm."],
  ["panel", "#151515", "Persistent chrome: rails, toolbars, docked panels."],
  ["field", "#1e1e1e", "Text inputs at rest."],
  ["card", "#1d1d1d", "Content containers in a grid."],
  ["raised", "#252525", "Chips, secondary fills — also the divider value."],
  ["line-strong", "#3a3a3a", "Hairline where a border is unavoidable."],
];

const stateTokens = [
  ["--state-hover", "white / 8%", "Hover on any surface."],
  ["--state-selected", "white / 16%", "Active nav item, current tab."],
  ["--state-focus", "white / 12%", "Keyboard focus fill."],
];

const inkTokens = [
  ["ink", "#f5f5f5", "Primary text and icons."],
  ["ink-secondary", "#a1a1aa", "Supporting copy, inactive labels."],
  ["ink-disabled", "#52525b", "Placeholders, inactive tabs, non-interactive text."],
];

const spectrumTokens = [
  ["spectrum-green", "#6ee86e"],
  ["spectrum-amber", "#ffd84d"],
  ["spectrum-orange", "#ff9a3c"],
];

const typeScale = [
  ["text-hero", "36 / 40", "Marketing and empty-canvas moments only"],
  ["text-sections", "24 / 30", "Page title, once per screen"],
  ["text-titles", "18 / 25", "Card title, tab, modal heading"],
  ["text-panels", "16 / 22", "Panel heading"],
  ["text-body", "16 / 24", "Inherited default and navigation — the one role tracked 0.2px"],
  ["text-default", "14 / 20", "Body and button labels"],
  ["text-ui", "13 / 18", "Dense UI text"],
  ["text-cap", "12 / 16", "Metadata, field labels, hints"],
  ["text-tiny", "11 / 14", "Badges, rail labels"],
];

const radii = [
  ["rounded-control", "10px", "Buttons, inputs, chips, menu"],
  ["rounded-nav", "12px", "Nav items, panel surfaces"],
  ["rounded-pill", "14px", "Search field, floating toolbar"],
  ["radius-overlay", "20px", "Dialogs, drawers, popovers, composer, artifact cards"],
  ["rounded-card", "32px", "Content cards in a grid"],
];

export default function TokensPage() {
  return (
    <Page>
      <PageHeader
        title="Tokens"
        lede="The interface is monochrome so that the only colour on screen belongs to the user's work. One chromatic mark exists — a gradient ring — and it is spent exclusively on the moment the model acts on your behalf."
        note="Values are taken from the reference product's own published token set rather than sampled from screenshots. The full capture lives in docs/butter-tokens.txt."
      />

      <Section
        id="surfaces"
        title="Surfaces"
        rule="There are really only two surfaces — canvas and panel — and a scale of white overlays on top of them. The named values below are those composites, kept as tokens for ergonomics. Elevation is lightness; shadow is reserved for things that float free of the layout."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {surfaceTokens.map(([name, hex, use]) => (
            <div key={name} className="flex items-center gap-3 rounded-control bg-panel p-2.5">
              <div className="size-10 shrink-0 rounded-control" style={{ backgroundColor: hex }} />
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-default">{name}</span>
                  <span className="font-mono text-cap text-ink-disabled">{hex}</span>
                </div>
                <p className="truncate text-cap text-ink-secondary">{use}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1 pt-1">
          {stateTokens.map(([name, value, use]) => (
            <div key={name} className="flex flex-wrap items-baseline gap-3 py-0.5">
              <span className="w-44 shrink-0 font-mono text-cap text-ink">{name}</span>
              <span className="w-24 shrink-0 font-mono text-cap text-ink-disabled">{value}</span>
              <span className="text-cap text-ink-secondary">{use}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="ink"
        title="Ink"
        rule="Three steps. Secondary and disabled are very slightly cool rather than pure neutral, which keeps grey text from looking muddy against a warm-black canvas."
      >
        <div className="flex flex-col gap-1">
          {inkTokens.map(([name, hex, use]) => (
            <div key={name} className="flex flex-wrap items-baseline gap-3 py-1">
              <span className="w-32 shrink-0 text-panels" style={{ color: hex }}>
                {name}
              </span>
              <span className="w-20 shrink-0 font-mono text-cap text-ink-disabled">{hex}</span>
              <span className="text-default text-ink-secondary">{use}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="spectrum"
        title="The spectrum"
        rule="A single gradient, and almost always a ring rather than a fill. It marks generative actions and their results — the button that briefs the model, the bar while it works, the badge on what it produced, the mark beside what it says. If it appears twice on a screen, one of them is wrong."
      >
        <div className="flex flex-col gap-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <div className="h-20 rounded-card" style={{ backgroundImage: "var(--gradient-spectrum-outline)" }} />
              <span className="font-mono text-cap text-ink-disabled">
                --gradient-spectrum-outline &middot; conic, 1.5px ring
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="h-20 rounded-card" style={{ backgroundImage: "var(--gradient-spectrum-fill)" }} />
              <span className="font-mono text-cap text-ink-disabled">
                --gradient-spectrum-fill &middot; 45°, bars and text
              </span>
            </div>
          </div>
          <p className="max-w-2xl text-cap text-ink-secondary">
            The ring is conic, not linear, and two of its sectors are pure white. That is what
            makes it read as light catching a metal edge rather than as a rainbow.
          </p>
          <div className="flex flex-wrap gap-2">
            {spectrumTokens.map(([name, hex]) => (
              <div key={name} className="flex items-center gap-2 rounded-control bg-raised px-2.5 py-1.5">
                <span className="size-3 rounded-full" style={{ backgroundColor: hex }} />
                <span className="text-cap">{name}</span>
                <span className="font-mono text-cap text-ink-disabled">{hex}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="spectrum" size="lg">
              <Sparkles /> Generate carousel
            </Button>
            <Badge tone="spectrum">AI draft</Badge>
            <span className="spectrum-text text-titles">Spectrum text</span>
          </div>
        </div>
      </Section>

      <Section
        id="type"
        title="Type"
        rule="Nine named roles, all at regular weight, and every one of them tracked +0.8px. The loose tracking is the most characteristic thing about the typeface treatment — tightening it is the fastest way to stop looking like the reference."
      >
        <div className="flex flex-col divide-y divide-line">
          {typeScale.map(([cls, metrics, use]) => (
            <div key={cls} className="flex flex-wrap items-baseline gap-4 py-2.5">
              <span className={`${cls} w-64 shrink-0`}>Persona &times; angle</span>
              <span className="w-28 shrink-0 font-mono text-cap text-ink-disabled">{cls}</span>
              <span className="w-16 shrink-0 font-mono text-cap text-ink-disabled">{metrics}</span>
              <span className="text-cap text-ink-secondary">{use}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="radius"
        title="Radius"
        rule="Five steps, and the step tells you what kind of object you are looking at. Controls are 10, chrome is 12, anything that floats is 20, content cards are 32. Nothing in between."
      >
        <div className="flex flex-wrap gap-3">
          {radii.map(([name, px, use]) => (
            <div key={name} className="flex w-[196px] flex-col gap-2">
              <div
                className="h-20 bg-raised"
                style={{ borderRadius: px }}
              />
              <span className="font-mono text-cap text-ink">{name}</span>
              <span className="text-cap text-ink-secondary">
                {px} &middot; {use}
              </span>
            </div>
          ))}
        </div>
      </Section>
    </Page>
  );
}
