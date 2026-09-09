import type { LucideIcon } from "lucide-react";

/*
  The chat is where strategy gets made, so its vocabulary is the product's
  object graph: what the agent can be grounded on (context) and what it can
  produce (artifacts). Everything in this folder speaks in these terms and
  nothing in components/ui does.
*/

/** What the agent is allowed to draw on for this conversation. */
export type ContextKind = "persona" | "angle" | "brand" | "product" | "asset" | "skill";

export type ContextItem = {
  id: string;
  label: string;
  /** One line under the label in the picker: the persona's identity, the product's price point. */
  detail?: string;
};

export type ContextSource = {
  kind: ContextKind;
  label: string;
  icon: LucideIcon;
  items: ContextItem[];
  selected: string[];
  /** Where the full library lives, for the picker's footer link. */
  href?: string;
};

/** What the agent produces. Each kind has a card in the thread and a document in the drawer. */
export type ArtifactKind = "persona" | "angle" | "strategy" | "research" | "brief" | "carousel";

export type ArtifactStatus = "generating" | "draft" | "ready";

export type Artifact = {
  id: string;
  kind: ArtifactKind;
  title: string;
  summary: string;
  /** Short facts joined by dots: "3 pains · 4 desires · 2 objections". */
  meta?: string[];
  status?: ArtifactStatus;
  /** Carousel and brief cards show a strip of slide thumbnails. */
  thumbnails?: string[];
};

export type Prompt = {
  title: string;
  text: string;
};

export type PromptGroup = {
  label: string;
  icon: LucideIcon;
  prompts: Prompt[];
};
