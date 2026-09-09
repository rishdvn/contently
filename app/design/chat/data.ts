import { Compass, FileText, Images, Layers, Package, Palette, Target, Users, Wand2 } from "lucide-react";

import type { Artifact, ContentBlock, ContextSource, PromptGroup, StoredEvent } from "@/components/patterns/chat";
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

/* ---------------------------------------------------------------------------
   The session, as the SDK would have emitted it and as we would have stored
   it: complete messages only, in receipt order. Everything the thread shows is
   reduced from this list.
   ------------------------------------------------------------------------ */

const S = "sess_7f3a";
const env = (uuid: string) => ({ uuid, session_id: S, parent_tool_use_id: null });
const user = (uuid: string, text: string, attachments?: { kind: string; label: string }[]): StoredEvent => ({
  ...env(uuid),
  type: "user",
  message: { role: "user", content: text },
  attachments,
});
const toolResult = (uuid: string, tool_use_id: string, content: string, structured?: unknown, is_error?: boolean): StoredEvent => ({
  ...env(uuid),
  type: "user",
  message: { role: "user", content: [{ type: "tool_result", tool_use_id, content, is_error }] },
  tool_use_result: structured,
});
const assistant = (uuid: string, id: string, content: ContentBlock[], stop: string | null = "tool_use"): StoredEvent => ({
  ...env(uuid),
  type: "assistant",
  message: { id, role: "assistant", model: "claude-sonnet-4-5", content, stop_reason: stop },
});

export const sessionEvents: StoredEvent[] = [
  { ...env("e0"), type: "system", subtype: "init", model: "claude-sonnet-4-5" },

  user(
    "u1",
    "Build a content strategy for the Vitamin C serum. Focus on women 28–40 who've been burned by dermatologist prescriptions — and tell me who else we're missing.",
    [
      { kind: "brand", label: "Glow Labs guide" },
      { kind: "product", label: "Vitamin C Serum 15%" },
    ],
  ),
  assistant("a1", "msg_01", [
    { type: "tool_use", id: "tu_read1", name: "read_source", input: { title: "Glow Labs voice & visual guide" } },
    { type: "tool_use", id: "tu_read2", name: "read_source", input: { title: "312 product reviews" } },
  ]),
  toolResult("r1", "tu_read1", "Tone: plain, unhurried, no exclamation marks. Palette: bone, oxblood, ink. Never say 'glow'."),
  toolResult("r2", "tu_read2", "312 reviews. 41% mention a prior prescription; 23% mention an event; 12% mention children."),
  assistant("a2", "msg_02", [
    { type: "tool_use", id: "tu_scan", name: "scan_accounts", input: { accounts: ["glossier", "theordinary", "drunkelephant"], days: 30 } },
  ]),
  toolResult("r3", "tu_scan", "184 posts. Angle types: social proof 61%, before/after 22%, greed 11%, new mechanism 0%."),
  assistant("a3", "msg_03", [
    {
      type: "text",
      text: "Starting from the pain rather than the demographic: the serum solves **over-treated skin**, not dullness. Two personas have enough evidence in the reviews to stand behind. A third — the stay-home mom — shows up in comments but not in purchases, so I've parked her.",
    },
    { type: "tool_use", id: "tu_p1", name: "create_persona", input: { title: "The Burned Professional" } },
    { type: "tool_use", id: "tu_p2", name: "create_persona", input: { title: "The Bride" } },
  ]),
  toolResult("r4", "tu_p1", "Created persona burned", { artifact: { ...artifactsSeed("burned"), status: "draft" } }),
  toolResult("r5", "tu_p2", "Created persona bride", { artifact: { ...artifactsSeed("bride"), status: "draft" } }),
  assistant("a4", "msg_04", [
    { type: "tool_use", id: "tu_cov", name: "coverage_matrix", input: {} },
    { type: "tool_use", id: "tu_strat", name: "create_strategy", input: { title: "Vitamin C — Q4 organic strategy" } },
  ]),
  toolResult("r6", "tu_cov", "3 pains × 3 personas. 7 angles. Empty: Bride×Sensitivity, Mom×Acne, Mom×Dullness, Professional×Dullness."),
  toolResult("r7", "tu_strat", "Created strategy", { artifact: { ...artifactsSeed("strategy"), status: "draft" } }),
  assistant(
    "a5",
    "msg_05",
    [
      {
        type: "text",
        text: "Here is how they cover the three pains. Seven angles are drafted; two cells are still empty, and only one of them is worth filling right now — the Burned Professional × Dullness, with an identity angle.\n\nNobody in the competitor set is running a new-mechanism angle. That is the gap.",
      },
    ],
    "end_turn",
  ),
  { ...env("res1"), type: "result", subtype: "success", duration_ms: 42300, num_turns: 5, is_error: false },

  user("u2", "Good. Brief a carousel batch for the Burned Professional at problem-aware — start with two and check the claims.", [
    { kind: "persona", label: "The Burned Professional" },
    { kind: "angle", label: "Your dermatologist wrecked your skin" },
  ]),
  assistant("a6", "msg_06", [
    { type: "tool_use", id: "tu_b1", name: "create_brief", input: { title: "Why does your prescription burn more than your acne?" } },
    { type: "tool_use", id: "tu_b2", name: "create_brief", input: { title: "The mirror test" } },
  ]),
  toolResult("r8", "tu_b1", "Created brief", { artifact: { ...artifactsSeed("brief"), status: "ready" } }),
  toolResult("r9", "tu_b2", "Created brief", {
    artifact: {
      id: "brief2",
      kind: "brief",
      title: "The mirror test",
      summary: "Carousel, 6 slides. Problem-aware; the 7am mirror as the moment of choice. Ends on the barrier mechanism.",
      meta: ["Carousel", "6 slides", "Instagram"],
      status: "ready",
    },
  }),
  assistant("a7", "msg_07", [
    { type: "tool_use", id: "tu_comp", name: "compliance_check", input: { count: 9 } },
  ]),
  toolResult("r10", "tu_comp", "1 flag: slide 4 of brief 1 implies 'cures' — rephrase as 'calms'.", undefined, true),
  assistant(
    "a8",
    "msg_08",
    [
      {
        type: "text",
        text: "Two briefs, both problem-aware, both proving the barrier-damage mechanism from different doors. The compliance check flagged one claim on slide 4 of the first — I've left it for you to decide rather than soften it silently.",
      },
    ],
    "end_turn",
  ),
  { ...env("res2"), type: "result", subtype: "success", duration_ms: 18900, num_turns: 3, is_error: false },
];

function artifactsSeed(id: string): Artifact {
  return artifacts[id];
}

export const recents = [
  "Vitamin C — Q4 strategy",
  "Competitor scan: Glossier, Ordinary",
  "Bride persona from reviews",
  "Hooks for problem-aware",
  "Barrier cream launch angles",
];
