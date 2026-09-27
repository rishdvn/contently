import {
  StockProviderError,
  type StockAsset,
  type StockCategory,
  type StockCategorySlug,
  type StockKind,
  type StockPage,
  type StockProvider,
} from "./provider";

/*
  Dupe (dupephotos.com): phone-shot, UGC-looking photos and videos, which is the
  look the stock panel is for.

  This is Dupe's private content API, the one their own site calls, verified
  2026-09-20 and again 2026-09-27. It needs no key and may change without
  notice. Only the one-off import in `import.ts` uses it; nothing the product
  serves ever calls Dupe, and none of these URLs may appear in client code.

  Licence: Dupe's terms allow free commercial use of the images but not
  aggregating them into a comparable service. The owner has decided to import a
  curated set for internal trial use only, so every row is stamped with
  `LICENSE` below and can be found — and purged — with one indexed query before
  anything is released outside the team.

  Politeness, as agreed with ourselves: one request at a time, at least half a
  second apart, with a browser's User-Agent, and a 429 or 5xx stops the import
  rather than being retried (see `StockProviderError`).
*/

const API = "https://content-api-prod-6gxsdymdsq-ue.a.run.app/api/v1/content";
const CDN = "https://d3p3fw3rutb1if.cloudfront.net";

const LICENSE = "dupe-internal-trial";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

/* Dupe answers 20 items a page, however many it has. */
const PAGE_SIZE = 20;

const MIN_GAP_MS = 500;

/* ── Taxonomy mapping ──────────────────────────────────────────────────── */

/*
  One search label per category, and the words that make a result belong to it.

  Dupe's search ranks by similarity rather than filtering — a nonsense label
  still returns twenty items — so page three of "hands" is mostly whatever is
  nearest. `terms` is matched against each asset's own labels and aesthetics,
  which only the per-asset endpoint returns; an asset that mentions none of them
  is skipped. The lists lean generous: the point is to drop the obvious
  strangers, not to second-guess Dupe's taggers.
*/
const CATEGORY_MAP: Record<StockCategorySlug, { label: string; terms: string[] }> = {
  cafe: {
    label: "cafe",
    terms: ["cafe", "café", "coffee", "coffee shop", "latte", "espresso", "matcha", "cappuccino", "bakery", "pastry", "croissant"],
  },
  beach: {
    label: "beach",
    terms: ["beach", "ocean", "sea", "sand", "coast", "coastal", "waves", "surf", "shore", "seaside", "beachcore", "swim", "bikini"],
  },
  workspace: {
    label: "workspace",
    terms: ["workspace", "office", "work", "working", "desk", "laptop", "wfh", "work from home", "study", "studying", "meeting", "notebook"],
  },
  city: {
    label: "city",
    terms: ["city", "street", "streets", "urban", "skyline", "downtown", "buildings", "architecture", "nyc", "new york", "london", "paris", "city girl"],
  },
  gym: {
    label: "gym",
    terms: ["gym", "workout", "fitness", "pilates", "yoga", "weights", "exercise", "training", "running", "sport", "athletic", "gym girl"],
  },
  home: {
    label: "home",
    terms: ["home", "interior", "living room", "bedroom", "kitchen", "cozy", "decor", "home decor", "sofa", "couch", "bed", "apartment"],
  },
  food: {
    label: "food",
    terms: ["food", "meal", "dinner", "lunch", "breakfast", "brunch", "dessert", "cooking", "baking", "pasta", "pizza", "salad", "snack", "foodie", "restaurant"],
  },
  ootd: {
    label: "ootd",
    terms: ["ootd", "outfit", "fashion", "style", "mirror selfie", "fit check", "streetwear", "clothes"],
  },
  travel: {
    label: "travel",
    terms: ["travel", "vacation", "airport", "plane", "trip", "holiday", "hotel", "road trip", "wanderlust", "europe", "italy", "explore", "adventure"],
  },
  nature: {
    label: "nature",
    terms: ["nature", "forest", "mountain", "mountains", "flowers", "trees", "hiking", "lake", "garden", "outdoors", "outdoorsy", "sunset", "field", "wildflowers"],
  },
  "desk-tech": {
    label: "desk setup",
    terms: ["desk", "desk setup", "computer", "laptop", "keyboard", "tech", "setup", "iphone", "phone", "monitor", "headphones", "macbook", "ipad"],
  },
  "night-out": {
    label: "night out",
    terms: ["night out", "party", "nightlife", "bar", "cocktail", "cocktails", "drinks", "club", "champagne", "night", "wine", "party girl", "going out"],
  },
  "hands-people": {
    label: "hands",
    terms: ["hands", "hand", "people", "friends", "portrait", "woman", "man", "girl", "couple", "holding", "candid", "smile", "group"],
  },
  textures: {
    label: "texture",
    terms: ["texture", "textures", "background", "fabric", "pattern", "abstract", "wall", "marble", "linen", "shadow", "shadows", "paper", "grain"],
  },
};

