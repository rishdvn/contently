import { Compass, FileText, Images, Layers, Package, Palette, Target, Users, Wand2 } from "lucide-react";

import type { Artifact, ContextSource, PromptGroup } from "@/components/patterns/chat";
import type { PersonaDocData } from "@/components/patterns/docs/persona-doc";
import type { StrategyDocData } from "@/components/patterns/docs/strategy-doc";

export const sources: ContextSource[] = [
  {
    kind: "persona",
    label: "Personas",
    icon: Users,
    selected: ["p1", "p2"],
    items: [
      { id: "p1", label: "The Burned Professional", detail: "28–35, tried harsh prescriptions, back-to-back meetings" },
      { id: "p2", label: "The Bride", detail: "25–35, wedding in 6 months, photos last forever" },
      { id: "p3", label: "The Stay-home Mom", detail: "30–42, no time for a routine, wants low-effort wins" },
      { id: "p4", label: "The Skeptic", detail: "Has been burned by 'miracle' serums before" },
    ],
  },
  {
    kind: "angle",
    label: "Angles",
    icon: Target,
    selected: [],
    items: [
      { id: "a1", label: "Your dermatologist wrecked your skin", detail: "New mechanism · Burned Professional" },
      { id: "a2", label: "Your wedding photos last forever", detail: "Fear / warning · Bride" },
      { id: "a3", label: "Why what you've tried keeps failing", detail: "Failed solution · Skeptic" },
    ],
  },
  {
    kind: "brand",
    label: "Brand",
    icon: Palette,
    selected: ["b1"],
    items: [
      { id: "b1", label: "Glow Labs — voice & visual guide", detail: "Tone, palette, type, do/don't" },
      { id: "b2", label: "Glow Labs — legal claims", detail: "What we can and cannot say" },
    ],
  },
  {
    kind: "product",
    label: "Products",
    icon: Package,
    selected: ["pr1"],
    items: [
      { id: "pr1", label: "Vitamin C Serum 15%", detail: "$48 · hero SKU" },
      { id: "pr2", label: "Barrier Repair Cream", detail: "$36" },
      { id: "pr3", label: "Gentle Cleanser", detail: "$22" },
    ],
  },
  {
    kind: "asset",
    label: "Assets",
    icon: Images,
    selected: [],
    items: [
      { id: "as1", label: "Product photography — Sept shoot", detail: "42 images" },
      { id: "as2", label: "UGC — Maya's 30-day", detail: "6 clips, 12 stills" },
      { id: "as3", label: "Before / after library", detail: "18 pairs, consented" },
    ],
  },
  {
    kind: "skill",
    label: "Skills",
    icon: Wand2,
    selected: [],
    items: [
      { id: "s1", label: "Competitor scan", detail: "Pulls the last 30 days from named accounts" },
      { id: "s2", label: "Hook writer", detail: "Eight hooks per angle × awareness stage" },
      { id: "s3", label: "Compliance check", detail: "Flags claims against the legal guide" },
    ],
  },
];

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
        text: "Read the attached reviews and draft a persona. Every field should change a downstream decision: jobs-to-be-done in their words, current workaround, three concrete pains, the visceral desire, spoken and unspoken objections, buying triggers, and the awareness stage they usually enter at.",
      },
      {
        title: "Stress-test a persona",
        text: "Argue against {persona}. Which fields are invented rather than evidenced? What would we need to observe in CRM or interviews to confirm them?",
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
        title: "Brief a carousel batch",
        text: "For {angle} at the {awareness} stage, write eight carousel briefs. Each brief: hook, slide-by-slide beats, the single claim it proves, the CTA, and which assets from the library to use.",
      },
      {
        title: "Rewrite hooks for a stage",
        text: "Take the hooks in this brief and rewrite them for a {awareness} audience. Keep the angle fixed; only the expression changes.",
      },
    ],
  },
];

