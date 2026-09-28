import type { LucideIcon } from "lucide-react";

/*
  The chat is where strategy gets made, so its vocabulary is the product's
  object graph: what the agent can be grounded on (context) and what it can
  produce (artifacts). Everything in this folder speaks in these terms and
  nothing in components/ui does.

  Documents are the unit of memory (see the Documents PRD). Every strategic
  output — brand core, research, persona, strategy, brief — is a document with
  a type, a handful of filterable properties and ONE rich-text body. There is
  no per-type field schema: the body is a Tiptap document and the agent reads
  it as markdown. That is why Artifact carries a `body` and not a bag of keys.
*/

/* ------------------------------------------------------------------ */
/*  Documents                                                          */
/* ------------------------------------------------------------------ */

/** The seven document types. The first three are the always-on Brand docs. */
export type DocumentType =
  | "brand_core"
  | "product_facts"
  | "visual_system"
  | "research"
  | "persona"
  | "strategy"
  | "brief";

/**
 * What the agent can leave behind in a thread: any document, or a piece of
 * produced content (a carousel, a static, a video) made from a brief.
 */
export type ArtifactKind = DocumentType | "content";

export type ArtifactStatus = "generating" | "draft" | "ready";

/**
 * Structure only what you filter or relate on. A property is a label and a
 * value; relations point at another artifact so the UI can open it. Anything
 * that is not a property lives in the body.
 */
export type ArtifactProperty = {
  label: string;
  value: string;
  /** Set when the value names another document; the pill becomes a link. */
  relation?: { id: string; kind: ArtifactKind };
};

export type Artifact = {
  id: string;
  kind: ArtifactKind;
  title: string;
  status?: ArtifactStatus;
  properties?: ArtifactProperty[];
  /** The one rich-text container. The card shows its first paragraph. */
  body: RichDoc;
  /** Briefs only: already sitting in Ideas. */
  saved?: boolean;
  /** Content only: the rendered slides. */
  thumbnails?: string[];
};

/* ------------------------------------------------------------------ */
/*  Rich text                                                          */
/* ------------------------------------------------------------------ */

/*
  A deliberately small subset of Tiptap's JSON document shape, with the same
  node names, so the read-only renderer here and the real editor agree on what
  a document is. Repeating blocks the product cares about — the coverage
  matrix, a citation — are custom nodes, exactly as they will be in Tiptap.
*/

export type RichMark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "code" }
  | { type: "link"; attrs: { href: string } };

export type RichInline =
  | { type: "text"; text: string; marks?: RichMark[] }
  /** A chip pointing at another document, or at a piece of evidence (VOC-017). */
  | { type: "mention"; attrs: { id: string; label: string; kind: ArtifactKind | "citation" } };

export type RichNode =
  | { type: "heading"; attrs: { level: 1 | 2 | 3 }; content: RichInline[] }
  | { type: "paragraph"; content: RichInline[] }
  | { type: "bulletList"; content: RichInline[][] }
  | { type: "orderedList"; content: RichInline[][] }
  | { type: "blockquote"; content: RichInline[] }
  | { type: "table"; attrs?: { headerRow?: boolean }; rows: string[][] }
  | { type: "image"; attrs: { src?: string; bg?: string; alt: string; caption?: string } }
  | { type: "horizontalRule" }
  | {
      type: "coverageMatrix";
      attrs: { personas: string[]; pains: string[]; cells: CoverageCell[][] };
    };

export type RichDoc = { type: "doc"; content: RichNode[] };

export type CoverageCell = { angles: number; hooks?: number };

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

/** What the agent is allowed to draw on: any document type, media, or a skill. */
export type ContextKind = DocumentType | "asset" | "skill";

export type ContextItem = {
  id: string;
  label: string;
  /** One line under the label: the persona's identity, the research subtype and date. */
  detail?: string;
  /** Longer copy for card layouts. */
  description?: string;
  /** Card layouts show a portrait; grid layouts a thumbnail. Either is a CSS background. */
  image?: string;
};

export type ContextSource = {
  kind: ContextKind;
  label: string;
  icon: LucideIcon;
  items: ContextItem[];
  selected: string[];
  /** Brand docs are attached to every chat unless the user removes them. */
  pinned?: boolean;
  /** How the picker lays the items out. Few and visual → cards; many and visual → grid. */
  layout?: "list" | "cards" | "grid";
  /** The item the agent recommends for this chat, with the one-line reason it shows. */
  suggested?: { id: string; reason: string };
  /** Where the full library lives, for the picker's footer link. */
  href?: string;
};

/** A document the user attached by @-mention or from the + menu, shown as a chip in the composer. */
export type Attachment = {
  id: string;
  kind: ContextKind;
  label: string;
};

/* ------------------------------------------------------------------ */
/*  Prompts                                                            */
/* ------------------------------------------------------------------ */

export type Prompt = {
  title: string;
  text: string;
};

export type PromptGroup = {
  label: string;
  icon: LucideIcon;
  prompts: Prompt[];
};
