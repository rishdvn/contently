import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import { mutation, query, type MutationCtx } from "../_generated/server";
import { requireUser } from "../lib/auth";
import { serialise, type PlayableTrack } from "./library";

/*
  The Audio flyout's "Recently used", kept per account the way Butter keeps it,
  so it follows a person to another browser. One row per track per user, bumped
  on every preview or add; the panel reads the newest first.
*/

const KIND = v.union(v.literal("music"), v.literal("sfx"));

/* Enough for "See more"; anything older is dropped as newer tracks arrive. */
const MAX_RECENT = 30;

export const list = query({
  args: { kind: KIND },
  handler: async (ctx, { kind }): Promise<PlayableTrack[]> => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("audioRecent")
      .withIndex("by_user_kind_usedAt", (q) => q.eq("userId", user._id).eq("kind", kind))
      .order("desc")
      .take(MAX_RECENT);
    const tracks = await Promise.all(rows.map((row) => ctx.db.get(row.trackId)));
    /* A track the nightly index pruned has gone from the catalog; so has its row
       here, as far as anyone can see. */
    return await Promise.all(tracks.filter((track) => track !== null).map((track) => serialise(ctx, track)));
  },
});

async function touch(ctx: MutationCtx, userId: Id<"users">, trackId: Id<"audioTracks">, usedAt: number) {
  const track = await ctx.db.get(trackId);
  if (!track) return;
  const existing = await ctx.db
    .query("audioRecent")
    .withIndex("by_user_track", (q) => q.eq("userId", userId).eq("trackId", trackId))
    .unique();
  if (existing) {
    if (existing.usedAt < usedAt) await ctx.db.patch(existing._id, { usedAt });
  } else {
    await ctx.db.insert("audioRecent", { userId, kind: track.kind, trackId, usedAt });
  }
}

async function prune(ctx: MutationCtx, userId: Id<"users">, kind: "music" | "sfx") {
  const stale = await ctx.db
    .query("audioRecent")
    .withIndex("by_user_kind_usedAt", (q) => q.eq("userId", userId).eq("kind", kind))
    .order("desc")
    .collect();
  for (const row of stale.slice(MAX_RECENT)) await ctx.db.delete(row._id);
}

/* A preview started or a track added: it moves to the front of its tab. */
export const remember = mutation({
  args: { trackId: v.id("audioTracks") },
  returns: v.null(),
  handler: async (ctx, { trackId }) => {
    const user = await requireUser(ctx);
    const track = await ctx.db.get(trackId);
    if (!track) return null;
    await touch(ctx, user._id, trackId, Date.now());
    await prune(ctx, user._id, track.kind);
    return null;
  },
});

/*
  What a browser remembered before the list moved to the account, carried over
  once. Newest first, as it was stored; each lands just behind anything the
  account already has from the same moment, and never ahead of a newer use.
  Ids that are not (or are no longer) catalog tracks are skipped.
*/
export const importLocal = mutation({
  args: { trackIds: v.array(v.string()) },
  returns: v.number(),
  handler: async (ctx, { trackIds }) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    const kinds = new Set<"music" | "sfx">();
    let imported = 0;
    for (const [i, raw] of trackIds.slice(0, MAX_RECENT * 2).entries()) {
      const trackId = ctx.db.normalizeId("audioTracks", raw);
      const track = trackId ? await ctx.db.get(trackId) : null;
      if (!trackId || !track) continue;
      /* A millisecond apart keeps the browser's order. */
      await touch(ctx, user._id, trackId, now - 60_000 - i);
      kinds.add(track.kind);
      imported++;
    }
    for (const kind of kinds) await prune(ctx, user._id, kind);
    return imported;
  },
});
