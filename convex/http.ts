import { httpRouter } from "convex/server";
import { Webhook } from "svix";

import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import {
  memberUserInput,
  orgInput,
  userInput,
  type ClerkOrganization,
  type ClerkOrganizationMembership,
  type ClerkUser,
} from "./clerk/payloads";

/*
  Clerk webhook → mirror tables. The endpoint is
  `https://<deployment>.convex.site/clerk`, registered in the Clerk dashboard.

  Two properties matter more than the mapping itself:

  - Signatures are verified with `CLERK_WEBHOOK_SECRET` (a deployment env var)
    before the body is parsed. An unverified body is not data, it is input.
  - Only a signature failure is answered with a non-2xx. Everything else — an
    event type we do not mirror, a payload missing a field — returns 200, because
    Clerk retries non-2xx for hours and a replay cannot fix a payload we will
    never understand. The backfill action is the recovery path for gaps.
*/

type ClerkEvent =
  | { type: "user.created" | "user.updated"; data: ClerkUser }
  | { type: "user.deleted"; data: { id: string } }
  | { type: "organization.created" | "organization.updated"; data: ClerkOrganization }
  | { type: "organization.deleted"; data: { id: string } }
  | {
      type: "organizationMembership.created" | "organizationMembership.updated";
      data: ClerkOrganizationMembership;
    }
  | { type: "organizationMembership.deleted"; data: ClerkOrganizationMembership }
  | { type: string; data: Record<string, unknown> };

function verify(body: string, request: Request): ClerkEvent | null {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    console.error("CLERK_WEBHOOK_SECRET is not set on this deployment; refusing the delivery");
    return null;
  }
  try {
    new Webhook(secret).verify(body, {
      "svix-id": request.headers.get("svix-id") ?? "",
      "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
      "svix-signature": request.headers.get("svix-signature") ?? "",
    });
  } catch (error) {
    console.error("Rejected a Clerk delivery with a bad signature", error);
    return null;
  }
  return JSON.parse(body) as ClerkEvent;
}

const clerkWebhook = httpAction(async (ctx, request) => {
  const event = verify(await request.text(), request);
  if (!event) return new Response("Invalid signature", { status: 400 });

  switch (event.type) {
    case "user.created":
    case "user.updated": {
      await ctx.runMutation(internal.clerk.mirror.upsertUser, userInput(event.data as ClerkUser));
      break;
    }
    case "user.deleted": {
      const { id } = event.data as { id?: string };
      /* Clerk sends `user.deleted` without an id for users it never fully
         created; there is nothing to delete in that case. */
      if (id) await ctx.runMutation(internal.clerk.mirror.deleteUser, { clerkUserId: id });
      break;
    }
    case "organization.created":
    case "organization.updated": {
      await ctx.runMutation(internal.clerk.mirror.upsertOrg, orgInput(event.data as ClerkOrganization));
      break;
    }
    case "organization.deleted": {
      const { id } = event.data as { id?: string };
      if (id) await ctx.runMutation(internal.clerk.mirror.deleteOrg, { clerkOrgId: id });
      break;
    }
    case "organizationMembership.created":
    case "organizationMembership.updated": {
      const data = event.data as ClerkOrganizationMembership;
      if (!data.public_user_data?.user_id || !data.organization?.id) {
        console.error(`${event.type} without an organisation or user; ignoring`);
        break;
      }
      await ctx.runMutation(internal.clerk.mirror.upsertMembership, {
        org: orgInput(data.organization),
        user: memberUserInput(data.public_user_data),
        role: data.role,
      });
      break;
    }
    case "organizationMembership.deleted": {
      const data = event.data as ClerkOrganizationMembership;
      if (!data.public_user_data?.user_id || !data.organization?.id) break;
      await ctx.runMutation(internal.clerk.mirror.deleteMembership, {
        clerkOrgId: data.organization.id,
        clerkUserId: data.public_user_data.user_id,
      });
      break;
    }
    default:
      console.info(`Clerk event ${event.type} is not mirrored; ignoring`);
  }

  return new Response(null, { status: 200 });
});

const http = httpRouter();

http.route({ path: "/clerk", method: "POST", handler: clerkWebhook });

export default http;
