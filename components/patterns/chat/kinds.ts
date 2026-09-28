import {
  BookOpen,
  FileText,
  Images,
  type LucideIcon,
  Map,
  Package,
  Palette,
  Search,
  User,
  Wand2,
} from "lucide-react";

import type { ArtifactKind, ContextKind, DocumentType } from "./types";

/*
  One registry for everything the chat can name. Adding a document type is one
  line here; the card, the drawer, the mention menu and the pickers read from
  it and do not change.

  `next` is the one generative action that makes sense once this kind exists —
  the spectrum button in the drawer footer and under the card in the thread.
  Briefs are the only kind with a destination: they go to Ideas, then to
  Content once produced. Every other document is context, not a deliverable,
  so it has nowhere to be "added to".
*/
export type KindMeta = {
  label: string;
  plural: string;
  icon: LucideIcon;
  /** Brand docs are always on; documents are attached; content is an output. */
  group: "brand" | "document" | "content";
  next?: string;
};

export const documentKinds: Record<DocumentType, KindMeta> = {
  brand_core: { label: "Brand core", plural: "Brand core", icon: BookOpen, group: "brand", next: "Draft personas from this" },
  product_facts: { label: "Product facts", plural: "Product facts", icon: Package, group: "brand" },
  visual_system: { label: "Visual system", plural: "Visual system", icon: Palette, group: "brand" },
  research: { label: "Research", plural: "Research", icon: Search, group: "document", next: "Draft personas from this" },
  persona: { label: "Persona", plural: "Personas", icon: User, group: "document", next: "Brief this persona" },
  strategy: { label: "Strategy", plural: "Strategies", icon: Map, group: "document", next: "Fill the gaps" },
  brief: { label: "Brief", plural: "Briefs", icon: FileText, group: "document", next: "Make this" },
};

export const artifactKinds: Record<ArtifactKind, KindMeta> = {
  ...documentKinds,
  content: { label: "Content", plural: "Content", icon: Images, group: "content", next: "Schedule" },
};

export const contextKinds: Record<ContextKind, Pick<KindMeta, "label" | "plural" | "icon">> = {
  ...documentKinds,
  asset: { label: "Asset", plural: "Assets", icon: Images },
  skill: { label: "Skill", plural: "Skills", icon: Wand2 },
};

export const isBrandDoc = (kind: ArtifactKind | ContextKind) =>
  kind in documentKinds && documentKinds[kind as DocumentType].group === "brand";
