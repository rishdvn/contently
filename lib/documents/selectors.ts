import { brandTypes, docTypes, statusLabels } from "./registry";
import type {
  Channel,
  DocStatus,
  DocType,
  Document,
  Filter,
  Freshness,
  QuickFilter,
  Relation,
  Subtype,
} from "./types";

/* Pure derivations over the store's state. Nothing here mutates. */

export function outgoing(relations: Relation[], docId: string) {
  return relations.filter((r) => r.from === docId);
}

export function incoming(relations: Relation[], docId: string) {
  return relations.filter((r) => r.to === docId);
}

const DAY = 86_400_000;

/** Verified-with-a-date collapses to expired once the date passes. */
export function effectiveFreshness(doc: Document, now: Date): Freshness | null {
  const f = doc.freshness;
  if (!f) return null;
  if (f.kind === "verified" && f.until && new Date(f.until).getTime() < now.getTime()) {
    return { kind: "expired", until: f.until };
  }
  return f;
}

export function isNeedsReview(doc: Document) {
  return doc.status === "draft" || doc.status === "in_review" || Boolean(doc.pendingDiff);
}

export function isStale(doc: Document, now: Date) {
  const f = effectiveFreshness(doc, now);
  return f?.kind === "expired" || f?.kind === "outdated";
}

export function isGenerating(doc: Document) {
  return doc.status === "generating";
}

/** Briefs Ready with no Asset for 14+ days; Personas or Strategies with zero Briefs. */
export function isUnused(doc: Document, relations: Relation[], now: Date) {
  if (doc.status === "archived") return false;
  if (doc.type === "brief") {
    const assets = doc.properties.assets;
    const count = assets?.kind === "number" ? assets.value : 0;
    const age = now.getTime() - new Date(doc.createdAt).getTime();
    return doc.status === "ready" && count === 0 && age >= 14 * DAY;
  }
  if (doc.type === "persona" || doc.type === "content_strategy") {
    return !relations.some((r) => r.to === doc.id && r.from.startsWith("doc_brief"));
  }
  return false;
}

export function matchesQuick(doc: Document, q: QuickFilter, relations: Relation[], now: Date) {
  switch (q) {
    case "needs_review":
      return isNeedsReview(doc);
    case "stale":
      return isStale(doc, now);
    case "generating":
      return isGenerating(doc);
    case "unused":
      return isUnused(doc, relations, now);
  }
}

export function quickCounts(docs: Document[], relations: Relation[], now: Date): Record<QuickFilter, number> {
  const live = docs.filter((d) => d.status !== "archived");
  return {
    needs_review: live.filter(isNeedsReview).length,
    stale: live.filter((d) => isStale(d, now)).length,
    generating: live.filter(isGenerating).length,
    unused: live.filter((d) => isUnused(d, relations, now)).length,
  };
}

export function matchesFilters(doc: Document, filters: Filter[], relations: Relation[], now: Date) {
  return filters.every((f) => {
    switch (f.kind) {
      case "type":
        return doc.type === f.value;
      case "subtype":
        return doc.subtype === f.value;
      case "status":
        return doc.status === f.value;
      case "freshness":
        return effectiveFreshness(doc, now)?.kind === f.value;
      case "channel":
        return doc.channels.includes(f.value);
      case "account":
        return doc.accounts.includes(f.value);
      case "related":
        return relations.some((r) => (r.from === doc.id && r.to === f.value) || (r.to === doc.id && r.from === f.value));
      case "owner":
        return doc.createdBy === f.value;
      case "quick":
        return matchesQuick(doc, f.value, relations, now);
      case "text": {
        const q = f.value.toLowerCase();
        return doc.title.toLowerCase().includes(q) || doc.bodyMd.toLowerCase().includes(q);
      }
    }
  });
}

export function filterLabel(f: Filter, docs: Document[]) {
  switch (f.kind) {
    case "type":
      return docTypes[f.value].plural;
    case "subtype":
      return f.value.replace(/_/g, " ");
    case "status":
      return statusLabels[f.value];
    case "freshness":
      return f.value.replace(/_/g, " ");
    case "channel":
      return f.value.replace(/_/g, " ");
    case "account":
      return f.value;
    case "related":
      return `Related to ${docs.find((d) => d.id === f.value)?.title.split(" — ")[0] ?? f.value}`;
    case "owner":
      return f.value === "agent" ? "By Agent" : "By me";
    case "quick":
      return { needs_review: "Needs review", stale: "Stale", generating: "Generating", unused: "Unused" }[f.value];
    case "text":
      return `“${f.value}”`;
  }
}

export function sameFilter(a: Filter, b: Filter) {
  return a.kind === b.kind && a.value === b.value;
}

/* --------------------------------------------------- natural language --- */

