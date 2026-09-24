import { v } from "convex/values";

import { internal } from "../_generated/api";
import { internalAction, internalMutation, internalQuery, type ActionCtx } from "../_generated/server";
import { CC0_MANIFEST, type Cc0Entry } from "./cc0Manifest";
import { upsertTrack } from "./index";

/*
  Seeds the CC0 fallback library into Convex storage:

      npx convex run audio/cc0:seed                 # skips what is already there
      npx convex run audio/cc0:seed '{"force":true}'  # re-downloads everything

  The Soundstripe trial key indexes songs and nothing else — `/sound_effects`
  answers 403 — and it expires. These rows are what keeps the Audio panel real
  in both cases: they are stored files, not signed URLs, so they never go stale
  and `getPlayableUrl` hands them straight back.

  Everything factual comes from Commons at seed time rather than from the
  manifest. That is what makes the licence claim on these rows worth anything:
  a file that was re-licensed, or one whose name now points at something else,
  is skipped with a warning instead of imported on the strength of a comment
  somebody wrote months earlier.
*/

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

/* Commons asks for a real User-Agent and blocks the default ones. */
const USER_AGENT = "Contently/1.0 (https://github.com/rishdvn/contently; audio seed)";

/* Files per scheduled action. Each one is a download of up to a few megabytes;
   six at a time keeps every step far inside the action limit and the whole seed
   at about a minute. */
const BATCH = 6;

/* Pause between files, so the seed reads as one polite client rather than a
   burst (see `download` for what happens when it does not). */
const PACE_MS = 500;

/* The only licences this seed will import. Anything else on Commons — CC BY,
   CC BY-SA — carries attribution or share-alike terms we are not set up to
   honour inside an exported video. */
const ALLOWED = [/^CC0/i, /^Public domain/i, /^PD/i];

/* ── Commons ───────────────────────────────────────────────────────────── */

type CommonsFile = {
  url: string;
  mime: string;
  duration?: number;
  license: string;
  author?: string;
  descriptionUrl?: string;
  categories: string[];
};

type CommonsResponse = {
  query?: {
    pages?: {
      title: string;
      missing?: boolean;
      imageinfo?: {
        url: string;
        mime: string;
        duration?: number;
        descriptionurl?: string;
        extmetadata?: Record<string, { value?: string }>;
      }[];
      categories?: { title: string }[];
    }[];
  };
};

/* Commons stores the author as a link. The panel wants a name. */
const stripHtml = (value: string) =>
  value
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();

async function commonsMetadata(files: string[]): Promise<Map<string, CommonsFile>> {
  const url = new URL(COMMONS_API);
  url.search = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    titles: files.map((file) => `File:${file}`).join("|"),
    prop: "imageinfo|categories",
    iiprop: "url|mime|size|extmetadata",
    cllimit: "max",
  }).toString();

  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`Commons responded ${response.status}: ${await response.text()}`);
  const body = (await response.json()) as CommonsResponse;

  const metadata = new Map<string, CommonsFile>();
  for (const page of body.query?.pages ?? []) {
    const info = page.imageinfo?.[0];
    if (page.missing || !info) continue;
    const extra = info.extmetadata ?? {};
    metadata.set(page.title.replace(/^File:/, ""), {
      url: info.url.split("?")[0],
      mime: info.mime,
      /* `iiprop=size` returns a media file's duration in seconds. */
      duration: info.duration,
      license: extra.LicenseShortName?.value ?? "",
      author: extra.Artist?.value ? stripHtml(extra.Artist.value) : undefined,
      descriptionUrl: info.descriptionurl,
      categories: (page.categories ?? []).map((category) => category.title.replace(/^Category:/, "")),
    });
  }
  return metadata;
}

/*
  Genre, from the file's own Commons categories rather than from our opinion of
  it: these albums are mirrored from the Free Music Archive, which tags them.
  Names that are not a genre (`Instrumental`, `French`) or that no listener would
  pick from a chip row (`Freak folk`) are folded into Soundstripe's vocabulary or
  dropped, so one filter row serves both providers.
*/
const GENRE_ALIASES: Record<string, string | null> = {
  Chiptune: "Chiptune",
  Electronic: "Electronic",
  Experimental: "Experimental",
  Folk: "Folk",
  "Freak folk": "Folk",
  "Hip hop": "Hip Hop",
  "Hip hop beats": "Hip Hop",
  House: "House",
  Instrumental: null,
  Noise: "Experimental",
  "Noise rock": "Rock",
  Rock: "Rock",
  Soundtrack: "Soundtrack / Cinematic",
  Ambient: "Ambient",
  Jazz: "Jazz",
  Blues: "Blues",
  Pop: "Pop",
  Funk: "Funk",
  French: null,
};

function genresOf(categories: string[]) {
  const genres = new Set<string>();
  for (const category of categories) {
    const match = /^(.+?) music from Free Music Archive$/.exec(category);
    if (!match) continue;
    const name = match[1].trim();
    const mapped = name in GENRE_ALIASES ? GENRE_ALIASES[name] : name;
    if (mapped) genres.add(mapped);
  }
  return [...genres];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/*
  Wikimedia rate-limits by IP, and a Convex deployment shares its egress with
  everything else on the host — the first run of this seed had a third of its
  downloads answered with 429. So: retry those, honour `Retry-After` when it is
  offered, and treat a 404 as an answer rather than something to retry.
*/
async function download(url: string): Promise<Response | null> {
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (response.ok) return response;
    if (response.status === 404) return null;
    if (attempt === 4 || (response.status !== 429 && response.status < 500)) {
      throw new Error(`${url} responded ${response.status}`);
    }
    const retryAfter = Number(response.headers.get("retry-after"));
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 1000);
  }
}

