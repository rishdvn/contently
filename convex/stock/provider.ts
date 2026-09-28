/*
  The seam between the stock library and wherever its files come from.

  The library is ours: `media` rows with `source: "stock"` and files in Convex
  storage. A provider is only ever asked for candidates and bytes, by the import
  in `import.ts`, which is run by hand from the CLI. Nothing the product serves
  calls a provider, so swapping Dupe for Pexels, Unsplash or a licensed feed
  (T-090b) is a new file implementing `StockProvider` and nothing else.

  No Convex functions live here, and nothing provider-specific either: the
  client may import the taxonomy below for its category chips.
*/

export type StockKind = "image" | "video";

/* ── Taxonomy ──────────────────────────────────────────────────────────── */

/*
  Ours, not a provider's. Every provider maps these onto its own vocabulary, and
  a row's `categories` holds these slugs whichever provider it came from, so the
  chips in the stock panel mean the same thing across providers.
*/
export const STOCK_CATEGORIES = [
  { slug: "cafe", name: "Cafe" },
  { slug: "beach", name: "Beach" },
  { slug: "workspace", name: "Workspace" },
  { slug: "city", name: "City" },
  { slug: "gym", name: "Gym" },
  { slug: "home", name: "Home" },
  { slug: "food", name: "Food" },
  { slug: "ootd", name: "OOTD" },
  { slug: "travel", name: "Travel" },
  { slug: "nature", name: "Nature" },
  { slug: "desk-tech", name: "Desk/Tech" },
  { slug: "night-out", name: "Night out" },
  { slug: "hands-people", name: "Hands/People" },
  { slug: "textures", name: "Textures" },
] as const;

export type StockCategorySlug = (typeof STOCK_CATEGORIES)[number]["slug"];
export type StockCategory = (typeof STOCK_CATEGORIES)[number];

export function stockCategory(slug: string): StockCategory | undefined {
  return STOCK_CATEGORIES.find((category) => category.slug === slug);
}

/* ── Assets ────────────────────────────────────────────────────────────── */

/* A provider's asset, normalised. Search results may be thin (Dupe's omit the
   labels); `fetchAsset` is what fills them in. */
export type StockAsset = {
  /* The provider's own id. Prefixed with the provider's id it becomes the row's
     `sourceRef`, which is what makes an import idempotent. */
  externalId: string;
  kind: StockKind;
  width: number;
  height: number;
  mimeType: string;
  /* The provider's handle for the bytes, opaque to everyone but `download`. */
  fileRef: string;
  /* Who made it, as the provider names them, and their page there. */
  credit: { name?: string; handle?: string; url?: string };
  /* The asset's own page on the provider's site. */
  sourceUrl?: string;
  /* The provider's free-form subject labels, and its style labels where it has
     them. Kept on the row: they are what search will match on. */
  labels: string[];
  aesthetics: string[];
};

export type StockPage = {
  items: StockAsset[];
  /* False once a further page would come back empty. */
  hasMore: boolean;
};

/* ── The interface ─────────────────────────────────────────────────────── */

export interface StockProvider {
  /* Short and stable: it prefixes every `sourceRef` this provider writes. */
  readonly id: string;
  /* Written on every row imported from this provider, so a licence decision
     can be applied — or reversed — with one query. */
  readonly license: string;

  /* One page of candidates for a category, one kind at a time. */
  search(category: StockCategory, kind: StockKind, page: number): Promise<StockPage>;

  /* Everything the provider knows about one asset; null if it is gone. */
  fetchAsset(externalId: string): Promise<StockAsset | null>;

  /* Whether a fully fetched asset belongs in a category. Searches rank rather
     than filter, so the tail of every result list is someone else's category;
     this is the curation step that keeps it out. */
  belongsTo(asset: Pick<StockAsset, "labels" | "aesthetics">, category: StockCategory): boolean;

  /* The file. The response is only ever read by the import. */
  download(asset: StockAsset): Promise<Response>;

  /* The provider's public pages for an asset and for its author, which the
     credit links to. Built from the id and handle a row already stores, so rows
     imported before the links existed gain them without asking the provider. */
  links(externalId: string, handle?: string): { asset: string; author?: string };
}

/*
  Thrown for anything the provider answered with that means "stop for now" —
  rate limiting and server errors. The import does not retry these: it stops,
  and a re-run later resumes where this one left off.
*/
export class StockProviderError extends Error {
  constructor(
    readonly provider: string,
    readonly status: number,
    readonly target: string,
  ) {
    super(`${provider} answered ${status} for ${target}`);
    this.name = "StockProviderError";
  }

  get shouldStop() {
    return this.status === 429 || this.status >= 500;
  }
}

export const sourceRefOf = (provider: StockProvider, externalId: string) => `${provider.id}:${externalId}`;
