import {
  Blocks,
  Calendar,
  Compass,
  Images,
  LayoutTemplate,
  MoreHorizontal,
  Redo2,
  Send,
  Sparkles,
  Type,
  Undo2,
  Users,
  Wand2,
} from "lucide-react";

import { AgentMark, Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { EmptyState, GeneratingBar, Skeleton } from "@/components/ui/feedback";
import { NavItem, RailItem, Sidebar, SidebarGroup } from "@/components/ui/nav";
import { Surface, SurfaceBody, SurfaceHeader } from "@/components/ui/surface";
import { Toolbar, ToolbarDivider } from "@/components/ui/toolbar";

import { Page, PageHeader, Row, Section } from "../_doc";

export const metadata = {
  title: "Views · Contently design",
};

export default function ViewsPage() {
  return (
    <Page>
      <PageHeader
        title="Views"
        lede="Things the user reads. Views arrange content and report state; they do not take input. When a view needs a control it composes one from the Controls page."
        note="Mobbin's View category also lists table, stacked list, tab bar, carousel, gallery and progress. Table and stacked list arrive with the library; progress with the board's generation queue."
      />

      <Section
        id="badges"
        title="Badge"
        rule="Reports a state. Tone is carried by a dot plus the label so meaning never depends on hue alone. The spectrum tone is reserved for things the model made."
      >
        <Row label="tones">
          <Badge>Draft</Badge>
          <Badge tone="positive">Scheduled</Badge>
          <Badge tone="caution">Needs review</Badge>
          <Badge tone="critical">Failed to post</Badge>
          <Badge tone="spectrum">AI draft</Badge>
        </Row>
        <Row label="no dot">
          <Badge dot={false}>Persona</Badge>
          <Badge dot={false}>Strategy</Badge>
          <Badge dot={false} tone="spectrum">
            Generating
          </Badge>
        </Row>
      </Section>

      <Section
        id="cards"
        title="Card"
        rule="Every enclosed region is a Surface at one of three levels — panel, card, raised — and the level is its elevation. No borders by default; value does the separating. The proof that the system works is that full-colour artwork can sit inside the chrome without either one shouting."
      >
        <Surface level="card" className="max-w-xl">
          <SurfaceHeader>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-titles">Vitamin C — Glow Seekers</span>
              <span className="text-cap text-ink-secondary">8 carousels &middot; modified 2 hours ago</span>
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
              <span className="text-ink-disabled">Angle</span> &middot; Your dermatologist wrecked your skin
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

      <Section
        id="navigation"
        title="Navigation"
        rule="Two shapes. A labelled sidebar for moving between workspaces, and a narrow glyph rail for switching tools without leaving the canvas. Active state is a white overlay in both, on a 12px radius. The design-system nav to your left is the same Sidebar at a narrower width."
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
                <NavItem icon={<Calendar />} trailing="12">
                  Schedule
                </NavItem>
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
        id="toolbar"
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
        id="feedback"
        title="Feedback"
        rule="Generation is slow and probabilistic, so it gets first-class states rather than a spinner. The sweep carries the same gradient as the button that triggered it. Empty states say what will appear and offer the one action that makes it appear."
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
                Writing hooks for <span className="text-ink">Problem-aware</span> &middot; 3 of 8
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
        id="imagery"
        title="Avatar & mark"
        rule="People are round and fall back to initials on a raised fill; workspaces and brands are square. The agent has no face — it is an empty spectrum ring, the one place the gradient may be persistent, because it names who is speaking. It breathes while a reply is streaming."
      >
        <Row label="people">
          <Avatar name="Hanna Moore" size="xs" />
          <Avatar name="Hanna Moore" size="sm" />
          <Avatar name="Hanna Moore" size="md" />
          <Avatar name="Hanna Moore" size="lg" />
        </Row>
        <Row label="workspace">
          <Avatar name="Glow Labs" shape="square" size="sm" />
          <Avatar name="Glow Labs" shape="square" size="md" />
          <Avatar name="Glow Labs" shape="square" size="lg" />
        </Row>
        <Row label="agent">
          <AgentMark size="xs" />
          <AgentMark size="sm" />
          <AgentMark size="md" />
          <AgentMark size="lg" />
          <span className="pl-2 text-cap text-ink-disabled">streaming &rarr;</span>
          <AgentMark size="md" active />
        </Row>
      </Section>
    </Page>
  );
}