/*
  Commons keeps an MP3 transcode of every audio upload, and the originals here
  are mostly Ogg Vorbis, which Safari will not play. Prefer the transcode; a
  missing one (Commons builds them on demand, so a file nobody has played may
  not have one yet) falls back to the original, which every browser but Safari
  handles and which a later re-seed will replace.
*/
async function fetchAudio(file: CommonsFile): Promise<{ blob: Blob; url: string }> {
  if (file.mime !== "audio/mpeg") {
    const name = file.url.split("/").pop();
    const transcode = `${file.url.replace("/commons/", "/commons/transcoded/")}/${name}.mp3`;
    const response = await download(transcode);
    if (response) return { blob: await response.blob(), url: transcode };
    console.warn(`CC0 seed: no MP3 transcode for ${file.url}; storing the original`);
  }

  const original = await download(file.url);
  if (!original) throw new Error(`${file.url} is gone`);
  return { blob: await original.blob(), url: file.url };
}

/* ── Writes ────────────────────────────────────────────────────────────── */

export const seededIds = internalQuery({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("audioTracks")
      .withIndex("by_provider_externalId", (q) => q.eq("provider", "cc0"))
      .collect();
    /* A row without a file is half-seeded — treat it as not done. */
    return rows.filter((row) => row.storageId).map((row) => row.externalId);
  },
});

export const writeSeeded = internalMutation({
  args: {
    externalId: v.string(),
    kind: v.union(v.literal("music"), v.literal("sfx")),
    title: v.string(),
    artist: v.optional(v.string()),
    duration: v.optional(v.number()),
    bpm: v.optional(v.number()),
    mood: v.array(v.string()),
    genre: v.array(v.string()),
    categories: v.array(v.string()),
    tags: v.array(v.string()),
    storageId: v.id("_storage"),
    license: v.string(),
    attribution: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, track) => {
    const existing = await ctx.db
      .query("audioTracks")
      .withIndex("by_provider_externalId", (q) => q.eq("provider", "cc0").eq("externalId", track.externalId))
      .unique();

    await upsertTrack(ctx, "cc0", track, Date.now());

    /* A re-seed uploads a new file before it replaces the row; the old blob is
       nobody's now, and storage is not free. */
    if (existing?.storageId && existing.storageId !== track.storageId) {
      await ctx.storage.delete(existing.storageId);
    }
    return null;
  },
});

/* ── The seed ──────────────────────────────────────────────────────────── */

async function seedEntry(ctx: ActionCtx, entry: Cc0Entry, file: CommonsFile) {
  if (!ALLOWED.some((pattern) => pattern.test(file.license))) {
    throw new Error(`licence is "${file.license || "unknown"}", not CC0 or public domain`);
  }
  const { blob } = await fetchAudio(file);
  const storageId = await ctx.storage.store(blob);
  return {
    externalId: entry.file,
    kind: entry.kind,
    title: entry.title,
    artist: entry.kind === "music" ? file.author : undefined,
    duration: file.duration,
    bpm: entry.bpm,
    mood: entry.mood ?? [],
    genre: entry.kind === "music" ? genresOf(file.categories) : [],
    categories: entry.categories ?? [],
    tags: entry.tags ?? [],
    storageId,
    license: file.license,
    attribution: file.author,
    sourceUrl: file.descriptionUrl,
  };
}

export const seed = internalAction({
  args: { offset: v.optional(v.number()), force: v.optional(v.boolean()) },
  returns: v.null(),
  handler: async (ctx, { offset = 0, force = false }) => {
    const batch = CC0_MANIFEST.slice(offset, offset + BATCH);
    if (batch.length > 0) {
      const already = force ? new Set<string>() : new Set(await ctx.runQuery(internal.audio.cc0.seededIds));
      const wanted = batch.filter((entry) => !already.has(entry.file));

      if (wanted.length > 0) {
        const metadata = await commonsMetadata(wanted.map((entry) => entry.file));
        for (const entry of wanted) {
          const file = metadata.get(entry.file);
          if (!file) {
            console.warn(`CC0 seed: "${entry.file}" is not on Commons any more; skipping`);
            continue;
          }
          try {
            await ctx.runMutation(internal.audio.cc0.writeSeeded, await seedEntry(ctx, entry, file));
          } catch (error) {
            /* One bad file must not cost the other 46. */
            console.warn(`CC0 seed: skipping "${entry.file}" — ${error instanceof Error ? error.message : error}`);
          }
          /* Wikimedia asks integrations to stay serial and unhurried. Half a
             second a file costs the seed half a minute in total. */
          await sleep(PACE_MS);
        }
      }
    }

    const next = offset + BATCH;
    if (next < CC0_MANIFEST.length) {
      await ctx.scheduler.runAfter(0, internal.audio.cc0.seed, { offset: next, force });
      return null;
    }

    /* The chips have to count the seeded rows too. */
    for (const kind of ["music", "sfx"] as const) {
      await ctx.runMutation(internal.audio.index.rebuildFacets, { kind });
    }
    console.info(`CC0 seed finished over ${CC0_MANIFEST.length} manifest entries`);
    return null;
  },
});
