import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { requireOrg, tryOrg } from "./lib/auth";

/*
  API keys: how a script or an AI reaches the public API (`convex/api/`) on an
  organisation's behalf, without a Clerk session.

  - A key is `ctly_` + 32 random base64url characters, made in an action
    (actions draw real randomness; queries and mutations are deterministic)
    and shown once. Only its SHA-256 is stored, so a leaked database row is
    not a key.
  - A key belongs to one organisation and acts as the member who made it:
    new projects and uploads are theirs. If that member leaves the
    organisation, their keys stop working with them.
  - Every member can make, list and revoke the organisation's keys — a key
    can do nothing its maker cannot already do in the studio.
  - Each key may make `RATE_LIMIT` requests a minute; the API answers 429
    past that.
*/

export const KEY_PREFIX = "ctly_";
export const RATE_LIMIT = 60;
const WINDOW_MS = 60_000;

export type ApiKeyDenial = { kind: "apiKey"; code: "missing" | "invalid"; message: string };

function fail(code: ApiKeyDenial["code"], message: string): never {
  throw new ConvexError({ kind: "apiKey", code, message } satisfies ApiKeyDenial);
}

export async function hashKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function newKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return KEY_PREFIX + btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/* The organisation's live keys, newest first. Never the keys themselves. */
export const list = query({
  args: { orgId: v.string() },
  handler: async (ctx, { orgId }) => {
    const context = await tryOrg(ctx, orgId);
    if (!context) return [];
    const rows = await ctx.db
      .query("apiKeys")
      .withIndex("by_org", (q) => q.eq("orgId", context.org._id))
      .order("desc")
      .collect();
    return await Promise.all(
      rows
        .filter((row) => !row.revokedAt)
        .map(async (row) => {
          const maker = await ctx.db.get(row.createdBy);
          return {
            id: row._id,
            label: row.label,
            start: row.start ?? KEY_PREFIX,
            createdAt: row._creationTime,
            createdBy: maker?.name ?? maker?.email ?? null,
            lastUsedAt: row.lastUsedAt ?? null,
          };
        }),
    );
  },
});

/*
  Make a key. The answer is the only time the key exists outside the caller's
  hands: the database keeps its hash.
*/
export const create = action({
  args: { orgId: v.string(), label: v.string() },
  handler: async (ctx, { orgId, label }): Promise<{ id: Id<"apiKeys">; key: string; label: string; start: string }> => {
    const name = label.trim();
    if (!name) fail("invalid", "Give the key a name, so you can tell it apart later");
    if (name.length > 60) fail("invalid", "Key names are at most 60 characters");
    const key = newKey();
    const start = key.slice(0, KEY_PREFIX.length + 4);
    const id: Id<"apiKeys"> = await ctx.runMutation(internal.apiKeys.insert, { orgId, label: name, hash: await hashKey(key), start });
    return { id, key, label: name, start };
  },
});

/* The action's write. The caller's identity carries through `runMutation`, so
   the membership check is the same one every mutation makes. */
export const insert = internalMutation({
  args: { orgId: v.string(), label: v.string(), hash: v.string(), start: v.string() },
  handler: async (ctx, { orgId, label, hash, start }) => {
    const { org, user } = await requireOrg(ctx, orgId);
    return await ctx.db.insert("apiKeys", { orgId: org._id, label, hash, start, createdBy: user._id });
  },
});

/* Stops working at once; the row stays, so `lastUsedAt` is still there to read. */
export const revoke = mutation({
  args: { orgId: v.string(), id: v.string() },
  handler: async (ctx, { orgId, id }) => {
    const { org } = await requireOrg(ctx, orgId);
    const keyId = ctx.db.normalizeId("apiKeys", id);
    const row = keyId ? await ctx.db.get(keyId) : null;
    if (!row || row.orgId !== org._id || row.revokedAt) fail("missing", "No such key in this organisation");
    await ctx.db.patch(row._id, { revokedAt: Date.now() });
  },
});

export type Authenticated =
  | { ok: true; keyId: Id<"apiKeys">; orgId: Id<"organizations">; userId: Id<"users">; limit: number; remaining: number; reset: number }
  | { ok: false; code: "unauthorized"; message: string }
  | { ok: false; code: "rate_limited"; message: string; limit: number; reset: number };

/*
  One API request's key check: the key exists, is not revoked, its maker is
  still in its organisation, and it has requests left this minute. Counting
  and `lastUsedAt` are written here, in the same transaction as the check, so
  two requests racing for the last slot cannot both get it.
*/
export const authenticate = internalMutation({
  args: { hash: v.string() },
  handler: async (ctx, { hash }): Promise<Authenticated> => {
    const denied = { ok: false, code: "unauthorized", message: "Invalid or revoked API key" } as const;
    const row = await ctx.db
      .query("apiKeys")
      .withIndex("by_hash", (q) => q.eq("hash", hash))
      .unique();
    if (!row || row.revokedAt) return denied;
    const member = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) => q.eq("orgId", row.orgId).eq("userId", row.createdBy))
      .unique();
    if (!member) return denied;

    const now = Date.now();
    const fresh = !row.windowStart || now - row.windowStart >= WINDOW_MS;
    const windowStart = fresh ? now : row.windowStart!;
    const count = (fresh ? 0 : (row.windowCount ?? 0)) + 1;
    const reset = windowStart + WINDOW_MS;
    if (count > RATE_LIMIT) {
      return { ok: false, code: "rate_limited", message: `Rate limit: ${RATE_LIMIT} requests a minute per key`, limit: RATE_LIMIT, reset };
    }
    await ctx.db.patch(row._id, { windowStart, windowCount: count, lastUsedAt: now });
    return { ok: true, keyId: row._id, orgId: row.orgId, userId: row.createdBy, limit: RATE_LIMIT, remaining: RATE_LIMIT - count, reset };
  },
});
