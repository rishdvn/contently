import type { Artifact, ArtifactKind } from "./types";

/*
  How a conversation is stored and how it becomes UI.

  The Claude Agent SDK yields a stream of messages while a turn runs:

    system (init) → stream_event* → assistant → user (tool_result) → stream_event* → assistant → … → result

  Each carries a uuid, a session_id and a parent_tool_use_id; assistant
  messages wrap an Anthropic `message` whose `content` is an array of blocks
  (text, thinking, tool_use); tool results arrive as *user* messages whose
  content is a tool_result block. Deltas only exist when includePartialMessages
  is on, and they are not part of the transcript — the complete assistant
  message that follows them is.

  We keep the SDK's shape rather than inventing our own, for three reasons:

  1. Persistence is trivial and lossless. Every complete message is appended
     to `conversation_events (conversation_id, seq, message jsonb)` in the
     order it was *received* — never sorted by timestamp, which the SDK docs
     warn comes from the producer's clock. `stream_event`s are never written.

  2. Resume is the SDK's job. The session lives on Anthropic's side (or in a
     `sessionStore` we mirror); we resume with `resume: session_id`. Our event
     log exists to *render*, not to feed the model, so the two can never drift.

  3. Rendering is a pure function of the log. `reduceTranscript(events)` folds
     the same events whether they arrive live over a socket or are read back
     from the database, and produces the same turns and blocks. Reload,
     reconnect, replay — one code path.

  Fluidity comes from the reducer's identity rules. A text block is keyed by
  `${message.id}:${index}`; a tool block by its `tool_use.id`. A delta creates
  the block as partial; the complete message that follows *replaces* it under
  the same key, so React reconciles in place and nothing jumps. A tool_result
  finds its tool block by id and flips it to done, wherever it is. Unknown
  block types fall through to a generic renderer instead of throwing, so a new
  SDK feature degrades to "something happened" rather than a blank thread.
*/

/* ---------------------------------------------------------------------------
   Wire shapes. Structural subsets of the SDK's types — only what we read.
   ------------------------------------------------------------------------ */

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

type Envelope = { uuid: string; session_id: string; parent_tool_use_id: string | null };

export type UserEvent = Envelope & {
  type: "user";
  message: { role: "user"; content: string | ContentBlock[] };
  /** Structured tool output, when this message carries a tool_result. */
  tool_use_result?: unknown;
  /** Ours, not the SDK's: which context sources were attached when the user sent this. */
  attachments?: { kind: string; label: string }[];
};

export type AssistantEvent = Envelope & {
  type: "assistant";
  message: { id: string; role: "assistant"; model: string; content: ContentBlock[]; stop_reason: string | null };
  error?: string;
};

export type ResultEvent = Envelope & {
  type: "result";
  subtype: "success" | "error_max_turns" | "error_during_execution";
  duration_ms: number;
  num_turns: number;
  is_error: boolean;
  errors?: string[];
};

export type SystemEvent = Envelope &
  (
    | { type: "system"; subtype: "init"; model: string }
    | { type: "system"; subtype: "compact_boundary"; compact_metadata: { trigger: "manual" | "auto"; pre_tokens: number } }
  );

export type StreamEvent = Envelope & {
  type: "stream_event";
  event:
    | { type: "message_start"; message: { id: string; model: string } }
    | { type: "content_block_start"; index: number; content_block: ContentBlock }
    | { type: "content_block_delta"; index: number; delta: { type: "text_delta"; text: string } | { type: "input_json_delta"; partial_json: string } | { type: "thinking_delta"; thinking: string } }
    | { type: "content_block_stop"; index: number }
    | { type: "message_delta"; delta: { stop_reason: string | null } }
    | { type: "message_stop" };
};

export type TranscriptEvent = UserEvent | AssistantEvent | ResultEvent | SystemEvent | StreamEvent;

/** What actually gets written. Deltas never do. */
export type StoredEvent = Exclude<TranscriptEvent, StreamEvent>;

/* ---------------------------------------------------------------------------
   View model. What the thread renders.
   ------------------------------------------------------------------------ */

export type ToolStatus = "running" | "done" | "error";

