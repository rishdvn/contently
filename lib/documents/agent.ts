import { outline, sectionMarkdown } from "./markdown";
import { docTypes, slugify, statusLabels } from "./registry";
import { effectiveFreshness, incoming, outgoing } from "./selectors";
import type { Channel, DocType, Document, Relation, Subtype, Version } from "./types";

/*
  The agent, simulated. Each skill declares the steps it will show, the review
  it needs before writing, and the sections it streams in. Content is grounded
  in the seeded brand so a run reads as a continuation of the real one rather
  than as lorem ipsum. The store owns timing; this module only produces text.
*/

export type SkillPlan = {
  title: string;
  subtype: Subtype | null;
  channels: Channel[];
  tags: string[];
  properties: Document["properties"];
  steps: string[];
  /** A decision the founder makes before the body is written. */
  review?: { title: string; fields?: { label: string; items: string[] }[]; choices?: string[] };
  sections: { heading: string; md: string }[];
  intro: string;
  outro: string;
  suggestions: string[];
  relations: { type: Relation["type"]; to: string; anchor?: string }[];
};

function quoted(prompt: string) {
  const m = /["“]([^"”]+)["”]/.exec(prompt);
  return m?.[1] ?? null;
}

function pick<T>(arr: T[], seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return arr[h % arr.length];
}