const typeWords: [RegExp, DocType][] = [
  [/\bbriefs?\b/, "brief"],
  [/\bpersonas?\b/, "persona"],
  [/\bstrateg(y|ies)\b/, "content_strategy"],
  [/\bresearch\b|\bsnapshots?\b|\baudits?\b|\bscans?\b/, "research_snapshot"],
  [/\bbrand core\b/, "brand_core"],
  [/\bproduct facts?\b|\bcatalog(ue)?\b/, "product_facts"],
  [/\bvisual( system)?\b/, "visual_system"],
];

const subtypeWords: [RegExp, Subtype][] = [
  [/\bvoc\b|voice of customer|\bcomments?\b|\breviews?\b/, "voc_mine"],
  [/\btrends?\b/, "trend_scan"],
  [/\bcompetitor/, "competitor_audit"],
  [/\bcategory\b/, "category_search"],
  [/\bown account\b|\baccount audit\b/, "account_audit"],
  [/\bcarousels?\b/, "carousel"],
  [/\bstatics?\b/, "static"],
  [/\bprimary\b/, "primary"],
  [/\bexploratory\b/, "exploratory"],
  [/\bcampaign\b/, "campaign"],
];

const statusWords: [RegExp, DocStatus][] = [
  [/\bin review\b/, "in_review"],
  [/\bdrafts?\b/, "draft"],
  [/\bready\b/, "ready"],
  [/\bin production\b/, "in_production"],
  [/\bused\b(?! yet)/, "used"],
  [/\bpublished\b/, "published"],
  [/\bactive\b/, "active"],
  [/\barchived?\b/, "archived"],
  [/\bgenerating\b|\bin progress\b/, "generating"],
];

const channelWords: [RegExp, Channel][] = [
  [/\binstagram\b|\big\b/, "instagram"],
  [/\btiktok\b/, "tiktok"],
  [/\bpinterest\b/, "pinterest"],
  [/\bshorts\b|\byoutube\b/, "youtube_shorts"],
  [/\bemail\b/, "email"],
];

/**
 * The agent turns a sentence into structured filters. Deterministic and
 * local: enough to cover "All briefs for P1 that haven't been used".
 */
export function filtersFromQuery(text: string, docs: Document[]): Filter[] {
  const q = text.toLowerCase();
  const out: Filter[] = [];

  for (const [re, t] of typeWords) if (re.test(q)) out.push({ kind: "type", value: t });
  for (const [re, s] of subtypeWords) {
    if (re.test(q) && !(s === "voc_mine" && out.some((f) => f.kind === "type" && f.value === "product_facts"))) {
      out.push({ kind: "subtype", value: s });
    }
  }
  for (const [re, s] of statusWords) if (re.test(q)) out.push({ kind: "status", value: s });
  for (const [re, c] of channelWords) if (re.test(q)) out.push({ kind: "channel", value: c });

  if (/haven'?t been used|not (been )?used|unused|no assets?/.test(q)) out.push({ kind: "quick", value: "unused" });
  if (/needs? review|to review|pending/.test(q)) out.push({ kind: "quick", value: "needs_review" });
  if (/\bstale\b|outdated|expired/.test(q)) out.push({ kind: "quick", value: "stale" });
  if (/\bby (the )?agent\b|agent[- ]made/.test(q)) out.push({ kind: "owner", value: "agent" });
  if (/\bby me\b|\bmine\b|i (wrote|made)/.test(q)) out.push({ kind: "owner", value: "user" });

  /* "for P1", "about Maya", "targeting the couple" resolve to a related doc. */
  for (const d of docs) {
    if (brandTypes.includes(d.type)) continue;
    const short = d.title.split(" — ")[0].toLowerCase();
    const name = d.title.split(" — ")[1]?.split(",")[0]?.toLowerCase();
    if ((short.length <= 4 && new RegExp(`\\b${short}\\b`).test(q)) || (name && q.includes(name))) {
      out.push({ kind: "related", value: d.id });
    }
  }

  /* Anything left over that looks like a quoted phrase becomes a text match. */
  const quoted = /["“]([^"”]+)["”]/.exec(text);
  if (quoted) out.push({ kind: "text", value: quoted[1] });

  /* De-duplicate while keeping order. */
  return out.filter((f, i) => out.findIndex((g) => sameFilter(f, g)) === i);
}

/* ------------------------------------------------------------------ time --- */

export function relativeTime(iso: string, now: Date) {
  const diff = now.getTime() - new Date(iso).getTime();
  const m = Math.round(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} d ago`;
  const mo = Math.round(d / 30);
  return `${mo} mo ago`;
}

export function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function daysUntil(iso: string, now: Date) {
  return Math.ceil((new Date(iso).getTime() - now.getTime()) / DAY);
}
