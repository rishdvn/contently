import { v } from "convex/values";

import { internalMutation, type MutationCtx } from "../_generated/server";

/*
  The writes that keep `organizations`, `users` and `memberships` in step with
  Clerk. Both the webhook (`convex/http.ts`) and the backfill
  (`convex/clerk/backfill.ts`) go through here, so there is one definition of
  what a mirrored row looks like.

  Everything is an upsert keyed on the Clerk id, for two reasons: webhook
  deliveries arrive out of order and can be replayed, and the backfill runs over
  rows the webhook may already have written. Running any of this twice must be a
  no-op.
*/

const orgFields = {
  clerkOrgId: v.string(),
  name: v.optional(v.string()),
  slug: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
};

const userFields = {
  clerkUserId: v.string(),
  name: v.optional(v.string()),
  email: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
};

type OrgInput = { clerkOrgId: string; name?: string; slug?: string; imageUrl?: string };
type UserInput = { clerkUserId: string; name?: string; email?: string; imageUrl?: string };

/* Fields absent from an event are left as they are rather than blanked: a
   membership event carries a thinner org/user than the org/user events do. */
function defined<T extends object>(patch: T): Partial<T> {
  return Object.fromEntries(Object.entries(patch).filter(([, x]) => x !== undefined)) as Partial<T>;
}

async function upsertOrgRow(ctx: MutationCtx, input: OrgInput) {
  const existing = await ctx.db
    .query("organizations")
    .withIndex("by_clerkOrgId", (q) => q.eq("clerkOrgId", input.clerkOrgId))
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, defined({ name: input.name, slug: input.slug, imageUrl: input.imageUrl }));
    return existing._id;
  }
  return await ctx.db.insert("organizations", {
    clerkOrgId: input.clerkOrgId,
    name: input.name ?? input.slug ?? "Untitled organisation",
    slug: input.slug,
    imageUrl: input.imageUrl,
  });
}

async function upsertUserRow(ctx: MutationCtx, input: UserInput) {
  const existing = await ctx.db
    .query("users")
    .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", input.clerkUserId))
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, defined({ name: input.name, email: input.email, imageUrl: input.imageUrl }));
    return existing._id;
  }
  return await ctx.db.insert("users", {
    clerkUserId: input.clerkUserId,
    name: input.name,
    email: input.email,
    imageUrl: input.imageUrl,
  });
}

export const upsertOrg = internalMutation({
  args: orgFields,
  handler: async (ctx, args) => {
    await upsertOrgRow(ctx, args);
  },
});

export const upsertUser = internalMutation({
  args: userFields,
  handler: async (ctx, args) => {
    const userId = await upsertUserRow(ctx, args);
    /*
      Personal org: Clerk sends `user.created` before the user has any
      membership, and we do not create orgs server-side — the client does it
      through Clerk on first load, so that Clerk stays the source of truth and
      the mirror only ever follows. Noted in the logs so a user who somehow
      never gets one is visible here.
    */
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!membership) {
      console.info(`user ${args.clerkUserId} has no org membership; awaiting a personal org from the client`);
    }
  },
});

/*
  Memberships carry a copy of the org and the user, so a membership event that
  overtakes its `organization.created` / `user.created` still lands with enough
  to create the rows it needs.
*/
export const upsertMembership = internalMutation({
  args: {
    org: v.object(orgFields),
    user: v.object(userFields),
    role: v.string(),
  },
  handler: async (ctx, { org, user, role }) => {
    const orgId = await upsertOrgRow(ctx, org);
    const userId = await upsertUserRow(ctx, user);

    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", userId))
      .unique();
    if (existing) {
      if (existing.role !== role) await ctx.db.patch(existing._id, { role });
      return;
    }
    await ctx.db.insert("memberships", { orgId, userId, role });
  },
});

export const deleteMembership = internalMutation({
  args: { clerkOrgId: v.string(), clerkUserId: v.string() },
  handler: async (ctx, { clerkOrgId, clerkUserId }) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_clerkOrgId", (q) => q.eq("clerkOrgId", clerkOrgId))
      .unique();
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", clerkUserId))
      .unique();
    if (!org || !user) return;

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) => q.eq("orgId", org._id).eq("userId", user._id))
      .unique();
    if (membership) await ctx.db.delete(membership._id);
  },
});

/*
  Deletes remove the mirror row and the memberships that pointed at it, which is
  enough to cut off access: `requireOrg` fails the moment either is gone. The
  org's projects and media are deliberately left in place — purging an
  organisation's content is a retention decision, not something a webhook should
  do on its own.
*/
export const deleteOrg = internalMutation({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_clerkOrgId", (q) => q.eq("clerkOrgId", clerkOrgId))
      .unique();
    if (!org) return;
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .collect();
    for (const membership of memberships) await ctx.db.delete(membership._id);
    await ctx.db.delete(org._id);
  },
});

export const deleteUser = internalMutation({
  args: { clerkUserId: v.string() },
  handler: async (ctx, { clerkUserId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", clerkUserId))
      .unique();
    if (!user) return;
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const membership of memberships) await ctx.db.delete(membership._id);
    await ctx.db.delete(user._id);
  },
});
