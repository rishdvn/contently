import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireUser, tryUser } from "./lib/auth";

/*
  Who the caller is, as the mirror sees them. `null` covers both "signed out" and
  "signed in, but Clerk's `user.created` has not landed yet", which the client
  treats the same way: keep waiting.
*/
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const user = await tryUser(ctx);
    if (!user) return null;
    return { id: user._id, clerkUserId: user.clerkUserId, name: user.name, email: user.email, imageUrl: user.imageUrl, flags: user.flags ?? {} };
  },
});

/* The flags a client may set. A closed list, so the record stays small and a
   typo is an error rather than a new key. */
export const USER_FLAGS = ["templatesHintDismissed"] as const;
export type UserFlag = (typeof USER_FLAGS)[number];

export const setFlag = mutation({
  args: { flag: v.union(...USER_FLAGS.map((f) => v.literal(f))), value: v.boolean() },
  handler: async (ctx, { flag, value }) => {
    const user = await requireUser(ctx);
    await ctx.db.patch(user._id, { flags: { ...user.flags, [flag]: value } });
  },
});
