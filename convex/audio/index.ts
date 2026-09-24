import { v } from "convex/values";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction, internalMutation, type MutationCtx } from "../_generated/server";
import {
  hasApiKey,
  listSongs,
  listSoundEffects,
  PAGE_SIZE,
  SoundstripeError,
  type IndexedTrack,
} from "./soundstripe";

/*
  Nightly indexing of the Soundstripe catalog into `audioTracks`.

      npx convex run audio/index:run                  # both kinds, the usual caps
      npx convex run audio/index:run '{"maxTracks":200,"kinds":["music"]}'

  Why index at all, rather than proxying searches to Soundstripe: their CDN URLs
  expire within a week, so something has to hold the catalog anyway, and the
  audio panel filters by mood and genre across the whole library — queries the
  API cannot answer in one call. Their own recommendation is a nightly index
  served from their CDN.

  One page per scheduled action rather than a loop inside one action. A run over
  the whole catalog is ~115 requests; keeping each page its own transaction means
  a failure costs one page instead of the run, the retry lands on that page only,
  and nothing approaches the action time limit.
*/

/* How much of the catalog to hold. The whole thing is ~11.5k songs, which the
   panel does not need and every filtered search would then pay for: filtering by
   mood or genre has no index to use (Convex cannot index into an array), so it
   scans the kind. 2,500 songs is a deep library and a scan we can afford.
   `SOUNDSTRIPE_MAX_TRACKS=0` on the deployment means "index everything". */
const DEFAULT_MAX_TRACKS = 2_500;

/* Soundstripe allows 25 requests a second. One page every 250ms is a tenth of
   that — polite, and still a complete pass in a couple of minutes. */
const PAGE_DELAY_MS = 250;

const KIND = v.union(v.literal("music"), v.literal("sfx"));

function maxTracksDefault() {
  const configured = Number(process.env.SOUNDSTRIPE_MAX_TRACKS);
  if (!Number.isFinite(configured) || configured < 0) return DEFAULT_MAX_TRACKS;
  /* 0 is "no cap", spelled as a number so it can live in an env var. */
  return configured === 0 ? Number.MAX_SAFE_INTEGER : configured;
}

/* ── Writes ────────────────────────────────────────────────────────────── */

const trackValidator = v.object({
  kind: KIND,
  externalId: v.string(),
  title: v.string(),
  artist: v.optional(v.string()),
  duration: v.optional(v.number()),
  bpm: v.optional(v.number()),
  mood: v.array(v.string()),
  genre: v.array(v.string()),
  categories: v.array(v.string()),
  tags: v.array(v.string()),
  previewUrl: v.optional(v.string()),
  previewExpiresAt: v.optional(v.number()),
  artworkUrl: v.optional(v.string()),
});

/* Everything a query might match on, in one field, because a Convex search index
   takes exactly one. Duplicated words cost nothing and keep "upbeat corporate"
   working across the title and the tags at once. */
export function searchTextOf(track: {
  title: string;
  artist?: string;
  mood: string[];
  genre: string[];
  categories: string[];
  tags: string[];
}) {
  return [track.title, track.artist ?? "", ...track.mood, ...track.genre, ...track.categories, ...track.tags]
    .join(" ")
    .trim();
}

export type UpsertInput = IndexedTrack & {
  storageId?: Id<"_storage">;
  license?: string;
  attribution?: string;
  sourceUrl?: string;
};

export async function upsertTrack(ctx: MutationCtx, provider: string, track: UpsertInput, fetchedAt: number) {
  const row = { ...track, provider, searchText: searchTextOf(track), fetchedAt };

  const existing = await ctx.db
    .query("audioTracks")
    .withIndex("by_provider_externalId", (q) => q.eq("provider", provider).eq("externalId", track.externalId))
    .unique();

  /* `replace` rather than `patch`: a track that lost its last mood tag upstream
     should lose it here too, and a patch would keep the stale array. */
  if (existing) {
    await ctx.db.replace(existing._id, row);
    return existing._id;
  }
  return await ctx.db.insert("audioTracks", row);
}

export const writePage = internalMutation({
  args: { tracks: v.array(trackValidator), fetchedAt: v.number() },
  returns: v.number(),
  handler: async (ctx, { tracks, fetchedAt }) => {
    for (const track of tracks) await upsertTrack(ctx, "soundstripe", track, fetchedAt);
    return tracks.length;
  },
});

/*
  Tracks the catalog no longer returns. Only ever called after a pass completed,
  and only against rows this run should have touched, so a run that died halfway
  leaves the library alone instead of emptying it.
*/
export const pruneStale = internalMutation({
  args: { kind: KIND, before: v.number() },
  returns: v.number(),
  handler: async (ctx, { kind, before }) => {
    const stale = await ctx.db
      .query("audioTracks")
      .withIndex("by_provider_fetchedAt", (q) => q.eq("provider", "soundstripe").lt("fetchedAt", before))
      .filter((q) => q.eq(q.field("kind"), kind))
      .collect();
    for (const track of stale) await ctx.db.delete(track._id);
    return stale.length;
  },
});

