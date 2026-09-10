"use client";

import {
  BookOpen,
  ChevronRight,
  ChevronsUpDown,
  FileText,
  History,
  Images,
  Lightbulb,
  LayoutGrid,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

import {
  ActionRow,
  ArtifactCard,
  ArtifactCardSkeleton,
  ArtifactDrawer,
  ArtifactGroup,
  AssistantMessage,
  AttachedChip,
  Composer,
  ContextAttachment,
  ContextEcho,
  ContextPickerBody,
  ContextPill,
  DocUpdate,
  MentionMenu,
  QuickPrompts,
  QuickPromptsPanel,
  Steps,
  StreamingText,
  Suggestions,
  Thread,
  UserMessage,
  artifactKinds,
  contextKinds,
  mentionHits,
  type Artifact,
  type ArtifactKind,
  type Attachment,
  type ContextSource,
  type MentionHit,
} from "@/components/patterns/chat";
import { AgentMark, Avatar } from "@/components/ui/avatar";
import { Badge, Kbd } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Chip, ChipRow } from "@/components/ui/chip";
import { Menu, MenuItem, MenuLabel } from "@/components/ui/menu";
import { NavItem, Sidebar, SidebarGroup } from "@/components/ui/nav";

import { Page, PageHeader, Row, Section } from "../_doc";
import { artifacts, mentionSources, promptGroups, recents, sources as initialSources } from "./data";

/* ------------------------------------------------------------------ */
/*  The surface                                                        */
/* ------------------------------------------------------------------ */

function AppSidebar() {
  return (
    <Sidebar className="w-[240px] gap-5 px-3 py-3">
      <button className="flex h-11 items-center gap-2.5 rounded-nav bg-panel px-2 text-left hover:bg-card">
        <Avatar name="Glow Labs" shape="square" size="sm" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-tiny leading-3 text-ink-disabled">Store</span>
          <span className="truncate text-ui text-ink">Glow Labs</span>
        </span>
        <ChevronsUpDown className="size-3.5 text-ink-disabled" />
      </button>

      <SidebarGroup label="General">
        <NavItem icon={<MessageSquare />} active className="h-9 text-default">
          Chat
        </NavItem>
        <NavItem icon={<Lightbulb />} trailing="7" className="h-9 text-default">
          Ideas
        </NavItem>
        <NavItem icon={<LayoutGrid />} trailing="12" className="h-9 text-default">
          Content
        </NavItem>
      </SidebarGroup>

      <SidebarGroup label="Knowledge">
        <NavItem icon={<BookOpen />} className="h-9 text-default">
          Brand
        </NavItem>
        <NavItem icon={<FileText />} trailing="9" className="h-9 text-default">
          Documents
        </NavItem>
        <NavItem icon={<Images />} className="h-9 text-default">
          Assets
        </NavItem>
      </SidebarGroup>

      <SidebarGroup label="Recent chats">
        {recents.map((r, i) => (
          <NavItem key={r} active={i === 0} className="h-8 text-ui">
            {r}
          </NavItem>
        ))}
      </SidebarGroup>

      <div className="mt-auto flex items-center gap-2.5 px-2 pt-2">
        <Avatar name="Hanna Moore" size="md" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-ui text-ink">Hanna M.</span>
          <span className="truncate text-tiny text-ink-disabled">hanna@glowlabs.co</span>
        </div>
        <IconButton aria-label="Account" size="sm">
          <MoreHorizontal />
        </IconButton>
      </div>
    </Sidebar>
  );
}

function ChatHeader({ title, made, onOpen }: { title: string; made: Artifact[]; onOpen: (a: Artifact) => void }) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-4 px-5">
      <div className="flex min-w-0 items-center gap-1.5 text-cap">
        <AgentMark size="xs" />
        <span className="text-ink-secondary">Assistant</span>
        <ChevronRight className="size-3 text-ink-disabled" />
        <span className="truncate text-ink">{title}</span>
      </div>
      <div className="flex items-center gap-1">
        {made.length ? (
          <Menu
            align="end"
            trigger={(props) => (
              <Button variant="ghost" size="sm" {...props}>
                <FileText /> {made.length} documents
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
        ) : null}
        <Button variant="ghost" size="sm">
          <History /> Chat history
        </Button>
        <Button variant="primary" size="sm">
          <Plus /> New chat
        </Button>
      </div>
    </header>
  );
}

