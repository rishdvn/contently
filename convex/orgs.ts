import { v } from "convex/values";

import { query } from "./_generated/server";
import { tryOrg, tryUser } from "./lib/auth";

/*
  Read-only views of the Clerk mirror. Organisations are created and edited in
  Clerk, so there are no mutations here — the webhook and the backfill are the
  only writers.
*/

/* The orgs the signed-in user is a member of, with their role. The client has
   the same list from Clerk; this one proves the mirror agrees, which is what
   every other function authorises against. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await tryUser(ctx);
    if (!user) return [];

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const orgs = await Promise.all(
      memberships.map(async (membership) => {
        const org = await ctx.db.get(membership.orgId);
        return org ? { id: org._id, clerkOrgId: org.clerkOrgId, name: org.name, slug: org.slug, role: membership.role } : null;
      }),
    );
    return orgs.filter((org) => org !== null).sort((a, b) => a.name.localeCompare(b.name));
  },
});

/* One org, by its Clerk id — `null` unless the caller is a member. */
export const get = query({
  args: { orgId: v.string() },
  handler: async (ctx, { orgId }) => {
    const context = await tryOrg(ctx, orgId);
    if (!context) return null;
    const { org, membership } = context;
    return {
      id: org._id,
      clerkOrgId: org.clerkOrgId,
      name: org.name,
      slug: org.slug,
      imageUrl: org.imageUrl,
      role: membership.role,
    };
  },
});