export function planSkill(type: DocType, subtype: Subtype | null, prompt: string, docs: Document[]): SkillPlan {
  const topic = quoted(prompt);
  const p1 = docs.find((d) => d.id === "doc_persona_p1");
  const p2 = docs.find((d) => d.id === "doc_persona_p2");
  const strategy = docs.find((d) => d.type === "content_strategy" && d.status !== "archived");

  switch (type) {
    case "research_snapshot": {
      const sub = (subtype as string) ?? "trend_scan";
      const term = topic ?? pick(["cozy hobby", "adult craft night", "quiet evening", "phone-free weekend"], prompt);
      const titles: Record<string, string> = {
        account_audit: "Own-account audit — @terraclays (refresh)",
        competitor_audit: `Competitor audit — ${topic ?? "@sculpd"}`,
        category_search: `Category search — "${term}"`,
        trend_scan: `Trend scan — "${term}" (TikTok, Instagram)`,
        voc_mine: `VoC mine — ${topic ?? "comments on our last 20 posts"}`,
        review_mine: `Review mine — ${topic ?? "Terra reviews, last 90 days"}`,
      };
      return {
        title: titles[sub] ?? titles.trend_scan,
        subtype: sub as Subtype,
        channels: ["tiktok", "instagram"],
        tags: [term.replace(/\s+/g, "-")],
        properties: {
          date_range: { kind: "range", start: "2026-08-09", end: "2026-09-09" },
          sample_size: { kind: "number", value: 60 },
          data_sources: { kind: "multi", value: ["SocialCrawl run sc_0909_02"] },
        },
        steps: ["Pulling 60 posts across both channels", "Clustering formats and hooks", "Writing the snapshot with citations"],
        intro: `Starting the ${sub.replace(/_/g, " ")}. The doc shell is open below and fills in as each section finishes.`,
        outro: "Published as a draft. Every finding carries a citation chip; the implications point at the persona and pillar they touch.",
        suggestions: ["Turn finding 1 into a brief", "Which persona does this serve?", "Add this to the strategy's hypotheses"],
        relations: [],
        sections: [
          {
            heading: "Executive summary",
            md: `- "${term}" content is up in the window; the top posts are a person, a lamp and a small finished object.\n- The phrase "give myself the gift of" recurs — the same identity move as [[VOC-008]].\n- Saves outpace likes 3:1 on the top ten, which is the same shape as the date-night listicle in @[doc_research_trend].\n- Nobody in the set names how long the hobby takes. That number is ours.`,
          },
          {
            heading: "Method",
            md: `SocialCrawl keyword search for "${term}" on TikTok and Instagram, top 60 by engagement in the window, full comment pull on the top five.`,
          },
          {
            heading: "Findings",
            md: `- **Identity over instruction.** The top posts say who the hobby is for ("for people who can't sit still") before they say what it is. [[VOC-006]] [[VOC-007]]\n- **The lamp shot.** Warm side light, hands, one object. It reads as an evening, not a craft.\n- **Duration is unnamed.** Comments ask "how long did this take" on every top post. [[VOC-005]]\n- **Cute object beats useful object** for saves; useful object beats cute for comments.`,
          },
          {
            heading: "Top posts",
            md: `| Post | Format | Hook | Views | Saves | Why it worked |\n| --- | --- | --- | --- | --- | --- |\n| "my ${term} era" | 12s montage | identity | 1.1M | 38k | Names the person, not the craft |\n| "things i do instead of scrolling" | listicle | named enemy | 640k | 22k | Same mechanic as @[doc_brief_b1] |\n| "a tiny thing i made tonight" | still | outcome | 210k | 9.4k | One object, lamp light |`,
          },
          {
            heading: "Implications",
            md: `- Personas: @[doc_persona_p1] — the identity language matches her Their language section almost word for word.\n- Strategy: a "things i do instead of scrolling" listicle belongs in @[doc_strategy_ig#pillars] Screen-free living as the P1 counterpart to B1.\n- Briefs: "3 things to do at 9:40pm that aren't your phone" — carousel, Terra as the honest third option.`,
          },
          {
            heading: "Open questions",
            md: `- Does the lamp-shot still work at 1:1, or only 9:16?\n- Is the "era" framing too online for P1's Instagram feed?`,
          },
        ],
      };
    }

    case "persona": {
      const name = topic ?? pick(["Priya, the gift-giver in a hurry", "Sam, the solo saver", "Leah, the new mum with one free hour"], prompt);
      return {
        title: `P4 — ${name}`,
        subtype: (subtype as Subtype) ?? "exploratory",
        channels: ["instagram", "tiktok"],
        tags: ["candidate"],
        properties: { funnel_focus: { kind: "select", value: "Solution-aware" } },
        steps: ["Reading Brand Core and the VoC bank", "Drafting pains, triggers and objections for review", "Writing the persona with angles"],
        review: {
          title: "Before I write the full persona, check these lists",
          fields: [
            { label: "Pains", items: ["Evenings disappear into the phone", "Every hobby becomes another unfinished project", "Gifts feel generic"] },
            { label: "Buying triggers", items: ["9:40pm screen-time report", "A friend's finished dinosaur", "A birthday in 5 days"] },
            { label: "Objections", items: ["I can't draw", "It'll crack or it's play-doh", "I won't finish it"] },
          ],
        },
        intro: "I have read Brand Core and the VoC bank. Before I write the full document, here are the lists that will drive it — edit anything that reads wrong.",
        outro: "Written. Two angles have anchors so briefs can point at them; the QA checklist has eight checks.",
        suggestions: ["Draft a brief from Angle 1", "Compare with P1", "Which snapshots is this weakest on?"],
        relations: [
          { type: "derived_from", to: "doc_research_voc" },
          { type: "derived_from", to: "doc_research_category" },
        ],
        sections: [
          { heading: "Snapshot", md: `${name.split(",")[0]} hires Terra to **turn a spare hour into something finished.** One-line job: "give me a small win tonight."` },
          { heading: "Context and moments", md: `- The evening after a long day, phone reporting the damage. [[VOC-005]]\n- A gift needed by the weekend that should not be a candle.\n- Awareness stage: solution-aware.` },
          { heading: "Pains, desires and objections", md: `- **Pain:** evenings disappear into the phone. [[VOC-001]]\n- **Pain:** every hobby becomes another unfinished project. [[VOC-004]]\n- **Desire:** a small finished thing to show for the evening. [[VOC-009]]\n- **Objection:** "I can't draw." → Roll a potato, add horns. [[VOC-011]]\n- **Objection:** "it'll crack." → Small, soft, air-dries on a shelf. [[VOC-003]]` },
          { heading: "Their language", md: `- Use: "small win", "actually finished", "give myself the gift of". [[VOC-008]]\n- Avoid: creativity journey, unwind, treat yourself.` },
          { heading: "Where they are", md: `- TikTok cozy-hobby content, Instagram saves, Pinterest evening routines.` },
          {
            heading: "Angles",
            md: `:::angle{id=angle-small-win status=untested title="A small win tonight"}\n- **Promise:** one finished thing before bed.\n- **Proof:** "Twenty minutes in and my shoulders finally dropped." [[VOC-009]]\n- **Funnel stage:** solution-aware.\n- **Hook directions:** "the hobby you finish tonight" · "one small win. no oven." · "a tiny thing i made instead of scrolling"\n:::\n\n:::angle{id=angle-gift-evening status=untested title="The gift that's an evening"}\n- **Promise:** a $20 gift that gives someone an evening, not an object.\n- **Proof:** the bundle ladder; gift-wrapped seasonal singles. @[doc_product_facts]\n- **Funnel stage:** product-aware.\n- **Hook directions:** "the $20 gift that's an evening" · "give someone 20 minutes off their phone"\n:::`,
          },
          { heading: "QA checklist", md: `- [ ] Names the moment, not the category.\n- [ ] Says how long it takes.\n- [ ] Quotes the bank at least once.\n- [ ] No banned words.\n- [ ] One joke, from the truth of the product.` },
        ],
      };
    }

    case "brief": {
      const fmt = (subtype as Subtype) ?? "carousel";
      const angle = p1 ? "@[doc_persona_p1#angle-phone-replacement]" : "the lead angle";
      const hooks = [
        "3 things to do at 9:40pm that aren't your phone",
        "for people who say \"one more video\" and mean it",
        "the hobby you finish tonight",
        "you've been scrolling for 47 minutes. here are 3 alternatives.",
        "i replaced my 9:40pm scroll. here's what with.",
      ];
      return {
        title: `B7 — ${topic ?? hooks[0]}`,
        subtype: fmt,
        channels: ["instagram", "tiktok"],
        tags: ["H7", "pillar-3"],
        properties: {
          due: { kind: "date", value: new Date(Date.now() + 5 * 86_400_000).toISOString() },
          funnel_stage: { kind: "select", value: "MOF" },
          format_spec: { kind: "text", value: fmt === "carousel" ? "Instagram carousel 4:5, 5 slides; TikTok photo mode" : "Instagram static 1:1" },
          assets: { kind: "number", value: 0 },
        },
        steps: ["Reading the persona, strategy and Product Facts through relations", "Drafting five hooks for you to pick from", "Writing the brief around the chosen hook"],
        review: { title: "Pick the hook; I'll write the rest around it", choices: hooks },
        intro: `Reading ${p1 ? "P1" : "the persona"}, the strategy pillar and Product Facts. Hooks first — pick one and I'll write the brief around it.`,
        outro: "Brief written and set to Draft. The structure is slide-by-slide; the caption is per channel.",
        suggestions: ["Tighten the caption", "Swap the third item", "Generate the carousel"],
        relations: [
          ...(p1 ? [{ type: "targets_persona" as const, to: p1.id }, { type: "uses_angle" as const, to: p1.id, anchor: "angle-phone-replacement" }] : []),
          ...(strategy ? [{ type: "uses_strategy" as const, to: strategy.id, anchor: "pillar-screen-free" }] : []),
          { type: "references_trend", to: "doc_research_trend" },
          { type: "features_product", to: "doc_product_facts", anchor: "TC-TRIKEY" },
        ],
        sections: [
          { heading: "Objective", md: `The P1 counterpart to B1: a genuinely useful list where Terra is the honest third option. **Success:** save rate above 3%; shares above 1%.` },
          { heading: "Audience and angle", md: `@[doc_persona_p1] at problem-aware, using ${angle}. She knows the scroll is the problem and has not found a replacement she finishes.` },
          { heading: "Key message and proof", md: `9:40pm doesn't need a plan. It needs 20 minutes. Proof: "Twenty minutes in and my shoulders finally dropped." [[VOC-009]] Product: Trikey. @[doc_product_facts]` },
          { heading: "Hook options", md: hooks.map((h, i) => `${i + 1}. ${i === 0 ? `**"${h}"** — chosen.` : `"${h}"`}`).join("\n") },
          {
            heading: "Structure",
            md: fmt === "carousel"
              ? `| Slide | Copy | Visual |\n| --- | --- | --- |\n| 1 · Cover | 3 things to do at 9:40pm that aren't your phone | phone face-down, lamp on |\n| 2 · 01 | the 10-minute tidy. yes, boring. yes, it works. | one clear surface |\n| 3 · 02 | call the friend you keep meaning to. | phone, but face-up this time |\n| 4 · 03 | make a dinosaur. 20 minutes. no oven. no talent. | Trikey, half-done |\n| 5 · CTA | save this for 9:40pm. / send it to someone who says "one more video". | terracotta block |`
              : `Single static: two lines of copy top-left, Trikey bottom-right on cream, phone face-down.`,
          },
          { heading: "Caption and CTA", md: `it's 9:40pm and you know what you're about to do. three alternatives, one of them is a dinosaur. (number 3 is us. we're not subtle.) 🦕 save it for tonight.` },
          { heading: "Visual direction", md: `Cream system from @[doc_visual_system]. Lamp light. Trikey as the object on slide 4.` },
          { heading: "Must include / must avoid", md: `- Include: "20 minutes", "no oven", the share CTA.\n- Avoid: mindfulness, self-care ritual, any cracking claim.` },
          { heading: "References", md: `- @[doc_research_trend] — the listicle mechanic.\n- [[VOC-001]] [[VOC-005]] [[VOC-009]]` },
        ],
      };
    }

    case "content_strategy":
      return {
        title: topic ?? "Q4 gifting campaign — Nov 1 to Dec 20",
        subtype: (subtype as Subtype) ?? "campaign",
        channels: ["instagram", "tiktok", "email"],
        tags: ["q4"],
        properties: {
          period: { kind: "range", start: "2026-11-01", end: "2026-12-20" },
          cadence: { kind: "text", value: "6 posts / week" },
          primary_kpi: { kind: "select", value: "Bundle share of orders" },
        },
        steps: ["Reading Brand Core, Personas and the account audit", "Setting pillars and share of posts", "Writing hypotheses with briefs to test them"],
        intro: "Reading the personas and the current strategy so this campaign layers on top rather than replacing it.",
        outro: "Drafted. Three pillars for the window, each with a hypothesis and a brief to test it.",
        suggestions: ["Write the three briefs", "Compare with the 8-week strategy"],
        relations: [
          { type: "informed_by", to: "doc_research_category" },
          ...(p2 ? [{ type: "targets_persona" as const, to: p2.id }] : []),
          ...(p1 ? [{ type: "targets_persona" as const, to: p1.id }] : []),
        ],
        sections: [
          { heading: "Goals and KPIs", md: `- Make the bundle ladder the default gift. **Primary KPI:** bundle share of orders from social above 35%.\n- Secondary: seasonal singles sell-through; saves on gift-guide carousels.` },
          { heading: "Audience", md: `1. @[doc_persona_p2] — the couple buying for each other and for friends.\n2. @[doc_persona_p1] — buying "an evening" for a friend who scrolls too much.\n3. @[doc_persona_p3] — the stocking single.` },
          {
            heading: "Pillars",
            md: `:::pillar{id=pillar-gift-evening status=active title="1. The gift that's an evening"}\n- **Intent:** reframe $20 as an evening, not an object.\n- **Funnel stage:** MOF / BOF · **Share of posts:** 40%\n- **Formats:** gift-guide carousel; flat-lay static; email hero.\n:::\n\n:::pillar{id=pillar-seasonal-makes status=active title="2. Seasonal makes"}\n- **Intent:** ride the seasonal how-to save behaviour with Christmas Stocking and Snow Ice Cream.\n- **Funnel stage:** TOF · **Share of posts:** 40%\n- **Formats:** 15s make; 4-slide how-to.\n:::\n\n:::pillar{id=pillar-proof-gifting status=active title="3. Gifting proof"}\n- **Intent:** reviews that mention gifting, verbatim.\n- **Funnel stage:** BOF · **Share of posts:** 20%\n:::`,
          },
          { heading: "Format mix and cadence", md: `- 6 posts per week; Friday and Sunday for offer posts; makes on Tuesday and Thursday.` },
          {
            heading: "Hypotheses",
            md: `:::hypothesis{id=h7 status=untested title="H7 — Seasonal singles as an evening"}\n- **Belief:** "the $20 gift that's an evening" out-converts "gift set" framing.\n- **Test:** a gift-guide carousel · **Metric:** bundle share of orders.\n:::\n\n:::hypothesis{id=h8 status=untested title="H8 — Which one first?"}\n- **Belief:** a choice carousel across the 12-pack drives comments at 4× the account median. @[doc_research_category]\n- **Test:** a choice carousel · **Metric:** comment rate.\n:::`,
          },
        ],
      };

    case "brand_core":
    case "product_facts":
    case "visual_system": {
      const meta = docTypes[type];
      return {
        title: `Terra Clays — ${meta.label} (refresh)`,
        subtype: null,
        channels: ["instagram", "tiktok"],
        tags: ["refresh"],
        properties: {},
        steps: ["Re-reading the site and the latest snapshots", "Comparing with the current document", "Drafting a diff for you to review"],
        intro: `Re-running ${meta.skill} against the latest sources. Because ${meta.label} is a living document I will propose a diff rather than overwrite it.`,
        outro: "Diff proposed. Open the document to accept or reject each section.",
        suggestions: ["Open the pending changes", "What changed since the last refresh?"],
        relations: [],
        sections: meta.sections.slice(0, 3).map((h) => ({ heading: h, md: `Proposed refresh of ${h.toLowerCase()} from the latest sources.` })),
      };
    }
  }
}