/*
  The filter chips, counted once per run instead of per request. Reading a whole
  kind here is the same scan a filtered search does, but it happens nightly
  rather than on every keystroke.
*/
export const rebuildFacets = internalMutation({
  args: { kind: KIND },
  returns: v.object({ mood: v.number(), genre: v.number(), category: v.number() }),
  handler: async (ctx, { kind }) => {
    const tracks = await ctx.db
      .query("audioTracks")
      .withIndex("by_kind", (q) => q.eq("kind", kind))
      .collect();

    const counts = { mood: new Map<string, number>(), genre: new Map<string, number>(), category: new Map<string, number>() };
    for (const track of tracks) {
      for (const value of track.mood) counts.mood.set(value, (counts.mood.get(value) ?? 0) + 1);
      for (const value of track.genre) counts.genre.set(value, (counts.genre.get(value) ?? 0) + 1);
      for (const value of track.categories) counts.category.set(value, (counts.category.get(value) ?? 0) + 1);
    }

    const computedAt = Date.now();
    const sizes = { mood: 0, genre: 0, category: 0 };
    for (const facet of ["mood", "genre", "category"] as const) {
      const values = [...counts[facet].entries()]
        .map(([value, count]) => ({ value, count }))
        /* Commonest first, then alphabetical, so the chip order is stable when
           two values tie. */
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
      sizes[facet] = values.length;

      const existing = await ctx.db
        .query("audioFacets")
        .withIndex("by_kind_facet", (q) => q.eq("kind", kind).eq("facet", facet))
        .unique();
      if (existing) await ctx.db.patch(existing._id, { values, computedAt });
      else await ctx.db.insert("audioFacets", { kind, facet, values, computedAt });
    }
    return sizes;
  },
});

/* ── The run ───────────────────────────────────────────────────────────── */

/*
  One page: fetch, write, then schedule the next page or finish. `runStartedAt`
  threads through every page of a pass so `pruneStale` knows which rows this pass
  was responsible for.
*/
export const indexPage = internalAction({
  args: {
    kind: KIND,
    pageNumber: v.number(),
    runStartedAt: v.number(),
    written: v.number(),
    maxTracks: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { kind, pageNumber, runStartedAt, written, maxTracks }) => {
    const now = Date.now();
    let page;
    try {
      page = kind === "music" ? await listSongs(pageNumber, now) : await listSoundEffects(pageNumber, now);
    } catch (error) {
      /* A key without Sound Effects access — which is what the trial key is —
         is a fact about the key, not a failure of the run. The music pass and
         the seeded `cc0` library carry the panel until access arrives. */
      if (error instanceof SoundstripeError && error.isForbidden) {
        console.warn(`Soundstripe ${kind}: ${error.message}. Skipping this kind; nothing was removed.`);
        return null;
      }
      throw error;
    }

    const remaining = maxTracks - written;
    const tracks = page.items.slice(0, Math.max(remaining, 0));
    if (tracks.length > 0) {
      await ctx.runMutation(internal.audio.index.writePage, { tracks, fetchedAt: now });
    }

    const total = written + tracks.length;
    const done = !page.hasMore || total >= maxTracks || page.items.length === 0;
    if (!done) {
      await ctx.scheduler.runAfter(PAGE_DELAY_MS, internal.audio.index.indexPage, {
        kind,
        pageNumber: pageNumber + 1,
        runStartedAt,
        written: total,
        maxTracks,
      });
      return null;
    }

    const pruned = await ctx.runMutation(internal.audio.index.pruneStale, { kind, before: runStartedAt });
    const facets = await ctx.runMutation(internal.audio.index.rebuildFacets, { kind });
    console.info(
      `Soundstripe ${kind}: indexed ${total} of ${page.totalCount ?? "?"} in ${pageNumber} page(s), ` +
        `pruned ${pruned}, facets ${facets.mood} moods / ${facets.genre} genres / ${facets.category} categories`,
    );
    return null;
  },
});

/*
  The entry point — the cron's and a person's. Starts one page chain per kind;
  the two run side by side because they are different endpoints with different
  entitlements, and a 403 on one must not stop the other.
*/
export const run = internalAction({
  args: {
    kinds: v.optional(v.array(KIND)),
    maxTracks: v.optional(v.number()),
  },
  returns: v.object({ started: v.array(KIND), maxTracks: v.number() }),
  handler: async (ctx, { kinds, maxTracks }) => {
    if (!hasApiKey()) {
      /* Not an error: a deployment without the key still serves the seeded `cc0`
         library, and failing the cron nightly would only make noise. */
      console.warn("SOUNDSTRIPE_API_KEY is not set on this deployment; skipping the index run");
      return { started: [], maxTracks: 0 };
    }

    const started = kinds ?? (["music", "sfx"] as const).slice();
    const cap = maxTracks ?? maxTracksDefault();
    const runStartedAt = Date.now();

    for (const kind of started) {
      await ctx.scheduler.runAfter(0, internal.audio.index.indexPage, {
        kind,
        pageNumber: 1,
        runStartedAt,
        written: 0,
        maxTracks: cap,
      });
    }
    console.info(`Soundstripe index run started for ${started.join(", ")} (up to ${cap} per kind, ${PAGE_SIZE}/page)`);
    return { started, maxTracks: cap };
  },
});
