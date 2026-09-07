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
import { Chip, ChipRow } from "@/components/ui/chip";
import { EmptyState, GeneratingBar, Skeleton } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/input";
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
  ["canvas", "#0d0d0d", "Page background. The floor everything sits on."],
  ["panel", "#151515", "Persistent chrome: rails, toolbars, docked panels."],
  ["sunken", "#191919", "Recessed tokens inside a panel, e.g. filter chips."],
  ["raised", "#1b1b1b", "Secondary buttons and hover targets."],
  ["field", "#1e1e1e", "Text inputs at rest."],
  ["card", "#1f1f1f", "Content containers in a grid."],
  ["selected", "#212121", "Active nav, pressed chip, current tab."],
  ["hover", "#262626", "Hover on an already-raised element."],
];

const inkTokens = [
  ["ink", "#f3f3f3", "Primary text and icons."],
  ["ink-secondary", "#bababa", "Supporting copy, inactive nav labels."],
  ["ink-muted", "#8a8a8a", "Metadata, timestamps, counts."],
  ["ink-faint", "#565656", "Placeholders and section labels."],
  ["ink-disabled", "#474747", "Non-interactive text."],
];

const spectrumTokens = [
  ["spectrum-green", "#63e563"],
  ["spectrum-lime", "#a9dc54"],
  ["spectrum-amber", "#ffd043"],
  ["spectrum-orange", "#ff9837"],
];

const typeScale = [
  ["text-2xl", "28 / 34", "Page title, used once per screen"],
  ["text-xl", "22 / 28", "Section heading"],
  ["text-lg", "18 / 24", "Card title, modal heading"],
  ["text-md", "15 / 22", "Emphasised body"],
  ["text-base", "14 / 20", "Body, button labels"],
  ["text-sm", "13 / 18", "Default UI text"],
  ["text-xs", "12 / 16", "Metadata, hints"],
  ["text-micro", "11 / 14", "Section labels, badges"],
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
        <h2 className="text-xl font-medium text-ink">{title}</h2>
        <p className="max-w-2xl text-sm text-ink-muted">{rule}</p>
      </header>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="w-24 shrink-0 text-xs text-ink-faint">{label}</span>
      {children}
    </div>
  );
}

