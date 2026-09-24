import { ConvexError, v } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { action, internalMutation, internalQuery, query, type QueryCtx } from "../_generated/server";
import { requireUser } from "../lib/auth";
import { expiryOf, getSong, getSoundEffect, hasApiKey } from "./soundstripe";

/*
  What the audio panel reads: the facet chips, the search, and the one URL it
  actually plays.

  Everything here is behind `requireUser`. The catalog is licensed to us, not to
  the internet, and the cheapest way to keep it that way is to make an anonymous
  caller get nothing rather than an empty list they might mistake for an empty
  library.
*/

const KIND = v.union(v.literal("music"), v.literal("sfx"));

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

/* Filtering by mood, genre or category has no index to use — Convex indexes
   values, not the contents of an array — so those searches scan the kind and
   filter in memory. The cap is what keeps a pathological library from turning
   one keystroke into an unbounded read; it is comfortably above the indexing cap
   in `index.ts`. */
const MAX_SCAN = 4_000;
/* Convex returns at most 1,024 search results; 512 is deep enough that paging
   through a query's matches never runs out before the user stops scrolling. */
const MAX_SEARCH_RESULTS = 512;

/* ── Serialisation ─────────────────────────────────────────────────────── */

export type PlayableTrack = {
  id: Id<"audioTracks">;
  provider: string;
  kind: "music" | "sfx";
  title: string;
  artist?: string;
  duration?: number;
  bpm?: number;
  mood: string[];
  genre: string[];
  categories: string[];
  tags: string[];
  artworkUrl?: string;
  license?: string;
  attribution?: string;
  sourceUrl?: string;
  /* Null while a `cc0` upload is missing its file, or a Soundstripe row was
     indexed without a preview. The panel shows the row and disables play. */
  previewUrl: string | null;
  /* Null for anything that does not expire. */
  previewExpiresAt: number | null;
};

/* `cc0` rows play from Convex storage, Soundstripe rows from a signed CDN URL.
   The storage URL is resolved here rather than stored, because it belongs to a
   deployment and the row does not. */
async function serialise(ctx: QueryCtx, track: Doc<"audioTracks">): Promise<PlayableTrack> {
  const previewUrl = track.storageId ? await ctx.storage.getUrl(track.storageId) : (track.previewUrl ?? null);
  return {
    id: track._id,
    provider: track.provider,
    kind: track.kind,
    title: track.title,
    artist: track.artist,
    duration: track.duration,
    bpm: track.bpm,
    mood: track.mood,
    genre: track.genre,
    categories: track.categories,
    tags: track.tags,
    artworkUrl: track.artworkUrl,
    license: track.license,
    attribution: track.attribution,
    sourceUrl: track.sourceUrl,
    previewUrl,
    previewExpiresAt: track.storageId ? null : (track.previewExpiresAt ?? null),
  };
}

/* ── Facets ────────────────────────────────────────────────────────────── */

async function facet(ctx: QueryCtx, kind: "music" | "sfx", name: "mood" | "genre" | "category") {
  await requireUser(ctx);
  const row = await ctx.db
    .query("audioFacets")
    .withIndex("by_kind_facet", (q) => q.eq("kind", kind).eq("facet", name))
    .unique();
  return row?.values ?? [];
}

const facetValues = v.array(v.object({ value: v.string(), count: v.number() }));

/* The music tab's two chip rows, and the sound-effect tab's one. Counts come
   with the values so the panel can hide a facet that only one track has. */
export const moods = query({
  args: {},
  returns: facetValues,
  handler: (ctx) => facet(ctx, "music", "mood"),
});

export const genres = query({
  args: {},
  returns: facetValues,
  handler: (ctx) => facet(ctx, "music", "genre"),
});

export const sfxCategories = query({
  args: {},
  returns: facetValues,
  handler: (ctx) => facet(ctx, "sfx", "category"),
});

/* ── Search ────────────────────────────────────────────────────────────── */

const matchesAll = (track: Doc<"audioTracks">, filters: { moods: string[]; genres: string[]; categories: string[] }) => {
  /* Within one facet the chips are an OR ("upbeat or hopeful"); across facets
     they are an AND ("upbeat, and electronic") — Butter's audio filters behave
     the same way, and so does every stock library worth copying. */
  const has = (values: string[], wanted: string[]) =>
    wanted.length === 0 || wanted.some((want) => values.some((value) => value.toLowerCase() === want.toLowerCase()));
  return (
    has(track.mood, filters.moods) && has(track.genre, filters.genres) && has(track.categories, filters.categories)
  );
};