export const artifacts: Record<string, Artifact> = {
  burned: {
    id: "burned",
    kind: "persona",
    title: "The Burned Professional",
    summary: "28–35, back-to-back client meetings, tried two harsh prescriptions that made things worse. Enters problem-aware.",
    meta: ["3 jobs", "4 pains", "3 objections"],
    status: "draft",
  },
  bride: {
    id: "bride",
    kind: "persona",
    title: "The Bride",
    summary: "25–35, wedding in six months, planning everything around a date. Enters solution-aware and price-insensitive.",
    meta: ["2 jobs", "3 pains", "2 objections"],
    status: "draft",
  },
  strategy: {
    id: "strategy",
    kind: "strategy",
    title: "Vitamin C — Q4 organic strategy",
    summary: "Two personas across three pains. Seven angles drafted, two cells still empty.",
    meta: ["2 personas", "3 pains", "7 angles", "2 gaps"],
    status: "draft",
  },
  research: {
    id: "research",
    kind: "research",
    title: "Competitor scan — 30 days",
    summary: "Glossier, The Ordinary and Drunk Elephant. Heavy on social proof, nobody is running a new-mechanism angle.",
    meta: ["3 accounts", "184 posts", "6 patterns"],
    status: "ready",
  },
  angle: {
    id: "angle",
    kind: "angle",
    title: "Your dermatologist wrecked your skin",
    summary: "New mechanism / reframe for The Burned Professional × cystic acne. Emotion: betrayal, then relief.",
    meta: ["New mechanism", "Problem-aware", "8 hooks"],
    status: "ready",
  },
  brief: {
    id: "brief",
    kind: "brief",
    title: "Why does your prescription burn more than your acne?",
    summary: "Carousel, 8 slides. Problem-aware hook for the Burned Professional; proves the barrier-damage mechanism.",
    meta: ["Carousel", "8 slides", "Instagram · TikTok"],
    status: "ready",
    thumbnails: [
      "linear-gradient(160deg,#f6d5c4,#c98f74)",
      "linear-gradient(160deg,#2a2a2a,#151515)",
      "linear-gradient(160deg,#d8e6c8,#7f9d63)",
      "linear-gradient(160deg,#2a2a2a,#151515)",
    ],
  },
  carousel: {
    id: "carousel",
    kind: "carousel",
    title: "Prescription vs. barrier — v2",
    summary: "Generated from the brief above. Slide 4 is flagged for a claim the legal guide does not allow.",
    meta: ["8 slides", "4:5", "1 flag"],
    status: "ready",
    thumbnails: [
      "linear-gradient(160deg,#f6d5c4,#c98f74)",
      "linear-gradient(160deg,#e7d9f5,#9b7fc4)",
      "linear-gradient(160deg,#d8e6c8,#7f9d63)",
      "linear-gradient(160deg,#fbe3c9,#d59a5c)",
      "linear-gradient(160deg,#cfe3f5,#6d97c2)",
      "linear-gradient(160deg,#f2d2dc,#c66f8c)",
      "linear-gradient(160deg,#2a2a2a,#151515)",
      "linear-gradient(160deg,#2a2a2a,#151515)",
    ],
  },
  generating: {
    id: "generating",
    kind: "brief",
    title: "Brief 3 of 8 — The mirror test",
    summary: "Writing slide beats…",
    status: "generating",
  },
};

export const burnedPersona: PersonaDocData = {
  identity: "I've done everything the dermatologist said and my skin is worse than when I started.",
  demographics: "Women 28–35, urban, salaried professional",
  context: "Client-facing work, cameras on. Skin is visible all day and the calendar has no room for a flare-up.",
  awareness: "Problem-aware",
  jobs: [
    "When a flare-up starts before a big meeting, I want to calm it in 48 hours so I can stop thinking about it.",
    "When I try something new, I want to know it won't strip my barrier so I don't lose another month.",
    "When I look in the mirror at 7am, I want to see progress so I can believe this is getting better.",
  ],
  workaround: "Alternating a prescription retinoid with a drugstore cleanser, skipping days when it stings, and covering with heavy concealer. The real competitor is 'stop everything and hope'.",
  pains: [
    "Prescriptions burned and peeled — treatment felt worse than the acne.",
    "Every product promises results; nothing explains why the last one failed.",
    "Cost of the dermatologist plus the products, with no visible return.",
    "Embarrassment on video calls; touching up between meetings.",
  ],
  desires: [
    "Skin she doesn't have to think about before 9am.",
    "A routine that feels gentle rather than punishing.",
    "To understand her own skin for once.",
  ],
  objections: [
    "\"Another serum\" — she has a drawer of them.",
    "Vitamin C is too active for compromised skin (partly true; must be addressed head-on).",
    "Unspoken: she blames herself for not being consistent enough.",
  ],
  triggers: [
    "A visible flare-up before an event on the calendar.",
    "Finishing a prescription with no plan for what comes next.",
    "A friend's before/after that looks like her own skin.",
  ],
  criteria: [
    "Explains the mechanism, not just the promise.",
    "Evidence from people with the same history — not glass-skin influencers.",
    "A money-back window long enough to see change.",
  ],
  channels: ["Instagram", "TikTok", "Reddit r/SkincareAddiction", "Podcasts"],
};

export const q4Strategy: StrategyDocData = {
  thesis:
    "Glow Labs wins with people whose skin has been over-treated. Every competitor is selling brightness to people with good skin; nobody is talking to the person whose prescription made things worse. Lead with the barrier-damage mechanism, prove it with same-history testimonials, and hold the bride as a second, price-insensitive audience.",
  personas: ["Burned Professional", "Bride", "Stay-home Mom"],
  pains: ["Cystic acne", "Post-treatment sensitivity", "Dullness before an event"],
  cells: [
    [{ angles: 3, hooks: 16 }, { angles: 1, hooks: 4 }, { angles: 0 }],
    [{ angles: 2, hooks: 8 }, { angles: 0 }, { angles: 1 }],
    [{ angles: 0 }, { angles: 2, hooks: 6 }, { angles: 0 }],
  ],
  angleTypes: [
    { type: "New mechanism", count: 3 },
    { type: "Failed solution", count: 2 },
    { type: "Fear / warning", count: 1 },
    { type: "Social proof", count: 1 },
    { type: "Identity", count: 0 },
    { type: "Before / after", count: 0 },
  ],
  next: [
    "Fill Burned Professional × Dullness with an identity angle — she is not a 'glow' person and that is the hook.",
    "Write eight hooks for 'Your dermatologist wrecked your skin' at problem-aware and brief a carousel batch.",
    "Park the Stay-home Mom until we have interview evidence; two of three cells are empty and the persona is inferred.",
  ],
};

export const recents = [
  "Vitamin C — Q4 strategy",
  "Competitor scan: Glossier, Ordinary",
  "Bride persona from reviews",
  "Hooks for problem-aware",
  "Barrier cream launch angles",
];
