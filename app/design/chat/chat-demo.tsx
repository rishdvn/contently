"use client";

import { Compass, FileText, MessageCircleQuestion, Play, Search, SkipForward, Sparkles } from "lucide-react";
import { useState } from "react";

import {
  ArtifactDrawer,
  Composer,
  ContextAttachment,
  QuickPrompts,
  Suggestions,
  Thread,
  artifactKinds,
  type Artifact,
  type ContextSource,
} from "@/components/patterns/chat";
import { PersonaDoc } from "@/components/patterns/docs/persona-doc";
import { CoverageMatrix, StrategyDoc } from "@/components/patterns/docs/strategy-doc";
import { Button } from "@/components/ui/button";
import { Illustration } from "@/components/ui/imagery";
import { Menu, MenuItem, MenuLabel } from "@/components/ui/menu";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableHead, Td, Th, Tr } from "@/components/ui/table";
import { cn } from "@/lib/cn";

import { AppFrame, AppHeader } from "../_app-shell";
import { Page, PageHeader, Section } from "../_doc";
import { useReplay } from "./_replay";
import { burnedPersona, promptGroups, q4Strategy, recents, sessionEvents, sources as initialSources } from "./data";

type Mode = "strategy" | "research" | "briefs" | "ask";
const modes = [
  { value: "strategy" as Mode, label: "Strategy", icon: <Compass />, detail: "Personas, angles, coverage" },
  { value: "research" as Mode, label: "Research", icon: <Search />, detail: "Scan, mine, cluster" },
  { value: "briefs" as Mode, label: "Briefs", icon: <FileText />, detail: "Hooks and slide beats" },
  { value: "ask" as Mode, label: "Ask", icon: <MessageCircleQuestion />, detail: "No tools, just an answer" },
];
const models = [
  { value: "sonnet", label: "Sonnet 4.5", detail: "Fast, default" },
  { value: "opus", label: "Opus 4.1", detail: "For strategy from scratch" },
];

/** Kind-specific previews in the thread. Only strategy earns one: the matrix is the point. */
function renderPreview(a: Artifact) {
  if (a.kind === "strategy") {
    return (
      <div className="flex flex-col gap-2">
        <CoverageMatrix personas={q4Strategy.personas} pains={q4Strategy.pains} cells={q4Strategy.cells} compact />
        <p className="text-cap text-ink-disabled">{a.meta?.join(" · ")}</p>
      </div>
    );
  }
  return undefined;
}

