import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/*
  Every query and mutation starts here. Two rules:

  1. There is a signed-in Clerk user, and we have mirrored them (`requireUser`).
  2. For anything org-owned, that user is a member of the org being asked about
     (`requireOrg`).

  Callers pass the *Clerk* org id — it is what `useAuth().orgId` and the API key
  lookups have — and get back the mirrored row whose `_id` is the `orgId` stored
  on documents. Passing it from the client is safe because the membership check
  below is what grants access; the argument only selects which org, it never
  proves anything.

  `QueryCtx` is enough for both: mutations' ctx is a superset, and neither helper
  writes. Actions have no `db`, so they authorise by calling a query/mutation.
*/

export class AuthError extends Error {}

/* Thrown as `ConvexError`-free plain errors: the client only ever needs to know
   that it was not allowed, and Convex logs the message server-side. */
function deny(message: string): never {
  throw new AuthError(message);
}

export async function requireUser(ctx: QueryCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) deny("Not signed in");

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
    .unique();

  /* The mirror is eventually consistent: a brand-new user can reach a query
     before Clerk's `user.created` webhook lands. Saying so beats a generic
     failure, and the client can retry. */
  if (!user) deny(`No mirrored user for ${identity.subject} yet`);
  return user;
}

export type OrgContext = {
  user: Doc<"users">;
  org: Doc<"organizations">;
  membership: Doc<"memberships">;
};

export async function requireOrg(ctx: QueryCtx, clerkOrgId: string): Promise<OrgContext> {
  const user = await requireUser(ctx);

  const org = await ctx.db
    .query("organizations")
    .withIndex("by_clerkOrgId", (q) => q.eq("clerkOrgId", clerkOrgId))
    .unique();
  /* Deliberately the same shape of failure as "not a member": whether an org
     exists is not something a non-member should be able to probe. */
  if (!org) deny("No access to this organisation");

  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_org_user", (q) => q.eq("orgId", org._id).eq("userId", user._id))
    .unique();
  if (!membership) deny("No access to this organisation");

  return { user, org, membership };
}

/*
  Same checks, but for read paths that would rather return nothing than fail —
  the hub renders while Clerk is still switching orgs, and a thrown error there
  would blank the page. Only our own `AuthError` is swallowed; a real failure
  still propagates.
*/
async function orNull<T>(check: Promise<T>): Promise<T | null> {
  try {
    return await check;
  } catch (error) {
    if (error instanceof AuthError) return null;
    throw error;
  }
}

export const tryUser = (ctx: QueryCtx) => orNull(requireUser(ctx));

export const tryOrg = (ctx: QueryCtx, clerkOrgId: string) => orNull(requireOrg(ctx, clerkOrgId));