export type Block =
  | { kind: "text"; id: string; text: string; partial: boolean }
  | { kind: "thinking"; id: string; text: string; partial: boolean }
  | {
      kind: "tool";
      id: string;
      name: string;
      input: Record<string, unknown>;
      /** Raw JSON accumulated from input_json_delta while the call streams. */
      partialInput?: string;
      status: ToolStatus;
      result?: string;
    }
  | { kind: "artifact"; id: string; artifact: Artifact; status: ToolStatus; partialInput?: string }
  | { kind: "error"; id: string; message: string }
  | { kind: "boundary"; id: string; preTokens: number; trigger: "manual" | "auto" }
  | { kind: "unknown"; id: string; raw: unknown };

export type Turn = {
  id: string;
  role: "user" | "assistant";
  blocks: Block[];
  /** True between the first delta and the result. */
  streaming: boolean;
  attachments?: { kind: string; label: string }[];
  result?: { durationMs: number; steps: number; isError: boolean };
};

export type Transcript = {
  sessionId: string | null;
  model: string | null;
  turns: Turn[];
};

/* ---------------------------------------------------------------------------
   Artifact registry. The one place the product's vocabulary meets the SDK's.
   ------------------------------------------------------------------------ */

/**
 * Tools whose result is a document. When the model calls one of these the
 * tool block is shown as an artifact from the first delta — title from the
 * input while it streams, full card once the tool_result carries the artifact.
 * Adding a document type is adding a line here; the reducer does not change.
 */
export const artifactTools: Record<string, ArtifactKind> = {
  create_persona: "persona",
  create_angle: "angle",
  create_strategy: "strategy",
  run_research: "research",
  create_brief: "brief",
  render_carousel: "carousel",
};

/** Short verbs for tool rows. Anything unlisted shows its raw name. */
export const toolLabels: Record<string, (input: Record<string, unknown>) => string> = {
  read_source: (i) => `Read ${String(i.title ?? "source")}`,
  search_library: (i) => `Searched library for “${String(i.query ?? "")}”`,
  scan_accounts: (i) => `Scanned ${Array.isArray(i.accounts) ? i.accounts.length : ""} accounts`,
  cluster_comments: (i) => `Clustered ${String(i.count ?? "")} comments`,
  coverage_matrix: () => "Computed coverage matrix",
  compliance_check: (i) => `Checked ${String(i.count ?? "")} claims against the legal guide`,
  create_persona: (i) => `Drafting persona “${String(i.title ?? "")}”`,
  create_strategy: (i) => `Drafting strategy “${String(i.title ?? "")}”`,
  create_brief: (i) => `Writing brief “${String(i.title ?? "")}”`,
  run_research: (i) => `Researching ${String(i.title ?? "")}`,
  create_angle: (i) => `Drafting angle “${String(i.title ?? "")}”`,
  render_carousel: (i) => `Rendering “${String(i.title ?? "")}”`,
};

export function toolLabel(block: Extract<Block, { kind: "tool" }>) {
  return toolLabels[block.name]?.(block.input) ?? block.name.replaceAll("_", " ");
}

/* ---------------------------------------------------------------------------
   Reducer
   ------------------------------------------------------------------------ */

const blockId = (messageId: string, index: number) => `${messageId}:${index}`;

