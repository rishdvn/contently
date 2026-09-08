"use client";

import {
  Calendar,
  ChevronRight,
  ChevronsUpDown,
  FileText,
  KanbanSquare,
  LayoutTemplate,
  Library,
  MessageSquare,
  MoreHorizontal,
  Palette,
  Package,
  Plus,
  Sparkles,
  Users,
} from "lucide-react";
import { useState } from "react";

import {
  ActionRow,
  ArtifactCard,
  ArtifactCardSkeleton,
  ArtifactDrawer,
  ArtifactGroup,
  AssistantMessage,
  Composer,
  ContextAttachment,
  ContextEcho,
  ContextPickerPanel,
  ContextPill,
  QuickPrompts,
  QuickPromptsPanel,
  Steps,
  StreamingText,
  Suggestions,
  Thread,
  UserMessage,
  artifactKinds,
  type Artifact,
  type ContextSource,
} from "@/components/patterns/chat";
import { Doc, DocSection } from "@/components/patterns/docs/doc";
import { PersonaDoc } from "@/components/patterns/docs/persona-doc";
import { CoverageMatrix, StrategyDoc } from "@/components/patterns/docs/strategy-doc";
import { AgentMark, Avatar } from "@/components/ui/avatar";
import { Kbd } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Chip, ChipRow } from "@/components/ui/chip";
import { Menu, MenuItem, MenuLabel } from "@/components/ui/menu";
import { NavItem, Sidebar, SidebarGroup } from "@/components/ui/nav";
import { cn } from "@/lib/cn";

import { Page, PageHeader, Row, Section } from "../_doc";
import { artifacts, burnedPersona, promptGroups, q4Strategy, recents, sources as initialSources } from "./data";

/* ------------------------------------------------------------------ */
/*  The surface                                                        */
/* ------------------------------------------------------------------ */

function AppSidebar() {
  return (
    <Sidebar className="w-[240px] gap-4 px-3 py-3">
      <button className="flex h-10 items-center gap-2.5 rounded-nav px-2 text-left hover:bg-[var(--state-hover)]">
        <Avatar name="Glow Labs" shape="square" size="sm" />
        <span className="min-w-0 flex-1 truncate text-default text-ink">Glow Labs</span>
        <ChevronsUpDown className="size-3.5 text-ink-disabled" />
      </button>

      <SidebarGroup>
        <NavItem icon={<Plus />} trailing={<Kbd>⌘K</Kbd>} className="h-9 text-default">
          New chat
        </NavItem>
      </SidebarGroup>

      <SidebarGroup label="Workspace">
        <NavItem icon={<MessageSquare />} active className="h-9 text-default">
          Chat
        </NavItem>
        <NavItem icon={<KanbanSquare />} trailing="6" className="h-9 text-default">
          Board
        </NavItem>
        <NavItem icon={<Calendar />} className="h-9 text-default">
          Calendar
        </NavItem>
        <NavItem icon={<Library />} className="h-9 text-default">
          Library
        </NavItem>
        <NavItem icon={<LayoutTemplate />} className="h-9 text-default">
          Templates
        </NavItem>
      </SidebarGroup>

      <SidebarGroup label="Recent">
        {recents.map((r, i) => (
          <NavItem key={r} active={i === 0} className="h-8 text-ui">
            {r}
          </NavItem>
        ))}
      </SidebarGroup>

      <div className="mt-auto flex items-center gap-2.5 px-2 pt-2">
        <Avatar name="Hanna Moore" size="md" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-ui text-ink">Hanna Moore</span>
          <span className="truncate text-tiny text-ink-disabled">hanna@glowlabs.co</span>
        </div>
        <IconButton aria-label="Account" size="sm">
          <MoreHorizontal />
        </IconButton>
      </div>
    </Sidebar>
  );
}

function ChatHeader({ onOpen }: { onOpen: (a: Artifact) => void }) {
  const made = [artifacts.burned, artifacts.bride, artifacts.strategy];
  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-4 px-5">
      <div className="flex min-w-0 items-center gap-1.5 text-cap">
        <span className="text-ink-secondary">Chat</span>
        <ChevronRight className="size-3 text-ink-disabled" />
        <span className="truncate text-ink">Vitamin C — Q4 strategy</span>
      </div>
      <div className="flex items-center gap-1">
        <Menu
          align="end"
          trigger={(props) => (
            <Button variant="ghost" size="sm" {...props}>
              <FileText /> {made.length} artifacts
            </Button>
          )}
        >
          <MenuLabel>Made in this chat</MenuLabel>
          {made.map((a) => {
            const Icon = artifactKinds[a.kind].icon;
            return (
              <MenuItem key={a.id} icon={<Icon />} onClick={() => onOpen(a)}>
                {a.title}
              </MenuItem>
            );
          })}
        </Menu>
        <Button size="sm">Share</Button>
      </div>
    </header>
  );
}

