import { v } from "convex/values";

import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import {
  memberUserInput,
  orgInput,
  userInput,
  type ClerkOrganization,
  type ClerkOrganizationMembership,
  type ClerkUser,
} from "./payloads";

/*
  One-shot reconciliation of the mirror against Clerk's Backend API:

      npx convex run clerk/backfill:run

  The webhook endpoint existed before this code did, so the first deliveries
  failed and those users, orgs and memberships would never be mirrored. This
  pages Clerk and upserts everything it finds, which also makes it the repair
  tool for any future gap (a deployment that was down, an event Clerk gave up
  retrying). It is idempotent — the mirror mutations are all upserts — so
  running it again is free.

  `CLERK_SECRET_KEY` must be set on the Convex deployment
  (`npx convex env set CLERK_SECRET_KEY …`); the app's Vercel env is not visible
  here.
*/

const API = "https://api.clerk.com/v1";
const PAGE = 100;

async function clerkGet<T>(path: string, params: Record<string, string | number>): Promise<T[]> {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) throw new Error("CLERK_SECRET_KEY is not set on this deployment");

  const url = new URL(`${API}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Clerk ${path} responded ${response.status}: ${await response.text()}`);
  }
  /* Some Clerk list endpoints return a bare array, others `{ data, total_count }`. */
  const body = (await response.json()) as T[] | { data: T[] };
  return Array.isArray(body) ? body : body.data;
}

/* Offset paging, stopping on the first short page. Clerk caps `limit` at 500;
   100 keeps each request small enough to stay well inside the action timeout. */
async function* pages<T>(path: string, params: Record<string, string | number> = {}) {
  for (let offset = 0; ; offset += PAGE) {
    const page = await clerkGet<T>(path, { ...params, limit: PAGE, offset });
    for (const item of page) yield item;
    if (page.length < PAGE) return;
  }
}

export const run = internalAction({
  args: {},
  returns: v.object({ users: v.number(), organizations: v.number(), memberships: v.number() }),
  handler: async (ctx) => {
    let users = 0;
    let organizations = 0;
    let memberships = 0;

    for await (const user of pages<ClerkUser>("/users")) {
      await ctx.runMutation(internal.clerk.mirror.upsertUser, userInput(user));
      users += 1;
    }

    /* Memberships are fetched per organisation: Clerk has no account-wide
       membership list, and the per-org payload carries the org and the user, so
       each upsert can stand on its own. */
    for await (const org of pages<ClerkOrganization>("/organizations")) {
      await ctx.runMutation(internal.clerk.mirror.upsertOrg, orgInput(org));
      organizations += 1;

      for await (const membership of pages<ClerkOrganizationMembership>(
        `/organizations/${org.id}/memberships`,
      )) {
        const member = membership.public_user_data;
        if (!member?.user_id) continue;
        await ctx.runMutation(internal.clerk.mirror.upsertMembership, {
          org: orgInput(org),
          user: memberUserInput(member),
          role: membership.role,
        });
        memberships += 1;
      }
    }

    console.info(`Backfilled ${users} users, ${organizations} organisations, ${memberships} memberships`);
    return { users, organizations, memberships };
  },
});
