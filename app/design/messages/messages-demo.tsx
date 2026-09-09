"use client";

import type { ReactNode } from "react";

import {
  Suggestions,
  Thread,
  expandToStream,
  reduceTranscript,
  type StoredEvent,
  type TranscriptEvent,
} from "@/components/patterns/chat";

import { Page, PageHeader, Section } from "../_doc";
import { sessionEvents } from "../chat/data";

/*
  Every example on this page is the real reducer over a slice of the real
  log. If a state can't be produced from events, it isn't a state the thread
  can be in.
*/

const upTo = (uuid: string): StoredEvent[] => {
  const i = sessionEvents.findIndex((e) => e.uuid === uuid);
  return sessionEvents.slice(0, i + 1);
};
const between = (from: string, to: string): StoredEvent[] => {
  const a = sessionEvents.findIndex((e) => e.uuid === from);
  const b = sessionEvents.findIndex((e) => e.uuid === to);
  return sessionEvents.slice(a, b + 1);
};

/** Cut a stream mid-sentence: everything up to the Nth text delta of the last message. */
function midStream(events: StoredEvent[], deltas: number): TranscriptEvent[] {
  const stream = expandToStream(events);
  let seen = 0;
  for (let i = 0; i < stream.length; i++) {
    const e = stream[i];
    if (e.type === "stream_event" && e.event.type === "content_block_delta" && e.event.delta.type === "text_delta") {
      if (++seen === deltas) return stream.slice(0, i + 1);
    }
  }
  return stream;
}

function Example({ label, events, children }: { label: ReactNode; events: TranscriptEvent[]; children?: ReactNode }) {
  const transcript = reduceTranscript(events);
  return (
    <div className="grid gap-4 lg:grid-cols-[180px_1fr]">
      <div className="text-cap leading-4 text-ink-secondary">{label}</div>
      <div className="rounded-nav bg-panel p-5">
        <Thread transcript={transcript} />
        {children}
      </div>
    </div>
  );
}

const S = { session_id: "sess_7f3a", parent_tool_use_id: null };

export function MessagesDemo() {
  const firstTurn = between("u1", "a1");
  const streamingProse = midStream(between("a5", "a5"), 14);

  return (
    <Page>
      <PageHeader
        eyebrow="Patterns"
        title="Messages"
        lede="The anatomy of a turn. Two voices told apart by shape, not colour: the user's message is a filled block, the assistant's prose is the page. Everything the model did on the way is one collapsible row; everything it made is a block with a header."
        note="Every example here is reduceTranscript() over a slice of the same event log the Chat page replays."
      />

      <Section title="User turn" rule="A quiet block on the card fill, full width, no avatar. Attached context is echoed as @mentions above the text so the message records what the model was given.">
        <Example label="user · text with attachments" events={firstTurn.slice(0, 1)} />
      </Section>

      <Section title="Assistant: prose" rule="No bubble. Paragraph breaks, bold and inline code only — anything richer is a document and becomes an artifact. While streaming, a caret sits at the end of the text; nothing else moves.">
        <Example label="text · partial (streaming)" events={streamingProse} />
        <Example label="text · complete, with footer" events={between("a5", "res1")} />
      </Section>

      <Section
        title="Activity"
        rule="Tool calls fold into a single row. While the turn runs, the row names the current step and stays open; once the result lands it collapses to a count and opens on click. Failed steps are counted, not shouted."
      >
        <Example label="tool · running" events={expandToStream(upTo("a1")).slice(0, -1)} />
        <Example label="tool · done, collapsed" events={between("a1", "r3")} />
        <Example label="tool · one failed" events={between("a7", "r10")} />
      </Section>

      <Section title="Artifacts in the flow" rule="A document tool is an artifact block from its first delta: the same size it will be when done, with a shimmer where the preview goes. The tool_result fills it in without a reflow.">
        <Example label="create_persona · generating" events={between("a3", "a3")} />
        <Example label="create_persona · done" events={between("a3", "r5")} />
      </Section>

      <Section title="Errors, boundaries, unknowns" rule="A failed turn is a compact critical band, not a dialog. Compaction is a hairline. An event the reducer doesn't recognise renders collapsed with its payload — a newer SDK cannot blank the thread.">
        <Example
          label="result · is_error"
          events={[
            { ...S, uuid: "x1", type: "user", message: { role: "user", content: "Scan the last 90 days for all six accounts." } },
            { ...S, uuid: "x2", type: "assistant", message: { id: "m_x", role: "assistant", model: "claude-sonnet-4-5", content: [{ type: "tool_use", id: "tu_x", name: "scan_accounts", input: { accounts: ["a", "b", "c", "d", "e", "f"], days: 90 } }], stop_reason: "tool_use" } },
            { ...S, uuid: "x3", type: "result", subtype: "error_during_execution", duration_ms: 6100, num_turns: 1, is_error: true, errors: ["scan_accounts: rate limited by the platform after 3 accounts. Retry in 12 minutes or narrow the window."] },
          ]}
        />
        <Example
          label="system · compact_boundary"
          events={[
            { ...S, uuid: "y1", type: "user", message: { role: "user", content: "Continue with the bride." } },
            { ...S, uuid: "y2", type: "system", subtype: "compact_boundary", compact_metadata: { trigger: "auto", pre_tokens: 84210 } },
            { ...S, uuid: "y3", type: "assistant", message: { id: "m_y", role: "assistant", model: "claude-sonnet-4-5", content: [{ type: "text", text: "Picking up from the strategy: the Bride has two empty cells, and only Sensitivity is worth an angle." }], stop_reason: "end_turn" } },
            { ...S, uuid: "y4", type: "result", subtype: "success", duration_ms: 3200, num_turns: 1, is_error: false },
          ]}
        />
        <Example
          label="unknown event type"
          events={[
            { ...S, uuid: "z1", type: "user", message: { role: "user", content: "What changed?" } },
            { ...S, uuid: "z2", type: "some_future_event", payload: { note: "from a newer SDK" } } as unknown as TranscriptEvent,
            { ...S, uuid: "z3", type: "result", subtype: "success", duration_ms: 900, num_turns: 0, is_error: false },
          ]}
        />
      </Section>

      <Section title="After the turn" rule="A footer with duration and quiet actions that appear on hover, then up to three follow-ups the user can send with one click. Suggestions are the model's, phrased as the next request.">
        <Example label="footer · suggestions" events={between("a8", "res2")}>
          <Suggestions className="pt-4" items={["Rephrase slide 4 as 'calms'", "Brief the remaining six", "Show me the mirror test slides"]} />
        </Example>
      </Section>
    </Page>
  );
}
