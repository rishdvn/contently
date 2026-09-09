/*
  The document layer's vocabulary, mirroring the PRD's data model:

    documents · document_relations · document_versions · doc_blocks
    chat_threads · chat_thread_docs

  Bodies are stored as Tiptap JSON and mirrored to Markdown on save. The agent
  only ever sees `frontmatter + markdown`.
*/

export type DocType =
  | "brand_core"
  | "product_facts"
  | "visual_system"
  | "research_snapshot"
  | "persona"
  | "content_strategy"
  | "brief";

/** Which tab a type lives under. Brand docs are living, singular, always-on context. */
export type DocTab = "brand" | "documents";

export type ResearchSubtype =
  | "account_audit"
  | "competitor_audit"
  | "category_search"
  | "trend_scan"
  | "voc_mine"
  | "review_mine";
export type PersonaSubtype = "primary" | "secondary" | "exploratory";
export type StrategySubtype = "brand" | "channel" | "account" | "campaign";
export type BriefSubtype = "static" | "carousel" | "video";
export type Subtype = ResearchSubtype | PersonaSubtype | StrategySubtype | BriefSubtype;

/** Workflow status. Each type has its own enum (see registry); the union is what the store holds. */
export type DocStatus =
  | "draft"
  | "in_review"
  | "active"
  | "archived"
  | "generating"
  | "published"
  | "ready"
  | "in_production"
  | "used";

/** Orthogonal to workflow status; only living docs carry it. */
export type Freshness =
  | { kind: "unverified" }
  | { kind: "verified"; until: string | null }
  | { kind: "expired"; until: string }
  | { kind: "outdated"; note?: string; by: Author }
  | { kind: "refresh_requested"; at: string };

export type Channel = "instagram" | "tiktok" | "youtube_shorts" | "pinterest" | "x" | "threads" | "email";

export type Author = "agent" | "user";

export type RelationType =
  | "derived_from"
  | "informed_by"
  | "targets_persona"
  | "uses_angle"
  | "uses_strategy"
  | "references_trend"
  | "features_product"
  | "informs"
  | "supersedes";

export type Relation = {
  from: string;
  to: string;
  type: RelationType;
  /** Points at a repeating block inside the target — `persona#angle-2`. */
  anchor?: string | null;
  createdAt: string;
};

/** Small, fixed set of property kinds. No formulas, no custom properties in v1. */
export type PropertyValue =
  | { kind: "text"; value: string }
  | { kind: "select"; value: string }
  | { kind: "multi"; value: string[] }
  | { kind: "date"; value: string }
  | { kind: "range"; start: string; end: string }
  | { kind: "number"; value: number }
  | { kind: "url"; value: string };

export type Properties = Record<string, PropertyValue>;

/** Tiptap-compatible JSON. Kept structural so the store never depends on the editor package. */
export type BodyNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: BodyNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
};

export type Body = { type: "doc"; content: BodyNode[] };

export type Document = {
  id: string;
  brandId: string;
  type: DocType;
  subtype: Subtype | null;
  title: string;
  status: DocStatus;
  version: number;
  properties: Properties;
  body: Body;
  bodyMd: string;
  createdBy: Author;
  /** Chat/skill run that produced it; null when user-created. */
  runId: string | null;
  channels: Channel[];
  accounts: string[];
  tags: string[];
  freshness: Freshness | null;
  owner: string;
  createdAt: string;
  updatedAt: string;
  /** Skill that wrote it, shown on hover over the Agent owner. */
  skill?: string;
  /** Section template headings the agent has not filled yet. */
  missingSections?: string[];
  /** Living docs: a proposed diff waiting for review. */
  pendingDiff?: PendingDiff | null;
  /** The last agent patch, so the editor can highlight it briefly. */
  lastPatch?: { anchor: string; at: string } | null;
  /** Monotonic counter bumped on every body write not made by the editor itself. */
  bodyRevision: number;
};

export type Version = {
  id: string;
  docId: string;
  version: number;
  body: Body;
  bodyMd: string;
  properties: Properties;
  author: Author;
  runId: string | null;
  summary: string;
  createdAt: string;
};

export type PendingDiff = {
  runId: string;
  proposedAt: string;
  summary: string;
  sections: { anchor: string; heading: string; before: string; after: string; accepted?: boolean }[];
};

export type ActivityKind =
  | "created"
  | "patched"
  | "status"
  | "freshness"
  | "relation"
  | "verified"
  | "archived"
  | "run_started"
  | "run_finished"
  | "edited";

export type Activity = {
  id: string;
  docId: string | null;
  kind: ActivityKind;
  author: Author;
  text: string;
  at: string;
  runId?: string | null;
  threadId?: string | null;
};

/** A repeating block mirrored out of a body on save: angles, pillars, quotes, hypotheses. */
export type DocBlock = {
  docId: string;
  anchor: string;
  blockType: "angle" | "pillar" | "quote" | "hypothesis";
  title: string;
  status?: string;
  text: string;
};

/** What a citation chip resolves to on hover and click. */
export type Citation = {
  ref: string;
  text: string;
  /** Document id or URL. */
  source: string;
  sourceLabel: string;
  meta?: string;
  anchor?: string;
};

/* ---------------------------------------------------------------- chat --- */

export type RunStep = { label: string; state: "pending" | "running" | "done" };

export type ReviewField = { label: string; items: string[] };

export type Message =
  | { id: string; role: "user"; text: string; context: string[]; at: string }
  | {
      id: string;
      role: "assistant";
      at: string;
      /** Prose paragraphs, in order. */
      text: string[];
      steps?: RunStep[];
      stepsSummary?: string;
      /** Docs made in this turn, rendered as artifact cards. */
      artifacts?: string[];
      /** A structured review the skill needs before writing. */
      review?: {
        title: string;
        fields: ReviewField[];
        /** Hook-style single choice instead of editable lists. */
        choices?: string[];
        chosen?: number | null;
        resolved: boolean;
      };
      /** "Updated Persona P1: rewrote Objections" lines. */
      patches?: { docId: string; anchor: string; text: string }[];
      suggestions?: string[];
      streaming?: boolean;
      runId?: string | null;
    };

export type Thread = {
  id: string;
  brandId: string;
  title: string;
  /** Docs attached to the thread: pinned Brand docs + explicit mentions. */
  docIds: string[];
  /** Doc the thread was opened against from Stage 3, if any. */
  scopedDocId?: string | null;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
};

export type SavedFilter = { id: string; label: string; filters: Filter[] };

/** One removable chip in the filter bar. */
export type Filter =
  | { kind: "type"; value: DocType }
  | { kind: "subtype"; value: Subtype }
  | { kind: "status"; value: DocStatus }
  | { kind: "freshness"; value: Freshness["kind"] }
  | { kind: "channel"; value: Channel }
  | { kind: "account"; value: string }
  | { kind: "related"; value: string }
  | { kind: "owner"; value: "agent" | "user" }
  | { kind: "quick"; value: QuickFilter }
  | { kind: "text"; value: string };

export type QuickFilter = "needs_review" | "stale" | "generating" | "unused";
