/*
  The Soundstripe HTTP client. No Convex functions live here — this file knows
  about JSON:API, rate limits and CDN tokens, and hands back plain rows that
  `convex/audio/index.ts` writes to `audioTracks`.

  Three facts shape everything below.

  - `SOUNDSTRIPE_API_KEY` is a deployment env var (`npx convex env set
    SOUNDSTRIPE_API_KEY …`). It authorises the catalog calls and never leaves
    the server: what the client eventually plays is a signed CDN URL, which
    carries a different, per-account key of Soundstripe's own.
  - Every audio URL Soundstripe returns expires. The token is
    `<unix seconds>_<signature>`, so the expiry is readable from the URL rather
    than guessed — see `expiryOf`.
  - The limiter allows 25 requests a second and answers `429` above that. We
    stay far below it (one page at a time), but a burst from another integration
    sharing the key would still land on us, so retries are built in.

  Docs: https://docs.soundstripe.com (index at /llms.txt).
*/

const API = "https://api.soundstripe.com/v1";

/* Songs and sound effects are separate products: a key can be entitled to one
   and not the other, which is exactly what the trial key does (`/sound_effects`
   answers 403). The indexer treats that as "no SFX today", not as a failure. */
export class SoundstripeError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    readonly body: string,
  ) {
    super(`Soundstripe ${path} responded ${status}: ${body.slice(0, 300)}`);
    this.name = "SoundstripeError";
  }

  /* The key is valid but not entitled to this part of the catalog. */
  get isForbidden() {
    return this.status === 401 || this.status === 403;
  }
}

export function hasApiKey() {
  return Boolean(process.env.SOUNDSTRIPE_API_KEY);
}

function apiKey() {
  const key = process.env.SOUNDSTRIPE_API_KEY;
  if (!key) {
    throw new Error(
      "SOUNDSTRIPE_API_KEY is not set on this deployment; run `npx convex env set SOUNDSTRIPE_API_KEY …`",
    );
  }
  return key;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/*
  One request, retried on the failures that are worth retrying: `429` and 5xx.
  Backoff is exponential with jitter because every deployment running this cron
  would otherwise retry in lockstep — the thundering herd their docs warn about.
*/
async function request<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const url = new URL(`${API}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));

  const attempts = 4;
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Token ${apiKey()}`,
        Accept: "application/vnd.api+json",
      },
    });
    if (response.ok) return (await response.json()) as T;

    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === attempts) {
      throw new SoundstripeError(response.status, path, await response.text());
    }
    /* 0.5s, 1s, 2s, each with up to 250ms of jitter. */
    await sleep(2 ** (attempt - 1) * 500 + Math.random() * 250);
  }
}

/* ── JSON:API shapes ───────────────────────────────────────────────────── */

type Resource<A> = {
  id: string;
  type: string;
  attributes: A;
  relationships?: Record<string, { data?: { id: string; type: string }[] | { id: string; type: string } | null }>;
};

type Collection<A> = {
  data: Resource<A>[];
  included?: Resource<Record<string, unknown>>[];
  links?: { next?: string | null; meta?: { total_count?: number } };
};

type SongAttributes = {
  title: string;
  bpm?: number | null;
  description?: string | null;
  energy?: string | null;
  tags?: { mood?: string[]; genre?: string[]; instrument?: string[]; characteristic?: string[] } | null;
};

type ArtistAttributes = { name?: string | null; image?: string | null };

type AudioFileAttributes = {
  duration?: number | null;
  song_id?: string | null;
  versions?: { mp3?: string | null; wav?: string | null } | null;
};

type SoundEffectAttributes = {
  title: string;
  description?: string | null;
  duration?: number | null;
  primary_category?: string | null;
  primary_subcategory?: string | null;
  categories?: string[] | null;
  subcategories?: string[] | null;
  versions?: { mp3?: string | null; wav?: string | null } | null;
};

/* ── Normalised rows ───────────────────────────────────────────────────── */

export type IndexedTrack = {
  kind: "music" | "sfx";
  externalId: string;
  title: string;
  artist?: string;
  duration?: number;
  bpm?: number;
  mood: string[];
  genre: string[];
  categories: string[];
  tags: string[];
  previewUrl?: string;
  previewExpiresAt?: number;
  artworkUrl?: string;
};

export type Page<T> = { items: T[]; hasMore: boolean; totalCount?: number };

/*
  When the signed URL stops working. Soundstripe puts the expiry in the token
  (`token=1790835637_<signature>`), which beats assuming seven days: a URL handed
  out by yesterday's run is already a day into its life, and the only thing worse
  than refreshing too often is handing the client a URL that 403s mid-playback.

  If the shape ever changes we fall back to a deliberately short window, so an
  unreadable token means "re-fetch soon", not "trust this for a week".
*/
const UNREADABLE_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

