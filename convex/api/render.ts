import { v } from "convex/values";

import { checkRenderQuota, dayKey, limitsFor } from "../../lib/api/limits";
import type { Id } from "../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx } from "../_generated/server";
import { enqueueJob, viewWithUrls } from "../render";

import { apiFail } from "./errors";

/*
  Renders through the public API: the same queue and the same rules as the
  studio's Export (`render.ts`); the render worker cannot tell the two apart.

  Unlike Export, a key is held to a quota (`lib/api/limits.ts`): so many
  renders a UTC day, counted in `apiUsage`, and so many of the organisation's
  jobs queued or running at once, Export's included, since both share the
  worker. Past either it is 429 with `Retry-After`.
*/

/* The organisation's jobs waiting for or on the worker. Few at any time
   across every organisation, so the status index is the short way in. */
async function inFlight(ctx: MutationCtx, orgId: Id<"organizations">) {
  let n = 0;
  for (const status of ["queued", "running"] as const) {
    const jobs = await ctx.db
      .query("renderJobs")
      .withIndex("by_status", (q) => q.eq("status", status))
      .collect();
    n += jobs.filter((job) => job.orgId === orgId).length;
  }
  return n;
}

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
    const now = Date.now();
    const day = dayKey(now);
    const usage = await ctx.db
      .query("apiUsage")
      .withIndex("by_org_day", (q) => q.eq("orgId", orgId).eq("day", day))
      .unique();
    const decision = checkRenderQuota({ usedToday: usage?.renders ?? 0, inFlight: await inFlight(ctx, orgId), now, quota: limitsFor().render });
    if (!decision.ok) apiFail("quota_exceeded", decision.message, undefined, decision.retryAfter);

    const id = await enqueueJob(ctx, orgId, userId, job);
    /* Counted once the job is in: a render refused as invalid costs nothing. */
    if (usage) await ctx.db.patch(usage._id, { renders: usage.renders + 1 });
    else await ctx.db.insert("apiUsage", { orgId, day, renders: 1 });
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
