import { ConvexError } from "convex/values";

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

export type AuthDenialCode =
  /* No token, or a token Convex would not accept. */
  | "unauthenticated"
  /* Signed in, but Clerk's `user.created` has not reached the mirror yet. */
  | "unmirrored"
  /* Signed in and mirrored, but not a member of the org asked about. */
  | "forbidden";

export type AuthDenial = { kind: "auth"; code: AuthDenialCode; message: string };

/*
  A `ConvexError` rather than a bare throw: its `data` reaches the client on the
  production deployment too, where plain errors are flattened to "Server Error".
  A client that has to tell "you are not in this org" apart from "the query
  crashed" can only do that if the denial is part of the value.
*/
function deny(code: AuthDenialCode, message: string): never {
  throw new ConvexError({ kind: "auth", code, message } satisfies AuthDenial);
}

export function isAuthDenial(error: unknown): error is ConvexError<AuthDenial> {
  return (
    error instanceof ConvexError &&
    typeof error.data === "object" &&
    error.data !== null &&
    (error.data as { kind?: unknown }).kind === "auth"
  );
}

export async function requireUser(ctx: QueryCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) deny("unauthenticated", "Not signed in");

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
    .unique();

  /* The mirror is eventually consistent: a brand-new user can reach a query
     before Clerk's `user.created` webhook lands. Saying which of the two it is
     lets the client retry instead of treating it as a dead end. */
  if (!user) deny("unmirrored", "This user has not been mirrored from Clerk yet");
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
  /* Deliberately the same failure as "not a member": whether an org exists is
     not something a non-member should be able to probe. */
  if (!org) deny("forbidden", "No access to this organisation");

  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_org_user", (q) => q.eq("orgId", org._id).eq("userId", user._id))
    .unique();
  if (!membership) deny("forbidden", "No access to this organisation");

  return { user, org, membership };
}

/*
  Same checks, but for read paths that would rather return nothing than fail —
  the hub renders while Clerk is still switching orgs, and a thrown error there
  would blank the page. Only a denial is swallowed; a real failure still
  propagates.
*/
async function orNull<T>(check: Promise<T>): Promise<T | null> {
  try {
    return await check;
  } catch (error) {
    if (isAuthDenial(error)) return null;
    throw error;
  }
}

export const tryUser = (ctx: QueryCtx) => orNull(requireUser(ctx));

export const tryOrg = (ctx: QueryCtx, clerkOrgId: string) => orNull(requireOrg(ctx, clerkOrgId));