function tryParse(json: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(json);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function fromContentBlock(messageId: string, index: number, b: ContentBlock, partial: boolean): Block {
  switch (b.type) {
    case "text":
      return { kind: "text", id: blockId(messageId, index), text: b.text, partial };
    case "thinking":
      return { kind: "thinking", id: blockId(messageId, index), text: b.thinking, partial };
    case "tool_use": {
      const artifactKind = artifactTools[b.name];
      if (artifactKind) {
        return {
          kind: "artifact",
          id: b.id,
          status: "running",
          artifact: {
            id: b.id,
            kind: artifactKind,
            title: String(b.input.title ?? "Untitled"),
            summary: "",
            status: "generating",
          },
        };
      }
      return { kind: "tool", id: b.id, name: b.name, input: b.input, status: "running" };
    }
    default:
      return { kind: "unknown", id: blockId(messageId, index), raw: b };
  }
}

/** Replace a block with the same id anywhere in the transcript, or append to the given turn. */
function upsert(turn: Turn, block: Block) {
  const i = turn.blocks.findIndex((b) => b.id === block.id);
  if (i >= 0) turn.blocks[i] = block;
  else turn.blocks.push(block);
}

function findBlock(turns: Turn[], id: string): Block | undefined {
  for (let t = turns.length - 1; t >= 0; t--) {
    const b = turns[t].blocks.find((x) => x.id === id);
    if (b) return b;
  }
  return undefined;
}

function lastAssistant(turns: Turn[]): Turn {
  const last = turns[turns.length - 1];
  if (last?.role === "assistant") return last;
  const turn: Turn = { id: `a-${turns.length}`, role: "assistant", blocks: [], streaming: true };
  turns.push(turn);
  return turn;
}

/**
 * Fold events into turns. Pure and total: never throws on an event it does
 * not understand, so a newer SDK cannot blank the thread.
 */
export function reduceTranscript(events: TranscriptEvent[]): Transcript {
  const turns: Turn[] = [];
  let sessionId: string | null = null;
  let model: string | null = null;
  /* Streaming state, keyed by the in-flight message id. */
  let streamingMessage: { id: string; indexToBlockId: Map<number, string> } | null = null;

  for (const ev of events) {
    sessionId = ev.session_id ?? sessionId;

    /* Subagent traffic renders inside its parent tool row, not as top-level turns. */
    if (ev.parent_tool_use_id) continue;

    switch (ev.type) {
      case "system": {
        if (ev.subtype === "init") model = ev.model;
        else {
          lastAssistant(turns).blocks.push({
            kind: "boundary",
            id: ev.uuid,
            preTokens: ev.compact_metadata.pre_tokens,
            trigger: ev.compact_metadata.trigger,
          });
        }
        break;
      }

      case "user": {
        const content = ev.message.content;
        const toolResults = typeof content === "string" ? [] : content.filter((b) => b.type === "tool_result");

        if (toolResults.length) {
          for (const r of toolResults) {
            const target = findBlock(turns, r.tool_use_id);
            if (!target) continue;
            if (target.kind === "tool") {
              target.status = r.is_error ? "error" : "done";
              target.result = r.content;
            } else if (target.kind === "artifact") {
              const structured = ev.tool_use_result as { artifact?: Partial<Artifact> } | undefined;
              target.status = r.is_error ? "error" : "done";
              target.artifact = {
                ...target.artifact,
                ...structured?.artifact,
                status: r.is_error ? target.artifact.status : (structured?.artifact?.status ?? "draft"),
              };
            }
          }
          break;
        }

        const text =
          typeof content === "string"
            ? content
            : content
                .filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text")
                .map((b) => b.text)
                .join("\n");
        turns.push({
          id: ev.uuid,
          role: "user",
          blocks: [{ kind: "text", id: `${ev.uuid}:0`, text, partial: false }],
          streaming: false,
          attachments: ev.attachments,
        });
        break;
      }

      case "stream_event": {
        const turn = lastAssistant(turns);
        turn.streaming = true;
        const e = ev.event;
        if (e.type === "message_start") {
          streamingMessage = { id: e.message.id, indexToBlockId: new Map() };
        } else if (streamingMessage && e.type === "content_block_start") {
          const block = fromContentBlock(streamingMessage.id, e.index, e.content_block, true);
          streamingMessage.indexToBlockId.set(e.index, block.id);
          upsert(turn, block);
        } else if (streamingMessage && e.type === "content_block_delta") {
          const id = streamingMessage.indexToBlockId.get(e.index);
          const block = id ? turn.blocks.find((b) => b.id === id) : undefined;
          if (!block) break;
          if (e.delta.type === "text_delta" && block.kind === "text") block.text += e.delta.text;
          else if (e.delta.type === "thinking_delta" && block.kind === "thinking") block.text += e.delta.thinking;
          else if (e.delta.type === "input_json_delta") {
            if (block.kind === "tool") {
              block.partialInput = (block.partialInput ?? "") + e.delta.partial_json;
              const parsed = tryParse(block.partialInput);
              if (parsed) block.input = parsed;
            } else if (block.kind === "artifact") {
              /* Title arrives first in the JSON, so the card can name itself early. */
              block.partialInput = (block.partialInput ?? "") + e.delta.partial_json;
              const m = /"title"\s*:\s*"([^"]*)"/.exec(block.partialInput);
              if (m) block.artifact = { ...block.artifact, title: m[1] };
            }
          }
        } else if (streamingMessage && e.type === "content_block_stop") {
          const id = streamingMessage.indexToBlockId.get(e.index);
          const block = id ? turn.blocks.find((b) => b.id === id) : undefined;
          if (block && (block.kind === "text" || block.kind === "thinking")) block.partial = false;
        } else if (e.type === "message_stop") {
          streamingMessage = null;
        }
        break;
      }

      case "assistant": {
        const turn = lastAssistant(turns);
        /* The complete message supersedes any partial blocks from its own deltas. */
        ev.message.content.forEach((b, i) => {
          const block = fromContentBlock(ev.message.id, i, b, false);
          const existing = turn.blocks.find((x) => x.id === block.id);
          /* Keep status/result if a tool_result already landed (it can, on replay). */
          if (existing && existing.kind === "tool" && block.kind === "tool") {
            block.status = existing.status;
            block.result = existing.result;
          }
          if (existing && existing.kind === "artifact" && block.kind === "artifact") {
            block.status = existing.status;
            block.artifact = { ...block.artifact, ...existing.artifact, title: block.artifact.title };
          }
          upsert(turn, block);
        });
        if (ev.error) turn.blocks.push({ kind: "error", id: `${ev.uuid}:error`, message: ev.error });
        streamingMessage = null;
        break;
      }

      case "result": {
        const turn = lastAssistant(turns);
        turn.streaming = false;
        turn.result = { durationMs: ev.duration_ms, steps: ev.num_turns, isError: ev.is_error };
        if (ev.is_error && ev.errors?.length) {
          turn.blocks.push({ kind: "error", id: `${ev.uuid}:error`, message: ev.errors.join("\n") });
        }
        break;
      }

      default:
        lastAssistant(turns).blocks.push({ kind: "unknown", id: (ev as Envelope).uuid, raw: ev });
    }
  }

  return { sessionId, model, turns };
}

