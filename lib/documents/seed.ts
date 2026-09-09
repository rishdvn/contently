import { bodyToMarkdown, markdownToBody } from "./markdown";
import type {
  Activity,
  Author,
  Body,
  Channel,
  Citation,
  DocStatus,
  DocType,
  Document,
  Freshness,
  Properties,
  Relation,
  SavedFilter,
  Subtype,
  Thread,
  Version,
} from "./types";

/*
  One brand, seeded from a real run (Terra Clays, 2026-09-08) so every document
  type has a worked example and every relation has something on both ends.
  Times are relative to "now" so the list reads naturally whenever it opens.
*/

export const BRAND_ID = "brand_terra";

const ago = (now: Date, mins: number) => new Date(now.getTime() - mins * 60_000).toISOString();
const ahead = (now: Date, days: number) => new Date(now.getTime() + days * 86_400_000).toISOString();
const H = 60;
const D = 24 * H;

type Seed = {
  id: string;
  type: DocType;
  subtype?: Subtype | null;
  title: string;
  status: DocStatus;
  version: number;
  properties?: Properties;
  md: string;
  createdBy?: Author;
  runId?: string | null;
  channels?: Channel[];
  accounts?: string[];
  tags?: string[];
  freshness?: Freshness | null;
  owner?: string;
  createdMins: number;
  updatedMins: number;
  skill?: string;
  missingSections?: string[];
};

function make(now: Date, s: Seed): Document {
  const body: Body = markdownToBody(s.md);
  return {
    id: s.id,
    brandId: BRAND_ID,
    type: s.type,
    subtype: s.subtype ?? null,
    title: s.title,
    status: s.status,
    version: s.version,
    properties: s.properties ?? {},
    body,
    bodyMd: bodyToMarkdown(body),
    createdBy: s.createdBy ?? "agent",
    runId: s.runId ?? "run_2026-09-08_terra",
    channels: s.channels ?? ["instagram", "tiktok"],
    accounts: s.accounts ?? ["@terraclays"],
    tags: s.tags ?? [],
    freshness: s.freshness ?? null,
    owner: s.owner ?? (s.createdBy === "user" ? "Hanna Moore" : "Agent"),
    createdAt: ago(now, s.createdMins),
    updatedAt: ago(now, s.updatedMins),
    skill: s.skill,
    missingSections: s.missingSections,
    pendingDiff: null,
    lastPatch: null,
    bodyRevision: 0,
  };
}

/* ---------------------------------------------------------------- docs --- */