/* -------------------------------------------------------------- patches --- */

export type Patch = { anchor: string; heading: string; md: string; summary: string };

const sectionAliases: [RegExp, string][] = [
  [/objection|pain|desire/i, "pains-desires-and-objections"],
  [/language|words/i, "their-language"],
  [/angle/i, "angles"],
  [/hook/i, "hook-options"],
  [/caption|cta/i, "caption-and-cta"],
  [/structure|slide/i, "structure"],
  [/visual/i, "visual-direction"],
  [/pillar/i, "pillars"],
  [/hypothes/i, "hypotheses"],
  [/goal|kpi/i, "goals-and-kpis"],
  [/summary/i, "executive-summary"],
  [/finding/i, "findings"],
  [/implication/i, "implications"],
  [/voice/i, "voice"],
  [/claim/i, "allowed-and-disallowed-claims"],
  [/faq/i, "faq"],
  [/catalog/i, "catalogue"],
  [/snapshot/i, "snapshot"],
  [/checklist|qa/i, "qa-checklist"],
  [/objective/i, "objective"],
  [/reference/i, "references"],
];

/** Which H2 a follow-up message is talking about. Falls back to the first section. */
export function targetSection(doc: Document, message: string) {
  const heads = outline(doc.body).filter((h) => h.level === 2);
  const lower = message.toLowerCase();
  for (const h of heads) if (lower.includes(h.text.toLowerCase())) return h;
  for (const [re, id] of sectionAliases) {
    if (re.test(message)) {
      const hit = heads.find((h) => h.id === id);
      if (hit) return hit;
    }
  }
  return heads[0] ?? null;
}

