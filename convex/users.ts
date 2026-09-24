import { query } from "./_generated/server";
import { tryUser } from "./lib/auth";

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
    return { id: user._id, clerkUserId: user.clerkUserId, name: user.name, email: user.email, imageUrl: user.imageUrl };
  },
});
