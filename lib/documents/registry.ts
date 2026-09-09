import {
  Compass,
  FileText,
  Fingerprint,
  Package,
  Search,
  SwatchBook,
  User,
  type LucideIcon,
} from "lucide-react";

import type {
  Channel,
  DocStatus,
  DocTab,
  DocType,
  Freshness,
  RelationType,
  Subtype,
} from "./types";

/*
  Everything the UI needs to know about a document type in one place: how it is
  named and drawn, which tab it lives under, its status enum, its subtypes,
  the section template the agent fills, the skill that writes it and the
  sources that skill needs. Section templates are guidance, not validation.
*/

export type TypeMeta = {
  label: string;
  plural: string;
  icon: LucideIcon;
  tab: DocTab;
  /** CSS variable suffix for the type hue: `--color-type-<hue>`. */
  hue: "brand" | "product" | "visual" | "research" | "persona" | "strategy" | "brief";
  living: boolean;
  statuses: DocStatus[];
  subtypes: { value: Subtype; label: string; description: string }[];
  /** H2s the agent fills, in order. */
  sections: string[];
  skill: string;
  intent: string;
  /** For the New → type picker: what the doc will contain and what the skill needs. */
  contains: string;
  needs: string;
  /** Default verification window in days; null for dated docs that do not carry freshness. */
  freshnessDays: number | null;
};

export const docTypes: Record<DocType, TypeMeta> = {
  brand_core: {
    label: "Brand Core",
    plural: "Brand Core",
    icon: Fingerprint,
    tab: "brand",
    hue: "brand",
    living: true,
    statuses: ["draft", "in_review", "active", "archived"],
    subtypes: [],
    sections: [
      "Positioning and story",
      "Mission",
      "Voice",
      "Do / Don't",
      "Proof points",
      "Voice excerpts",
      "Audience summary",
    ],
    skill: "brand-core",
    intent: "The single source of truth for who the brand is and how it speaks.",
    contains: "Positioning, voice traits and dials, do/don't lists, proof points and on-brand excerpts.",
    needs: "Website (About, PDPs, FAQ), own-account audit, founder notes, a short Q&A for gaps.",
    freshnessDays: 90,
  },
  product_facts: {
    label: "Product Facts",
    plural: "Product Facts",
    icon: Package,
    tab: "brand",
    hue: "product",
    living: true,
    statuses: ["draft", "in_review", "active", "archived"],
    subtypes: [],
    sections: [
      "Catalogue",
      "Allowed and disallowed claims",
      "Objections and approved responses",
      "FAQ",
      "Shipping, returns and bundles",
      "Seasonal and limited",
    ],
    skill: "product-facts",
    intent: "Exact, safe-to-use facts about what we sell so copy never invents a price or a claim.",
    contains: "A SKU table with prices and contents, claims you may and may not make, objections with approved answers, FAQ.",
    needs: "Shopify products.json or PDPs, review corpus, founder answers.",
    freshnessDays: 90,
  },
  visual_system: {
    label: "Visual System",
    plural: "Visual System",
    icon: SwatchBook,
    tab: "brand",
    hue: "visual",
    living: true,
    statuses: ["draft", "in_review", "active", "archived"],
    subtypes: [],
    sections: [
      "Palette and type",
      "Photography and illustration",
      "Layout rules per format",
      "Reference board",
      "Text-on-image rules",
      "Generation prompt fragments",
    ],
    skill: "visual-system",
    intent: "How the brand looks in feed, so generated statics and carousels are recognisably ours.",
    contains: "Swatches, type, photography rules, per-format layout rules, a reference board and prompt fragments.",
    needs: "Site CSS, product CDN imagery, top-performing own posts, any uploads.",
    freshnessDays: 90,
  },
  research_snapshot: {
    label: "Research",
    plural: "Research Snapshots",
    icon: Search,
    tab: "documents",
    hue: "research",
    living: false,
    statuses: ["generating", "draft", "published"],
    subtypes: [
      { value: "account_audit", label: "Account audit", description: "Our own accounts" },
      { value: "competitor_audit", label: "Competitor audit", description: "A named account" },
      { value: "category_search", label: "Category search", description: "Keyword, hashtag or topic" },
      { value: "trend_scan", label: "Trend scan", description: "Sounds, formats, memes in a window" },
      { value: "voc_mine", label: "VoC mine", description: "Comments, reviews, DMs, forum threads" },
      { value: "review_mine", label: "Review mine", description: "Product reviews specifically" },
    ],
    sections: [
      "Executive summary",
      "Method",
      "Findings",
      "Top posts",
      "Quote bank",
      "Implications",
      "Open questions",
    ],
    skill: "research",
    intent: "A dated, append-only record of what we looked at and what we found.",
    contains: "Summary, method, evidence-backed findings, top posts, a quote bank with stable ids, implications.",
    needs: "SocialCrawl, site fetch, reviews. Long-running: the doc streams in.",
    freshnessDays: null,
  },
  persona: {
    label: "Persona",
    plural: "Personas",
    icon: User,
    tab: "documents",
    hue: "persona",
    living: true,
    statuses: ["draft", "in_review", "active", "archived"],
    subtypes: [
      { value: "primary", label: "Primary", description: "Lead audience this period" },
      { value: "secondary", label: "Secondary", description: "Worth serving, not leading" },
      { value: "exploratory", label: "Exploratory", description: "Inferred; needs evidence" },
    ],
    sections: [
      "Snapshot",
      "Context and moments",
      "Pains, desires and objections",
      "Their language",
      "Where they are",
      "Angles",
      "QA checklist",
    ],
    skill: "persona",
    intent: "Who we are talking to, in their words, and the angles that move them.",
    contains: "A snapshot, buying moments, pains and objections with VoC citations, their language, angles with anchors, a QA checklist.",
    needs: "Selected Research Snapshots and Brand Core. Presents a structured review before writing.",
    freshnessDays: 90,
  },
  content_strategy: {
    label: "Strategy",
    plural: "Content Strategies",
    icon: Compass,
    tab: "documents",
    hue: "strategy",
    living: true,
    statuses: ["draft", "in_review", "active", "archived"],
    subtypes: [
      { value: "brand", label: "Brand", description: "Cross-channel" },
      { value: "channel", label: "Channel", description: "Instagram, TikTok, Shorts" },
      { value: "account", label: "Account", description: "A specific handle" },
      { value: "campaign", label: "Campaign", description: "A dated push" },
    ],
    sections: [
      "Goals and KPIs",
      "Audience",
      "Pillars",
      "Format mix and cadence",
      "Channel rules",
      "Hypotheses",
      "What's working",
    ],
    skill: "content-strategy",
    intent: "What we publish, for whom, how often, and what we are trying to learn.",
    contains: "Goals, personas in priority order, pillars with share of posts, cadence rules, hypotheses to test.",
    needs: "Brand Core, Personas, Research (account audit, trend scan), founder constraints from chat.",
    freshnessDays: 30,
  },
  brief: {
    label: "Brief",
    plural: "Briefs",
    icon: FileText,
    tab: "documents",
    hue: "brief",
    living: false,
    statuses: ["draft", "ready", "in_production", "used", "archived"],
    subtypes: [
      { value: "static", label: "Static", description: "One image" },
      { value: "carousel", label: "Carousel", description: "Slides" },
      { value: "video", label: "Video", description: "Later" },
    ],
    sections: [
      "Objective",
      "Audience and angle",
      "Key message and proof",
      "Hook options",
      "Structure",
      "Caption and CTA",
      "Visual direction",
      "Must include / must avoid",
      "References",
    ],
    skill: "brief",
    intent: "Everything the production skills need to make one piece of content, and nothing else.",
    contains: "Objective, angle, key message, hook options, slide-by-slide structure, captions, visual direction, references.",
    needs: "A pillar and angle or a trend. Reads Persona, Strategy and Product Facts through relations. Hooks first.",
    freshnessDays: null,
  },
};