function DemoThread({ onOpen }: { onOpen: (a: Artifact) => void }) {
  return (
    <Thread>
      <UserMessage
        author={{ name: "Hanna Moore" }}
        context={
          <>
            <ContextEcho icon={<Palette />}>Glow Labs guide</ContextEcho>
            <ContextEcho icon={<Package />}>Vitamin C Serum 15%</ContextEcho>
          </>
        }
      >
        Build a content strategy for the Vitamin C serum. Focus on women 28–40 who&rsquo;ve
        been burned by dermatologist prescriptions — and tell me who else we&rsquo;re missing.
      </UserMessage>

      <AssistantMessage>
        <Steps
          summary="Read 2 sources · scanned 3 accounts · drafted 2 personas"
          items={[
            { label: "Read Glow Labs voice & visual guide" },
            { label: "Read 312 product reviews" },
            { label: "Scanned Glossier, The Ordinary, Drunk Elephant — last 30 days" },
            { label: "Drafted personas with evidence" },
          ]}
        />
        <p>
          Starting from the pain rather than the demographic: the serum solves{" "}
          <strong>over-treated skin</strong>, not dullness. Two personas have enough evidence in
          the reviews to stand behind. A third — the stay-home mom — shows up in comments but
          not in purchases, so I&rsquo;ve parked her.
        </p>
        <ArtifactGroup>
          <ArtifactCard artifact={artifacts.burned} onOpen={onOpen} />
          <ArtifactCard artifact={artifacts.bride} onOpen={onOpen} />
        </ArtifactGroup>
        <p>
          Here is how they cover the three pains. Seven angles are drafted; two cells are still
          empty, and only one of them is worth filling right now.
        </p>
        <ArtifactCard artifact={artifacts.strategy} onOpen={onOpen} />
        <ActionRow>
          <Button variant="spectrum" size="sm">
            <Sparkles /> Generate 8 briefs
          </Button>
          <Button size="sm">Edit strategy</Button>
          <Button variant="ghost" size="sm">
            Explain the gaps
          </Button>
        </ActionRow>
        <Suggestions
          items={[
            "Why park the stay-home mom?",
            "Show hooks for the first angle",
            "Who runs new-mechanism angles?",
          ]}
        />
      </AssistantMessage>

      <UserMessage author={{ name: "Hanna Moore" }}>
        Brief a carousel batch for the burned professional at problem-aware.
      </UserMessage>

      <AssistantMessage streaming>
        <Steps
          running
          summary="Writing briefs · 3 of 8"
          items={[
            { label: "Loaded angle: Your dermatologist wrecked your skin" },
            { label: "Selected assets: before/after library, Sept shoot" },
            { label: "Brief 1 — Why does your prescription burn more than your acne?" },
            { label: "Brief 2 — The mirror test", done: true },
            { label: "Brief 3 — What your derm didn't tell you about retinoids", done: false },
          ]}
        />
        <StreamingText>
          Eight briefs, each proving one claim about barrier damage. The first two are ready to
          open; the rest will land here as they finish
        </StreamingText>
        <ArtifactGroup>
          <ArtifactCard artifact={artifacts.brief} onOpen={onOpen} />
          <ArtifactCardSkeleton label="Brief 3 of 8 — drafting slide beats…" />
        </ArtifactGroup>
      </AssistantMessage>
    </Thread>
  );
}