function verbOf(message: string) {
  const m = message.toLowerCase();
  if (/tighten|shorter|condense|cut/.test(m)) return "tightened";
  if (/rewrite|redo|rephrase/.test(m)) return "rewrote";
  if (/add|append|include|more/.test(m)) return "added to";
  if (/evidence|cite|source/.test(m)) return "added evidence to";
  if (/brand core|on[- ]brand|voice/.test(m)) return "checked against Brand Core in";
  return "updated";
}

/** Produce a section-level patch for a follow-up message about `doc`. */
export function patchFor(doc: Document, message: string): Patch | null {
  const target = targetSection(doc, message);
  if (!target) return null;
  const verb = verbOf(message);
  const current = sectionMarkdown(doc.body, target.id);
  const lines = current.split("\n").filter(Boolean);
  const bullets = lines.filter((l) => /^[-*]\s|^\d+\.\s/.test(l));

  let md: string;
  if (verb === "tightened" && bullets.length) {
    md = bullets
      .map((b) => {
        const [head, ...rest] = b.split(/(?<=[.!?])\s/);
        return rest.length ? head : b;
      })
      .join("\n");
  } else if (verb === "added to" || verb === "added evidence to") {
    const extra =
      doc.type === "persona"
        ? `- **New:** the identity move — adults claiming a kids' category — is the hook, not the demographic. [[VOC-006]] [[VOC-017]]`
        : doc.type === "brief"
          ? `- **New:** "put me down and pick me up. different me." — character voice variant. [[VOC-005]]`
          : `- **New:** save rate, not views, is the metric every top post in the category shares. @[doc_research_sculpd]`;
    md = `${current}\n\n${extra}`.trim();
  } else if (verb === "checked against Brand Core in") {
    md = `${current}\n\n:::callout{tone=positive}\n**Checked against Brand Core.** No banned words. Perspective rules hold ("we" for the brand, "you" addressed directly). One joke, from the truth of the product.\n:::`;
  } else {
    /* Rewrite: keep the facts, change the register. */
    const rewritten = bullets.length
      ? bullets.map((b) => b.replace(/\*\*(.+?)\*\*/g, "**$1**").replace(/\.\s*$/, "")).map((b) => (b.includes("→") ? b : `${b} — said in her words, not ours.`)).join("\n")
      : `${current}\n\nRewritten for the persona's register: shorter sentences, the enemy named, the number said out loud.`;
    md = rewritten;
  }

  const short = doc.title.split(" — ")[0];
  return {
    anchor: target.id,
    heading: target.text,
    md,
    summary: `Updated ${docTypes[doc.type].label} ${short}: ${verb} ${target.text}`,
  };
}