export function buildSeed(now = new Date()) {
  const docs: Document[] = [];
  const versions: Version[] = [];
  const relations: Relation[] = [];
  const activity: Activity[] = [];

  const rel = (from: string, type: Relation["type"], to: string, anchor?: string, mins = 20 * H) =>
    relations.push({ from, to, type, anchor: anchor ?? null, createdAt: ago(now, mins) });

  const act = (a: Omit<Activity, "id" | "at"> & { mins: number }) =>
    activity.push({ id: `act_${activity.length + 1}`, docId: a.docId, kind: a.kind, author: a.author, text: a.text, at: ago(now, a.mins), runId: a.runId, threadId: a.threadId });

  /* ------------------------------------------------------------ Brand --- */

  docs.push(
    make(now, {
      id: "doc_brand_core",
      type: "brand_core",
      title: "Terra Clays — Brand Core",
      status: "active",
      version: 3,
      skill: "brand-core",
      freshness: { kind: "verified", until: ahead(now, 62) },
      properties: {
        last_reviewed: { kind: "date", value: ago(now, 28 * D) },
        primary_channels: { kind: "multi", value: ["Instagram", "TikTok"] },
      },
      createdMins: 3 * D + 2 * H,
      updatedMins: 28 * D,
      md: `## Positioning and story

**Terra is the 20-minute phone replacement.** Tiny air-dry clay kits — dinosaurs, desserts, animals — that you can actually finish in an evening, with no oven and no talent required.

The enemy is the scroll, not other clay brands. Every competitive alternative is either another episode, a pottery kit that takes three hours and cracks, or a bag of Crayola with no cute outcome at the end. Terra sits in "a different kind of evening", never in "arts and crafts supplies".

## Mission

Give people something small to make with their hands so they stop making nothing with their evenings.

## Voice

Warm, dry, lowercase-friendly and self-aware. The dinosaurs can speak. Short sentences. Jokes come from honesty ("sculpt something ugly together") rather than from wordplay.

| Dial | Setting |
| --- | --- |
| Perspective | "we" for the brand, "i" when a character speaks, "you" always addressed directly |
| Formality | Low. Lowercase captions are allowed; product copy keeps sentence case |
| Humour | Deadpan, never zany. One joke per post, and it should come from the truth of the product |
| Traits | Warm · Dry · Honest · Unhurried · A bit judgemental (only the dinosaurs) |

## Do / Don't

- **Do** name the enemy: the scroll, the "what do you want to do?" loop, the half-finished hobby.
- **Do** say how long it takes. "20 minutes" is the most important number we own.
- **Do** let the product be a character. Trikey has opinions about your screen time.
- **Don't** use: unleash, creativity journey, elevate, premium, mindfulness (as a noun), self-care ritual, wellness journey, "treat yourself".
- **Don't** claim "no cracking" as an absolute; say small, soft, air-dries on a shelf. See @[doc_product_facts#allowed-and-disallowed-claims].
- **Don't** talk about the brand. Talk about the evening.

## Proof points

- 11,000+ five-star reviews. Love-it-or-refund.
- Bloomberg: "the screen-free hobby quietly taking over living rooms".
- BuzzFeed: "I came for the tiny dinosaurs and stayed for the stress relief".
- Named reviews we may quote: Maya L, Hannah P, Jess & Tom, The Nguyens, Sarah M, Cara D, Aaron & Lily, Daniel K.

## Voice excerpts

- "friday is not going to plan itself."
- "step 1: roll a potato. that's the body. yes, really."
- "you've been scrolling for 47 minutes. i took 20 to make. just saying."
- "sculpt something ugly together. you will laugh at each other's."
- "no oven. no kiln. no skill. one dinosaur."
- "six evenings, sorted."
- "this is trikey. he's 20 minutes and a bit judgemental."

## Audience summary

- @[doc_persona_p1] — works on a screen all day, doomscrolls at night and hates it. Enters problem-aware. Angle: the 20-minute phone replacement.
- @[doc_persona_p2] — together 2+ years, evenings are two phones on one sofa. Enters solution-aware. Angle: the date night that requires zero talent and zero planning.
- @[doc_persona_p3] — kids 5–10, wants one activity both of them enjoy that doesn't wreck the kitchen. Exploratory until month 2.`,
    }),
  );

  docs.push(
    make(now, {
      id: "doc_product_facts",
      type: "product_facts",
      title: "Terra Clays — Product Facts",
      status: "active",
      version: 2,
      skill: "product-facts",
      freshness: { kind: "verified", until: ahead(now, 41) },
      properties: {
        catalogue_source: { kind: "url", value: "https://terraclays.com/products.json" },
        sku_count: { kind: "number", value: 14 },
        last_synced: { kind: "date", value: ago(now, 6 * D) },
      },
      createdMins: 3 * D + H,
      updatedMins: 6 * D,
      md: `## Catalogue

| SKU | Name | Price | In the box | Time |
| --- | --- | --- | --- | --- |
| TC-TRIKEY | Trikey (triceratops) | $20 | soft clay ×4, kid-safe tools, picture guide | ~20 min |
| TC-SPIKLES | Spikles (stegosaurus) | $20 | soft clay ×4, tools, guide | ~20 min |
| TC-ZIPPY | Zippy (raptor) | $20 | soft clay ×4, tools, guide | ~25 min |
| TC-HIPPO | Hippo | $20 | soft clay ×3, tools, guide | ~20 min |
| TC-CAKE | Strawberry Cake | $20 | soft clay ×5, tools, guide | ~20 min |
| TC-MATCHA | Matcha Tea Roll | $20 | soft clay ×4, tools, guide | ~15 min |
| TC-COZY3 | Cozy Critters (3 kits) | $60 | three single kits, shared tool kit | 3 evenings |
| TC-DINO3 | Dino Dreamers (3 kits) | $60 | Trikey, Spikles, Zippy | 3 evenings |
| TC-BITES3 | Blissful Bites (3 kits) | $60 | Cake, Matcha, Donut | 3 evenings |
| TC-LSS3 | Land Sea & Sky (3 kits) | $60 | three single kits | 3 evenings |
| TC-DISC12 | Dino Discovery Collection (12) | $120 | twelve single kits, two tool kits | a season |
| TC-TOOLS | 1 Tool Kit | $8 | wooden tools ×4, roller | — |
| TC-XSTOCK | Christmas Stocking (seasonal) | $20 | soft clay ×4, tools, guide | ~20 min |
| TC-SNOWIC | Snow Ice Cream (seasonal) | $20 | soft clay ×4, tools, guide | ~20 min |

## Allowed and disallowed claims

- **Allowed:** no baking · non-toxic · mess-free · ships in 2–3 days · 11,000+ five-star reviews · love-it-or-refund · everything in the box · visual step-by-step guide · finish in about 20 minutes.
- **Allowed with care:** "far less likely to crack" — small pieces, soft clay, air-dries on a shelf. Never "no cracking" or "crack-proof".
- **Disallowed:** "professional grade", "museum quality", "therapeutic", any health claim, "kiln-fired", any comparison that names Sculpd.

:::callout{tone=caution}
The site says the clay is soft, forgiving and air-dries; it does not claim "no cracking". Copy must avoid the absolute. Confirm with the founder that small pieces reliably dry crack-free before softening this rule.
:::

## Objections and approved responses

| Objection | Approved response | Evidence |
| --- | --- | --- |
| "my air dry clay always cracks" | Big slab bowls crack because they're big, dry unevenly and get baked. Ours are 3cm tall, soft, and air-dry on a shelf. Different sport. | [[VOC-003]] |
| "we can't draw" | You don't draw. You roll a potato and add horns. The picture guide does the rest. | [[VOC-011]] |
| "do you need to bake it?" | No oven, no kiln. Leave it overnight. | [[VOC-015]] |
| "isn't this just play-doh?" | Play-doh goes back in the tub. This dries hard and stays on your shelf. | [[VOC-014]] |
| "my partner would never" | Neither would Tom, until he did. | [[VOC-012]] [[VOC-018]] |
| "why buy pre-coloured clay?" | Because the point is the evening, not the mixing. | [[VOC-013]] |

## FAQ

- **How long does it take?** About 20 minutes for a single kit. Leave it overnight to dry.
- **Is it safe for kids?** Non-toxic, kid-safe tools. Easy enough for a six-year-old, calming enough for the adult next to them. [[VOC-020]]
- **What if I hate it?** Love-it-or-refund. No questions.
- **Do I need anything else?** No. Clay, tools and the guide are in the box.

## Shipping, returns and bundles

- Ships in 2–3 days. Free shipping at 9 kits.
- Bundle ladder: 40% off at 6 (+ free tool kit), 45% at 9 (+ free shipping), 50% at 12.
- Price anchors: $20 single · $60 three-kit collection · $120 twelve-pack.
- Gifting: every kit is "an evening", which is the gift framing. Christmas singles ship gift-wrapped.

## Seasonal and limited

| Item | Window | Note |
| --- | --- | --- |
| Christmas Stocking | Nov 1 – Dec 20 | Q4 gifting single |
| Snow Ice Cream | Nov 1 – Jan 15 | Q4 gifting single |
| Clay ghosts (planned) | Oct 1 – Oct 31 | Rides the seasonal how-to trend, see @[doc_research_category] |`,
    }),
  );

  docs.push(
    make(now, {
      id: "doc_visual_system",
      type: "visual_system",
      title: "Terra Clays — Visual System",
      status: "in_review",
      version: 1,
      skill: "visual-system",
      freshness: { kind: "unverified" },
      properties: {},
      createdMins: 2 * D + 20 * H,
      updatedMins: 2 * D + 20 * H,
      missingSections: ["Generation prompt fragments"],
      md: `## Palette and type

| Role | Swatch | Hex | Use |
| --- | --- | --- | --- |
| Cream | {{#f4ead9}} | #F4EAD9 | Background of every static and slide |
| Terracotta | {{#c8623a}} | #C8623A | Display type, CTA, the only accent |
| Clay pink | {{#e8b4a0}} | #E8B4A0 | Trikey, Hippo, secondary shapes |
| Sage | {{#9db08a}} | #9DB08A | Spikles, plants, calm accents |
| Ink | {{#2b2622}} | #2B2622 | Body copy, never pure black |

- Display: a soft rounded grotesque, lowercase, tight leading. Body: the same face at regular weight.
- Never more than two type sizes on one slide.

## Photography and illustration

- Product characters are the visual anchors. Shoot them at eye level, slightly underlit, on cream or a lived-in sofa.
- Real hands, real evenings: a mug, a lamp, a phone face-down. No studio white, no stock smiles.
- Avoid: kids' craft aesthetics (primary colours, glitter), pottery-studio aprons, anything that says "supplies".

## Layout rules per format

| Format | Rule |
| --- | --- |
| 1:1 static | Character bottom-right, copy top-left, two lines max |
| 4:5 carousel | Cover: headline + one character. Body slides: number top-left, one idea, one object. CTA slide: terracotta block, one line |
| 9:16 video cover | Hands and clay in the top third, hook text in the safe zone below |

## Reference board

- Own post: Trikey on cream, "you've been scrolling for 47 minutes" — the character-with-a-point-of-view format.
- Own post: B1 carousel cover, couple lit by two phones — proof that a dark cover works against the cream system.
- Sculpd: single-object make stills — the cleanliness we want, minus the pottery-studio tone.
- Duolingo statics — how a character carries a still without a product pitch.
- Product CDN: Trikey, Spikles, Hippo, Strawberry Cake, Matcha Tea Roll, Tool Kit — approved as generation references.

## Text-on-image rules

- Max 12 words on a static; max 9 words per carousel slide.
- Safe zones: 8% margin all sides; keep the bottom 15% clear on 9:16.
- Captions lowercase; on-image copy may be lowercase when a character speaks, sentence case otherwise.`,
    }),
  );

  /* --------------------------------------------------------- Research --- */

  docs.push(
    make(now, {
      id: "doc_research_audit",
      type: "research_snapshot",
      subtype: "account_audit",
      title: "Own-account audit — @terraclays",
      status: "published",
      version: 1,
      skill: "research-account_audit",
      channels: ["instagram", "tiktok"],
      properties: {
        date_range: { kind: "range", start: "2026-03-17", end: "2026-09-08" },
        sample_size: { kind: "number", value: 12 },
        data_sources: { kind: "multi", value: ["SocialCrawl run sc_0908_01", "instagram.com/terraclays"] },
      },
      createdMins: 3 * D + 40,
      updatedMins: 3 * D,
      md: `## Executive summary

- The account has 39 followers and 12 posts; every post is repurposed couples-meme content with 2–3 likes and zero comments.
- The bio promise ("relax and unwind") is right; the feed does not deliver it. There is no product presence at all.
- The bio link points to an AU date-night page that 404s.
- No TikTok account exists under terraclays or itsterra; TikTok is where the category grows.
- Recommendation: archive the memes, keep the couples *insight*, express it through the product.

## Method

Pulled the full Instagram profile and all 12 posts via SocialCrawl (\`/instagram/profile/posts/full\`), plus a TikTok handle search for terraclays and itsterra. Reviewed bio, link, hashtags, per-post engagement and comment counts.

## Findings

| Signal | Finding | Implication |
| --- | --- | --- |
| Bio | "Adorable clay kits to help you relax and unwind." Link → itsterra.com.au/pages/date-night (404) | Fix the link. Keep the promise. |
| Feed (12 posts, Mar 17–22) | All couples memes: "pov: how to be a good boyfriend", "which one are you", "we'll be in bed by 10pm". #couples #bf #gf. 2–3 likes each, 0 comments | Borrowed audience-bait with no bridge to product. Kill it. |
| TikTok | No account found | Open one; repost carousels as photo-mode posts. |

## Top posts

| Post | Format | Hook | Likes | Why it worked |
| --- | --- | --- | --- | --- |
| "we'll be in bed by 10pm" | static meme | relatable couple line | 3 | It didn't. Best of a flat set. |

## Implications

- Personas: the couples insight is real ([[VOC-001]]); the execution was the problem.
- Strategy: replace meme-repurposing with a character-led, save-first system. Open TikTok.
- Briefs: none can be built from own-account performance yet; use category evidence instead.

## Open questions

- Does the founder have raw footage of kits being made? A 15s make reel is the cheapest TOF format.
- Who owns the AU domain, and should the bio link go to the US store instead?`,
    }),
  );

  docs.push(
    make(now, {
      id: "doc_research_sculpd",
      type: "research_snapshot",
      subtype: "competitor_audit",
      title: "Category leader — Sculpd (TikTok)",
      status: "published",
      version: 1,
      skill: "research-competitor_audit",
      channels: ["tiktok"],
      accounts: ["@sculpd"],
      properties: {
        date_range: { kind: "range", start: "2026-06-01", end: "2026-09-08" },
        sample_size: { kind: "number", value: 10 },
        data_sources: { kind: "multi", value: ["SocialCrawl run sc_0908_02"] },
      },
      createdMins: 3 * D + 30,
      updatedMins: 3 * D,
      md: `## Executive summary

- Top 10 recent videos are all 13–16 seconds, all a single satisfying make with a trend or seasonal hook.
- Save rate, not view count, is the signal: "Warning: this candle melts before you light it" — 2.3M views, **11k saves**.
- Comments are almost entirely product-aware questions: where to buy, do you bake it, what varnish. The brand should answer these in content.
- A new series format ("Ep 1: The Trend Edit — we see a homeware trend, we make it") is worth copying at Terra's scale.

## Method

Pulled the last 10 videos from @sculpd via SocialCrawl (\`/tiktok/profile/videos\`) with view, like, save and share counts, plus the top comments on the three highest-saved videos.

## Findings

- **Curiosity or trend hook in the caption + one object made start to finish + high save rate** is the whole pattern.
- Seasonal and colour-of-the-year hooks ("Mocha Mousse") outperform product-name hooks.
- The couples angle exists in the category ("the key to a happy relationship 😉🗝️" — 321k views, 4.0k saves) but nobody owns it.

## Top posts

| Post | Format | Hook | Views | Saves | Why it worked |
| --- | --- | --- | --- | --- | --- |
| DIY egg bowl in Mocha Mousse | 15s make | colour-of-the-year | 3.7M | 3.0k | Trend hook on a simple object |
| Is that… a baguette candle holder?! | 14s make | curiosity | 2.6M | 2.8k | Absurd object, satisfying finish |
| Warning: this candle melts before you light it | 16s make | warning | 2.3M | 11k | Named a problem, showed the fix |
| Cute as a button (literally) | 13s make | pun | 855k | 8.0k | Tiny cute object = saves |
| the key to a happy relationship 😉🗝️ | 15s make | couples | 321k | 4.0k | Relationship framing on a product |
| Ep 1: The Trend Edit | series | format | 12.6k | — | New series; copy the mechanic |

## Implications

- Strategy: pillar 1 "Make & satisfy" should borrow this pattern exactly — one object, one hook, 15 seconds. See @[doc_strategy_ig#pillars].
- Briefs: pre-answer "do you bake it" and "where do I buy" in-feed rather than in replies.
- Product Facts: the "what varnish" question suggests a finishing FAQ we don't have.

## Open questions

- Are Sculpd's saves driven by the object or by the trend hook? Test both on Terra in week 1.`,
    }),
  );

  docs.push(
    make(now, {
      id: "doc_research_category",
      type: "research_snapshot",
      subtype: "category_search",
      title: "Category search — \"air dry clay kit\" (TikTok)",
      status: "published",
      version: 1,
      skill: "research-category_search",
      channels: ["tiktok"],
      properties: {
        date_range: { kind: "range", start: "2026-07-01", end: "2026-09-08" },
        sample_size: { kind: "number", value: 40 },
        data_sources: { kind: "multi", value: ["SocialCrawl run sc_0908_03"] },
      },
      createdMins: 3 * D + 20,
      updatedMins: 3 * D,
      md: `## Executive summary

- Kit-creator content is claimed by adults: the biggest post ("Not your regular air-dry clay kit… #screenfreeplay", 2.0M views) has comments skewing to adults saying it's for them.
- Seasonal how-to is a save magnet: "DIY air dry clay ghosts" — 323k views, **10.4k saves, 5.3k shares**.
- Choice questions drive comments: "Which one should I turn into a plushie first?" — 818 comments on 207k views.
- The cute-object trend (Jellycat dupes, "hard-boiled egg jellycats") is alive and maps onto Terra's product line.

## Method

SocialCrawl keyword search on TikTok for "air dry clay kit", top 40 by engagement in the window, plus top comments on the five most-saved.

## Findings

- Adults claiming kids' kits for themselves is the strongest identity signal in the category. [[VOC-006]] [[VOC-007]] [[VOC-008]]
- Seasonal how-tos out-save everything else by 3×.
- "Which one first?" formats convert views to comments at 4×.

## Top posts

| Post | Format | Hook | Views | Saves | Why it worked |
| --- | --- | --- | --- | --- | --- |
| Not your regular air-dry clay kit… #screenfreeplay | kit reveal | contrast | 2.0M | 5.1k | Adults claimed it |
| DIY air dry clay ghosts, your next fall craft | how-to | seasonal | 323k | 10.4k | Seasonal + saveable |
| Which one should I turn into a plushie first? | choice | question | 207k | — | 818 comments |
| hard-boiled egg jellycats | make | trend dupe | 640k | 3.1k | Cute-object trend |

## Implications

- Personas: @[doc_persona_p1] is real and under-served — the "29-year-old me would love this" comment is her.
- Briefs: a seasonal how-to (clay ghosts, October) and a "which one first?" carousel across the 12-pack.
- Product Facts: plan the clay-ghost seasonal item.

## Open questions

- Does the seasonal how-to work as a carousel, or only as video?`,
    }),
  );

  docs.push(
    make(now, {
      id: "doc_research_trend",
      type: "research_snapshot",
      subtype: "trend_scan",
      title: "Adjacent trend — \"screen-free date night\" (TikTok)",
      status: "published",
      version: 1,
      skill: "research-trend_scan",
      channels: ["tiktok"],
      accounts: ["@atwistofdate"],
      properties: {
        date_range: { kind: "range", start: "2026-08-01", end: "2026-09-08" },
        sample_size: { kind: "number", value: 25 },
        data_sources: { kind: "multi", value: ["SocialCrawl run sc_0908_04"] },
      },
      createdMins: 3 * D + 10,
      updatedMins: 3 * D,
      md: `## Executive summary

- The single strongest format signal in this run: @atwistofdate "Our top 3 zero-planning, free, last-minute date nights… instead of just zoning out side by side" — 1.96M views, **92k saves, 53k shares**.
- Listicle + named pain is the mechanic. The pain is verbatim: "zoning out side by side". [[VOC-001]]
- The objections are all in the comments: "we can't draw" (4.9k likes), "I am too competitive for these ideas", "my fiancé would never do this".

## Method

SocialCrawl keyword search for "screen free date night" on TikTok, top 25 in the window, full comment pull on the top post.

## Findings

- A 3-item listicle where the product is the honest third option will out-save any product-first post. This becomes hypothesis H1 in @[doc_strategy_ig#hypotheses].
- The audience already saves these and rarely acts; the brief must remove the last excuse (talent, planning, partner).
- "I don't have a partner but still saving it for some reason" — a solo variant of the same need. [[VOC-023]]

## Top posts

| Post | Format | Hook | Views | Saves | Shares |
| --- | --- | --- | --- | --- | --- |
| Our top 3 zero-planning, free, last-minute date nights | listicle | named pain | 1.96M | 92k | 53k |
| Date night ideas for when you're tired and busy | listicle | tired/busy | 14k | 2.1k | 600 |

## Quote bank

| Id | Quote | Likes | Theme |
| --- | --- | --- | --- |
| [[VOC-011]] | "we can't draw" | 4,853 | objection — talent |
| [[VOC-002]] | "We had a baby and now we're never bored 😅" | 563 | pain — no time |
| [[VOC-022]] | "I am too competitive for these ideas" | 818 | objection — partner dynamic |
| [[VOC-012]] | "I would love this, but my fiancé would never do this 😭" | — | objection — partner buy-in |
| [[VOC-023]] | "I don't have a partner but still saving it for some reason" | — | solo variant |

## Implications

- Personas: @[doc_persona_p2] with its objections list.
- Briefs: B1 (3 zero-planning date nights) rides this directly.

## Open questions

- Is there a solo version of the listicle for P1 ("3 things to do at 9:40pm that aren't your phone")?`,
    }),
  );

  docs.push(
    make(now, {
      id: "doc_research_voc",
      type: "research_snapshot",
      subtype: "voc_mine",
      title: "VoC mine — category comments and Terra reviews",
      status: "published",
      version: 1,
      skill: "research-voc_mine",
      channels: ["tiktok", "instagram"],
      properties: {
        date_range: { kind: "range", start: "2026-06-01", end: "2026-09-08" },
        sample_size: { kind: "number", value: 412 },
        data_sources: { kind: "multi", value: ["SocialCrawl runs sc_0908_02–05", "terraclays.com/reviews"] },
      },
      createdMins: 3 * D,
      updatedMins: 3 * D,
      md: `## Executive summary

- 412 comments and reviews clustered into pain, desire/identity, objection and proof.
- The dominant pain is passive evenings ("zoning out side by side"); the dominant objection is talent ("we can't draw").
- Adults claiming the category for themselves is the identity theme: "My 29 year old me would love this" (796 likes).
- Terra's own reviews already contain the proof language for every objection.

## Method

Comments pulled from the top posts in the Sculpd, category and trend snapshots; reviews pulled from the Terra site. Clustered by theme; starred lines are recommended verbatim for hooks.

## Quote bank

| Id | Quote | Theme | Sentiment | Source |
| --- | --- | --- | --- | --- |
| [[VOC-001]] | "instead of just zoning out side by side" | pain | negative | atwistofdate caption, 1.96M views |
| [[VOC-002]] | "We had a baby and now we're never bored 😅" | pain | wry | comment, 563 likes |
| [[VOC-003]] | "my air dry clay always horrendously cracks" | pain | negative | comment, 539 likes |
| [[VOC-004]] | "I don't have the patience for this" | pain | negative | comment |
| [[VOC-005]] | "I need to do it now bc I know I won't do it later" | trigger | urgent | comment |
| [[VOC-006]] | "My 29 year old me would love this" | identity | positive | comment, 796 likes |
| [[VOC-007]] | "I'm 48 and I'm DESPERATE for this." | identity | positive | comment |
| [[VOC-008]] | "I think I'm gonna give myself the gift of creativity 😂" | desire | positive | comment |
| [[VOC-009]] | "So soothing. Twenty minutes in and my shoulders finally dropped." | desire | positive | Terra review, Hannah P |
| [[VOC-010]] | "These kits are part of my weekly me-time" | desire | positive | Terra review, Maya L |
| [[VOC-011]] | "we can't draw" | objection | doubtful | comment, 4,853 likes |
| [[VOC-012]] | "I would love this, but my fiancé would never do this 😭" | objection | wistful | comment |
| [[VOC-013]] | "why would anyone buy precolored air dry clay" | objection | skeptical | comment, 210 likes |
| [[VOC-014]] | "air dry clay is playdo. I was so disappointed" | objection | negative | comment |
| [[VOC-015]] | "Do you need to bake it?" | objection | curious | asked on nearly every make video |
| [[VOC-016]] | "Price is nowhere near as bad as I thought it was gonna be" | proof | relieved | comment, 37 likes |
| [[VOC-017]] | "Bought it for the kids, ended up fighting over it as adults. Worth it." | proof | positive | Terra review, The Nguyens |
| [[VOC-018]] | "Our new date night. We put music on, sculpt, and actually talk." | proof | positive | Terra review, Jess & Tom |
| [[VOC-019]] | "Did one together on a rainy night in. Way more fun than another show." | proof | positive | Terra review, Aaron & Lily |
| [[VOC-020]] | "Easy enough for my six-year-old, calming enough for me." | proof | positive | Terra review, Daniel K |
| [[VOC-021]] | "No mess, no baking, no stress, just us and a little pot of calm." | proof | positive | Terra review, Cara D |
| [[VOC-022]] | "I am too competitive for these ideas" | objection | wry | comment, 818 likes |
| [[VOC-023]] | "I don't have a partner but still saving it for some reason" | desire | wistful | comment |

## Findings

- **Pain** clusters: passive evenings (3 quotes), no time (2), category disappointment — cracking, play-doh (2).
- **Identity** cluster is the surprise: adults explicitly claiming a kids' category. This is @[doc_persona_p1].
- **Objections** rank: talent (4,853 likes) → partner buy-in → skeptic/value → keepsake vs toy → baking.
- **Proof** language from Terra reviews answers every objection already; briefs should quote rather than paraphrase.

## Implications

- Personas: P1 (identity + pain), P2 (pain + objections), P3 (proof, [[VOC-017]] [[VOC-020]]).
- Product Facts: the objection table should cite these ids.
- Briefs: B4 (proof), B5 (myth-bust) come straight from this bank.

## Open questions

- Pull Terra's own DMs; they are likely to hold the gifting objections we have not seen yet.`,
    }),
  );

  docs.push(
    make(now, {
      id: "doc_research_duolingo",
      type: "research_snapshot",
      subtype: "competitor_audit",
      title: "Inspiration account — Duolingo (Instagram)",
      status: "draft",
      version: 1,
      skill: "research-competitor_audit",
      channels: ["instagram"],
      accounts: ["@duolingo"],
      properties: {
        date_range: { kind: "range", start: "2026-08-01", end: "2026-09-08" },
        sample_size: { kind: "number", value: 30 },
        data_sources: { kind: "multi", value: ["SocialCrawl run sc_0908_05"] },
      },
      createdMins: 2 * D + 22 * H,
      updatedMins: 2 * D + 22 * H,
      missingSections: ["Top posts", "Open questions"],
      md: `## Executive summary

- Not a competitor; a mechanics reference. Steal the mechanics, not the mascot.
- Brand as a character with a point of view. Duo narrates; captions are lowercase, deadpan, first person.
- Product mechanic turned into a joke. The streak is the joke. For Terra: *20 minutes, no oven, tiny dinosaur* are the jokes.
- Share hooks addressed to a third person: "send this to someone with knees" — 2.3M views, 206k likes.

## Method

Top 30 Instagram posts by engagement in the window via SocialCrawl; caption and format analysis.

## Findings

- Comment on culture, not on yourself. Posts about MrBeast, anime and K-pop get 3M+ because they ride existing attention. Terra can ride phone-addiction discourse, date-night discourse and "cozy hobby" discourse.
- Pinned character posts are statics. Stills and carousels work when the character is strong.
- Terra version of the share hook: "tag the person you're zoning out next to."

## Implications

- Strategy: pillar 2 "Terra characters" borrows the narrator mechanic. See @[doc_strategy_ig#pillars].
- Briefs: B3 (Trikey on your screen time) is the first character static.`,
    }),
  );

  /* A run still in flight, so the Generating filter and the stepper are real. */
  docs.push(
    make(now, {
      id: "doc_research_cozy",
      type: "research_snapshot",
      subtype: "trend_scan",
      title: "Trend scan — \"cozy hobby\" discourse (TikTok, Instagram)",
      status: "generating",
      version: 0,
      skill: "research-trend_scan",
      runId: "run_cozy_hobby",
      channels: ["tiktok", "instagram"],
      properties: {
        date_range: { kind: "range", start: "2026-08-09", end: "2026-09-09" },
        data_sources: { kind: "multi", value: ["SocialCrawl run sc_0909_01"] },
      },
      createdMins: 4,
      updatedMins: 1,
      md: `## Executive summary

- "Cozy hobby" content is up sharply in the window; the top posts are all a person, a lamp and a small finished object.
- The phrase "give myself the gift of" recurs; it is the same identity move as [[VOC-008]].`,
    }),
  );

  /* --------------------------------------------------------- Personas --- */

  docs.push(
    make(now, {
      id: "doc_persona_p1",
      type: "persona",
      subtype: "primary",
      title: "P1 — Maya, the overstimulated unwinder",
      status: "active",
      version: 3,
      skill: "persona",
      freshness: { kind: "verified", until: ahead(now, 78) },
      channels: ["instagram", "tiktok", "pinterest"],
      tags: ["me-time", "identity"],
      properties: {
        funnel_focus: { kind: "select", value: "Problem-aware" },
      },
      createdMins: 2 * D + 21 * H,
      updatedMins: 38,
      md: `## Snapshot

Maya is 28–40, works on a screen all day, doomscrolls at night and hates it. She hires Terra to **replace 20 minutes of scrolling with 20 minutes of making something she can finish.** Her one-line job: "give me something to do with my hands that isn't my phone."

## Context and moments

- 9:40pm, sofa, phone reports 47 minutes of screen time, and she thinks "i should do something". This is the trigger moment for every P1 brief.
- Sunday evening, the dread of Monday, wanting one quiet thing that is hers. [[VOC-010]]
- Right after seeing a kit reveal on TikTok: "I need to do it now bc I know I won't do it later." [[VOC-005]]
- Awareness stage: problem-aware. She knows the scroll is the problem; she has not found a replacement she finishes.

## Pains, desires and objections

- **Pain:** evenings disappear into the phone and she feels worse after. [[VOC-001]] [[VOC-004]]
- **Pain:** every hobby she starts becomes "another hobby to my list". Half-finished projects are proof she can't stick to things.
- **Desire:** her shoulders to drop. [[VOC-009]]
- **Desire:** permission to want something small and cute at 34. [[VOC-006]] [[VOC-007]] [[VOC-008]]
- **Objection:** "crafts are for kids or for talented people." → You roll a potato and add horns. The guide does the rest. [[VOC-011]]
- **Objection:** "it'll crack / it's play-doh." → Small, soft, air-dries on a shelf; dries hard and stays. [[VOC-003]] [[VOC-014]]
- **Objection (unspoken):** she will not finish it. → 20 minutes. One object. Done tonight.

## Their language

- Use: "my shoulders finally dropped", "29-year-old me would love this", "give myself the gift of", "one more video", "i should do something".
- Avoid: mindfulness, self-care ritual, unwind (overused in her feed), creative journey, "treat yourself".

## Where they are

- TikTok (cozy-hobby and kit-reveal content), Instagram (saves more than she posts), Pinterest (evening routines), the r/simpleliving corner of Reddit.
- Already watches: Sculpd makes, "romanticise your evening" content, screen-time confession videos.

## Angles

:::angle{id=angle-phone-replacement status=winning title="The 20-minute phone replacement"}
- **Promise:** twenty minutes with your hands instead of your thumb, and something to show for it.
- **Proof:** "So soothing. Twenty minutes in and my shoulders finally dropped." [[VOC-009]]
- **Funnel stage:** problem-aware → solution-aware.
- **Hook directions:** "you've been scrolling for 47 minutes. i took 20 to make." · "3 things to do at 9:40pm that aren't your phone" · "put me down and pick me up. different me."
- **Related pillar:** @[doc_strategy_ig#pillars] Terra characters · Screen-free living.
:::

:::angle{id=angle-adults-claiming status=untested title="Adults claiming it"}
- **Promise:** this was never really for the kids.
- **Proof:** "Bought it for the kids, ended up fighting over it as adults. Worth it." [[VOC-017]] · "My 29 year old me would love this" [[VOC-006]]
- **Funnel stage:** problem-aware.
- **Hook directions:** "my 29-year-old self needed this." · "the kit that did not stay with the kids" · "artsy child? i'm 34. it's for me."
- **Related pillar:** Proof & people.
:::

:::angle{id=angle-finishable status=untested title="Finishable"}
- **Promise:** a hobby you finish tonight, not one you feel guilty about.
- **Proof:** every kit is ~20 minutes; no oven means no second session.
- **Funnel stage:** solution-aware.
- **Hook directions:** "the whole tutorial fits in 3 slides. that's the point." · "no second session. no oven. done tonight."
- **Related pillar:** Make & satisfy.
:::

## QA checklist

- [x] Names the enemy (the scroll) or the moment (9:40pm), not the category.
- [x] Says how long it takes.
- [x] Uses at least one verbatim line from the quote bank.
- [x] Never uses a banned word.
- [ ] Answers "will I finish it?" implicitly or explicitly.
- [x] The product appears as a character or an object, never as "a kit".
- [ ] Reads as written for a 34-year-old, not for a parent buying for a child.
- [x] One joke, from the truth of the product.`,
    }),
  );

  docs.push(
    make(now, {
      id: "doc_persona_p2",
      type: "persona",
      subtype: "primary",
      title: "P2 — Jess & Tom, the zoned-out couple",
      status: "active",
      version: 2,
      skill: "persona",
      freshness: { kind: "verified", until: ahead(now, 80) },
      channels: ["instagram", "tiktok"],
      tags: ["date-night", "couples"],
      properties: {
        funnel_focus: { kind: "select", value: "Solution-aware" },
      },
      createdMins: 2 * D + 21 * H,
      updatedMins: 2 * D + 2 * H,
      md: `## Snapshot

Jess and Tom are 25–35, together two years or more, and their evenings are two phones on one sofa. They hire Terra to **give Friday a plan that needs zero talent and zero planning.** The one-line job: "something to do together that isn't another show."

## Context and moments

- Friday 7pm. "what do you want to do?" "i don't know, what do you want to do?" This loop is the trigger.
- Rainy night in, the third episode nobody is watching. [[VOC-019]]
- Saving date-night listicles on TikTok and never acting on them. [[VOC-001]]
- Awareness stage: solution-aware. They know they want an activity; they doubt they will do it.

## Pains, desires and objections

- **Pain:** "instead of just zoning out side by side". [[VOC-001]]
- **Pain:** every date idea needs a booking, a budget or a plan.
- **Desire:** to actually talk. "We put music on, sculpt, and actually talk." [[VOC-018]]
- **Objection:** "we can't draw." → Nobody draws. You roll and squish. You will laugh at each other's. [[VOC-011]]
- **Objection:** "my partner would never." → Neither would Tom. [[VOC-012]] [[VOC-018]]
- **Objection:** "I'm too competitive." → Good. Judge harshly. [[VOC-022]]

## Their language

- Use: "zoning out side by side", "what do you want to do?", "we can't draw", "our new date night", "actually talk".
- Avoid: romantic, intimate, connection, quality time, "date night in a box".

## Where they are

- TikTok (date-night listicles, @atwistofdate), Instagram (send-to-partner content), Pinterest for the planners among them.

## Angles

:::angle{id=angle-date-night status=winning title="Zero talent, zero planning"}
- **Promise:** a date night that needs no booking, no budget and no ability to draw.
- **Proof:** "Our new date night. We put music on, sculpt, and actually talk." [[VOC-018]]
- **Funnel stage:** solution-aware → product-aware.
- **Hook directions:** "3 zero-planning date nights that don't involve a screen" · "for couples who zone out side by side every night" · "date night for people who can't draw".
- **Related pillar:** Screen-free living.
:::

:::angle{id=angle-competitive status=untested title="Sculpt something ugly together"}
- **Promise:** the point is to laugh at each other's.
- **Proof:** "I am too competitive for these ideas" [[VOC-022]] — leaned into, not answered.
- **Funnel stage:** solution-aware.
- **Hook directions:** "judge harshly." · "whose dinosaur is worse? a 20-minute competition" · "we replaced netflix on fridays. here's what with."
- **Related pillar:** Screen-free living · Terra characters.
:::

## QA checklist

- [x] Speaks to both of them, or to one about the other ("tag the person you're zoning out next to").
- [x] Removes at least one excuse: talent, planning or partner.
- [x] Says how long it takes.
- [x] Terra is the honest third option, never the only option, in listicles.
- [x] Never uses a banned word.
- [x] One joke, from the truth of the evening.`,
    }),
  );

  docs.push(
    make(now, {
      id: "doc_persona_p3",
      type: "persona",
      subtype: "exploratory",
      title: "P3 — Sarah, the screen-tired parent",
      status: "draft",
      version: 1,
      skill: "persona",
      freshness: { kind: "unverified" },
      channels: ["instagram"],
      tags: ["parents", "month-2"],
      properties: {
        funnel_focus: { kind: "select", value: "Solution-aware" },
      },
      createdMins: 2 * D + 20 * H,
      updatedMins: 2 * D + 20 * H,
      missingSections: ["Where they are", "QA checklist"],
      md: `## Snapshot

Sarah is 30–45 with kids aged 5–10. She hires Terra for **one activity both of them actually enjoy that doesn't wreck the kitchen.** Parked until month two; the evidence is thinner than P1 and P2.

## Context and moments

- Rainy Saturday, 2pm, kids asking for the iPad.
- Awareness stage: solution-aware. Fears mess and half-finished projects.
- Belief to shift: "kits are for the kids; I supervise." → "Bought it for the kids, ended up fighting over it as adults." [[VOC-017]]

## Pains, desires and objections

- **Pain:** screen-time guilt, hers and theirs. [[VOC-002]]
- **Desire:** a shared thing that is calm rather than a production. [[VOC-020]] [[VOC-021]]
- **Objection:** mess. → Mess-free, no oven, kid-safe tools.
- **Objection:** "they'll lose interest." → 20 minutes, a finished dinosaur.

## Their language

- Use: "both of us", "no mess", "actually calm", "fought over it".
- Avoid: educational, STEM, screen-time (as a scold), "keeps them busy".

## Angles

:::angle{id=angle-fight-the-kids status=untested title="The one activity the adults fight the kids for"}
- **Promise:** you will want a turn.
- **Proof:** [[VOC-017]] [[VOC-020]]
- **Funnel stage:** solution-aware.
- **Hook directions:** "bought it for the kids. it did not stay with the kids." · "which one would you fight over?"
- **Related pillar:** Proof & people.
:::`,
    }),
  );

  /* --------------------------------------------------------- Strategy --- */

  docs.push(
    make(now, {
      id: "doc_strategy_ig",
      type: "content_strategy",
      subtype: "brand",
      title: "Organic strategy — first 8 weeks (Instagram + TikTok)",
      status: "active",
      version: 2,
      skill: "content-strategy",
      freshness: { kind: "expired", until: ago(now, 3 * D) },
      channels: ["instagram", "tiktok"],
      tags: ["q4-run-up"],
      properties: {
        period: { kind: "range", start: "2026-09-09", end: "2026-11-03" },
        cadence: { kind: "text", value: "5 posts / week per channel" },
        primary_kpi: { kind: "select", value: "Save rate" },
      },
      createdMins: 2 * D + 18 * H,
      updatedMins: 33 * D,
      md: `## Goals and KPIs

- Replace a meme feed with a character-led, save-first system in 8 weeks.
- **Primary KPI:** save rate above 3% of reach on carousels, 1.5% shares on character statics.
- Secondary: follows per 1k reach; profile visits; bundle share of orders from social.
- Open a TikTok account and get to 1,000 followers by week 8.

## Audience

1. @[doc_persona_p1] — lead for weeks 1–8. Angles in play: the 20-minute phone replacement · adults claiming it.
2. @[doc_persona_p2] — Fridays and weekends. Angles: zero talent, zero planning · sculpt something ugly together.
3. @[doc_persona_p3] — unlocked in month 2, after P1/P2 proof lands.

## Pillars

:::pillar{id=pillar-make status=active title="1. Make & satisfy"}
- **Intent:** stop the scroll with a finished object; earn saves.
- **Funnel stage:** TOF · **Share of posts:** 30%
- **Formats:** 15s make reel; step-by-step carousel.
- **Example ideas:** Trikey in 3 steps; "step 1: roll a potato"; the Trend Edit — we see a cute-object trend, we make it tiny.
- **Related angles:** Finishable.
- **Borrowed from:** Sculpd (trend or season hook + one object). @[doc_research_sculpd]
:::

:::pillar{id=pillar-characters status=active title="2. Terra characters"}
- **Intent:** give the brand a voice people follow; comment on scroll culture.
- **Funnel stage:** TOF · **Share of posts:** 20%
- **Formats:** static meme; character POV reel.
- **Example ideas:** Trikey on your screen time; Spikles reviews your evening; "tag the person you're zoning out next to".
- **Related angles:** The 20-minute phone replacement.
- **Borrowed from:** Duolingo (character narrator, third-person share hooks). @[doc_research_duolingo]
:::

:::pillar{id=pillar-screen-free status=active title="3. Screen-free living"}
- **Intent:** solve the evening; bust objections (talent, cracking, baking, partner).
- **Funnel stage:** MOF · **Share of posts:** 25%
- **Formats:** listicle carousel; myth-bust static; FAQ reel.
- **Example ideas:** 3 zero-planning date nights; "my air dry clay always cracks"; 3 things to do at 9:40pm that aren't your phone.
- **Related angles:** Zero talent, zero planning · Sculpt something ugly together.
- **Borrowed from:** atwistofdate (listicle + named pain). @[doc_research_trend]
:::

:::pillar{id=pillar-proof status=active title="4. Proof & people"}
- **Intent:** make the 11,000 reviews visible.
- **Funnel stage:** MOF / BOF · **Share of posts:** 15%
- **Formats:** review static; UGC repost; "what people made" carousel.
- **Example ideas:** "Bought it for the kids…"; which one would you fight over?
- **Related angles:** Adults claiming it.
:::

:::pillar{id=pillar-offer status=active title="5. Gift & offer"}
- **Intent:** convert with the bundle ladder and gifting moments.
- **Funnel stage:** BOF · **Share of posts:** 10%
- **Formats:** flat-lay static; bundle carousel; seasonal drop.
- **Example ideas:** "build your box."; six evenings, sorted; the $20 gift that's an evening.
:::

## Format mix and cadence

- 5 posts per week per channel: 2 makes, 1 character static, 1 screen-free carousel or myth-bust, 1 proof or offer.
- Post 6–8pm local; Sunday evening for how-to carousels (save behaviour); Friday for offers (P2 purchase intent).
- Every carousel is reposted to TikTok as photo mode; every make reel is cut with 3 hooks.

## Channel rules

| Channel | Hook | Caption | Hashtags / sound | CTA |
| --- | --- | --- | --- | --- |
| Instagram | ≤ 9 words on the cover | lowercase, one joke, one line of product truth | none, or 3 niche | save · tag |
| TikTok | first 1.5s shows hands and clay | shorter, ends on the question people ask | trending sound under makes | comment · save |

## Hypotheses

:::hypothesis{id=h1 status=confirmed title="H1 — Honest third option"}
- **Belief:** a 3-item listicle where Terra is item 3 will out-save any product-first post.
- **Evidence:** zero-planning date-night listicle: 92k saves, 53k shares. @[doc_research_trend]
- **Test:** @[doc_brief_b1] · **Metric:** save rate > 3% · **Result:** 4.1% save rate, 1.3% shares. Confirmed.
:::

:::hypothesis{id=h2 status=testing title="H2 — Three-slide how-to"}
- **Belief:** a 4-slide "how to make X in 20 minutes with zero talent" carousel earns saves and answers "do you bake it" in-feed.
- **Evidence:** seasonal how-to (clay ghosts) 10k saves; Sculpd step makes. @[doc_research_category]
- **Test:** @[doc_brief_b2] · **Metric:** save rate > 4%; comments asking "which kit".
:::

:::hypothesis{id=h3 status=testing title="H3 — Character on your screen time"}
- **Belief:** a dinosaur commenting on your screen time gets shares from P1 without a product pitch.
- **Evidence:** Duolingo character statics; phone-addiction discourse. @[doc_research_duolingo]
- **Test:** @[doc_brief_b3] · **Metric:** shares > 1.5% of reach.
:::

:::hypothesis{id=h4 status=untested title="H4 — Adults-claiming proof"}
- **Belief:** adults-claiming-it proof beats kid-focused proof for the P1/P3 overlap.
- **Evidence:** [[VOC-017]] [[VOC-006]]
- **Test:** @[doc_brief_b4] · **Metric:** comment rate; profile visits.
:::

:::hypothesis{id=h5 status=untested title="H5 — Name the objection verbatim"}
- **Belief:** quoting "my air dry clay always cracks" and answering with product truth lifts saves and profile visits.
- **Evidence:** [[VOC-003]] is the top objection in category comments.
- **Test:** @[doc_brief_b5] · **Metric:** saves; DM questions about the clay.
:::

:::hypothesis{id=h6 status=untested title="H6 — Friday sorted"}
- **Belief:** a calm flat-lay offer framed as "friday sorted" converts the warm audience without discount-brand tone.
- **Evidence:** the bundle ladder exists on site and has never appeared on social.
- **Test:** @[doc_brief_b6] · **Metric:** link clicks; bundle share of orders.
:::

## What's working

- **Week 1:** B1 confirmed H1 (4.1% saves). The "honest third option" mechanic becomes the default for listicles.
- **Retired:** repurposed couples memes. Archived 12 posts.
- **Queued:** H7 seasonal singles as "the $20 gift that's an evening"; H8 "which one first?" choice carousel; H9 character POV reel.`,
    }),
  );

  /* ----------------------------------------------------------- Briefs --- */

  const briefBase = {
    type: "brief" as DocType,
    skill: "brief",
  };

  docs.push(
    make(now, {
      ...briefBase,
      id: "doc_brief_b1",
      subtype: "carousel",
      title: "B1 — 3 zero-planning date nights that don't involve a screen",
      status: "used",
      version: 2,
      channels: ["instagram", "tiktok"],
      tags: ["H1", "pillar-3"],
      properties: {
        due: { kind: "date", value: ago(now, 6 * D) },
        funnel_stage: { kind: "select", value: "MOF" },
        format_spec: { kind: "text", value: "Instagram carousel 4:5, 5 slides; repost as TikTok photo mode" },
        assets: { kind: "number", value: 5 },
      },
      createdMins: 2 * D + 12 * H,
      updatedMins: 5 * D,
      md: `## Objective

A genuinely useful list where Terra is the honest third option. **Success:** save rate above 3% of reach; shares above 1%.

## Audience and angle

@[doc_persona_p2] at solution-aware, using @[doc_persona_p2#angle-date-night]. They save date-night listicles and rarely act; this one removes the last excuse.

## Key message and proof

Friday doesn't need a plan. It needs 20 minutes and no talent. Proof: "Our new date night. We put music on, sculpt, and actually talk." [[VOC-018]] Product: two single kits (Trikey + Hippo), or @[doc_product_facts] Land Sea & Sky.

## Hook options

1. **"3 zero-planning date nights that don't involve a screen"** — chosen. Specific number, named enemy.
2. "for couples who zone out side by side every night" — verbatim pain. [[VOC-001]]
3. "date night for people who can't draw" — objection call-out. [[VOC-011]]
4. "we replaced netflix on fridays. here's what with." — contrast.
5. "you don't need a plan. you need 20 minutes." — promise.

## Structure

| Slide | Copy | Visual |
| --- | --- | --- |
| 1 · Cover | 3 zero-planning date nights that don't involve a screen | couple on sofa lit by two phones |
| 2 · 01 | the 36 questions. yes, the famous ones. / skip the 4 minutes of staring if you must. | two mugs, a list |
| 3 · 02 | the $10 supermarket sweep. / one course each. 15 minutes. judge harshly. | basket, receipt |
| 4 · 03 | sculpt something ugly together. / 20 minutes. zero talent required. you will laugh at each other's. | Trikey and Hippo, one clearly worse |
| 5 · CTA | save this for friday. / tag the person you're zoning out next to. | terracotta block |

## Caption and CTA

friday is not going to plan itself. three options, none of them involve a screen, one of them involves a very ugly dinosaur. (number 3 is us. we're not subtle.) 🦕 save it for the "what do you want to do?" conversation.

## Visual direction

Cream system from @[doc_visual_system]; cover is the one dark slide. Trikey and Hippo as the two "ugly" results. 4:5, number top-left on body slides.

## Must include / must avoid

- Include: the number 3, "20 minutes", the tag CTA.
- Avoid: "date night in a box", romantic language, any claim about cracking.

## References

- @[doc_research_trend] — the 92k-save listicle this rides.
- [[VOC-001]] [[VOC-011]] [[VOC-018]] [[VOC-022]]`,
    }),
  );

  docs.push(
    make(now, {
      ...briefBase,
      id: "doc_brief_b2",
      subtype: "carousel",
      title: "B2 — how to make a dinosaur in 20 minutes with zero talent",
      status: "ready",
      version: 1,
      channels: ["instagram", "tiktok", "pinterest"],
      tags: ["H2", "pillar-1"],
      properties: {
        due: { kind: "date", value: ahead(now, 2) },
        funnel_stage: { kind: "select", value: "TOF" },
        format_spec: { kind: "text", value: "Instagram carousel 4:5, 4 slides; TikTok photo mode; Pinterest" },
        assets: { kind: "number", value: 0 },
      },
      createdMins: 16 * D,
      updatedMins: 16 * D,
      md: `## Objective

A real three-step tutorial for Trikey that pre-answers "do you bake it" and "I can't draw". **Success:** save rate above 4%; comments asking "which kit is this".

## Audience and angle

@[doc_persona_p1] (works for @[doc_persona_p3]) at TOF → MOF, using @[doc_persona_p1#angle-finishable].

## Key message and proof

The whole tutorial fits in three slides. That is the point. Proof: the finished object. Product: Trikey, @[doc_product_facts] 1 Tool Kit.

## Hook options

1. **"how to make a dinosaur in 20 minutes with zero talent"** — chosen.
2. "step 1: roll a potato." — curiosity via absurd instruction.
3. "no oven. no kiln. no skill. one dinosaur." — negation stack.
4. "the whole tutorial fits in 3 slides. that's the point."
5. "my 29-year-old self needed this." — identity, verbatim. [[VOC-006]]

## Structure

| Slide | Copy | Visual |
| --- | --- | --- |
| 1 · Cover | how to make a dinosaur in 20 minutes with zero talent | flat-lay of clay, tools, guide |
| 2 · step 1 | roll a potato. / that's the body. yes, really. | hands, one clay blob |
| 3 · step 2 | add horns. add judgement. / the eyes go wherever feels right. | Trikey half-done |
| 4 · step 3 | leave it overnight. no oven. / wake up to a dinosaur. save this for your next quiet evening. | Trikey on a shelf, morning light |

## Caption and CTA

this is trikey. he takes 20 minutes, needs no oven, and forgives everything. (the potato step is real.) every kit ships with the tools and the picture guide, so the only thing you bring is an evening. 🦕

## Visual direction

Cream system, hands in every body slide, Trikey as the object. Real morning light on the last slide.

## Must include / must avoid

- Include: "no oven", "20 minutes", the potato.
- Avoid: "easy" (show it instead), any cracking claim.

## References

- @[doc_research_sculpd] — step makes; @[doc_research_category] — seasonal how-to saves.
- [[VOC-015]] [[VOC-011]] [[VOC-006]]`,
    }),
  );

  docs.push(
    make(now, {
      ...briefBase,
      id: "doc_brief_b3",
      subtype: "static",
      title: "B3 — Trikey on your screen time",
      status: "in_production",
      version: 1,
      channels: ["instagram", "x", "threads"],
      tags: ["H3", "pillar-2"],
      properties: {
        due: { kind: "date", value: ahead(now, 1) },
        funnel_stage: { kind: "select", value: "TOF" },
        format_spec: { kind: "text", value: "Instagram static 1:1; X; Threads" },
        assets: { kind: "number", value: 1 },
      },
      createdMins: 2 * D + 11 * H,
      updatedMins: 5 * H,
      md: `## Objective

The product speaks, Duolingo-style, about the thing it replaces. No pitch. **Success:** shares above 1.5% of reach; follows per 1k reach.

## Audience and angle

@[doc_persona_p1] at unaware / problem-aware, using @[doc_persona_p1#angle-phone-replacement].

## Key message and proof

Twenty minutes to make versus forty-seven to scroll. Proof: the number itself. Product: Trikey.

## Hook options

1. **"you've been scrolling for 47 minutes." / "i took 20 to make. just saying."** — chosen.
2. "your screen time report is in. i'm in it."
3. "you scrolled past me 3 times this week."
4. "put me down and pick me up. different me."

## Structure

Single static: Trikey bottom-right on cream, two lines of copy top-left, no logo, no CTA on-image.

## Caption and CTA

send this to someone who says "one more video". 🦕 (this is trikey. he's 20 minutes and a bit judgemental.)

## Visual direction

Trikey at eye level, slightly underlit, a phone face-down beside him. See @[doc_visual_system#layout-rules-per-format].

## Must include / must avoid

- Include: the two numbers; the share CTA in the caption only.
- Avoid: any product name, price or link on the image.

## References

- @[doc_research_duolingo] — character statics and third-person share hooks.`,
    }),
  );

  docs.push(
    make(now, {
      ...briefBase,
      id: "doc_brief_b4",
      subtype: "static",
      title: "B4 — Review: \"Bought it for the kids. Ended up fighting over it as adults.\"",
      status: "ready",
      version: 1,
      channels: ["instagram"],
      tags: ["H4", "pillar-4"],
      properties: {
        due: { kind: "date", value: ahead(now, 4) },
        funnel_stage: { kind: "select", value: "MOF" },
        format_spec: { kind: "text", value: "Instagram static 1:1; story with link" },
        assets: { kind: "number", value: 0 },
      },
      createdMins: 2 * D + 10 * H,
      updatedMins: 2 * D,
      md: `## Objective

A verbatim review that reframes who the kit is for. **Success:** comment rate; profile visits.

## Audience and angle

@[doc_persona_p3] with @[doc_persona_p1] overlap, using @[doc_persona_p1#angle-adults-claiming].

## Key message and proof

This was never really for the kids. Proof: The Nguyens, verified, one of 11,000+. [[VOC-017]] Product: Hippo, Strawberry Cake.

## Hook options

1. **"Bought it for the kids. Ended up fighting over it as adults."** — chosen, verbatim.
2. "the kit that did not stay with the kids."
3. "which one would you fight over?"

## Structure

Single static: the quote in terracotta on cream, Hippo and Strawberry Cake either side, "— The Nguyens, verified" small.

## Caption and CTA

the nguyens bought a kit for the kids. it did not stay with the kids. 🦛🍓 which one would you fight over — hippo or strawberry cake? (verified review, one of 11,000+.)

## Visual direction

Two characters, cream, quote as display type. Story version adds the link sticker.

## Must include / must avoid

- Include: "verified", the choice question.
- Avoid: paraphrasing the review; any kid-craft aesthetic.

## References

- @[doc_research_voc] — [[VOC-017]] [[VOC-020]]`,
    }),
  );

  docs.push(
    make(now, {
      ...briefBase,
      id: "doc_brief_b5",
      subtype: "static",
      title: "B5 — Myth-bust: \"my air dry clay always cracks\"",
      status: "draft",
      version: 1,
      channels: ["instagram", "tiktok", "pinterest"],
      tags: ["H5", "pillar-3"],
      properties: {
        due: { kind: "date", value: ahead(now, 6) },
        funnel_stage: { kind: "select", value: "MOF" },
        format_spec: { kind: "text", value: "Instagram static 1:1; TikTok photo; Pinterest" },
        assets: { kind: "number", value: 0 },
      },
      createdMins: 2 * D + 9 * H,
      updatedMins: 2 * D + 9 * H,
      md: `## Objective

Quote the objection verbatim, answer with three product truths. **Success:** saves; DM or comment questions about the clay.

## Audience and angle

@[doc_persona_p1] and @[doc_persona_p2] at solution-aware, using @[doc_persona_p1#angle-phone-replacement] (objection half).

## Key message and proof

Big slab bowls crack because they're big, dry unevenly and get baked. Ours is 3cm tall, soft, and air-dries on a shelf. Different sport. [[VOC-003]] Product: Spikles.

:::callout{tone=caution}
**Claim check before publishing.** The site says the clay is soft, forgiving and air-dries; it does not claim "no cracking". Copy below avoids the absolute. Confirm with the founder, or soften to "far less likely to crack". See @[doc_product_facts#allowed-and-disallowed-claims].
:::

## Hook options

1. **"'my air dry clay always cracks'" / "small. soft. no oven. that's the whole trick."** — chosen.
2. "the reason your clay cracked is not you."
3. "3cm tall. that's the trick."

## Structure

Single static: the quoted objection in quotation marks, then the three-word answer. Spikles as the object.

## Caption and CTA

big slab bowls crack because they're big, dry unevenly, and get baked. spikles is 3cm tall, made of soft clay, and air-dries on a shelf. different sport. 🦕

## Visual direction

Spikles on cream, a ruler for scale if it reads.

## Must include / must avoid

- Include: the verbatim objection in quotes.
- Avoid: "no cracking", "crack-proof", any comparison that names Sculpd.

## References

- @[doc_research_voc] — [[VOC-003]] [[VOC-014]]`,
    }),
  );

  docs.push(
    make(now, {
      ...briefBase,
      id: "doc_brief_b6",
      subtype: "static",
      title: "B6 — Offer: \"build your box.\"",
      status: "ready",
      version: 1,
      channels: ["instagram", "email"],
      tags: ["H6", "pillar-5"],
      properties: {
        due: { kind: "date", value: ago(now, 3 * D) },
        funnel_stage: { kind: "select", value: "BOF" },
        format_spec: { kind: "text", value: "Instagram static + story link; email hero" },
        assets: { kind: "number", value: 0 },
      },
      createdMins: 20 * D,
      updatedMins: 20 * D,
      md: `## Objective

The bundle ladder framed as a solved Friday, not a sale. **Success:** link clicks; bundle share of orders.

## Audience and angle

@[doc_persona_p2] and @[doc_persona_p3] at product-aware / most-aware.

## Key message and proof

Six evenings, sorted. Offer from @[doc_product_facts#shipping-returns-and-bundles]: 6 kits = 40% off + free tools; 9 = free shipping; 12 = half price.

## Hook options

1. **"build your box." / "6 kits = 40% off + free tools. friday night is sorted."** — chosen.
2. "six evenings, sorted."
3. "the $20 gift that's an evening."

## Structure

Single static: flat-lay of six kits in a box, the two lines of copy, link in bio.

## Caption and CTA

six evenings, sorted. pick any six kits, we knock 40% off and throw in the tools. nine gets you free shipping, twelve gets you half price and probably a new personality. link in bio. 🦕

## Visual direction

Calm flat-lay, cream, Dino Dreamers + Blissful Bites + Tool Kit. No starbursts, no red.

## Must include / must avoid

- Include: the ladder numbers exactly as in Product Facts.
- Avoid: "sale", "deal", percent signs larger than the copy.

## References

- @[doc_product_facts]`,
    }),
  );

  /* -------------------------------------------------------- relations --- */

  rel("doc_persona_p1", "derived_from", "doc_research_voc");
  rel("doc_persona_p1", "derived_from", "doc_research_category");
  rel("doc_persona_p1", "derived_from", "doc_research_trend");
  rel("doc_persona_p1", "informs", "doc_strategy_ig");
  rel("doc_persona_p2", "derived_from", "doc_research_trend");
  rel("doc_persona_p2", "derived_from", "doc_research_voc");
  rel("doc_persona_p2", "informs", "doc_strategy_ig");
  rel("doc_persona_p3", "derived_from", "doc_research_voc");

  rel("doc_strategy_ig", "informed_by", "doc_research_audit");
  rel("doc_strategy_ig", "informed_by", "doc_research_sculpd");
  rel("doc_strategy_ig", "informed_by", "doc_research_trend");
  rel("doc_strategy_ig", "informed_by", "doc_research_duolingo");
  rel("doc_strategy_ig", "targets_persona", "doc_persona_p1");
  rel("doc_strategy_ig", "targets_persona", "doc_persona_p2");

  rel("doc_brief_b1", "targets_persona", "doc_persona_p2");
  rel("doc_brief_b1", "uses_angle", "doc_persona_p2", "angle-date-night");
  rel("doc_brief_b1", "uses_strategy", "doc_strategy_ig", "pillar-screen-free");
  rel("doc_brief_b1", "references_trend", "doc_research_trend");
  rel("doc_brief_b1", "features_product", "doc_product_facts", "TC-TRIKEY");

  rel("doc_brief_b2", "targets_persona", "doc_persona_p1");
  rel("doc_brief_b2", "uses_angle", "doc_persona_p1", "angle-finishable");
  rel("doc_brief_b2", "uses_strategy", "doc_strategy_ig", "pillar-make");
  rel("doc_brief_b2", "references_trend", "doc_research_category");
  rel("doc_brief_b2", "features_product", "doc_product_facts", "TC-TRIKEY");

  rel("doc_brief_b3", "targets_persona", "doc_persona_p1");
  rel("doc_brief_b3", "uses_angle", "doc_persona_p1", "angle-phone-replacement");
  rel("doc_brief_b3", "uses_strategy", "doc_strategy_ig", "pillar-characters");
  rel("doc_brief_b3", "references_trend", "doc_research_duolingo");
  rel("doc_brief_b3", "features_product", "doc_product_facts", "TC-TRIKEY");

  rel("doc_brief_b4", "targets_persona", "doc_persona_p3");
  rel("doc_brief_b4", "uses_angle", "doc_persona_p1", "angle-adults-claiming");
  rel("doc_brief_b4", "uses_strategy", "doc_strategy_ig", "pillar-proof");
  rel("doc_brief_b4", "features_product", "doc_product_facts", "TC-HIPPO");

  rel("doc_brief_b5", "targets_persona", "doc_persona_p1");
  rel("doc_brief_b5", "uses_strategy", "doc_strategy_ig", "pillar-screen-free");
  rel("doc_brief_b5", "references_trend", "doc_research_voc");
  rel("doc_brief_b5", "features_product", "doc_product_facts", "TC-SPIKLES");

  rel("doc_brief_b6", "targets_persona", "doc_persona_p2");
  rel("doc_brief_b6", "uses_strategy", "doc_strategy_ig", "pillar-offer");
  rel("doc_brief_b6", "features_product", "doc_product_facts", "TC-DINO3");

  /* --------------------------------------------------- pending diff --- */

  const pf = docs.find((d) => d.id === "doc_product_facts")!;
  pf.pendingDiff = {
    runId: "run_resync_0908",
    proposedAt: ago(now, 3 * H),
    summary: "Re-synced products.json: one price change and two new seasonal items.",
    sections: [
      {
        anchor: "catalogue",
        heading: "Catalogue",
        before: "| TC-DISC12 | Dino Discovery Collection (12) | $120 | twelve single kits, two tool kits | a season |",
        after: "| TC-DISC12 | Dino Discovery Collection (12) | $110 | twelve single kits, two tool kits | a season |",
      },
      {
        anchor: "seasonal-and-limited",
        heading: "Seasonal and limited",
        before: "| Clay ghosts (planned) | Oct 1 – Oct 31 | Rides the seasonal how-to trend |",
        after:
          "| Clay ghosts | Oct 1 – Oct 31 | Live on site as TC-GHOST, $20 |\n| Gingerbread House | Nov 15 – Dec 24 | New Q4 single, $20 |",
      },
    ],
  };

  /* ---------------------------------------------------------- versions --- */

  const ver = (docId: string, version: number, summary: string, mins: number, author: Author = "agent") => {
    const d = docs.find((x) => x.id === docId)!;
    versions.push({
      id: `ver_${docId}_${version}`,
      docId,
      version,
      body: d.body,
      bodyMd: d.bodyMd,
      properties: d.properties,
      author,
      runId: author === "agent" ? d.runId : null,
      summary,
      createdAt: ago(now, mins),
    });
  };

  ver("doc_brand_core", 1, "Drafted from site, account audit and founder notes", 3 * D + 2 * H);
  ver("doc_brand_core", 2, "Founder corrected 3 of 5 highlighted claims; added banned words", 3 * D, "user");
  ver("doc_brand_core", 3, "Added Audience summary after personas were written", 28 * D);
  ver("doc_product_facts", 1, "Pulled 14 SKUs from products.json; wrote claims and objections", 3 * D + H);
  ver("doc_product_facts", 2, "Founder added the gifting note and the varnish FAQ", 6 * D, "user");
  ver("doc_visual_system", 1, "Sampled site CSS, CDN imagery and top own posts", 2 * D + 20 * H);
  for (const id of ["doc_research_audit", "doc_research_sculpd", "doc_research_category", "doc_research_trend", "doc_research_voc"]) {
    ver(id, 1, "Published", 3 * D);
  }
  ver("doc_research_duolingo", 1, "Drafted; two sections still open", 2 * D + 22 * H);
  ver("doc_persona_p1", 1, "Drafted from VoC, category and trend snapshots", 2 * D + 21 * H);
  ver("doc_persona_p1", 2, "Founder tightened Their language; removed 'unwind'", 2 * D + 3 * H, "user");
  ver("doc_persona_p1", 3, "Rewrote Objections with approved responses from Product Facts", 38);
  ver("doc_persona_p2", 1, "Drafted from trend and VoC snapshots", 2 * D + 21 * H);
  ver("doc_persona_p2", 2, "Added the competitive angle after review", 2 * D + 2 * H);
  ver("doc_persona_p3", 1, "Drafted as exploratory; parked until month 2", 2 * D + 20 * H);
  ver("doc_strategy_ig", 1, "Drafted pillars, cadence and six hypotheses", 2 * D + 18 * H);
  ver("doc_strategy_ig", 2, "H1 confirmed from week-1 metrics; What's working updated", 33 * D);
  ver("doc_brief_b1", 1, "Hooks chosen; brief written", 2 * D + 12 * H);
  ver("doc_brief_b1", 2, "Frozen when the carousel was generated", 5 * D);
  for (const id of ["doc_brief_b2", "doc_brief_b3", "doc_brief_b4", "doc_brief_b5", "doc_brief_b6"]) {
    const created = new Date(docs.find((d) => d.id === id)!.createdAt).getTime();
    ver(id, 1, "Hooks chosen; brief written", Math.round((now.getTime() - created) / 60_000));
  }

  /* ---------------------------------------------------------- activity --- */

  act({ docId: "doc_research_cozy", kind: "run_started", author: "agent", text: "Started research-trend_scan for \"cozy hobby\"", mins: 4, runId: "run_cozy_hobby", threadId: "thread_cozy" });
  act({ docId: "doc_persona_p1", kind: "patched", author: "agent", text: "Updated Persona P1: rewrote Objections with approved responses", mins: 38, runId: "run_2026-09-08_terra", threadId: "thread_run" });
  act({ docId: "doc_product_facts", kind: "patched", author: "agent", text: "Proposed 2 changes to Product Facts from a catalogue re-sync", mins: 3 * H, runId: "run_resync_0908" });
  act({ docId: "doc_brief_b3", kind: "status", author: "user", text: "Moved B3 to In production", mins: 5 * H });
  act({ docId: "doc_brief_b4", kind: "created", author: "agent", text: "Wrote Brief B4 from Persona P3 and the VoC bank", mins: 2 * D, runId: "run_2026-09-08_terra", threadId: "thread_run" });
  act({ docId: "doc_persona_p2", kind: "patched", author: "agent", text: "Added the competitive angle to Persona P2", mins: 2 * D + 2 * H, runId: "run_2026-09-08_terra", threadId: "thread_run" });
  act({ docId: "doc_persona_p1", kind: "edited", author: "user", text: "Edited Their language in Persona P1", mins: 2 * D + 3 * H });
  act({ docId: "doc_brief_b1", kind: "status", author: "agent", text: "B1 frozen: carousel generated (5 slides)", mins: 5 * D });
  act({ docId: "doc_product_facts", kind: "edited", author: "user", text: "Added the gifting note to Product Facts", mins: 6 * D });
  act({ docId: "doc_brand_core", kind: "verified", author: "user", text: "Verified Brand Core for 90 days", mins: 28 * D });
  act({ docId: "doc_strategy_ig", kind: "patched", author: "agent", text: "Strategy: H1 confirmed from week-1 metrics", mins: 33 * D });
  act({ docId: "doc_brand_core", kind: "created", author: "agent", text: "Drafted Brand Core; asked the founder to confirm 5 claims", mins: 3 * D + 2 * H, runId: "run_2026-09-08_terra", threadId: "thread_run" });

  /* ----------------------------------------------------------- threads --- */

  const threads: Thread[] = [
    {
      id: "thread_run",
      brandId: BRAND_ID,
      title: "Terra — first content run",
      docIds: ["doc_brand_core", "doc_product_facts", "doc_visual_system", "doc_research_voc", "doc_research_trend"],
      scopedDocId: null,
      createdAt: ago(now, 2 * D + 22 * H),
      updatedAt: ago(now, 38),
      messages: [
        {
          id: "m1",
          role: "user",
          at: ago(now, 2 * D + 22 * H),
          context: ["doc_brand_core", "doc_research_voc", "doc_research_trend"],
          text: "Draft personas from the research. Start from the VoC bank and the date-night trend; I want to know who we lead with for the first two weeks.",
        },
        {
          id: "m2",
          role: "assistant",
          at: ago(now, 2 * D + 21 * H),
          stepsSummary: "Read 3 snapshots · clustered 412 quotes · drafted 3 personas",
          steps: [
            { label: "Read Brand Core and 3 Research Snapshots", state: "done" },
            { label: "Clustered 412 comments and reviews into 4 themes", state: "done" },
            { label: "Crossed VoC themes with product proof points for angles", state: "done" },
            { label: "Drafted 3 personas with citations", state: "done" },
          ],
          text: [
            "Two personas have enough evidence to lead with. The overstimulated unwinder is the identity story — adults claiming a kids' category for themselves — and the zoned-out couple is the pain story with the strongest format signal in the run. The parent shows up in reviews but not in category comments, so I have written her as exploratory and parked her until month two.",
            "Each angle has a stable anchor, so briefs can point at `P1 > Angle 1` directly.",
          ],
          artifacts: ["doc_persona_p1", "doc_persona_p2", "doc_persona_p3"],
          suggestions: ["Why park the parent?", "Which angle should B1 use?", "Draft the strategy from these"],
        },
        {
          id: "m3",
          role: "user",
          at: ago(now, 2 * D + 19 * H),
          context: ["doc_persona_p1", "doc_persona_p2"],
          text: "Draft the strategy for the first 8 weeks. I can shoot two makes a week and one static; no video edits beyond cutting hooks.",
        },
        {
          id: "m4",
          role: "assistant",
          at: ago(now, 2 * D + 18 * H),
          stepsSummary: "Read 4 snapshots and 2 personas · drafted 5 pillars · 6 hypotheses",
          steps: [
            { label: "Read the account audit, Sculpd, trend and Duolingo snapshots", state: "done" },
            { label: "Set the share of posts from your shooting capacity", state: "done" },
            { label: "Wrote 6 hypotheses, each pointing at a brief", state: "done" },
          ],
          text: [
            "Five pillars, weighted toward Make & satisfy because that is what you can shoot. Every hypothesis names the brief that tests it, so the briefs below are already scoped.",
          ],
          artifacts: ["doc_strategy_ig"],
          suggestions: ["Write the six briefs", "Show me the week-1 calendar"],
        },
        {
          id: "m5",
          role: "user",
          at: ago(now, 45),
          context: ["doc_persona_p1", "doc_product_facts"],
          text: "Rewrite the objections in P1 so each one uses the approved response from Product Facts.",
        },
        {
          id: "m6",
          role: "assistant",
          at: ago(now, 38),
          text: ["Done. Each objection now ends with the approved response and cites the VoC id it answers."],
          patches: [{ docId: "doc_persona_p1", anchor: "pains-desires-and-objections", text: "Updated Persona P1: rewrote Objections with approved responses" }],
          suggestions: ["Do the same for P2", "Check P1 against Brand Core"],
        },
      ],
    },
    {
      id: "thread_cozy",
      brandId: BRAND_ID,
      title: "Cozy hobby trend scan",
      docIds: ["doc_brand_core", "doc_product_facts", "doc_visual_system"],
      scopedDocId: null,
      createdAt: ago(now, 5),
      updatedAt: ago(now, 1),
      messages: [
        {
          id: "c1",
          role: "user",
          at: ago(now, 5),
          context: [],
          text: "Scan the last 30 days of \"cozy hobby\" content on TikTok and Instagram. I want to know if there's a format we can ride for P1.",
        },
        {
          id: "c2",
          role: "assistant",
          at: ago(now, 4),
          streaming: true,
          runId: "run_cozy_hobby",
          stepsSummary: "Gather → Cluster → Write",
          steps: [
            { label: "Pulled 60 posts across both channels", state: "done" },
            { label: "Clustering formats and hooks", state: "running" },
            { label: "Writing the snapshot", state: "pending" },
          ],
          text: ["Starting the scan. The doc shell is open below and will fill in as each section finishes."],
          artifacts: ["doc_research_cozy"],
        },
      ],
    },
  ];

  /* --------------------------------------------------------- citations --- */

  const voc = docs.find((d) => d.id === "doc_research_voc")!;
  const citations: Record<string, Citation> = {};
  const quoteRows = voc.body.content.find((n) => n.type === "table")?.content ?? [];
  for (const row of quoteRows.slice(1)) {
    const cells = (row.content ?? []).map((c) => c.content?.[0]);
    const ref = cells[0]?.content?.find((n) => n.type === "citation")?.attrs?.ref as string | undefined;
    if (!ref) continue;
    const text = (cells[1]?.content ?? []).map((n) => n.text ?? "").join("");
    const theme = (cells[2]?.content ?? []).map((n) => n.text ?? "").join("");
    const source = (cells[4]?.content ?? []).map((n) => n.text ?? "").join("");
    citations[ref] = { ref, text: text.replace(/^"|"$/g, ""), source: "doc_research_voc", sourceLabel: "VoC mine", meta: `${theme} · ${source}`, anchor: "quote-bank" };
  }

  const savedFilters: SavedFilter[] = [
    { id: "sf_p1_unused", label: "P1 briefs not yet used", filters: [{ kind: "type", value: "brief" }, { kind: "related", value: "doc_persona_p1" }, { kind: "status", value: "ready" }] },
    { id: "sf_research_month", label: "Research this month", filters: [{ kind: "type", value: "research_snapshot" }] },
  ];

  return { docs, relations, versions, activity, threads, citations, savedFilters };
}

export type SeedData = ReturnType<typeof buildSeed>;
