import { Compass, FileText, Layers, Users } from "lucide-react";

import {
  contextKinds,
  type Artifact,
  type ArtifactKind,
  type ContextSource,
  type PromptGroup,
  type RichDoc,
  type RichInline,
  type RichNode,
} from "@/components/patterns/chat";

/* ------------------------------------------------------------------ */
/*  Rich text builders — keep the demo bodies readable                 */
/* ------------------------------------------------------------------ */

const t = (text: string): RichInline => ({ type: "text", text });
const b = (text: string): RichInline => ({ type: "text", text, marks: [{ type: "bold" }] });
const m = (id: string, label: string, kind: ArtifactKind | "citation" = "citation"): RichInline => ({
  type: "mention",
  attrs: { id, label, kind },
});
const p = (...content: (RichInline | string)[]): RichNode => ({
  type: "paragraph",
  content: content.map((c) => (typeof c === "string" ? t(c) : c)),
});
const h2 = (text: string): RichNode => ({ type: "heading", attrs: { level: 2 }, content: [t(text)] });
const h3 = (text: string): RichNode => ({ type: "heading", attrs: { level: 3 }, content: [t(text)] });
const ul = (...items: (RichInline | string)[][]): RichNode => ({
  type: "bulletList",
  content: items.map((it) => it.map((c) => (typeof c === "string" ? t(c) : c))),
});
const ol = (...items: string[]): RichNode => ({ type: "orderedList", content: items.map((s) => [t(s)]) });
const quote = (text: string): RichNode => ({ type: "blockquote", content: [t(text)] });
const table = (rows: string[][]): RichNode => ({ type: "table", attrs: { headerRow: true }, rows });
const doc = (...content: RichNode[]): RichDoc => ({ type: "doc", content });

/* ------------------------------------------------------------------ */
/*  Context sources                                                    */
/* ------------------------------------------------------------------ */

const portrait = (a: string, c: string) => `linear-gradient(160deg,${a},${c})`;

export const sources: ContextSource[] = [
  {
    kind: "brand_core",
    label: "Brand",
    icon: contextKinds.brand_core.icon,
    pinned: true,
    selected: ["bc", "pf", "vs"],
    items: [
      { id: "bc", label: "Glow Labs — Brand core", detail: "Voice, story, proof points · v4 · verified" },
      { id: "pf", label: "Glow Labs — Product facts", detail: "3 SKUs · synced from Shopify 2d ago" },
      { id: "vs", label: "Glow Labs — Visual system", detail: "Palette, type, feed rules · v2" },
    ],
  },
  {
    kind: "persona",
    label: "Personas",
    icon: contextKinds.persona.icon,
    layout: "cards",
    selected: ["p1"],
    suggested: { id: "p1", reason: "Based on the attached strategy, we recommend" },
    items: [
      {
        id: "p1",
        label: "The Burned Professional",
        detail: "28–35 · Client-facing, cameras on",
        description:
          "Did everything the dermatologist said and her skin is worse than when she started. Enters problem-aware; wants the mechanism, not the promise.",
        image: portrait("#f6d5c4", "#c98f74"),
      },
      {
        id: "p2",
        label: "The Bride",
        detail: "25–35 · Wedding in six months",
        description:
          "Planning everything around one date. Solution-aware and price-insensitive; will pay for certainty and a routine that photographs well.",
        image: portrait("#e7d9f5", "#9b7fc4"),
      },
      {
        id: "p3",
        label: "The Stay-home Mom",
        detail: "30–42 · No time for a routine",
        description:
          "Shows up in comments but not in purchases. Wants low-effort wins and permission to spend on herself. Parked until we have interview evidence.",
        image: portrait("#d8e6c8", "#7f9d63"),
      },
    ],
  },
  {
    kind: "strategy",
    label: "Strategy",
    icon: contextKinds.strategy.icon,
    selected: ["s1"],
    items: [
      { id: "s1", label: "Vitamin C — Q4 organic strategy", detail: "Campaign · Instagram, TikTok · Oct–Dec" },
      { id: "s2", label: "Instagram — evergreen pillars", detail: "Channel · 3 posts / week" },
    ],
  },
  {
    kind: "research",
    label: "Research",
    icon: contextKinds.research.icon,
    selected: [],
    items: [
      { id: "r1", label: "Competitor scan — 30 days", detail: "Competitor audit · Sep 2 · 184 posts" },
      { id: "r2", label: "Review mine — 312 reviews", detail: "Review mine · Aug 28 · 41 quotes" },
      { id: "r3", label: "Own account audit", detail: "Account audit · Aug 20 · @glowlabs" },
    ],
  },
  {
    kind: "asset",
    label: "Assets",
    icon: contextKinds.asset.icon,
    layout: "grid",
    selected: [],
    href: "/assets",
    items: [
      { id: "as1", label: "Sept shoot — serum on marble", detail: "Photography", image: portrait("#f6d5c4", "#c98f74") },
      { id: "as2", label: "Maya — day 30", detail: "UGC", image: portrait("#2a2a2a", "#151515") },
      { id: "as3", label: "Before / after — cheek", detail: "Consented pair", image: portrait("#d8e6c8", "#7f9d63") },
      { id: "as4", label: "Bottle macro", detail: "Photography", image: portrait("#fbe3c9", "#d59a5c") },
      { id: "as5", label: "Texture swatch", detail: "Photography", image: portrait("#cfe3f5", "#6d97c2") },
      { id: "as6", label: "Priya — first week", detail: "UGC", image: portrait("#f2d2dc", "#c66f8c") },
      { id: "as7", label: "Ingredient board", detail: "Illustration", image: portrait("#e7d9f5", "#9b7fc4") },
      { id: "as8", label: "Lifestyle — 7am mirror", detail: "Photography", image: portrait("#fde2e1", "#e0917f") },
    ],
  },
  {
    kind: "skill",
    label: "Skills",
    icon: contextKinds.skill.icon,
    selected: [],
    items: [
      { id: "sk1", label: "Competitor scan", detail: "Pulls the last 30 days from named accounts" },
      { id: "sk2", label: "Hook writer", detail: "Eight hooks per angle × awareness stage" },
      { id: "sk3", label: "Compliance check", detail: "Flags claims against Product facts" },
    ],
  },
];