/* ---------------------------------------------------------- ask modal --- */

export type Answer = { text: string[]; patch?: Patch; createBrief?: boolean; suggestions?: string[] };

/** The pinned summary at the top of the Ask modal: says, changed, stale. */
export function summarize(doc: Document, versions: Version[], relations: Relation[], docs: Document[], now: Date) {
  const heads = outline(doc.body).filter((h) => h.level === 2);
  const last = versions.filter((v) => v.docId === doc.id).sort((a, b) => b.version - a.version)[0];
  const fresh = effectiveFreshness(doc, now);
  const used = incoming(relations, doc.id).length;
  const from = outgoing(relations, doc.id).length;
  const says = `${docTypes[doc.type].label}${doc.subtype ? ` (${doc.subtype.replace(/_/g, " ")})` : ""} in ${heads.length} sections: ${heads.slice(0, 4).map((h) => h.text.toLowerCase()).join(", ")}${heads.length > 4 ? "…" : ""}. ${from ? `Built from ${from} related doc${from === 1 ? "" : "s"}` : "No relations yet"}${used ? `; used by ${used}` : ""}.`;
  const changed = last ? `v${last.version}: ${last.summary}${last.author === "user" ? " (you)" : ""}.` : "No versions yet.";
  const staleBits: string[] = [];
  if (fresh?.kind === "expired") staleBits.push("verification expired");
  if (fresh?.kind === "outdated") staleBits.push("flagged outdated");
  if (fresh?.kind === "unverified") staleBits.push("never verified");
  if (doc.missingSections?.length) staleBits.push(`${doc.missingSections.length} template section${doc.missingSections.length === 1 ? "" : "s"} unfilled (${doc.missingSections.join(", ")})`);
  if (doc.pendingDiff) staleBits.push("a pending diff is waiting for review");
  const sources = outgoing(relations, doc.id)
    .map((r) => docs.find((d) => d.id === r.to))
    .filter((d): d is Document => Boolean(d) && new Date(d!.updatedAt) > new Date(doc.updatedAt));
  if (sources.length) staleBits.push(`${sources.length} source doc${sources.length === 1 ? "" : "s"} changed since this was touched`);
  const stale = staleBits.length ? staleBits.join("; ") + "." : "Nothing looks stale.";
  return { says, changed, stale };
}