function EmptyThread({ onStarter }: { onStarter: (text: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
      <AgentMark size="lg" />
      <div className="flex flex-col gap-1.5">
        <h2 className="text-sections text-ink">
          <span className="text-ink-secondary">Hey Hanna,</span> what are we making?
        </h2>
        <p className="text-default text-ink-secondary">
          A strategy, a persona, a batch of briefs. Attach what I should work from below.
        </p>
      </div>
      <ChipRow wrap className="justify-center">
        {promptGroups.map((g) => (
          <Chip key={g.label} onClick={() => onStarter(g.prompts[0].text)}>
            <g.icon className="size-3.5" /> {g.prompts[0].title}
          </Chip>
        ))}
      </ChipRow>
    </div>
  );
}

function AppFrame({
  mode,
  sources,
  onSources,
  onOpen,
}: {
  mode: "thread" | "empty";
  sources: ContextSource[];
  onSources: (next: ContextSource[]) => void;
  onOpen: (a: Artifact) => void;
}) {
  const [draft, setDraft] = useState("");
  const update = (kind: ContextSource["kind"], selected: string[]) =>
    onSources(sources.map((s) => (s.kind === kind ? { ...s, selected } : s)));

  const composer = (
    <Composer
      value={draft}
      onChange={setDraft}
      onSend={() => setDraft("")}
      generating={mode === "thread"}
      onStop={() => undefined}
      tools={<QuickPrompts groups={promptGroups} onPick={(p) => setDraft(p.text)} />}
      context={sources.map((s) => (
        <ContextAttachment key={s.kind} source={s} onChange={(sel) => update(s.kind, sel)} />
      ))}
    />
  );

  return (
    <div className="flex h-[780px] overflow-hidden rounded-[var(--radius-overlay)] bg-canvas ring-1 ring-line">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        {mode === "thread" ? (
          <>
            <ChatHeader onOpen={onOpen} />
            <div className="min-h-0 flex-1 overflow-y-auto px-8 pt-4 pb-6">
              <DemoThread onOpen={onOpen} />
            </div>
            <div className="shrink-0 px-8 pt-1 pb-5">
              <div className="mx-auto max-w-[760px]">{composer}</div>
            </div>
          </>
        ) : (
          <>
            <header className="flex h-12 shrink-0 items-center justify-end px-5">
              <Button size="sm">Share</Button>
            </header>
            <EmptyThread onStarter={setDraft} />
            <div className="flex-1" />
            <div className="shrink-0 px-8 pt-1 pb-5">
              <div className="mx-auto max-w-[760px]">{composer}</div>
            </div>
            <div className="flex-1" />
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

function StaticPills() {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {initialSources.map((s) => (
        <ContextPill key={s.kind} icon={<s.icon />} label={s.label} count={s.selected.length} onClear={() => undefined} />
      ))}
    </div>
  );
}

export function ChatDemo() {
  const [mode, setMode] = useState<"thread" | "empty">("thread");
  const [sources, setSources] = useState(initialSources);
  const [open, setOpen] = useState<Artifact | null>(null);
  const [docSources, setDocSources] = useState(initialSources);
  const [docDraft, setDocDraft] = useState("");

  const openArtifact = (a: Artifact) => setOpen(a);

  return (
    <Page>
      <PageHeader
        eyebrow="Patterns"
        title="Chat"
        lede="Where strategy gets made. The user tells the model what to work from, the model answers in prose and in artifacts, and every artifact is a real object — a persona, a strategy, a brief — that opens in place and lives on in the board, the calendar and the library."
        note="Built entirely from the primitives on the Controls, Views and Overlays pages. Nothing here defines a colour, a radius or a button of its own."
      >
        <ChipRow className="pt-1">
          <Chip selected={mode === "thread"} onClick={() => setMode("thread")}>
            Mid-conversation
          </Chip>
          <Chip selected={mode === "empty"} onClick={() => setMode("empty")}>
            Empty state
          </Chip>
        </ChipRow>
      </PageHeader>

      <Section
        id="surface"
        title="The surface"
        rule="Live. Attach personas from the pill row, browse prompts with the lightning button, open any artifact, hover a reply for its actions. The sidebar is the app's real navigation: one chat, one board, one calendar, one library, and the conversations you have had."
      >
        <AppFrame mode={mode} sources={sources} onSources={setSources} onOpen={openArtifact} />
      </Section>

      <Section
        id="composer"
        title="Composer"
        rule="Three rows with fixed jobs. The text is the message. The bar beneath holds tools for this message — attach, saved prompts, send. The pill row beneath the panel is context for the whole conversation, so it sits outside the message. Send is white, not spectrum: asking is cheap, generating is not."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <span className="text-cap text-ink-disabled">Empty</span>
            <Composer value="" onChange={() => undefined} onSend={() => undefined} />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-cap text-ink-disabled">Typing — shortcut appears, send enables</span>
            <Composer
              value={docDraft || "Draft an identity angle for the burned professional × dullness."}
              onChange={setDocDraft}
              onSend={() => setDocDraft("")}
            />
          </div>
          <div className="flex flex-col gap-2 lg:col-span-2">
            <span className="text-cap text-ink-disabled">Generating — send becomes stop; context stays editable</span>
            <Composer
              value=""
              onChange={() => undefined}
              onSend={() => undefined}
              generating
              tools={<QuickPrompts groups={promptGroups} onPick={() => undefined} />}
              context={docSources.map((s) => (
                <ContextAttachment
                  key={s.kind}
                  source={s}
                  onChange={(sel) =>
                    setDocSources(docSources.map((x) => (x.kind === s.kind ? { ...x, selected: sel } : x)))
                  }
                />
              ))}
            />
          </div>
        </div>
      </Section>

      <Section
        id="pickers"
        title="Context pills & pickers"
        rule="A pill is an attachable source of grounding, and a different object from a Chip: chips filter a list, pills change what the model knows. Rest is an outline with a plus; attached is a fill with a count. Clicking opens a picker — search, a checklist, a way out to the library — and nothing heavier. Creating a persona is a page, not a popover."
      >
        <div className="flex flex-col gap-5">
          <Row label="rest / attached">
            <StaticPills />
          </Row>
          <Row label="picker">
            <div className="overflow-hidden rounded-[var(--radius-overlay)] bg-panel shadow-overlay">
              <ContextPickerPanel
                source={docSources[0]}
                onChange={(sel) =>
                  setDocSources(docSources.map((x) => (x.kind === "persona" ? { ...x, selected: sel } : x)))
                }
              />
            </div>
          </Row>
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              ["Personas · Angles · Products", "Small, curated lists. Picker with search.", "Popover"],
              ["Brand · Skills", "One or two items, rarely changed. Picker without search.", "Popover"],
              ["Assets", "Hundreds of items, visual. Opens the library as a drawer with a grid.", "Drawer"],
            ].map(([kind, why, shape]) => (
              <div key={kind} className="flex flex-col gap-1 rounded-control bg-panel p-3.5">
                <span className="text-default text-ink">{kind}</span>
                <span className="text-cap text-ink-secondary">{why}</span>
                <span className="text-cap text-ink-disabled">{shape}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section
        id="prompts"
        title="Quick prompts"
        rule="Saved prompts live in groups and the groups switch on hover, so the whole library is one horizontal sweep of the pointer. The band at the foot prints the full text of whatever is under the cursor, so nothing is sent unread. Choosing a prompt fills the composer; it never sends. Placeholders in braces are what the user is expected to edit."
      >
        <div className="flex flex-col gap-4">
          <div className="w-fit overflow-hidden rounded-[var(--radius-overlay)] bg-panel shadow-overlay">
            <QuickPromptsPanel groups={promptGroups} onPick={() => undefined} />
          </div>
          <Row label="starters">
            <ChipRow wrap>
              {promptGroups.map((g) => (
                <Chip key={g.label}>
                  <g.icon className="size-3.5" /> {g.prompts[0].title}
                </Chip>
              ))}
            </ChipRow>
          </Row>
          <p className="max-w-2xl text-cap text-ink-secondary">
            Starters on the empty state are the first prompt of each group. The same groups appear
            later as the &ldquo;Prompts&rdquo; button in the composer, so there is one library, seen
            two ways.
          </p>
        </div>
      </Section>

      <Section
        id="messages"
        title="Messages"
        rule="The user's turn is a bubble; the model's is not. A bubble says 'this is a quote', which is what a prompt is. The reply is the working surface — full measure, no container, attributed by the spectrum mark alone. What the model did before answering collapses to one line of evidence; its actions appear on hover and never compete with the content."
      >
        <div className="rounded-[var(--radius-overlay)] bg-canvas p-6 ring-1 ring-line">
          <Thread>
            <UserMessage
              author={{ name: "Hanna Moore" }}
              context={<ContextEcho icon={<Users />}>2 personas</ContextEcho>}
            >
              Which of these two personas should we lead with in October?
            </UserMessage>
            <AssistantMessage>
              <Steps
                summary="Compared 2 personas against Q4 calendar"
                items={[{ label: "Read both persona docs" }, { label: "Checked seasonality in reviews" }]}
              />
              <p>
                Lead with <strong>the Burned Professional</strong>. She enters problem-aware, which
                is where organic wins; the Bride is solution-aware and will convert on retargeting
                anyway. October also has no wedding peak.
              </p>
              <Suggestions items={["Make that the default persona", "Show the October calendar"]} />
            </AssistantMessage>
            <UserMessage author={{ name: "Hanna Moore" }}>Do it.</UserMessage>
            <AssistantMessage streaming>
              <StreamingText>Setting the Burned Professional as the default persona for Q4 and re-ordering the board</StreamingText>
            </AssistantMessage>
          </Thread>
        </div>
      </Section>

      <Section
        id="artifacts"
        title="Artifact cards"
        rule="A thing the model made, sitting in the thread. A card and not a link because it must be recognisable when the user scrolls back: kind, title, one line, a few facts. The whole card opens it; the overflow menu does everything else. Six kinds share one card, which is what makes a seventh cheap. Briefs and carousels carry a strip of slides; generating cards carry the sweep."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {(["persona", "angle", "strategy", "research", "brief", "carousel"] as const).map((k) => {
            const a = Object.values(artifacts).find((x) => x.kind === k && x.status !== "generating")!;
            return <ArtifactCard key={k} artifact={a} onOpen={openArtifact} />;
          })}
          <ArtifactCard artifact={artifacts.generating} />
          <ArtifactCardSkeleton />
        </div>
        <div className="grid gap-2 pt-2 sm:grid-cols-3">
          {[
            ["Click", "Opens the artifact in a drawer over the conversation. The thread stays visible behind the scrim."],
            ["Open page ↗", "Leaves the chat for the object's own page — the persona editor, the brief in the board, the carousel in the editor."],
            ["Add to board", "Briefs and carousels become cards in the Board's first column. Personas and strategies pin to the workspace."],
          ].map(([t, b]) => (
            <div key={t} className="flex flex-col gap-1 rounded-control bg-panel p-3.5">
              <span className="text-default text-ink">{t}</span>
              <span className="text-cap leading-4 text-ink-secondary">{b}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="drawer"
        title="Artifact drawer"
        rule="Where a card opens. A drawer rather than a dialog because the conversation is the document's context; a drawer rather than a page because most openings are a glance. Header and footer are identical for every kind — only the body knows what a persona is. The footer's spectrum button is the one generative action that makes sense for that kind."
      >
        <Row label="open">
          <Button onClick={() => openArtifact(artifacts.burned)}>Persona</Button>
          <Button onClick={() => openArtifact(artifacts.strategy)}>Strategy</Button>
          <Button onClick={() => openArtifact(artifacts.brief)}>Brief</Button>
        </Row>
        <div className="flex flex-col gap-2 pt-2">
          <span className="text-cap text-ink-disabled">Inside the strategy: the coverage matrix</span>
          <div className="max-w-xl rounded-[var(--radius-overlay)] bg-panel p-5">
            <CoverageMatrix personas={q4Strategy.personas} pains={q4Strategy.pains} cells={q4Strategy.cells} />
          </div>
          <p className="max-w-2xl text-cap text-ink-secondary">
            Rows are pains, columns are personas, a number is how many angles exist for the
            intersection, a ring is a gap. Clicking a cell will ask the model for an angle there.
            This is the product&rsquo;s most important visual and it is built from Tooltip, a table
            and two tokens.
          </p>
        </div>
      </Section>

      <ArtifactDrawer
        artifact={open}
        open={open !== null}
        onClose={() => setOpen(null)}
        onGenerate={() => setOpen(null)}
        generateLabel={
          open?.kind === "strategy" ? "Fill the gaps" : open?.kind === "brief" ? "Generate carousel" : "Generate briefs"
        }
      >
        {open?.kind === "persona" ? (
          <PersonaDoc data={burnedPersona} />
        ) : open?.kind === "strategy" ? (
          <StrategyDoc data={q4Strategy} />
        ) : open ? (
          <Doc>
            <DocSection label="Preview">
              <p className="text-default leading-6 text-ink-secondary">
                The {artifactKinds[open.kind].noun} document renders here. Its layout arrives with
                the {open.kind === "carousel" ? "Editor" : open.kind === "brief" ? "Board" : "Library"}{" "}
                pattern, which owns that object.
              </p>
            </DocSection>
            {open.thumbnails ? (
              <DocSection label="Slides">
                <div className={cn("grid grid-cols-4 gap-2")}>
                  {open.thumbnails.map((bg, i) => (
                    <div key={i} className="aspect-[4/5] rounded-control" style={{ backgroundImage: bg }} />
                  ))}
                </div>
              </DocSection>
            ) : null}
          </Doc>
        ) : null}
      </ArtifactDrawer>
    </Page>
  );
}
