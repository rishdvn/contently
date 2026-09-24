import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/*
  Convex is the only datastore. Two groups of tables live here:

  - Mirrors of Clerk (`organizations`, `users`, `memberships`). Clerk owns them;
    the webhook in `http.ts` and the backfill in `clerk/backfill.ts` keep them
    current. Server code authorises by reading `memberships` so no request has
    to call Clerk.
  - Our own data. Everything an organisation owns carries `orgId` — a reference
    to the mirrored `organizations` row, not the Clerk id — and has an index on
    it, because every query is scoped to one org before it filters anything else.

  `kind`, `aspect` and the like are stored as plain strings rather than unions of
  the editor's literals: the document model in `lib/editor/types.ts` is the
  source of truth for those, and a schema that had to be edited in lockstep with
  it would reject documents written by an older deployment mid-rollout.
*/

/* The editor's `Project` JSON (`lib/editor/types.ts`). Validated by the app, not
   here: the block union changes with every block ticket. */
const editorDocument = v.any();

export default defineSchema({
  /* ── Clerk mirrors ─────────────────────────────────────────────────── */

  organizations: defineTable({
    clerkOrgId: v.string(),
    name: v.string(),
    slug: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  }).index("by_clerkOrgId", ["clerkOrgId"]),

  users: defineTable({
    clerkUserId: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  }).index("by_clerkUserId", ["clerkUserId"]),

  memberships: defineTable({
    orgId: v.id("organizations"),
    userId: v.id("users"),
    /* Clerk's role key, e.g. `org:admin` / `org:member`. */
    role: v.string(),
  })
    .index("by_org", ["orgId"])
    .index("by_user", ["userId"])
    /* The authorisation lookup: is this user in this org? */
    .index("by_org_user", ["orgId", "userId"]),

  /* ── Org-owned data ────────────────────────────────────────────────── */

  projects: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
    kind: v.string(), // image | carousel | video
    aspect: v.string(), // 9:16 | 4:5 | 1:1 | 3:4 | 16:9
    width: v.number(),
    height: v.number(),
    document: editorDocument,
    posterStorageId: v.optional(v.id("_storage")),
    /* Kept alongside `_creationTime` because the hub sorts by last edit and
       imported documents bring their own timestamp. */
    updatedAt: v.number(),
    createdBy: v.id("users"),
  })
    .index("by_org", ["orgId"])
    .index("by_org_updatedAt", ["orgId", "updatedAt"]),

  media: defineTable({
    /* Absent on stock: "Our media" is shared by every organisation. */
    orgId: v.optional(v.id("organizations")),
    kind: v.union(v.literal("image"), v.literal("video")),
    storageId: v.id("_storage"),
    width: v.number(),
    height: v.number(),
    duration: v.optional(v.number()),
    /* Poster frame for videos, generated on upload/import. */
    posterStorageId: v.optional(v.id("_storage")),
    name: v.string(),
    tags: v.array(v.string()),
    source: v.union(v.literal("upload"), v.literal("stock")),
    /* Provider-scoped id of the asset this row was imported from. */
    sourceRef: v.optional(v.string()),
    license: v.optional(v.string()),
    /* Absent on stock rows, which a script imports rather than a person. */
    createdBy: v.optional(v.id("users")),
  })
    .index("by_org", ["orgId"])
    .index("by_org_kind", ["orgId", "kind"])
    .index("by_source_kind", ["source", "kind"]),

  apiKeys: defineTable({
    orgId: v.id("organizations"),
    /* SHA-256 of the key. The key itself is shown once, at creation. */
    hash: v.string(),
    label: v.string(),
    createdBy: v.id("users"),
    lastUsedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
  })
    .index("by_org", ["orgId"])
    /* Authenticating an API request: hash the bearer token, look it up. */
    .index("by_hash", ["hash"]),

  renderJobs: defineTable({
    orgId: v.id("organizations"),
    projectId: v.id("projects"),
    format: v.union(v.literal("png"), v.literal("carousel-zip"), v.literal("mp4")),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("done"),
      v.literal("failed"),
    ),
    outputStorageIds: v.array(v.id("_storage")),
    error: v.optional(v.string()),
  })
    .index("by_org", ["orgId"])
    .index("by_project", ["projectId"])
    /* The render worker claims jobs oldest-first. */
    .index("by_status", ["status"]),

  /* ── Shared libraries (not org-scoped) ─────────────────────────────── */

  templates: defineTable({
    name: v.string(),
    kind: v.string(), // image | carousel | video
    aspect: v.string(),
    tags: v.array(v.string()),
    categories: v.array(v.string()),
    document: editorDocument,
    /* One poster per scene, in scene order, so the API and the scene picker can
       show the visual hierarchy instead of guessing from role tags. */
    scenePosters: v.array(v.id("_storage")),
    poster: v.optional(v.id("_storage")),
    published: v.boolean(),
  })
    .index("by_published", ["published"])
    .index("by_published_kind", ["published", "kind"]),

  /* Cache of a stock provider's catalog. Assets we keep are copied into `media`
     with `source: "stock"`; this table only records what the provider returned. */
  stockAssets: defineTable({
    provider: v.string(), // dupe | pexels | …
    kind: v.union(v.literal("image"), v.literal("video")),
    externalId: v.string(),
    url: v.string(),
    thumbUrl: v.optional(v.string()),
    width: v.number(),
    height: v.number(),
    duration: v.optional(v.number()),
    categories: v.array(v.string()),
    /* The search labels that surfaced this asset. */
    queryTerms: v.array(v.string()),
  })
    .index("by_provider_externalId", ["provider", "externalId"])
    .index("by_kind", ["kind"]),

  audioTracks: defineTable({
    provider: v.string(), // soundstripe | cc0
    kind: v.union(v.literal("music"), v.literal("sfx")),
    externalId: v.string(),
    title: v.string(),
    artist: v.optional(v.string()),
    duration: v.optional(v.number()),
    /* Music facets. */
    mood: v.array(v.string()),
    genre: v.array(v.string()),
    bpm: v.optional(v.number()),
    /* Sound-effect facet. Kept apart from `genre` because the two vocabularies
       do not overlap and the panel filters one tab with each. */
    categories: v.array(v.string()),
    /* Everything else worth matching on — instruments, characteristics,
       sub-categories. Searched, never offered as a filter chip. */
    tags: v.array(v.string()),
    /* Title, artist and every facet value in one string, because a Convex
       search index takes a single field. */
    searchText: v.string(),
    /* Soundstripe signs its CDN URLs with a token that expires in seven days,
       so the nightly run refreshes every row and `getPlayableUrl` re-fetches
       anything that went stale in between. Absent on a row whose provider has
       no hosted file (a `cc0` upload plays from `storageId`). */
    previewUrl: v.optional(v.string()),
    previewExpiresAt: v.optional(v.number()),
    /* `cc0` rows are uploads: the audio lives in Convex storage and never
       expires. */
    storageId: v.optional(v.id("_storage")),
    artworkUrl: v.optional(v.string()),
    /* What we are allowed to do with it, and who to credit — `cc0` rows carry
       the source page so the credit survives the seed script. */
    license: v.optional(v.string()),
    attribution: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    fetchedAt: v.number(),
  })
    .index("by_provider_externalId", ["provider", "externalId"])
    .index("by_kind", ["kind"])
    /* Browsing a tab: one index scan in a stable order, no sort in the query. */
    .index("by_kind_title", ["kind", "title"])
    /* Refreshing what the nightly run missed, oldest first. */
    .index("by_provider_fetchedAt", ["provider", "fetchedAt"])
    .searchIndex("by_text", { searchField: "searchText", filterFields: ["kind", "provider"] }),

  /* The filter chips above the audio list. Recomputed at the end of an index
     run rather than derived per request: counting moods across the whole
     catalog on every keystroke would read every track row. */
  audioFacets: defineTable({
    kind: v.union(v.literal("music"), v.literal("sfx")),
    facet: v.union(v.literal("mood"), v.literal("genre"), v.literal("category")),
    /* Sorted by count, descending — the order the chips are shown in. */
    values: v.array(v.object({ value: v.string(), count: v.number() })),
    computedAt: v.number(),
  }).index("by_kind_facet", ["kind", "facet"]),
});