export function expiryOf(url: string | undefined, now: number): number | undefined {
  if (!url) return undefined;
  let token: string | null = null;
  try {
    token = new URL(url).searchParams.get("token");
  } catch {
    return now + UNREADABLE_TOKEN_TTL_MS;
  }
  const seconds = Number(token?.split("_")[0]);
  if (!token || !Number.isFinite(seconds) || seconds <= 0) return now + UNREADABLE_TOKEN_TTL_MS;

  const expiresAt = seconds * 1000;
  /* A token that is already spent is not evidence of anything; treat it the same
     as one we could not read rather than storing a past expiry. */
  return expiresAt > now ? expiresAt : now + UNREADABLE_TOKEN_TTL_MS;
}

const clean = (values: (string | null | undefined)[] | null | undefined) =>
  [...new Set((values ?? []).filter((value): value is string => Boolean(value && value.trim())))];

/* Soundstripe's sound-effect categories arrive lowercased (`transportation`)
   while song tags are title case (`Orchestral`). The panel shows both as chips,
   so they are normalised here rather than in the UI. */
const titleCase = (value: string) =>
  value
    .split(/[\s_/-]+/)
    .filter(Boolean)
    .map((word) => (word.length > 3 || /[A-Z]/.test(word) ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");

function relatedIds(resource: Resource<unknown>, name: string): string[] {
  const data = resource.relationships?.[name]?.data;
  if (!data) return [];
  return Array.isArray(data) ? data.map((entry) => entry.id) : [data.id];
}

function song(resource: Resource<SongAttributes>, included: Map<string, Resource<Record<string, unknown>>>, now: number): IndexedTrack {
  /* The first artist and the first audio file are the primary ones — the rest
     are alternates (vocal/instrumental cuts) we do not index separately. */
  const artist = included.get(relatedIds(resource, "artists")[0] ?? "")?.attributes as ArtistAttributes | undefined;
  const audio = included.get(relatedIds(resource, "audio_files")[0] ?? "")?.attributes as AudioFileAttributes | undefined;

  const tags = resource.attributes.tags ?? {};
  const previewUrl = audio?.versions?.mp3 ?? undefined;

  return {
    kind: "music",
    externalId: resource.id,
    title: resource.attributes.title,
    artist: artist?.name ?? undefined,
    duration: audio?.duration ?? undefined,
    bpm: resource.attributes.bpm ?? undefined,
    mood: clean(tags.mood),
    genre: clean(tags.genre),
    categories: [],
    tags: clean([...(tags.instrument ?? []), ...(tags.characteristic ?? []), resource.attributes.energy ?? null]),
    previewUrl,
    previewExpiresAt: expiryOf(previewUrl, now),
    artworkUrl: artist?.image ?? undefined,
  };
}

function soundEffect(resource: Resource<SoundEffectAttributes>, now: number): IndexedTrack {
  const attributes = resource.attributes;
  const previewUrl = attributes.versions?.mp3 ?? undefined;
  const categories = clean([attributes.primary_category, ...(attributes.categories ?? [])]).map(titleCase);
  const subcategories = clean([attributes.primary_subcategory, ...(attributes.subcategories ?? [])]).map(titleCase);

  return {
    kind: "sfx",
    externalId: resource.id,
    title: attributes.title,
    duration: attributes.duration ?? undefined,
    mood: [],
    genre: [],
    categories,
    tags: subcategories,
    previewUrl,
    previewExpiresAt: expiryOf(previewUrl, now),
  };
}

/* ── Endpoints ─────────────────────────────────────────────────────────── */

/* 100 is the documented maximum, and the fewest round trips for a catalog of
   ~11.5k songs. */
export const PAGE_SIZE = 100;

function index(included: Resource<Record<string, unknown>>[] | undefined) {
  return new Map((included ?? []).map((resource) => [resource.id, resource]));
}

export async function listSongs(pageNumber: number, now: number): Promise<Page<IndexedTrack>> {
  const body = await request<Collection<SongAttributes>>("/songs", {
    "page[number]": pageNumber,
    "page[size]": PAGE_SIZE,
  });
  const included = index(body.included);
  return {
    items: body.data.map((resource) => song(resource, included, now)),
    hasMore: Boolean(body.links?.next),
    totalCount: body.links?.meta?.total_count,
  };
}

export async function listSoundEffects(pageNumber: number, now: number): Promise<Page<IndexedTrack>> {
  const body = await request<Collection<SoundEffectAttributes>>("/sound_effects", {
    "page[number]": pageNumber,
    "page[size]": PAGE_SIZE,
  });
  return {
    items: body.data.map((resource) => soundEffect(resource, now)),
    hasMore: Boolean(body.links?.next),
    totalCount: body.links?.meta?.total_count,
  };
}

/* One track, for `getPlayableUrl`: the response carries a freshly signed URL. */
export async function getSong(externalId: string, now: number): Promise<IndexedTrack> {
  const body = await request<{ data: Resource<SongAttributes>; included?: Resource<Record<string, unknown>>[] }>(
    `/songs/${externalId}`,
  );
  return song(body.data, index(body.included), now);
}

export async function getSoundEffect(externalId: string, now: number): Promise<IndexedTrack> {
  const body = await request<{ data: Resource<SoundEffectAttributes> }>(`/sound_effects/${externalId}`);
  return soundEffect(body.data, now);
}