export const docTypeOrder: DocType[] = [
  "brand_core",
  "product_facts",
  "visual_system",
  "research_snapshot",
  "persona",
  "content_strategy",
  "brief",
];

export const brandTypes: DocType[] = ["brand_core", "product_facts", "visual_system"];
export const workTypes: DocType[] = ["research_snapshot", "persona", "content_strategy", "brief"];

export const statusLabels: Record<DocStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  active: "Active",
  archived: "Archived",
  generating: "Generating",
  published: "Published",
  ready: "Ready",
  in_production: "In production",
  used: "Used",
};

export type StatusTone = "neutral" | "positive" | "caution" | "critical" | "spectrum";

export const statusTone: Record<DocStatus, StatusTone> = {
  draft: "neutral",
  in_review: "caution",
  active: "positive",
  archived: "neutral",
  generating: "spectrum",
  published: "positive",
  ready: "positive",
  in_production: "caution",
  used: "neutral",
};

export const freshnessLabels: Record<Freshness["kind"], string> = {
  unverified: "Unverified",
  verified: "Verified",
  expired: "Verification expired",
  outdated: "Outdated",
  refresh_requested: "Refresh requested",
};

export const relationLabels: Record<RelationType, { forward: string; reverse: string }> = {
  derived_from: { forward: "Built from", reverse: "Used by" },
  informed_by: { forward: "Informed by", reverse: "Informs" },
  targets_persona: { forward: "Targets", reverse: "Targeted by" },
  uses_angle: { forward: "Uses angle", reverse: "Angle used by" },
  uses_strategy: { forward: "Sits in", reverse: "Used by" },
  references_trend: { forward: "Rides", reverse: "Referenced by" },
  features_product: { forward: "Features", reverse: "Featured in" },
  informs: { forward: "Informs", reverse: "Informed by" },
  supersedes: { forward: "Supersedes", reverse: "Superseded by" },
};

export const channelLabels: Record<Channel, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube_shorts: "YouTube Shorts",
  pinterest: "Pinterest",
  x: "X",
  threads: "Threads",
  email: "Email",
};

export function subtypeLabel(type: DocType, subtype: Subtype | null) {
  if (!subtype) return null;
  return docTypes[type].subtypes.find((s) => s.value === subtype)?.label ?? subtype;
}

/** "Research · VoC mine" — the muted suffix after a title in lists. */
export function typeSuffix(type: DocType, subtype: Subtype | null) {
  const s = subtypeLabel(type, subtype);
  return s ? `${docTypes[type].label} · ${s}` : docTypes[type].label;
}

/** Turns a heading into the stable anchor id used for TOC links and section patches. */
export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