function DemoThread({
  onOpen,
  onAttach,
  onSave,
  saved,
}: {
  onOpen: (a: Artifact) => void;
  onAttach: (a: Artifact) => void;
  onSave: (a: Artifact) => void;
  saved: boolean;
}) {
  const brief = { ...artifacts.brief, saved };
  return (
    <Thread>
      <UserMessage
        author={{ name: "Hanna Moore" }}
        context={
          <>
            <ContextEcho icon={<contextKinds.brand_core.icon />}>Brand · 3 docs</ContextEcho>
            <ContextEcho icon={<contextKinds.research.icon />}>Review mine — 312 reviews</ContextEcho>
          </>
        }
      >
        Build a content strategy for the Vitamin C serum. Focus on women 28–40 who&rsquo;ve been burned by
        dermatologist prescriptions — and tell me who else we&rsquo;re missing.
      </UserMessage>

      <AssistantMessage>
        <Steps
          summary="Read 4 documents · scanned 3 accounts · drafted 2 personas"
          items={[
            { label: "Read Brand core, Product facts, Visual system" },
            { label: "Read Review mine — 312 reviews (41 quotes)" },
            { label: "Scanned Glossier, The Ordinary, Drunk Elephant — last 30 days" },
            { label: "Drafted personas with VOC citations" },
          ]}
        />
        <p>
          Starting from the pain rather than the demographic: the serum solves <strong>over-treated skin</strong>, not
          dullness. Two personas have enough evidence in the reviews to stand behind. A third — the stay-home mom —
          shows up in comments but not in purchases, so I&rsquo;ve parked her.
        </p>
        <ArtifactGroup>
          <ArtifactCard artifact={artifacts.burned} onOpen={onOpen} onAttach={onAttach} />
          <ArtifactCard artifact={artifacts.bride} onOpen={onOpen} onAttach={onAttach} />
        </ArtifactGroup>
        <p>
          Here is how they cover the three pains. Seven angles are drafted; two cells are still empty, and only one of
          them is worth filling right now.
        </p>
        <ArtifactCard artifact={artifacts.strategy} onOpen={onOpen} onAttach={onAttach} />
        <ActionRow>
          <Button variant="spectrum" size="sm">
            <Sparkles /> Brief the first angle
          </Button>
          <Button size="sm">Edit strategy</Button>
          <Button variant="ghost" size="sm">
            Explain the gaps
          </Button>
        </ActionRow>
        <Suggestions items={["Why park the stay-home mom?", "Show hooks for A1", "Who runs new-mechanism angles?"]} />
      </AssistantMessage>

      <UserMessage
        author={{ name: "Hanna Moore" }}
        context={<ContextEcho icon={<contextKinds.persona.icon />}>The Burned Professional</ContextEcho>}
      >
        Brief a carousel for her at problem-aware. Use the first angle.
      </UserMessage>

      <AssistantMessage>
        <Steps
          summary="Read persona A1 · checked Product facts · wrote 1 brief"
          items={[
            { label: "Read The Burned Professional › A1" },
            { label: "Checked claims against Product facts" },
            { label: "Selected assets: Before / after — cheek" },
          ]}
        />
        <p>
          One brief, eight slides, proving one claim: the sting was the dose, not her. Three hook options; I&rsquo;d
          lead with the question.
        </p>
        <ArtifactCard artifact={brief} onOpen={onOpen} onAttach={onAttach} onSave={onSave} />
        <ActionRow>
          <Button variant="spectrum" size="sm">
            <Sparkles /> Make this
          </Button>
          <Button size="sm" disabled={saved} onClick={() => onSave(brief)}>
            {saved ? "Saved to ideas" : "Save to ideas"}
          </Button>
          <Button variant="ghost" size="sm">
            Try the reframe hook
          </Button>
        </ActionRow>
      </AssistantMessage>

      <UserMessage author={{ name: "Hanna Moore" }}>Go make it.</UserMessage>

      <AssistantMessage streaming>
        <Steps
          running
          summary="Rendering carousel · 5 of 8"
          items={[
            { label: "Loaded Visual system — 4:5 carousel rules" },
            { label: "Slides 1–4 rendered" },
            { label: "Slide 5 — proof, Before / after — cheek", done: false },
          ]}
        />
        <DocUpdate artifact={artifacts.brief} change="status Ready → In production" onOpen={onOpen} />
        <StreamingText>Rendering in the Glow Labs visual system. Slide 4 has a claim I want you to look at before</StreamingText>
        <ArtifactCard artifact={artifacts.rendering} onOpen={onOpen} />
      </AssistantMessage>
    </Thread>
  );
}