/** What `@` can reach: every document source plus assets. Skills are `/`. */
export const mentionSources = sources.filter((s) => s.kind !== "skill");

/* ------------------------------------------------------------------ */
/*  Prompts                                                            */
/* ------------------------------------------------------------------ */

export const promptGroups: PromptGroup[] = [
  {
    label: "Strategy",
    icon: Compass,
    prompts: [
      {
        title: "Build a strategy for a product",
        text: "Build a content strategy for {product}. Start from the pains it solves, propose no more than three personas per pain, and draft one angle per pain × persona cell. Show me the coverage matrix before writing any hooks.",
      },
      {
        title: "Find the gaps",
        text: "Look at the current coverage matrix and list every empty pain × persona cell. For each, say whether it is worth filling and why, then draft an angle for the top three.",
      },
      {
        title: "Diversify angle types",
        text: "We have too many social-proof angles. For {persona}, draft one angle each of type new-mechanism, failed-solution and identity, in the persona's own words.",
      },
    ],
  },
  {
    label: "Personas",
    icon: Users,
    prompts: [
      {
        title: "Draft a persona from reviews",
        text: "Read the attached research and draft a persona. Every section should change a downstream decision: the job they hire us for, their current workaround, three concrete pains with VOC citations, the visceral desire, spoken and unspoken objections, buying triggers, and the awareness stage they enter at.",
      },
      {
        title: "Stress-test a persona",
        text: "Argue against {persona}. Which claims are invented rather than evidenced? What would we need to observe in reviews or interviews to confirm them?",
      },
    ],
  },
  {
    label: "Research",
    icon: Layers,
    prompts: [
      {
        title: "Scan competitors",
        text: "Scan the last 30 days of organic content from {accounts}. Group what you find by angle type and awareness stage, and tell me which intersections nobody is serving.",
      },
      {
        title: "Mine the comments",
        text: "Pull the comments on our last 20 posts. Cluster them into pains, desires and objections, and quote the three most representative lines for each cluster.",
      },
    ],
  },
  {
    label: "Briefs",
    icon: FileText,
    prompts: [
      {
        title: "Brief a carousel",
        text: "For {angle} at the {awareness} stage, write a carousel brief. Hook options, slide-by-slide beats, the single claim it proves, the CTA, and which assets to use.",
      },
      {
        title: "Rewrite hooks for a stage",
        text: "Take the hooks in this brief and rewrite them for a {awareness} audience. Keep the angle fixed; only the expression changes.",
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Artifacts                                                          */
/* ------------------------------------------------------------------ */

const slide = (a: string, c: string) => `linear-gradient(160deg,${a},${c})`;

export const artifacts: Record<string, Artifact> = {
  brandCore: {
    id: "bc",
    kind: "brand_core",
    title: "Glow Labs — Brand core",
    status: "ready",
    properties: [
      { label: "Status", value: "Active · v4" },
      { label: "Freshness", value: "Verified until Dec 8" },
      { label: "Channels", value: "Instagram · TikTok" },
    ],
    body: doc(
      p("Glow Labs makes skincare for people whose skin has been over-treated. We are the brand you find after the prescription made things worse."),
      h2("What we believe"),
      p("Most skincare is sold to people with good skin. The person who needs help most is the one who has been burned — literally — by the last thing she tried. She does not need brightness; she needs her barrier back, and she needs someone to explain why."),
      h2("Voice"),
      p("Calm, specific, a little dry. We explain mechanisms in plain words and we never promise glass skin. First person plural for the brand, second person for her. No exclamation marks."),
      ul(
        [b("Do: "), "name the ingredient and the dose. Say what will happen in week one and week four."],
        [b("Do: "), "quote people with the same history as the reader."],
        [b("Don't: "), "use 'glow', 'radiance', 'miracle', 'detox' or any before/after language that implies a cure."],
        [b("Don't: "), "compare against dermatologists by name. We are what comes after, not instead."],
      ),
      h2("Proof points"),
      ul(
        ["312 verified reviews, 4.7 average; 68% mention 'gentle' or 'no sting' ", m("VOC-002", "VOC-002")],
        ["Formulated with a compounding pharmacist; pH 5.5, 15% ascorbic acid, no fragrance."],
        ["Featured in Allure's 'sensitive skin' roundup, March."],
      ),
      h2("Voice excerpts"),
      quote("You did everything right. The product was wrong for your skin, and nobody told you that was possible."),
      quote("Fifteen percent is the dose that works. Anything higher on compromised skin is just a faster way to peel."),
    ),
  },
  productFacts: {
    id: "pf",
    kind: "product_facts",
    title: "Glow Labs — Product facts",
    status: "ready",
    properties: [
      { label: "Status", value: "Active · v7" },
      { label: "Source", value: "Shopify · synced 2d ago" },
      { label: "SKUs", value: "3" },
    ],
    body: doc(
      p("Exact, safe-to-use facts about what we sell so copy never invents a price, an ingredient or a claim. Every number here is the number."),
      h2("Catalogue"),
      table([
        ["SKU", "Price", "In the box", "Hero claim"],
        ["Vitamin C Serum 15%", "$48", "30 ml · dropper · leaflet", "Brightens without stinging compromised skin"],
        ["Barrier Repair Cream", "$36", "50 ml", "Restores barrier in 14 days (in-house panel, n=42)"],
        ["Gentle Cleanser", "$22", "150 ml", "pH-balanced; removes SPF without stripping"],
      ]),
      h2("Allowed and disallowed claims"),
      ul(
        [b("Allowed: "), "'formulated for sensitive skin', 'fragrance-free', 'dermatologist-tested' (report on file)."],
        [b("Disallowed: "), "'cures acne', 'replaces your prescription', 'clinically proven' (no third-party trial), any % improvement figure."],
      ),
      h2("Objections and approved responses"),
      ul(
        [b("'Vitamin C is too harsh for me.' "), "At 15% and pH 5.5 it is the gentlest effective dose; we do not sell 20%. ", m("VOC-011", "VOC-011")],
        [b("'Another serum.' "), "It replaces two steps, not adds one — drop the toner and the brightening mask."],
      ),
    ),
  },
  visualSystem: {
    id: "vs",
    kind: "visual_system",
    title: "Glow Labs — Visual system",
    status: "ready",
    properties: [
      { label: "Status", value: "Active · v2" },
      { label: "Formats", value: "1:1 · 4:5 · 9:16" },
    ],
    body: doc(
      p("How the brand looks in feed, so generated statics and carousels are recognisably ours before the logo appears."),
      h2("Palette and type"),
      p("Warm neutrals: bone, clay, a single deep terracotta for emphasis. No white backgrounds. Display in a low-contrast serif; body in the same grotesque as the site. One typeface per slide."),
      h2("Photography"),
      ul(
        ["Natural light, morning. Skin shown at real texture — pores and redness stay in."],
        ["Product on stone, linen or skin. Never on a gradient, never floating."],
        ["UGC is filmed by the person, not staged; we do not colour-grade it to match."],
      ),
      h2("Text on image"),
      p("Maximum eleven words on a cover, eighteen on a body slide. Safe zone 96px top and bottom for 4:5. The CTA slide is always the same layout."),
      { type: "image", attrs: { alt: "Reference board", bg: slide("#f6d5c4", "#c98f74"), caption: "Reference board — 14 images, own top posts and the Sept shoot." } },
    ),
  },
  research: {
    id: "r1",
    kind: "research",
    title: "Competitor scan — 30 days",
    status: "ready",
    properties: [
      { label: "Subtype", value: "Competitor audit" },
      { label: "Period", value: "Aug 3 – Sep 2" },
      { label: "Sample", value: "184 posts · 3 accounts" },
    ],
    body: doc(
      p("Glossier, The Ordinary and Drunk Elephant are all selling brightness to people with good skin. Nobody is running a new-mechanism angle, and nobody is talking to the person whose prescription made things worse."),
      h2("Summary"),
      ul(
        ["Social proof dominates: 61% of posts are testimonials or press quotes."],
        ["Zero posts address post-treatment sensitivity as the entry problem."],
        ["Carousels outperform statics 2.3× on saves across all three accounts."],
        ["The Ordinary's 'ingredient explainer' format is the only educational pattern, and it never names a pain."],
      ),
      h2("Top posts"),
      table([
        ["Account", "Format", "Hook", "Saves"],
        ["Drunk Elephant", "Carousel", "'What your derm won't tell you about SPF'", "12.4k"],
        ["The Ordinary", "Static", "'Niacinamide 10% + Zinc 1%: the basics'", "9.1k"],
        ["Glossier", "Reel", "'Skin first, makeup second'", "7.8k"],
      ]),
      h2("Implications"),
      ul(
        ["Lead with the barrier-damage mechanism — the intersection is empty."],
        ["Borrow the carousel-explainer format; change the entry point from ingredient to pain."],
      ),
    ),
  },
  burned: {
    id: "p1",
    kind: "persona",
    title: "The Burned Professional",
    status: "draft",
    properties: [
      { label: "Subtype", value: "Primary" },
      { label: "Enters at", value: "Problem-aware" },
      { label: "Built from", value: "Review mine — 312 reviews", relation: { id: "r2", kind: "research" } },
    ],
    body: doc(
      quote("I've done everything the dermatologist said and my skin is worse than when I started."),
      p("Women 28–35, urban, salaried, client-facing with cameras on. Skin is visible all day and the calendar has no room for a flare-up. She has tried two prescriptions that burned and peeled, and she is quietly convinced the problem is her."),
      h2("The job she hires us for"),
      p("When a flare-up starts before a big meeting, calm it in 48 hours — without stripping the barrier and losing another month."),
      h2("Current workaround"),
      p("Alternating a prescription retinoid with a drugstore cleanser, skipping days when it stings, covering with heavy concealer. The real competitor is 'stop everything and hope'."),
      h2("Pains"),
      ul(
        ["Prescriptions burned and peeled — the treatment felt worse than the acne. ", m("VOC-004", "VOC-004")],
        ["Every product promises results; nothing explains why the last one failed. ", m("VOC-017", "VOC-017")],
        ["Cost of the dermatologist plus the products, with no visible return."],
        ["Embarrassment on video calls; touching up between meetings. ", m("VOC-023", "VOC-023")],
      ),
      h2("Desires"),
      ul(["Skin she doesn't have to think about before 9am."], ["A routine that feels gentle rather than punishing."], ["To understand her own skin for once."]),
      h2("Objections → responses"),
      ul(
        [b("'Another serum.' "), "It replaces two steps. See ", m("pf", "Product facts", "product_facts"), "."],
        [b("'Vitamin C is too active for damaged skin.' "), "Partly true — which is why the dose is 15% at pH 5.5, and why we say so first."],
        [b("Unspoken: "), "she blames herself for not being consistent. Never imply she failed."],
      ),
      h2("Angles"),
      h3("A1 · Your dermatologist wrecked your skin"),
      p("New mechanism / reframe. Promise: it wasn't you, it was the dose. Proof: barrier-damage explainer + same-history testimonials. Funnel: problem-aware. Status: untested."),
      h3("A2 · The mirror test"),
      p("Failed solution. Promise: know in 14 days whether it's working. Proof: day-1 / day-14 UGC, no filters. Funnel: solution-aware. Status: untested."),
    ),
  },
  bride: {
    id: "p2",
    kind: "persona",
    title: "The Bride",
    status: "draft",
    properties: [
      { label: "Subtype", value: "Secondary" },
      { label: "Enters at", value: "Solution-aware" },
      { label: "Built from", value: "Review mine — 312 reviews", relation: { id: "r2", kind: "research" } },
    ],
    body: doc(
      quote("The photos are forever. I'll pay whatever it takes to not think about my skin that day."),
      p("Women 25–35 with a wedding in six months, planning everything around one date. Enters solution-aware and price-insensitive; converts on retargeting anyway, so organic should build trust rather than sell."),
      h2("Pains"),
      ul(["A timeline with a hard deadline and no room to experiment. ", m("VOC-031", "VOC-031")], ["Fear that anything new will cause a reaction close to the date."]),
      h2("Angles"),
      h3("B1 · Your wedding photos last forever"),
      p("Fear / warning. Promise: start now, be boring by the date. Proof: a 6-month countdown routine. Funnel: solution-aware. Status: untested."),
    ),
  },
  strategy: {
    id: "s1",
    kind: "strategy",
    title: "Vitamin C — Q4 organic strategy",
    status: "draft",
    properties: [
      { label: "Subtype", value: "Campaign" },
      { label: "Period", value: "Oct 1 – Dec 20" },
      { label: "Channels", value: "Instagram · TikTok" },
      { label: "Targets", value: "The Burned Professional", relation: { id: "p1", kind: "persona" } },
      { label: "Informed by", value: "Competitor scan — 30 days", relation: { id: "r1", kind: "research" } },
    ],
    body: doc(
      p("Glow Labs wins with people whose skin has been over-treated. Every competitor is selling brightness to people with good skin; nobody is talking to the person whose prescription made things worse. Lead with the barrier-damage mechanism, prove it with same-history testimonials, and hold the bride as a second, price-insensitive audience."),
      h2("Coverage"),
      {
        type: "coverageMatrix",
        attrs: {
          personas: ["Burned Professional", "Bride", "Stay-home Mom"],
          pains: ["Cystic acne", "Post-treatment sensitivity", "Dullness before an event"],
          cells: [
            [{ angles: 3, hooks: 16 }, { angles: 1, hooks: 4 }, { angles: 0 }],
            [{ angles: 2, hooks: 8 }, { angles: 0 }, { angles: 1 }],
            [{ angles: 0 }, { angles: 2, hooks: 6 }, { angles: 0 }],
          ],
        },
      },
      h2("Pillars"),
      ul(
        [b("Mechanism (40%) · TOF · carousel. "), "Why the last thing failed; what 15% at pH 5.5 does differently."],
        [b("Same-history proof (35%) · MOF · reel + carousel. "), "People who were burned first. Never glass skin."],
        [b("The routine (25%) · BOF · static. "), "Two steps, morning. The CTA slide is always the same."],
      ),
      h2("Hypotheses this period"),
      ol(
        "Pain-first carousels save 2× more than ingredient-first — measured on the first eight briefs.",
        "The Bride converts on retargeting without organic; hold her to one post a fortnight and check.",
      ),
      h2("Recommended next"),
      ul(
        ["Fill Burned Professional × Dullness with an identity angle — she is not a 'glow' person and that is the hook."],
        ["Brief a carousel for ", m("p1", "The Burned Professional", "persona"), " · A1 at problem-aware."],
        ["Park the Stay-home Mom until we have interview evidence; two of three cells are empty and the persona is inferred."],
      ),
    ),
  },
  brief: {
    id: "b1",
    kind: "brief",
    title: "Why does your prescription burn more than your acne?",
    status: "ready",
    properties: [
      { label: "Format", value: "Carousel · 8 slides" },
      { label: "Channels", value: "Instagram · TikTok" },
      { label: "Targets", value: "The Burned Professional · A1", relation: { id: "p1", kind: "persona" } },
      { label: "Pillar", value: "Mechanism", relation: { id: "s1", kind: "strategy" } },
    ],
    body: doc(
      p("Problem-aware hook for the Burned Professional. Proves one claim — that a too-strong dose damages the barrier and that is why it stung — and ends on the two-step routine. Success metric: saves per reach above the account's 30-day median."),
      h2("Hook options"),
      ol(
        "Why does your prescription burn more than your acne? (question)",
        "You didn't fail your skincare. Your skincare failed your barrier. (reframe)",
        "The 15% number nobody explained to you. (curiosity)",
      ),
      h2("Slides"),
      table([
        ["#", "Beat", "Copy"],
        ["1", "Cover", "Why does your prescription burn more than your acne?"],
        ["2", "Reframe", "Stinging isn't 'working'. It's your barrier giving up."],
        ["3", "Mechanism", "High doses strip the lipid layer that holds water in."],
        ["4", "Consequence", "Less water → more redness → more product → more sting."],
        ["5", "Break the loop", "Lower the dose. Fix the barrier. Then brighten."],
        ["6", "Proof", "Same history as you — day 1 vs day 14, no filter."],
        ["7", "Routine", "Two steps, morning. That's it."],
        ["8", "CTA", "If your skin has been over-treated, start here."],
      ]),
      h2("Visual direction"),
      p("Bone background, terracotta emphasis, morning light. Slide 6 uses ", m("as3", "Before / after — cheek", "content"), " uncropped. Text under eighteen words per slide."),
      h2("Must include / must avoid"),
      ul(
        [b("Include: "), "'15% at pH 5.5', 'fragrance-free', the two-step routine."],
        [b("Avoid: "), "'cures', 'replaces your prescription', any % improvement figure, the word 'glow'."],
      ),
    ),
  },
  content: {
    id: "c1",
    kind: "content",
    title: "Prescription vs. barrier — carousel v2",
    status: "ready",
    properties: [
      { label: "Format", value: "Carousel · 4:5 · 8 slides" },
      { label: "From", value: "Why does your prescription burn…", relation: { id: "b1", kind: "brief" } },
      { label: "Check", value: "1 claim flagged" },
    ],
    body: doc(
      p("Generated from the brief. Slide 4 is flagged: 'more product → more sting' reads as a % improvement implication under the disallowed claims rule. Rephrase or approve."),
    ),
    thumbnails: [
      slide("#f6d5c4", "#c98f74"),
      slide("#e7d9f5", "#9b7fc4"),
      slide("#d8e6c8", "#7f9d63"),
      slide("#fbe3c9", "#d59a5c"),
      slide("#cfe3f5", "#6d97c2"),
      slide("#f2d2dc", "#c66f8c"),
      slide("#2a2a2a", "#151515"),
      slide("#2a2a2a", "#151515"),
    ],
  },
  generating: {
    id: "b2",
    kind: "brief",
    title: "The mirror test",
    status: "generating",
    properties: [{ label: "Format", value: "Carousel" }],
    body: doc(p("Writing slide beats…")),
  },
  rendering: {
    id: "c2",
    kind: "content",
    title: "Prescription vs. barrier — carousel",
    status: "generating",
    body: doc(p("Rendering slide 5 of 8 in the Glow Labs visual system…")),
    thumbnails: [slide("#f6d5c4", "#c98f74"), slide("#e7d9f5", "#9b7fc4"), slide("#d8e6c8", "#7f9d63"), slide("#fbe3c9", "#d59a5c")],
  },
};

export const recents = [
  "Vitamin C — Q4 strategy",
  "Competitor scan: Glossier, Ordinary",
  "Bride persona from reviews",
  "Hooks for problem-aware",
  "Barrier cream launch angles",
];