export const search = query({
  args: {
    kind: KIND,
    q: v.optional(v.string()),
    moods: v.optional(v.array(v.string())),
    genres: v.optional(v.array(v.string())),
    categories: v.optional(v.array(v.string())),
    /* Zero-indexed, because the panel counts pages from the top of the list. */
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    const pageSize = Math.min(Math.max(args.pageSize ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const page = Math.max(args.page ?? 0, 0);
    const offset = page * pageSize;
    const term = args.q?.trim() ?? "";
    const filters = { moods: args.moods ?? [], genres: args.genres ?? [], categories: args.categories ?? [] };
    const filtered = filters.moods.length + filters.genres.length + filters.categories.length > 0;

    let rows: Doc<"audioTracks">[];
    /* Known whenever the whole result set had to be materialised anyway; null on
       a plain browse, where counting the tab would mean reading it. */
    let total: number | null = null;
    let hasMore: boolean;

    if (term) {
      const matches = await ctx.db
        .query("audioTracks")
        .withSearchIndex("by_text", (q) => q.search("searchText", term).eq("kind", args.kind))
        .take(MAX_SEARCH_RESULTS);
      /* Relevance order is the search index's; the chips only narrow it. */
      const kept = matches.filter((track) => matchesAll(track, filters));
      /* A query that filled the window has more matches than we looked at, and
         reporting the window size as the total would be a lie the panel would
         print. */
      total = matches.length < MAX_SEARCH_RESULTS ? kept.length : null;
      rows = kept.slice(offset, offset + pageSize);
      hasMore = offset + rows.length < kept.length;
    } else if (filtered) {
      const all = await ctx.db
        .query("audioTracks")
        .withIndex("by_kind_title", (q) => q.eq("kind", args.kind))
        .take(MAX_SCAN);
      const kept = all.filter((track) => matchesAll(track, filters));
      total = kept.length;
      rows = kept.slice(offset, offset + pageSize);
      hasMore = offset + rows.length < kept.length;
    } else {
      /* Plain browse: this page and one row beyond it, which is all "is there a
         next page" needs. */
      const window = await ctx.db
        .query("audioTracks")
        .withIndex("by_kind_title", (q) => q.eq("kind", args.kind))
        .take(offset + pageSize + 1);
      rows = window.slice(offset, offset + pageSize);
      hasMore = window.length > offset + pageSize;
    }

    return {
      items: await Promise.all(rows.map((track) => serialise(ctx, track))),
      page,
      pageSize,
      total,
      hasMore,
    };
  },
});

/* ── Playback ──────────────────────────────────────────────────────────── */

/* Anything closer to expiry than this is refreshed before it is handed out: a
   URL that dies while the panel is previewing it looks like a broken track. */
const REFRESH_MARGIN_MS = 15 * 60 * 1000;

/* The return type is spelled out because `getPlayableUrl`, in this file, calls
   this query: without it TypeScript walks into the action's own inferred type
   and gives up. */
type PlaybackRow = (PlayableTrack & { externalId: string }) | null;

export const playbackRow = internalQuery({
  args: { trackId: v.id("audioTracks") },
  handler: async (ctx, { trackId }): Promise<PlaybackRow> => {
    await requireUser(ctx);
    const track = await ctx.db.get(trackId);
    return track ? { ...(await serialise(ctx, track)), externalId: track.externalId } : null;
  },
});

export const storeRefreshedUrl = internalMutation({
  args: {
    trackId: v.id("audioTracks"),
    previewUrl: v.string(),
    previewExpiresAt: v.optional(v.number()),
    duration: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, { trackId, previewUrl, previewExpiresAt, duration }) => {
    const track = await ctx.db.get(trackId);
    if (!track) return null;
    await ctx.db.patch(trackId, {
      previewUrl,
      previewExpiresAt,
      duration: duration ?? track.duration,
      fetchedAt: Date.now(),
    });
    return null;
  },
});

/*
  The URL to play, guaranteed live at the moment it is returned.

  The nightly run refreshes every row, so this is almost always a cache read.
  It earns its keep the rest of the time: a track indexed six days ago, a run
  that skipped a page, a deployment restored from a backup — all of which end
  with a signed URL that Soundstripe's CDN will refuse, and none of which the
  panel can tell apart from a broken file.
*/
export const getPlayableUrl = action({
  args: { trackId: v.id("audioTracks") },
  returns: v.object({
    url: v.string(),
    expiresAt: v.union(v.number(), v.null()),
    refreshed: v.boolean(),
  }),
  handler: async (ctx, { trackId }): Promise<{ url: string; expiresAt: number | null; refreshed: boolean }> => {
    const track: PlaybackRow = await ctx.runQuery(internal.audio.library.playbackRow, { trackId });
    if (!track) throw new ConvexError({ kind: "audio", code: "not-found", message: "No such track" });

    const now = Date.now();
    const cached = track.previewUrl;
    if (cached && (track.previewExpiresAt ?? Infinity) - now > REFRESH_MARGIN_MS) {
      return { url: cached, expiresAt: track.previewExpiresAt, refreshed: false };
    }

    /* A `cc0` upload with no file, or any provider we cannot re-sign for. */
    if (track.provider !== "soundstripe" || !hasApiKey()) {
      if (cached) return { url: cached, expiresAt: track.previewExpiresAt, refreshed: false };
      throw new ConvexError({
        kind: "audio",
        code: "unplayable",
        message: `No playable file for this ${track.provider} track`,
      });
    }

    const fresh =
      track.kind === "music" ? await getSong(track.externalId, now) : await getSoundEffect(track.externalId, now);
    if (!fresh.previewUrl) {
      throw new ConvexError({
        kind: "audio",
        code: "unplayable",
        message: "Soundstripe returned no audio file for this track",
      });
    }

    const expiresAt = fresh.previewExpiresAt ?? expiryOf(fresh.previewUrl, now) ?? null;
    await ctx.runMutation(internal.audio.library.storeRefreshedUrl, {
      trackId,
      previewUrl: fresh.previewUrl,
      previewExpiresAt: expiresAt ?? undefined,
      duration: fresh.duration,
    });
    return { url: fresh.previewUrl, expiresAt, refreshed: true };
  },
});
