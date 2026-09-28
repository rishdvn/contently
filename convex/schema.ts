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
    /* One-off UI state that follows the person across browsers, such as a
       first-run hint they have dismissed. Keys are `USER_FLAGS` in users.ts. */
    flags: v.optional(v.record(v.string(), v.boolean())),
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
    /* `posterKey` of the document the poster was taken from (lib/editor/poster.ts). */
    posterKey: v.optional(v.string()),
    /* Present while "Anyone with the link" is on. The viewer at `/p/<id>` asks
       for it alongside the id, so turning sharing off and on again mints a new
       one and every link handed out before stops working. */
    shareToken: v.optional(v.string()),
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
    /* Videos: a small muted rendition (360 px short edge, six seconds at most)
       that library grids play on hover instead of streaming the master. */
    previewStorageId: v.optional(v.id("_storage")),
    /* Videos: the master's codec as ffprobe names it ("h264", "hevc"). Absent
       until something has probed the file, which for stock means the import
       script has not processed it yet. */
    codec: v.optional(v.string()),
    /* Uploads: the render worker's claim on a clip it is re-encoding to H.264
       (`convex/transcode.ts`), and how many times it has tried. */
    transcode: v.optional(v.object({ attempts: v.number(), claimedAt: v.optional(v.number()), error: v.optional(v.string()) })),
    name: v.string(),
    tags: v.array(v.string()),
    source: v.union(v.literal("upload"), v.literal("stock")),
    /* Provider-scoped id of the asset this row was imported from,
       `<provider>:<id>` (`dupe:a584…`). Unique: it is what makes a re-run of
       the stock import a no-op instead of a second copy. */
    sourceRef: v.optional(v.string()),
    /* What we may do with a stock file. Every row from one provider carries the
       same value, so a licence decision is one indexed query. */
    license: v.optional(v.string()),
    /* Stock only. Our taxonomy slugs (`convex/stock/provider.ts`), not the
       provider's words — those are in `tags` and `aesthetics`. */
    categories: v.optional(v.array(v.string())),
    /* Stock only: the provider's style labels, kept apart from its subject
       labels in `tags`. */
    aesthetics: v.optional(v.array(v.string())),
    /* Stock only: who made it, as the provider names them, and (`url`) their
       page on the provider's site. */
    credit: v.optional(v.object({ name: v.optional(v.string()), handle: v.optional(v.string()), url: v.optional(v.string()) })),
    /* Stock only: the asset's own page on the provider's site. */
    sourceUrl: v.optional(v.string()),
    /* Absent on stock rows, which a script imports rather than a person. */
    createdBy: v.optional(v.id("users")),
  })
    .index("by_org", ["orgId"])
    .index("by_org_kind", ["orgId", "kind"])
    .index("by_source_kind", ["source", "kind"])
    .index("by_sourceRef", ["sourceRef"])
    .index("by_license", ["license"])
    /* Which videos still need a transcode: `codec` absent or not "h264". */
    .index("by_source_kind_codec", ["source", "kind", "codec"])
    /* The API refuses to register a file another row already owns
       (`api/media.create`): a storage id is visible in its URL. */
    .index("by_storageId", ["storageId"]),

  apiKeys: defineTable({
    orgId: v.id("organizations"),
    /* SHA-256 of the key. The key itself is shown once, at creation. */
    hash: v.string(),
    label: v.string(),
    createdBy: v.id("users"),
    lastUsedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    /* The key's first characters (`ctly_Ab3x`), so a person can tell their
       keys apart in the list without the key being recoverable. */
    start: v.optional(v.string()),
    /* Rate limit: a fixed one-minute window per key (`apiKeys.authenticate`). */
    windowStart: v.optional(v.number()),
    windowCount: v.optional(v.number()),
  })
    .index("by_org", ["orgId"])
    /* Authenticating an API request: hash the bearer token, look it up. */
    .index("by_hash", ["hash"]),

  /* What an organisation has used of the public API's daily quotas
     (`lib/api/limits.ts`): one row per organisation per UTC day. */
  apiUsage: defineTable({
    orgId: v.id("organizations"),
    /* `2026-09-28`, UTC. */
    day: v.string(),
    renders: v.number(),
  }).index("by_org_day", ["orgId", "day"]),

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
    /* One scene by index, or every scene when absent. */
    scene: v.optional(v.number()),
    /* Pixel multiplier for stills (1× or 2×), frame rate for video. */
    scale: v.optional(v.number()),
    fps: v.optional(v.number()),
    outputStorageIds: v.array(v.id("_storage")),
    /* Parallel to `outputStorageIds`: what to call each file on the way out.
       Storage ids carry no name and a caller downloading three PNGs needs to
       know which scene each one is. */
    outputNames: v.optional(v.array(v.string())),
    error: v.optional(v.string()),
    /* Set when a worker claims the job; the timeout sweep reads it. */
    claimedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
    /* Claims so far. A job whose worker died is requeued, but not forever. */
    attempts: v.optional(v.number()),
    requestedBy: v.optional(v.id("users")),
    /* 0–1 while the worker renders, so the studio can draw a bar. */
    progress: v.optional(v.number()),
    /* Exported in a studio tab rather than by the worker: a line in the
       project's export history, never queued and with no files to keep. */
    browser: v.optional(v.boolean()),
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
    /* SHA-256 of the document the posters were rendered from. The poster
       script skips a template whose document still hashes to this. */
    postersHash: v.optional(v.string()),
    published: v.boolean(),
    /* Where it came from (`templates.createFromProject`). The org's admins
       are the ones who may update and publish it, and its media is resolved
       against this org for every reader. */
    orgId: v.optional(v.id("organizations")),
    sourceProjectId: v.optional(v.id("projects")),
    createdBy: v.optional(v.id("users")),
    updatedAt: v.optional(v.number()),
  })
    .index("by_published", ["published"])
    .index("by_published_kind", ["published", "kind"])
    .index("by_org", ["orgId"]),

  /* The Blocks panel's pictures of each catalog block, written by
     `scripts/block-previews.ts`. The block itself is code (`lib/blocks/<id>/`);
     this is only what it looks like, rendered by the studio's own exporter. */
  blockAssets: defineTable({
    /* The registered `BlockDefinition.id`. One row per block. */
    blockId: v.string(),
    /* SHA-256 of the block's source and the preview spec. A re-run skips a
       block whose hash has not changed. */
    hash: v.string(),
    /* A few seconds of the block animating, H.264 MP4. */
    previewStorageId: v.id("_storage"),
    /* The static-mode frame, PNG. */
    posterStorageId: v.id("_storage"),
    width: v.number(),
    height: v.number(),
    /* Seconds. */
    duration: v.number(),
    updatedAt: v.number(),
  }).index("by_blockId", ["blockId"]),

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

  /* The Audio flyout's "Recently used", per person and per tab: one row per
     track a user previewed or added, bumped on every use, capped in
     `audio/recent.ts`. The track itself stays in `audioTracks`; a row whose
     track was pruned from the catalog is skipped when read. */
  audioRecent: defineTable({
    userId: v.id("users"),
    kind: v.union(v.literal("music"), v.literal("sfx")),
    trackId: v.id("audioTracks"),
    usedAt: v.number(),
  })
    .index("by_user_kind_usedAt", ["userId", "kind", "usedAt"])
    .index("by_user_track", ["userId", "trackId"]),

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