/* ---------------------------------------------------------------------------
   Stream expansion. Turns a stored log back into the live stream that
   produced it, so the demo and tests exercise the same reducer path as
   production. Text is chunked by word; tool inputs by JSON fragment.
   ------------------------------------------------------------------------ */

export function expandToStream(events: StoredEvent[]): TranscriptEvent[] {
  const out: TranscriptEvent[] = [];
  for (const ev of events) {
    if (ev.type !== "assistant") {
      out.push(ev);
      continue;
    }
    const env = { uuid: `${ev.uuid}:stream`, session_id: ev.session_id, parent_tool_use_id: ev.parent_tool_use_id };
    out.push({ ...env, type: "stream_event", event: { type: "message_start", message: { id: ev.message.id, model: ev.message.model } } });
    ev.message.content.forEach((b, index) => {
      if (b.type === "text") {
        out.push({ ...env, type: "stream_event", event: { type: "content_block_start", index, content_block: { type: "text", text: "" } } });
        for (const word of b.text.match(/\S+\s*/g) ?? []) {
          out.push({ ...env, type: "stream_event", event: { type: "content_block_delta", index, delta: { type: "text_delta", text: word } } });
        }
      } else if (b.type === "tool_use") {
        out.push({ ...env, type: "stream_event", event: { type: "content_block_start", index, content_block: { ...b, input: {} } } });
        const json = JSON.stringify(b.input);
        for (let i = 0; i < json.length; i += 24) {
          out.push({ ...env, type: "stream_event", event: { type: "content_block_delta", index, delta: { type: "input_json_delta", partial_json: json.slice(i, i + 24) } } });
        }
      } else if (b.type === "thinking") {
        out.push({ ...env, type: "stream_event", event: { type: "content_block_start", index, content_block: { type: "thinking", thinking: "" } } });
        out.push({ ...env, type: "stream_event", event: { type: "content_block_delta", index, delta: { type: "thinking_delta", thinking: b.thinking } } });
      }
      out.push({ ...env, type: "stream_event", event: { type: "content_block_stop", index } });
    });
    out.push({ ...env, type: "stream_event", event: { type: "message_delta", delta: { stop_reason: ev.message.stop_reason } } });
    out.push({ ...env, type: "stream_event", event: { type: "message_stop" } });
    out.push(ev);
  }
  return out;
}

/** Pacing for the replay: deltas are quick, tool results take a beat. */
export function eventDelay(ev: TranscriptEvent): number {
  if (ev.type === "stream_event") {
    if (ev.event.type === "content_block_delta") return ev.event.delta.type === "text_delta" ? 28 : 12;
    return 0;
  }
  if (ev.type === "user") return 700;
  if (ev.type === "assistant") return 120;
  return 0;
}