export default function DesignSystemPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-8 py-12">
      <header className="flex flex-col gap-3">
        <SectionLabel>Contently</SectionLabel>
        <h1 className="text-2xl font-medium">Design system</h1>
        <p className="max-w-2xl text-base text-ink-muted">
          The interface is monochrome so that the only colour on screen belongs to
          the user&rsquo;s work. One chromatic mark exists — a gradient hairline —
          and it is spent exclusively on the moment the model acts on your behalf.
        </p>
      </header>

      <Section
        title="Surfaces"
        rule="Elevation is lightness, not shadow. Each step up the ramp means one step closer to the user; shadow is added only when an element floats free of the layout."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {surfaceTokens.map(([name, hex, use]) => (
            <div
              key={name}
              className="flex items-center gap-3 rounded-card border border-line p-2.5"
            >
              <div
                className="size-10 shrink-0 rounded-chip border border-line"
                style={{ backgroundColor: hex }}
              />
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium">{name}</span>
                  <span className="font-mono text-xs text-ink-faint">{hex}</span>
                </div>
                <p className="truncate text-xs text-ink-muted">{use}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Ink"
        rule="Five steps, all neutral. Hierarchy is carried by contrast alone, which is what lets a full-colour thumbnail sit next to a label without either fighting."
      >
        <div className="flex flex-col gap-1">
          {inkTokens.map(([name, hex, use]) => (
            <div key={name} className="flex items-baseline gap-3 py-1">
              <span
                className="w-32 shrink-0 text-base font-medium"
                style={{ color: hex }}
              >
                {name}
              </span>
              <span className="w-20 shrink-0 font-mono text-xs text-ink-faint">
                {hex}
              </span>
              <span className="text-sm text-ink-muted">{use}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="The spectrum"
        rule="A single gradient, never a fill. It marks generative actions and their results — the button that briefs the model, the bar while it works, the badge on what it produced. If it appears twice on a screen, one of them is wrong."
      >
        <div className="flex flex-col gap-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <div
                className="h-14 rounded-card"
                style={{ backgroundImage: "var(--gradient-spectrum)" }}
              />
              <span className="font-mono text-xs text-ink-faint">
                --gradient-spectrum &middot; edges
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <div
                className="h-14 rounded-card"
                style={{ backgroundImage: "var(--gradient-spectrum-x)" }}
              />
              <span className="font-mono text-xs text-ink-faint">
                --gradient-spectrum-x &middot; bars and text
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {spectrumTokens.map(([name, hex]) => (
              <div
                key={name}
                className="flex items-center gap-2 rounded-chip bg-sunken px-2.5 py-1.5"
              >
                <span
                  className="size-3 rounded-full"
                  style={{ backgroundColor: hex }}
                />
                <span className="text-xs">{name}</span>
                <span className="font-mono text-xs text-ink-faint">{hex}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="spectrum" size="lg">
              <Sparkles /> Generate carousel
            </Button>
            <Badge tone="spectrum">AI draft</Badge>
            <span className="spectrum-text text-lg font-medium">
              Spectrum text
            </span>
          </div>
        </div>
      </Section>

      <Section
        title="Type"
        rule="Small and tight. 13px is the default, and anything above 18px is a deliberate signal that appears at most once per screen."
      >
        <div className="flex flex-col divide-y divide-line">
          {typeScale.map(([cls, metrics, use]) => (
            <div key={cls} className="flex items-baseline gap-4 py-2.5">
              <span className={`${cls} w-56 shrink-0 font-medium`}>
                Persona &times; angle
              </span>
              <span className="w-24 shrink-0 font-mono text-xs text-ink-faint">
                {cls}
              </span>
              <span className="w-16 shrink-0 font-mono text-xs text-ink-faint">
                {metrics}
              </span>
              <span className="text-xs text-ink-muted">{use}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Buttons"
        rule="Exactly one primary per surface. White is for the safe, expected next step; the spectrum edge is for spending model time; everything else recedes."
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
            <Button variant="ghost" size="lg">
              Cancel
            </Button>
          </Row>
          <Row label="danger">
            <Button variant="danger" size="sm">
              Delete
            </Button>
            <Button variant="danger">Delete batch</Button>
          </Row>
          <Row label="icon">
            <IconButton aria-label="Undo">
              <Undo2 className="size-4" />
            </IconButton>
            <IconButton aria-label="Redo">
              <Redo2 className="size-4" />
            </IconButton>
            <IconButton aria-label="More" variant="secondary">
              <MoreHorizontal className="size-4" />
            </IconButton>
          </Row>
        </div>
      </Section>

      <Section
        title="Inputs"
        rule="Fields are darker than the panel they sit in, so a form reads as a set of holes rather than a stack of boxes. Focus lightens the fill instead of adding a ring of colour."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Search" hint="Matches angle statements and hooks.">
            <Input placeholder="Search templates" leading={<Search className="size-4" />} />
          </Field>
          <Field label="Persona">
            <Input placeholder="Bride-to-be, 25–35" />
          </Field>
          <Field
            label="Angle statement"
            hint="Conversational. Write what the person would think, not a tagline."
            className="sm:col-span-2"
          >
            <Textarea
              rows={3}
              placeholder="Your dermatologist wrecked your skin"
            />
          </Field>
          <Field label="Disabled">
            <Input placeholder="Not editable" disabled />
          </Field>
        </div>
      </Section>

      <Section
        title="Chips and badges"
        rule="Chips filter; badges report. Chips show selection with a lighter fill. Badges pair a dot with a word so state never rests on hue alone."
      >
        <div className="flex flex-col gap-4">
          <ChipRow>
            <Chip selected>All angles</Chip>
            <Chip>New mechanism</Chip>
            <Chip>Failed solution</Chip>
            <Chip>Us vs them</Chip>
            <Chip>Social proof</Chip>
            <Chip>Identity</Chip>
            <Chip>Before / after</Chip>
          </ChipRow>
          <Row label="badges">
            <Badge>Draft</Badge>
            <Badge tone="positive">Scheduled</Badge>
            <Badge tone="caution">Needs review</Badge>
            <Badge tone="critical">Failed to post</Badge>
            <Badge tone="spectrum">AI draft</Badge>
          </Row>
          <Row label="keys">
            <span className="flex items-center gap-1 text-sm text-ink-muted">
              Generate <Kbd>⌘</Kbd> <Kbd>⏎</Kbd>
            </span>
          </Row>
        </div>
      </Section>

      <Section
        title="Navigation"
        rule="Two shapes. A labelled sidebar for moving between workspaces, and a narrow glyph rail for switching tools without leaving the canvas. Active state is a fill in both."
      >
        <div className="flex flex-wrap gap-4">
          <Surface className="overflow-hidden p-0">
            <Sidebar className="border-r-0">
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

          <Surface level="panel" className="flex flex-col gap-1 p-1.5">
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
        <div className="flex items-center justify-center rounded-panel bg-sunken p-8">
          <Toolbar>
            <IconButton aria-label="Undo">
              <Undo2 className="size-4" />
            </IconButton>
            <IconButton aria-label="Redo">
              <Redo2 className="size-4" />
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
        rule="Generation is slow and probabilistic, so it gets first-class states rather than a spinner. The spectrum sweep is the same mark as the button that triggered it."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Surface level="card">
            <SurfaceHeader>
              <span className="text-sm font-medium">Generating 8 slides</span>
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
              <p className="text-xs text-ink-muted">
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
              <span className="truncate text-base font-medium">
                Vitamin C — Glow Seekers
              </span>
              <span className="text-xs text-ink-muted">
                8 carousels &middot; modified 2 hours ago
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge tone="caution">Needs review</Badge>
              <IconButton aria-label="More">
                <MoreHorizontal className="size-4" />
              </IconButton>
            </div>
          </SurfaceHeader>
          <SurfaceBody className="flex flex-col gap-3">
            <div className="rounded-chip bg-sunken px-2.5 py-2 text-xs text-ink-secondary">
              <span className="text-ink-faint">Angle</span> &middot; Your
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
                  className="relative aspect-[4/5] overflow-hidden rounded-chip"
                  style={{ backgroundImage: bg }}
                >
                  {i === 3 ? (
                    <span className="absolute inset-0 flex items-center justify-center text-base font-medium text-ink">
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
