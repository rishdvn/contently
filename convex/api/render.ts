import { v } from "convex/values";

import { internalMutation, internalQuery } from "../_generated/server";
import { enqueueJob, viewWithUrls } from "../render";

/*
  Renders through the public API: the same queue and the same rules as the
  studio's Export (`render.ts`); the render worker cannot tell the two apart.
*/

const format = v.union(v.literal("png"), v.literal("carousel-zip"), v.literal("mp4"));

export const enqueue = internalMutation({
  args: {
    orgId: v.id("organizations"),
    userId: v.id("users"),
    projectId: v.string(),
    format,
    scene: v.optional(v.number()),
    scale: v.optional(v.number()),
    fps: v.optional(v.number()),
  },
  handler: async (ctx, { orgId, userId, ...job }) => {
    const id = await enqueueJob(ctx, orgId, userId, job);
    return await viewWithUrls(ctx, (await ctx.db.get(id))!);
  },
});

/* One job and, once it is done, its files. Null for another organisation's. */
export const job = internalQuery({
  args: { orgId: v.id("organizations"), id: v.string() },
  handler: async (ctx, { orgId, id }) => {
    const jobId = ctx.db.normalizeId("renderJobs", id);
    const row = jobId ? await ctx.db.get(jobId) : null;
    if (!row || row.orgId !== orgId) return null;
    /* Where it stands in the queue, so a caller can tell "waiting" from "stuck". */
    const ahead =
      row.status === "queued"
        ? (await ctx.db
            .query("renderJobs")
            .withIndex("by_status", (q) => q.eq("status", "queued"))
            .collect()).filter((other) => other._creationTime < row._creationTime).length
        : undefined;
    return { ...(await viewWithUrls(ctx, row)), ...(ahead !== undefined ? { queuePosition: ahead } : {}) };
  },
});
