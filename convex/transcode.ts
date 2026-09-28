import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, type MutationCtx } from "./_generated/server";

/*
  The render worker's second job: re-encoding uploaded videos that not every
  browser can decode to H.264, keeping their media ids. An iPhone records HEVC,
  which Chrome plays only with hardware support: the uploader's Mac shows the
  clip, a teammate's Linux machine shows black, and cloud render always fails.

  The queue is the `media` table itself. An upload whose `codec` is anything
  but "h264" is waiting: HEVC read from the container at upload
  (`lib/editor/sniffVideo.ts`), or no codec at all for a clip uploaded before
  that, or through the API. The worker (`workers/render/src/transcode.ts`)
  claims one, probes it with ffprobe, re-encodes it the way the stock import
  does (H.264 High, SDR, sized to cover 1080×1920), uploads the master and a new
  poster and hands them to `finish`, which swaps them in through
  `media:replaceFiles`, the same id-preserving swap. A clip that turns out to
  be H.264 already is finished with its codec and no new file.

  A claim is a lease. A worker that dies mid-encode loses it after `LEASE_MS`
  and the clip is claimed again, up to `MAX_ATTEMPTS` times; after that it stays
  as uploaded, with the last error on the row (`transcode.error`).

  Every function takes the worker secret in place of a session, as the render
  queue does (`convex/render.ts`).
*/

const LEASE_MS = 20 * 60 * 1000;
const MAX_ATTEMPTS = 3;

/* Length-independent so a mismatch costs the same time whatever it is. */
function sameSecret(a: string, b: string): boolean {
  const bytes = new TextEncoder();
  const left = bytes.encode(a);
  const right = bytes.encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return diff === 0;
}

function requireWorker(secret: string) {
  const expected = process.env.RENDER_WORKER_SECRET;
  if (!expected || !sameSecret(secret, expected)) throw new ConvexError({ kind: "transcode", message: "Not a render worker" });
}

const claimable = (row: Doc<"media">, now: number) =>
  row.codec !== "h264" &&
  (!row.transcode || (row.transcode.attempts < MAX_ATTEMPTS && (!row.transcode.claimedAt || now - row.transcode.claimedAt > LEASE_MS)));

/* Uploaded videos whose codec is not "h264": absent, or either side of it in
   the index's order. */
async function waiting(ctx: MutationCtx) {
  const index = "by_source_kind_codec" as const;
  const [unknown, below, above] = await Promise.all([
    ctx.db.query("media").withIndex(index, (q) => q.eq("source", "upload").eq("kind", "video").eq("codec", undefined)).take(100),
    ctx.db.query("media").withIndex(index, (q) => q.eq("source", "upload").eq("kind", "video").lt("codec", "h264")).take(100),
    ctx.db.query("media").withIndex(index, (q) => q.eq("source", "upload").eq("kind", "video").gt("codec", "h264")).take(100),
  ]);
  const seen = new Set<Id<"media">>();
  return [...above, ...below, ...unknown].filter((row) => !seen.has(row._id) && Boolean(seen.add(row._id)));
}

/*
  The next clip to transcode, with a URL to download it from, or null. Known
  non-H.264 codecs come before clips nobody has probed. `orgId` keeps a worker
  run by hand to one organisation's uploads (`TRANSCODE_ORG_ID`).
*/
export const claim = mutation({
  args: { secret: v.string(), orgId: v.optional(v.id("organizations")) },
  handler: async (ctx, { secret, orgId }) => {
    requireWorker(secret);
    const now = Date.now();
    for (const row of await waiting(ctx)) {
      if ((orgId && row.orgId !== orgId) || !claimable(row, now)) continue;
      const attempts = (row.transcode?.attempts ?? 0) + 1;
      const url = await ctx.storage.getUrl(row.storageId);
      if (!url) {
        await ctx.db.patch(row._id, { transcode: { attempts: MAX_ATTEMPTS, error: "File missing from storage" } });
        continue;
      }
      await ctx.db.patch(row._id, { transcode: { attempts, claimedAt: now } });
      return { id: row._id, storageId: row.storageId, name: row.name, codec: row.codec ?? null, attempts, url };
    }
    return null;
  },
});

/* Where the worker uploads a new master or poster. */
export const uploadUrl = mutation({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    requireWorker(secret);
    return await ctx.storage.generateUploadUrl();
  },
});

/*
  The clip is done: swap in what the worker made (nothing, when it was H.264
  already) and record its codec. `from` is the file the worker encoded from; if
  the row has moved on since, `replaceFiles` deletes the uploads and changes
  nothing. Answers whether the swap happened.
*/
export const finish = mutation({
  args: {
    secret: v.string(),
    id: v.id("media"),
    from: v.id("_storage"),
    storageId: v.optional(v.id("_storage")),
    posterStorageId: v.optional(v.id("_storage")),
    codec: v.string(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    duration: v.optional(v.number()),
  },
  handler: async (ctx, { secret, ...swap }): Promise<boolean> => {
    requireWorker(secret);
    const swapped = await ctx.runMutation(internal.media.replaceFiles, swap);
    if (swapped) await ctx.db.patch(swap.id, { transcode: undefined });
    return swapped;
  },
});

/* An attempt failed. The lease ends now, so the next poll may try again until
   the attempts run out. */
export const fail = mutation({
  args: { secret: v.string(), id: v.id("media"), error: v.string() },
  handler: async (ctx, { secret, id, error }) => {
    requireWorker(secret);
    const row = await ctx.db.get(id);
    if (!row) return;
    await ctx.db.patch(id, { transcode: { attempts: row.transcode?.attempts ?? 1, error: error.slice(0, 500) } });
  },
});