export function answer(doc: Document, question: string, docs: Document[], relations: Relation[], now: Date): Answer {
  const q = question.toLowerCase();
  const heads = outline(doc.body).filter((h) => h.level === 2);
  const missing = docTypes[doc.type].sections.filter((s) => !heads.some((h) => h.text.toLowerCase() === s.toLowerCase()));

  if (/summar/.test(q)) {
    return {
      text: [
        `${doc.title} is a ${docTypes[doc.type].label.toLowerCase()} at ${statusLabels[doc.status].toLowerCase()}, v${doc.version}. It covers ${heads.map((h) => h.text.toLowerCase()).join(", ")}.`,
        heads.length ? `The load-bearing section is "${heads[Math.min(2, heads.length - 1)].text}": ${sectionMarkdown(doc.body, heads[Math.min(2, heads.length - 1)].id).split("\n")[0].replace(/^[-*]\s*/, "").slice(0, 180)}` : "",
      ].filter(Boolean),
      suggestions: ["Find gaps", "Check against Brand Core"],
    };
  }
  if (/gap|missing|weak/.test(q)) {
    const cites = (doc.bodyMd.match(/\[\[VOC-\d+\]\]/g) ?? []).length;
    return {
      text: [
        missing.length
          ? `The template has ${missing.length} section${missing.length === 1 ? "" : "s"} this doc does not: ${missing.join(", ")}.`
          : "Every template section is present.",
        `${cites} citation chip${cites === 1 ? "" : "s"} in the body${cites < 3 ? " — thin; the claims in the first two sections are unevidenced." : "."} ${heads.some((h) => /qa|checklist/i.test(h.text)) ? "" : "There is no QA checklist, so a draft has nothing to be checked against."}`,
      ],
      suggestions: missing.length ? [`Add ${missing[0]}`, "Add evidence"] : ["Add evidence", "Turn this into a Brief"],
    };
  }
  if (/brand core|on[- ]brand|voice/.test(q)) {
    const banned = ["unleash", "creativity journey", "elevate", "premium", "mindfulness", "self-care ritual", "wellness journey", "treat yourself"];
    const hits = banned.filter((w) => doc.bodyMd.toLowerCase().includes(w));
    return {
      text: [
        hits.length ? `Found ${hits.length} banned word${hits.length === 1 ? "" : "s"} from Brand Core: ${hits.map((h) => `"${h}"`).join(", ")}.` : "No banned words. Perspective rules hold.",
        "I can append a check callout to the first section so the result stays with the doc.",
      ],
      patch: patchFor(doc, "check against brand core in the first section") ?? undefined,
      suggestions: ["Apply the check", "Find gaps"],
    };
  }
  if (/refresh|latest research|re-?run|changed since/.test(q)) {
    const fresh = effectiveFreshness(doc, now);
    const newer = outgoing(relations, doc.id)
      .map((r) => docs.find((d) => d.id === r.to))
      .filter((d): d is Document => Boolean(d) && new Date(d!.updatedAt) > new Date(doc.updatedAt));
    return {
      text: [
        newer.length
          ? `${newer.length} source${newer.length === 1 ? "" : "s"} changed since this was written: ${newer.map((d) => d.title.split(" — ")[0]).join(", ")}. I have queued a refresh; it will arrive as a pending diff you accept per section.`
          : `No source document has changed since this was last touched${fresh?.kind === "expired" ? ", but its verification has expired" : ""}. A refresh would re-run the skill against the same evidence; ask for one from the document menu if you want the freshness state made explicit.`,
      ],
      suggestions: ["Open Updates", "Verify for 90 days instead"],
    };
  }
  if (/brief/.test(q) && doc.type !== "brief") {
    return {
      text: [`Starting a brief from ${doc.title.split(" — ")[0]}. I will pick the winning angle and present hooks first.`],
      createBrief: true,
    };
  }
  if (/tighten|rewrite|add|evidence|cite/.test(q)) {
    const patch = patchFor(doc, question);
    return {
      text: [patch ? `${patch.summary.replace(/^Updated /, "Updating ")}.` : "I could not find that section."],
      patch: patch ?? undefined,
      suggestions: ["Undo that", "Do the same for the next section"],
    };
  }
  const first = heads[0];
  return {
    text: [
      first
        ? `From "${first.text}": ${sectionMarkdown(doc.body, first.id).split("\n")[0].replace(/^[-*]\s*/, "").slice(0, 220)}`
        : "This document is still empty.",
      `Ask me to summarise, find gaps, check it against Brand Core, or turn it into a brief. Anything that changes the doc is applied as a patch you can see.`,
    ],
    suggestions: ["Summarize", "Find gaps"],
  };
}

export function makeAnchor(text: string) {
  return slugify(text);
}
