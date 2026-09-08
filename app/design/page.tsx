import type { ReactNode } from "react";
import {
  Blocks,
  Calendar,
  Compass,
  Images,
  LayoutTemplate,
  MoreHorizontal,
  Plus,
  Redo2,
  Search,
  Send,
  Sparkles,
  Type,
  Undo2,
  Users,
  Wand2,
} from "lucide-react";

import { Badge, Kbd } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Chip, ChipRow, TextTab } from "@/components/ui/chip";
import { EmptyState, GeneratingBar, Skeleton } from "@/components/ui/feedback";
import { Field, Input, SearchInput, Textarea } from "@/components/ui/input";
import { NavItem, RailItem, Sidebar, SidebarGroup } from "@/components/ui/nav";
import {
  SectionLabel,
  Surface,
  SurfaceBody,
  SurfaceHeader,
} from "@/components/ui/surface";
import { Toolbar, ToolbarDivider } from "@/components/ui/toolbar";

export const metadata = {
  title: "Design system · Contently",
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

function Section({
  title,
  rule,
  children,
}: {
  title: string;
  rule: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 border-t border-line pt-8">
      <header className="flex flex-col gap-1">
        <h2 className="text-titles text-ink">{title}</h2>
        <p className="max-w-2xl text-default text-ink-secondary">{rule}</p>
      </header>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="w-24 shrink-0 text-cap text-ink-disabled">{label}</span>
      {children}
    </div>
  );
}

export default function DesignSystemPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-8 py-12">
      <header className="flex flex-col gap-3">
        <SectionLabel>Contently</SectionLabel>
        <h1 className="text-sections">Design system</h1>
        <p className="max-w-2xl text-panels text-ink-secondary">
          The interface is monochrome so that the only colour on screen belongs to
          the user&rsquo;s work. One chromatic mark exists — a gradient ring — and
          it is spent exclusively on the moment the model acts on your behalf.
        </p>
        <p className="max-w-2xl text-cap text-ink-disabled">
          Values are taken from the reference product&rsquo;s own published token
          set rather than sampled from screenshots. The full capture lives in
          docs/butter-tokens.txt.
        </p>
        <nav className="flex flex-wrap items-center gap-2 pt-1">
          <a
            href="/design/overlays"
            className="rounded-control bg-raised px-3 py-1.5 text-cap text-ink hover:bg-line-strong"
          >
            Overlays &rarr;
          </a>
          <a
            href="/design/parity"
            className="rounded-control bg-raised px-3 py-1.5 text-cap text-ink hover:bg-line-strong"
          >
            Reference parity &rarr;
          </a>
        </nav>
      </header>

      <Section
        title="Surfaces"
        rule="There are really only two surfaces — canvas and panel — and a scale of white overlays on top of them. The named values below are those composites, kept as tokens for ergonomics. Elevation is lightness; shadow is reserved for things that float free of the layout."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {surfaceTokens.map(([name, hex, use]) => (
            <div key={name} className="flex items-center gap-3 rounded-control bg-panel p-2.5">
              <div
                className="size-10 shrink-0 rounded-control"
                style={{ backgroundColor: hex }}
              />
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
              <span className="w-24 shrink-0 font-mono text-cap text-ink-disabled">
                {value}
              </span>
              <span className="text-cap text-ink-secondary">{use}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Ink"
        rule="Three steps. Secondary and disabled are very slightly cool rather than pure neutral, which keeps grey text from looking muddy against a warm-black canvas."
      >
        <div className="flex flex-col gap-1">
          {inkTokens.map(([name, hex, use]) => (
            <div key={name} className="flex flex-wrap items-baseline gap-3 py-1">
              <span className="w-32 shrink-0 text-panels" style={{ color: hex }}>
                {name}
              </span>
              <span className="w-20 shrink-0 font-mono text-cap text-ink-disabled">
                {hex}
              </span>
              <span className="text-default text-ink-secondary">{use}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="The spectrum"
        rule="A single gradient, and almost always a ring rather than a fill. It marks generative actions and their results — the button that briefs the model, the bar while it works, the badge on what it produced. If it appears twice on a screen, one of them is wrong."
      >
        <div className="flex flex-col gap-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <div
                className="h-20 rounded-card"
                style={{ backgroundImage: "var(--gradient-spectrum-outline)" }}
              />
              <span className="font-mono text-cap text-ink-disabled">
                --gradient-spectrum-outline &middot; conic, 1.5px ring
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <div
                className="h-20 rounded-card"
                style={{ backgroundImage: "var(--gradient-spectrum-fill)" }}
              />
              <span className="font-mono text-cap text-ink-disabled">
                --gradient-spectrum-fill &middot; 45°, bars and text
              </span>
            </div>
          </div>
          <p className="max-w-2xl text-cap text-ink-secondary">
            The ring is conic, not linear, and two of its sectors are pure white.
            That is what makes it read as light catching a metal edge rather than
            as a rainbow — and it is why sampling a rendered button suggests a
            vertical gradient: green sits at the top of the sweep and both sides
            warm as they descend.
          </p>
          <div className="flex flex-wrap gap-2">
            {spectrumTokens.map(([name, hex]) => (
              <div
                key={name}
                className="flex items-center gap-2 rounded-control bg-raised px-2.5 py-1.5"
              >
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
        title="Type"
        rule="Eight named roles, all at regular weight, and every one of them tracked +0.8px. The loose tracking is the most characteristic thing about the typeface treatment — tightening it is the fastest way to stop looking like the reference."
      >
        <div className="flex flex-col divide-y divide-line">
          {typeScale.map(([cls, metrics, use]) => (
            <div key={cls} className="flex flex-wrap items-baseline gap-4 py-2.5">
              <span className={`${cls} w-64 shrink-0`}>Persona &times; angle</span>
              <span className="w-28 shrink-0 font-mono text-cap text-ink-disabled">
                {cls}
              </span>
              <span className="w-16 shrink-0 font-mono text-cap text-ink-disabled">
                {metrics}
              </span>
              <span className="text-cap text-ink-secondary">{use}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Buttons"
        rule="Exactly one primary per surface. White is for the safe, expected next step; the spectrum ring is for spending model time; everything else recedes. Corners are 10px and icon buttons are fully round."
      >
        <div className="flex flex-col gap-4">
          <Row label="primary">
            <Button variant="primary" size="sm">
              <Plus /> Create
            </Button>
            <Button variant="primary">
              <Plus /> Create
            </Button>
            <Button variant="primary" size="lg">
              <Plus /> Create
            </Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
          </Row>
          <Row label="spectrum">
            <Button variant="spectrum" size="sm">
              <Sparkles /> Generate
            </Button>
            <Button variant="spectrum">
              <Sparkles /> Generate
            </Button>
            <Button variant="spectrum" size="lg">
              <Sparkles /> Generate
            </Button>
          </Row>
          <Row label="secondary">
            <Button size="sm">Share</Button>
            <Button>Share</Button>
            <Button size="lg">Share</Button>
            <Button disabled>Disabled</Button>
          </Row>
          <Row label="ghost">
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
            <Button variant="ghost">Cancel</Button>
          </Row>
          <Row label="danger">
            <Button variant="danger" size="sm">
              Delete
            </Button>
            <Button variant="danger">Delete batch</Button>
          </Row>
          <Row label="icon">
            <IconButton aria-label="Undo">
              <Undo2 />
            </IconButton>
            <IconButton aria-label="More" variant="secondary">
              <MoreHorizontal />
            </IconButton>
            <IconButton aria-label="Create" variant="primary">
              <Plus />
            </IconButton>
          </Row>
        </div>
      </Section>

      <Section
        title="Inputs"
        rule="Fields are darker than the panel they sit in, so a form reads as a set of holes rather than a stack of boxes. Search is a pill; everything else takes the 10px control radius."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Search" hint="Matches angle statements and hooks.">
            <SearchInput placeholder="Search templates" leading={<Search />} />
          </Field>
          <Field label="Persona">
            <Input placeholder="Bride-to-be, 25–35" />
          </Field>
          <Field
            label="Angle statement"
            hint="Conversational. Write what the person would think, not a tagline."
            className="sm:col-span-2"
          >
            <Textarea rows={3} placeholder="Your dermatologist wrecked your skin" />
          </Field>
          <Field label="Disabled">
            <Input placeholder="Not editable" disabled />
          </Field>
        </div>
      </Section>

      <Section
        title="Chips, tabs and badges"
        rule="Chips filter, tabs switch a view in place, badges report. Chips invert to a light fill when selected; tabs mark the current one with an underline and drop the rest to the disabled ink."
      >
        <div className="flex flex-col gap-4">
          <ChipRow>
            <Chip selected>All angles</Chip>
            <Chip>New mechanism</Chip>
            <Chip>Failed solution</Chip>
            <Chip>Us vs them</Chip>
            <Chip>Social proof</Chip>
            <Chip>Identity</Chip>
          </ChipRow>
          <div className="flex items-center gap-5">
            <TextTab active>Carousels</TextTab>
            <TextTab>Static</TextTab>
            <TextTab>Video</TextTab>
          </div>
          <Row label="badges">
            <Badge>Draft</Badge>
            <Badge tone="positive">Scheduled</Badge>
            <Badge tone="caution">Needs review</Badge>
            <Badge tone="critical">Failed to post</Badge>
            <Badge tone="spectrum">AI draft</Badge>
          </Row>
          <Row label="keys">
            <span className="flex items-center gap-1 text-default text-ink-secondary">
              Generate <Kbd>⌘</Kbd> <Kbd>⏎</Kbd>
            </span>
          </Row>
        </div>
      </Section>

      <Section
        title="Navigation"
        rule="Two shapes. A labelled sidebar for moving between workspaces, and a narrow glyph rail for switching tools without leaving the canvas. Active state is a white overlay in both, on a 12px radius."
      >
        <div className="flex flex-wrap gap-4">
          <Surface className="overflow-hidden p-0">
            <Sidebar>
              <SidebarGroup label="Home">
                <NavItem icon={<Compass />}>Explore</NavItem>
                <NavItem icon={<LayoutTemplate />} active>
                  Templates
                </NavItem>
                <NavItem icon={<Blocks />}>Blocks</NavItem>
              </SidebarGroup>
              <SidebarGroup label="Workspace">
                <NavItem icon={<Images />}>Carousels</NavItem>
                <NavItem icon={<Calendar />}>Schedule</NavItem>
                <NavItem icon={<Users />}>Personas</NavItem>
              </SidebarGroup>
            </Sidebar>
          </Surface>

          <Surface level="panel" className="flex h-fit flex-col gap-1 p-1.5">
            <RailItem icon={<Wand2 />} active>
              Build
            </RailItem>
            <RailItem icon={<LayoutTemplate />}>Layouts</RailItem>
            <RailItem icon={<Type />}>Text</RailItem>
            <RailItem icon={<Images />}>Media</RailItem>
          </Surface>
        </div>
      </Section>

      <Section
        title="Toolbar"
        rule="Overlays the canvas, so it always carries a shadow. Groups are separated by a hairline, and the one consequential action sits at the right end."
      >
        <div className="flex items-center justify-center rounded-card bg-panel p-8">
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
              Share
            </Button>
            <Button variant="spectrum" size="sm">
              <Send /> Schedule
            </Button>
          </Toolbar>
        </div>
      </Section>

      <Section
        title="Model states"
        rule="Generation is slow and probabilistic, so it gets first-class states rather than a spinner. The sweep carries the same gradient as the button that triggered it."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Surface level="card">
            <SurfaceHeader>
              <span className="text-default">Generating 8 slides</span>
              <Badge tone="spectrum">AI draft</Badge>
            </SurfaceHeader>
            <SurfaceBody className="flex flex-col gap-3">
              <GeneratingBar />
              <div className="grid grid-cols-4 gap-2">
                <Skeleton className="aspect-[4/5]" />
                <Skeleton className="aspect-[4/5]" />
                <Skeleton className="aspect-[4/5]" />
                <Skeleton className="aspect-[4/5]" />
              </div>
              <p className="text-cap text-ink-secondary">
                Writing hooks for <span className="text-ink">Problem-aware</span>{" "}
                &middot; 3 of 8
              </p>
            </SurfaceBody>
          </Surface>

          <EmptyState
            icon={<Images />}
            title="No carousels yet"
            description="Pick a persona and an angle, and the first batch of eight will land here."
            action={
              <Button variant="spectrum" size="sm">
                <Sparkles /> Generate first batch
              </Button>
            }
          />
        </div>
      </Section>

      <Section
        title="Composed: a batch card"
        rule="The proof that the system works is that a full-colour thumbnail grid can sit inside the chrome without either one shouting. Everything around the artwork is grey."
      >
        <Surface level="card" className="max-w-xl">
          <SurfaceHeader>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-titles">Vitamin C — Glow Seekers</span>
              <span className="text-cap text-ink-secondary">
                8 carousels &middot; modified 2 hours ago
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge tone="caution">Needs review</Badge>
              <IconButton aria-label="More" size="sm">
                <MoreHorizontal />
              </IconButton>
            </div>
          </SurfaceHeader>
          <SurfaceBody className="flex flex-col gap-3">
            <div className="rounded-control bg-raised px-3 py-2 text-cap text-ink-secondary">
              <span className="text-ink-disabled">Angle</span> &middot; Your
              dermatologist wrecked your skin
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                "linear-gradient(160deg,#f6d5c4,#c98f74)",
                "linear-gradient(160deg,#d8e6c8,#7f9d63)",
                "linear-gradient(160deg,#e7d9f5,#9b7fc4)",
                "linear-gradient(160deg,#1d1d1d,#3a3a3a)",
              ].map((bg, i) => (
                <div
                  key={i}
                  className="relative aspect-[4/5] overflow-hidden rounded-control"
                  style={{ backgroundImage: bg }}
                >
                  {i === 3 ? (
                    <span className="absolute inset-0 flex items-center justify-center text-default text-ink">
                      +5
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </SurfaceBody>
        </Surface>
      </Section>
    </div>
  );
}