function ComposerBar({
  sources,
  setSources,
  generating,
  onStop,
}: {
  sources: ContextSource[];
  setSources: (s: ContextSource[]) => void;
  generating: boolean;
  onStop: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<Mode>("strategy");
  const [model, setModel] = useState("sonnet");
  return (
    <Composer
      value={draft}
      onChange={setDraft}
      onSend={() => setDraft("")}
      onStop={onStop}
      generating={generating}
      context={sources.map((s) => (
        <ContextAttachment
          key={s.kind}
          source={s}
          onChange={(selected) => setSources(sources.map((x) => (x.kind === s.kind ? { ...x, selected } : x)))}
        />
      ))}
      leading={
        <>
          <Select variant="inline" size="sm" value={mode} options={modes} onChange={setMode} />
          <Select variant="inline" size="sm" value={model} options={models} onChange={setModel} />
          <QuickPrompts groups={promptGroups} onPick={(p) => setDraft(p.text)} />
        </>
      }
    />
  );
}

export function ChatDemo() {
  const [sources, setSources] = useState(initialSources);
  const [openArtifact, setOpenArtifact] = useState<Artifact | null>(null);
  const { transcript, playing, replay, finish, progress } = useReplay(sessionEvents);

  const made = transcript.turns.flatMap((t) => t.blocks.flatMap((b) => (b.kind === "artifact" && b.status === "done" ? [b.artifact] : [])));
  const last = transcript.turns[transcript.turns.length - 1];
  const finished = last && !last.streaming && last.role === "assistant";

  return (
    <Page wide>
      <PageHeader
        eyebrow="Patterns"
        title="Chat"
        lede="Where strategy gets made. The transcript is rendered from a stored event log in the Claude Agent SDK's own shape, so the same reducer draws a live stream, a reload and a reconnect. Press replay to watch the log arrive as it would over the wire."
        note="Idiom borrowed from Cursor, Devin and Codex: the assistant has no bubble, the user's message is a quiet block, tool work folds into one row, documents are inline blocks with a header."
      />

      <Section title="The surface" rule="Sidebar, header, thread, composer. Nothing in the frame scrolls on its own; the page does.">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={replay} disabled={playing}>
            <Play /> Replay session
          </Button>
          <Button size="sm" variant="ghost" onClick={finish} disabled={!playing}>
            <SkipForward /> Skip to end
          </Button>
          <Progress value={Math.round(progress * 100)} size="sm" spectrum className="w-40" />
          <span className="text-cap text-ink-disabled tabular-nums">
            {transcript.turns.length} turns · {transcript.model ?? "—"} · {transcript.sessionId ?? "—"}
          </span>
        </div>

        <AppFrame active="chat" recents={recents}>
          <AppHeader crumbs={["Chat", "Vitamin C — Q4 strategy"]}>
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
                  <MenuItem key={a.id} icon={<Icon />} onClick={() => setOpenArtifact(a)}>
                    {a.title}
                  </MenuItem>
                );
              })}
            </Menu>
            <Button size="sm">Share</Button>
          </AppHeader>

          <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-6 px-6 pt-4 pb-6">
            <Thread transcript={transcript} onOpenArtifact={setOpenArtifact} renderPreview={renderPreview} />
            {finished ? (
              <Suggestions
                items={["Fill Burned Professional × Dullness", "Write eight hooks for the top angle", "Explain the two empty cells"]}
                className="-mt-2 px-1"
              />
            ) : null}
            <div className="mt-auto pt-4">
              <ComposerBar sources={sources} setSources={setSources} generating={playing} onStop={finish} />
            </div>
          </div>
        </AppFrame>

        <ArtifactDrawer artifact={openArtifact} open={openArtifact !== null} onClose={() => setOpenArtifact(null)} onGenerate={() => setOpenArtifact(null)}>
          {openArtifact?.kind === "persona" ? <PersonaDoc data={burnedPersona} /> : null}
          {openArtifact?.kind === "strategy" ? <StrategyDoc data={q4Strategy} /> : null}
          {openArtifact && openArtifact.kind !== "persona" && openArtifact.kind !== "strategy" ? (
            <p className="text-default text-ink-secondary">{openArtifact.summary}</p>
          ) : null}
        </ArtifactDrawer>
      </Section>

      <Section title="Empty thread" rule="One question and the composer. No feature tour, no wall of suggestions — the prompts library is one click away in the bar.">
        <AppFrame active="chat" recents={recents} className="min-h-[420px]">
          <AppHeader crumbs={["Chat", "New chat"]} />
          <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col items-center justify-center gap-6 px-6 pb-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <Illustration name="empty-thread" className="size-16" />
              <p className="text-panels text-ink">What are we making this week?</p>
              <p className="max-w-sm text-default text-ink-secondary">Attach a product and a brand guide, then ask for a strategy — or start from a saved prompt.</p>
            </div>
            <div className="w-full">
              <ComposerBar sources={sources.map((s) => ({ ...s, selected: [] }))} setSources={() => {}} generating={false} onStop={() => {}} />
            </div>
          </div>
        </AppFrame>
      </Section>

      <Section
        title="How a conversation is stored"
        rule="Complete SDK messages, appended in receipt order. Deltas are never written. The thread is a pure function of this table, which is what makes it survive reloads, reconnects and new SDK features."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {[
            {
              title: "Write",
              body: "Every non-delta SDKMessage the query yields is appended to conversation_events (conversation_id, seq, message jsonb). seq is the receipt order — the SDK warns that timestamps come from the producer's clock and must not be used to sort. Artifacts referenced in tool_use_result are upserted into their own table by id.",
            },
            {
              title: "Read",
              body: "reduceTranscript(events) folds the log into turns of typed blocks. Text blocks are keyed message.id:index, tool blocks by tool_use.id, so a tool_result flips its tool wherever it sits and a complete assistant message replaces the partial blocks its own deltas created — React reconciles in place, nothing jumps.",
            },
            {
              title: "Resume",
              body: "The session itself lives with the SDK (optionally mirrored through sessionStore). To continue we call query({ resume: session_id }); new messages append to the same log. Unknown block or event types render as a collapsed 'unrecognised event', never as a blank thread.",
            },
          ].map((c) => (
            <div key={c.title} className="flex flex-col gap-2 rounded-nav bg-card p-4">
              <h3 className="text-ui text-ink">{c.title}</h3>
              <p className="text-cap leading-4 text-ink-secondary">{c.body}</p>
            </div>
          ))}
        </div>

        <Table>
          <TableHead>
            <Th>SDK message</Th>
            <Th>What the reducer does</Th>
            <Th>What the thread shows</Th>
          </TableHead>
          <TableBody>
            {[
              ["system · init", "Records model and session id", "Nothing"],
              ["user (text)", "Opens a user turn; keeps our own attachments field", "Filled block with @mentions"],
              ["stream_event · content_block_start/delta", "Creates or appends a partial block under a stable key", "Streaming prose with caret; tool row spinning"],
              ["assistant", "Replaces partial blocks with the complete message; tool_use becomes a tool or artifact block by registry", "Prose; activity row; artifact block (generating)"],
              ["user (tool_result)", "Finds the block by tool_use_id; sets status; merges tool_use_result.artifact", "Row ticks; artifact block fills in"],
              ["system · compact_boundary", "Appends a boundary block", "Hairline: 'Context compacted · 84k tokens'"],
              ["result", "Closes the turn with duration and step count", "Footer: 'Done · 42s' and actions"],
              ["anything else", "Appends an unknown block with the raw payload", "Collapsed 'Unrecognised event'"],
            ].map(([a, b, c]) => (
              <Tr key={a}>
                <Td className="font-mono text-cap text-ink">{a}</Td>
                <Td muted className="text-cap">
                  {b}
                </Td>
                <Td muted className="text-cap">
                  {c}
                </Td>
              </Tr>
            ))}
          </TableBody>
        </Table>
      </Section>

      <Section title="What the model can be given" rule="Context is attached per source, inside the composer, and echoed on the message it was sent with. Tools that produce documents are declared once, in the artifact registry.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sources.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.kind} className="flex items-start gap-3 rounded-nav bg-card p-4">
                <Icon className="mt-0.5 size-4 shrink-0 text-ink-secondary" />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-default text-ink">{s.label}</span>
                  <span className="text-cap text-ink-secondary">{s.items.length} in library · {s.selected.length} attached</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className={cn("flex items-center gap-2 rounded-nav bg-card p-4 text-cap text-ink-secondary")}>
          <Sparkles className="size-3.5 text-ink" />
          Artifact tools: create_persona · create_angle · create_strategy · run_research · create_brief · render_carousel — each maps to one ArtifactKind and one document view.
        </div>
      </Section>
    </Page>
  );
}