/* ── HTTP ──────────────────────────────────────────────────────────────── */

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/* Module state, so the gap holds across every call one action makes. The CLI
   runs actions one after another, and each run costs more than the gap. */
let lastRequestAt = 0;

async function politely(target: string, init?: RequestInit): Promise<Response> {
  const wait = lastRequestAt + MIN_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();

  const response = await fetch(target, {
    ...init,
    headers: { "User-Agent": USER_AGENT, Accept: "application/json, */*", ...init?.headers },
  });
  if (response.status === 429 || response.status >= 500) {
    throw new StockProviderError("dupe", response.status, target);
  }
  return response;
}

/* ── Shapes ────────────────────────────────────────────────────────────── */

type DupeItem = {
  id: string;
  img_id: string;
  content_type: "PHOTO" | "VIDEO";
  img_width: number;
  img_height: number;
  user?: string | null;
  username?: string | null;
  /* Null in search results; filled in by `/<id>/preview`. */
  labels?: { label: string }[] | null;
  aesthetics?: { aesthetic: string }[] | null;
};

/* Dupe's labels are typed by people: mixed case, trailing spaces, duplicates. */
const tidy = (values: (string | undefined)[]) => [
  ...new Set(values.map((value) => value?.trim().toLowerCase()).filter((value): value is string => Boolean(value))),
];

function toAsset(item: DupeItem): StockAsset {
  const kind: StockKind = item.content_type === "VIDEO" ? "video" : "image";
  return {
    externalId: item.id,
    kind,
    width: item.img_width,
    height: item.img_height,
    /* The CDN serves both without an extension; these are the types it answers. */
    mimeType: kind === "video" ? "video/mp4" : "image/jpeg",
    fileRef: item.img_id,
    credit: { name: item.user?.trim() || undefined, handle: item.username?.trim() || undefined },
    labels: tidy((item.labels ?? []).map((entry) => entry.label)),
    aesthetics: tidy((item.aesthetics ?? []).map((entry) => entry.aesthetic)),
  };
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* ── The provider ──────────────────────────────────────────────────────── */

export const dupe: StockProvider = {
  id: "dupe",
  license: LICENSE,

  async search(category: StockCategory, kind: StockKind, page: number): Promise<StockPage> {
    const response = await politely(`${API}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      /* `label` is the only field name the endpoint accepts; `content_type`
         narrows to one kind, which the site itself never does but the API
         honours. */
      body: JSON.stringify({
        label: CATEGORY_MAP[category.slug].label,
        page,
        content_type: kind === "video" ? "VIDEO" : "PHOTO",
      }),
    });
    if (!response.ok) throw new Error(`Dupe search answered ${response.status}: ${await response.text()}`);
    const items = ((await response.json()) as DupeItem[] | null) ?? [];
    return { items: items.map(toAsset), hasMore: items.length >= PAGE_SIZE };
  },

  async fetchAsset(externalId: string): Promise<StockAsset | null> {
    const response = await politely(`${API}/${encodeURIComponent(externalId)}/preview`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Dupe asset ${externalId} answered ${response.status}`);
    return toAsset((await response.json()) as DupeItem);
  },

  belongsTo(asset, category) {
    const text = [...asset.labels, ...asset.aesthetics].join(" | ");
    return CATEGORY_MAP[category.slug].terms.some((term) =>
      /* Whole words, so "bar" does not claim "barbecue" or "work" "artwork". */
      new RegExp(`(^|[^\\p{L}])${escapeRegExp(term)}($|[^\\p{L}])`, "u").test(text),
    );
  },

  async download(asset: StockAsset): Promise<Response> {
    const folder = asset.kind === "video" ? "videos" : "photos";
    const response = await politely(`${CDN}/${folder}/${encodeURIComponent(asset.fileRef)}`, {
      headers: { Accept: asset.mimeType },
    });
    if (!response.ok) throw new Error(`Dupe ${folder}/${asset.fileRef} answered ${response.status}`);
    return response;
  },
};