function EmptyThread({ onStarter }: { onStarter: (text: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-panel ring-1 ring-line">
        <AgentMark size="md" />
      </span>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-sections text-ink">
          <span className="text-ink-secondary">Hey Hanna,</span> what are we making?
        </h2>
        <p className="text-default text-ink-secondary">
          A strategy, a persona, a brief. Your brand docs are attached; @ anything else you want me to read.
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
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [saved, setSaved] = useState(false);

  const update = (kind: ContextSource["kind"], selected: string[]) =>
    onSources(sources.map((s) => (s.kind === kind ? { ...s, selected } : s)));

  const attach = (a: Attachment) =>
    setAttachments((prev) => (prev.some((x) => x.id === a.id) ? prev : [...prev, a]));
  const onMention = (hit: MentionHit) => attach({ id: hit.item.id, kind: hit.source.kind, label: hit.item.label });
  const onAttachArtifact = (a: Artifact) =>
    attach({ id: a.id, kind: a.kind === "content" ? "asset" : a.kind, label: a.title });

  const made = [artifacts.burned, artifacts.bride, artifacts.strategy, artifacts.brief];

  const composer = (
    <Composer
      value={draft}
      onChange={setDraft}
      onSend={() => {
        setDraft("");
        setAttachments([]);
      }}
      generating={mode === "thread"}
      onStop={() => undefined}
      attachments={attachments}
      onRemoveAttachment={(id) => setAttachments((prev) => prev.filter((a) => a.id !== id))}
      mentionSources={mentionSources}
      onMention={onMention}
      tools={<QuickPrompts groups={promptGroups} onPick={(p) => setDraft(p.text)} />}
      context={sources.map((s) => (
        <ContextAttachment key={s.kind} source={s} onChange={(sel) => update(s.kind, sel)} />
      ))}
    />
  );

  return (
    <div className="flex h-[820px] overflow-hidden rounded-[var(--radius-overlay)] bg-canvas ring-1 ring-line">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        {mode === "thread" ? (
          <>
            <ChatHeader title="Vitamin C — Q4 strategy" made={made} onOpen={onOpen} />
            <div className="min-h-0 flex-1 overflow-y-auto px-8 pt-4 pb-6">
              <DemoThread onOpen={onOpen} onAttach={onAttachArtifact} onSave={() => setSaved(true)} saved={saved} />
            </div>
            <div className="shrink-0 px-8 pt-1 pb-5">
              <div className="mx-auto max-w-[760px]">{composer}</div>
            </div>
          </>
        ) : (
          <>
            <ChatHeader title="New chat" made={[]} onOpen={onOpen} />
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

function StaticPills({ sources }: { sources: ContextSource[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {sources.map((s) => (
        <ContextPill
          key={s.kind}
          icon={<s.icon />}
          label={s.label}
          count={s.selected.length}
          pinned={s.pinned}
          onClear={() => undefined}
        />
      ))}
    </div>
  );
}

const docKinds: ArtifactKind[] = ["brand_core", "product_facts", "visual_system", "research", "persona", "strategy", "brief"];

export function ChatDemo() {
  const [mode, setMode] = useState<"thread" | "empty">("thread");
  const [sources, setSources] = useState(initialSources);
  const [open, setOpen] = useState<Artifact | null>(null);
  const [docSources, setDocSources] = useState(initialSources);
  const [docDraft, setDocDraft] = useState("");
  const [docAttachments, setDocAttachments] = useState<Attachment[]>([
    { id: "p1", kind: "persona", label: "The Burned Professional" },
    { id: "r1", kind: "research", label: "Competitor scan — 30 days" },
  ]);

  const openArtifact = (a: Artifact) => setOpen(a);
  const updateDoc = (kind: ContextSource["kind"], sel: string[]) =>
    setDocSources(docSources.map((x) => (x.kind === kind ? { ...x, selected: sel } : x)));
  const bySource = (kind: ContextSource["kind"]) => docSources.find((s) => s.kind === kind)!;

  const staticHits = mentionHits(mentionSources, "bur");

  return (
    <Page>
      <PageHeader
        eyebrow="Patterns"
        title="Chat"
        lede="Where strategy gets made. The user tells the agent what to read, the agent answers in prose and in documents, and every document is a real object — a persona, a strategy, a brief — with one rich-text body that the agent reads back as context in the next turn. Briefs are the only documents that go anywhere: to Ideas when saved, to Content when made."
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
        rule="Live. Type @ in the composer to attach a document, open a pill to pick personas by face, open any card, save the brief to Ideas, hover a reply for its actions. The sidebar is the app's navigation: Chat, then the two places work lands (Ideas, Content), then the knowledge the agent reads from (Brand, Documents, Assets)."
      >
        <AppFrame mode={mode} sources={sources} onSources={setSources} onOpen={openArtifact} />
      </Section>

      <Section
        id="composer"
        title="Composer"
        rule="A tray with two jobs. The panel is the message: attached documents along its top, the text, and a bar of tools for this message — add, prompts, send. The pills beneath are context for the whole conversation, so they sit outside the message but inside the tray. Brand is pinned and shows a check; it is a fact, not a choice. Enter sends, Shift-Enter breaks a line."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <span className="text-cap text-ink-disabled">Empty</span>
            <Composer value="" onChange={() => undefined} onSend={() => undefined} />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-cap text-ink-disabled">Typing — send enables, the hint appears</span>
            <Composer
              value={docDraft || "Draft an identity angle for the burned professional × dullness."}
              onChange={setDocDraft}
              onSend={() => setDocDraft("")}
              mentionSources={mentionSources}
            />
          </div>
          <div className="flex flex-col gap-2 lg:col-span-2">
            <span className="text-cap text-ink-disabled">
              Two documents attached to this message, generating — send becomes stop; pills stay editable
            </span>
            <Composer
              value=""
              onChange={() => undefined}
              onSend={() => undefined}
              generating
              attachments={docAttachments}
              onRemoveAttachment={(id) => setDocAttachments(docAttachments.filter((a) => a.id !== id))}
              mentionSources={mentionSources}
              tools={<QuickPrompts groups={promptGroups} onPick={() => undefined} />}
              context={docSources.map((s) => (
                <ContextAttachment key={s.kind} source={s} onChange={(sel) => updateDoc(s.kind, sel)} />
              ))}
            />
          </div>
        </div>
      </Section>

      <Section
        id="mentions"
        title="@ mentions"
        rule="Typing @ opens one flat list grouped under the document types, so the user sees what kinds of thing exist while typing the name of one. Arrow keys walk it, Enter attaches, Escape dismisses; the @query is removed from the text and the document appears as a chip in the panel. Already-attached documents show a check rather than disappearing — the list is also how the user confirms what the agent can see."
      >
        <div className="flex flex-col gap-5">
          <Row label="menu · '@bur'">
            <MentionMenu hits={staticHits} query="bur" activeIndex={0} attached={["p1"]} onPick={() => undefined} onBrowse={() => undefined} />
          </Row>
          <Row label="attached chip">
            <AttachedChip attachment={{ id: "p1", kind: "persona", label: "The Burned Professional" }} onRemove={() => undefined} />
            <AttachedChip attachment={{ id: "r1", kind: "research", label: "Competitor scan — 30 days" }} onRemove={() => undefined} />
            <AttachedChip attachment={{ id: "as3", kind: "asset", label: "Before / after — cheek" }} />
          </Row>
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              ["@ mention", "Attaches one document to this message. Brand, Research, Personas, Strategy, Briefs and Assets are all reachable."],
              ["+ menu", "The same places for people who do not know the shortcut: mention a document, add from assets, attach files, use a skill."],
              ["/ skill", "Runs a named skill — competitor scan, hook writer, compliance check — with the current context."],
            ].map(([t, b]) => (
              <div key={t} className="flex flex-col gap-1 rounded-control bg-panel p-3.5">
                <span className="text-default text-ink">{t}</span>
                <span className="text-cap leading-4 text-ink-secondary">{b}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section
        id="pickers"
        title="Context pills & pickers"
        rule="A pill is an attachable source of grounding, and a different object from a Chip: chips filter a list, pills change what the agent knows. Rest is an outline with a plus; attached is a fill with a count; pinned is a fill with a check. Clicking opens a picker in a dialog — the room to see three personas at once, and it closes on a decision (Done), not a click-away. The agent's suggestion is a card at the top with the one-line reason."
      >
        <div className="flex flex-col gap-5">
          <Row label="rest / attached / pinned">
            <StaticPills sources={docSources} />
          </Row>
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="flex flex-col gap-2">
              <span className="text-cap text-ink-disabled">Cards — personas, chosen by face</span>
              <div className="overflow-hidden rounded-[var(--radius-overlay)] bg-panel pt-5 shadow-overlay">
                <ContextPickerBody source={bySource("persona")} onChange={(sel) => updateDoc("persona", sel)} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-cap text-ink-disabled">List — research, strategies, brand</span>
              <div className="overflow-hidden rounded-[var(--radius-overlay)] bg-panel pt-5 shadow-overlay">
                <ContextPickerBody source={bySource("research")} onChange={(sel) => updateDoc("research", sel)} />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-cap text-ink-disabled">Grid — assets</span>
            <div className="max-w-3xl overflow-hidden rounded-[var(--radius-overlay)] bg-panel pt-5 shadow-overlay">
              <ContextPickerBody source={bySource("asset")} onChange={(sel) => updateDoc("asset", sel)} />
            </div>
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
        </div>
      </Section>

      <Section
        id="messages"
        title="Messages"
        rule="The user's turn is a bubble; the agent's is not. A bubble says 'this is a quote', which is what a prompt is. The reply is the working surface — full measure, no container, attributed by the spectrum mark alone. What the agent did before answering collapses to one line of evidence; when it edits a document that already exists, one quiet 'Updated …' line logs the change without re-printing the document."
      >
        <div className="rounded-[var(--radius-overlay)] bg-canvas p-6 ring-1 ring-line">
          <Thread>
            <UserMessage
              author={{ name: "Hanna Moore" }}
              context={<ContextEcho icon={<contextKinds.persona.icon />}>2 personas</ContextEcho>}
            >
              Which of these two personas should we lead with in October?
            </UserMessage>
            <AssistantMessage>
              <Steps
                summary="Compared 2 personas against the Q4 strategy"
                items={[{ label: "Read both persona documents" }, { label: "Checked seasonality in the review mine" }]}
              />
              <p>
                Lead with <strong>the Burned Professional</strong>. She enters problem-aware, which is where organic
                wins; the Bride is solution-aware and will convert on retargeting anyway. October also has no wedding
                peak.
              </p>
              <Suggestions items={["Make her the primary persona", "Show the October plan"]} />
            </AssistantMessage>
            <UserMessage author={{ name: "Hanna Moore" }}>Do it.</UserMessage>
            <AssistantMessage>
              <DocUpdate artifact={artifacts.burned} change="subtype Secondary → Primary" onOpen={openArtifact} />
              <DocUpdate artifact={artifacts.strategy} change="rewrote Audience; re-ordered pillars" onOpen={openArtifact} />
              <p>Done. The strategy now leads with her, and the Bride drops to one post a fortnight.</p>
            </AssistantMessage>
            <AssistantMessage streaming>
              <StreamingText>Checking whether the change leaves any pillar without a persona</StreamingText>
            </AssistantMessage>
          </Thread>
        </div>
      </Section>

      <Section
        id="artifacts"
        title="Artifact cards"
        rule="A document the agent made, sitting in the thread. Kind, title, the opening line of the body and the few properties that matter — enough to recognise it when scrolling back. No field grid, because a document has no fields; it has a body, and the card shows how the body begins. Seven document kinds and one content kind share one card. Only a brief has a destination."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {docKinds.map((k) => {
            const a = Object.values(artifacts).find((x) => x.kind === k && x.status !== "generating")!;
            return <ArtifactCard key={k} artifact={a} onOpen={openArtifact} onSave={() => undefined} />;
          })}
          <ArtifactCard artifact={{ ...artifacts.brief, id: "b1s", saved: true }} onOpen={openArtifact} />
          <ArtifactCard artifact={artifacts.content} onOpen={openArtifact} />
          <ArtifactCard artifact={artifacts.generating} />
          <ArtifactCardSkeleton />
        </div>
        <div className="grid gap-2 pt-2 sm:grid-cols-3">
          {[
            [
              "Brand · Research · Persona · Strategy",
              "Context. They live in Brand and Documents and are read by the agent in later turns. Menu: attach to chat, open page, duplicate, delete. Nothing to add them to.",
              <Badge key="ctx" dot={false}>Documents</Badge>,
            ],
            [
              "Brief",
              "The one document with somewhere to go. Save to ideas keeps it as an idea, tagged by persona, angle, pillar, channel and format. Make this produces the content — from the card, the drawer, or by replying 'go make it'.",
              <Badge key="idea" dot={false}>Ideas</Badge>,
            ],
            [
              "Content",
              "What a brief becomes. Carries the slides and a link back to its brief; lives in Content. Next step is to schedule it.",
              <Badge key="content" dot={false}>Content</Badge>,
            ],
          ].map(([t, b, badge]) => (
            <div key={t as string} className="flex flex-col gap-1.5 rounded-control bg-panel p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-default text-ink">{t}</span>
                {badge}
              </div>
              <span className="text-cap leading-4 text-ink-secondary">{b}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="drawer"
        title="Artifact drawer"
        rule="Where a card opens. A drawer rather than a dialog because the conversation is the document's context; a drawer rather than a page because most openings are a glance. Header is the properties, body is the rich text, footer is the one generative next step. Nothing in it knows what a persona is — the body is one Tiptap document, rendered read-only here and editable on the page."
      >
        <Row label="open">
          <Button onClick={() => openArtifact(artifacts.brandCore)}>Brand core</Button>
          <Button onClick={() => openArtifact(artifacts.research)}>Research</Button>
          <Button onClick={() => openArtifact(artifacts.burned)}>Persona</Button>
          <Button onClick={() => openArtifact(artifacts.strategy)}>Strategy</Button>
          <Button onClick={() => openArtifact(artifacts.brief)}>Brief</Button>
          <Button onClick={() => openArtifact(artifacts.content)}>Content</Button>
        </Row>
        <div className="grid gap-2 pt-2 sm:grid-cols-4">
          {[
            ["Persona", "Brief this persona"],
            ["Strategy", "Fill the gaps"],
            ["Research", "Draft personas from this"],
            ["Brief", "Make this · Save to ideas"],
          ].map(([k, n]) => (
            <div key={k} className="flex flex-col gap-1 rounded-control bg-panel p-3.5">
              <span className="text-cap text-ink-disabled">{k}</span>
              <span className="flex items-center gap-1.5 text-default text-ink">
                <Sparkles className="size-3.5" /> {n}
              </span>
            </div>
          ))}
        </div>
        <p className="max-w-2xl pt-1 text-cap text-ink-secondary">
          Body nodes are the Tiptap subset: headings, paragraphs, lists, quotes, tables, images, mentions and citations
          (<Kbd>VOC-017</Kbd>), plus the coverage matrix as a custom node — so the strategy&rsquo;s most important
          visual is a block in its body, not a separate schema.
        </p>
      </Section>

      <ArtifactDrawer
        artifact={open}
        open={open !== null}
        onClose={() => setOpen(null)}
        onNext={() => setOpen(null)}
        onProduce={() => setOpen(null)}
        onSave={() => setOpen(null)}
        onAttach={() => setOpen(null)}
      />
    </Page>
  );
}
