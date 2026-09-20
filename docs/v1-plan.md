# Contently V1 — plan

V1 is: a library of templates, a studio that works end to end for images, carousels and videos, and a way for a person or an AI (via MCP/API) to take a template and replace its content with on-brand content for an organisation.

Everything below is written to be turned into Linear tickets. Each ticket carries: **Goal**, **Reference** (what to look at first), **Files** (expected touch points, to spot conflicts), **Verify** (the feedback loop the agent must complete before the PR is ready) and **Depends on**. Tickets in the same phase without a dependency arrow can run in parallel.

Quality rule for every ticket: the job is not done when the code exists. It is done when the agent has used the running app (headless Playwright and, for anything visual, the desktop browser) to show the behaviour end to end, compared it against the reference where one exists, and attached the evidence to the PR. Fewer things done properly beat more things done loosely.

---

## 0. Scope

**In:** Clerk auth with organisations (an organisation = a brand). Convex for all data and file storage. Nav: Templates · Projects · Media. Studio rail: Templates · Blocks · Text · Stock · Audio · Uploads. Templates with per-scene picking. A block platform with a small, high-quality catalog of blocks and text blocks that work in both static and video modes. Stock photos/videos with an organic-content taxonomy. Music and sound effects. Org media library. A REST API and an MCP server that let an AI pick a template, understand its content slots, replace them, and render.

**Out (V1):** Build (code blocks), Captions, BrandKit, Comments, Variations, Figma import, keyframes, creator blocks marketplace, real-time collaboration.

---

## 1. Architecture

### Stack
- Next.js (existing) on Vercel.
- **Clerk** for auth, with Organizations enabled. The org switcher and user button live bottom-left in the nav (replacing "Personal · Local workspace").
- **Convex** for data, file storage, scheduled jobs (stock/audio indexing) and HTTP actions (public API). Clerk ↔ Convex via Convex's Clerk auth provider (JWT template named `convex`). Org membership is mirrored into Convex with Clerk webhooks so server code can authorise by `orgId` without calling Clerk.
- **Render worker** (small Node service, e.g. Fly.io or a Vercel function with `@sparticuz/chromium`) that opens a headless page of the app in "render mode" and produces PNG (image, carousel slides) and MP4 (video, via the existing WebCodecs exporter running in headless Chrome). Convex schedules jobs; the worker writes results to Convex storage. Needed because the API/MCP must return finished assets and Convex actions cannot run a browser.
- **MCP server**: a thin Node package (`packages/mcp`) speaking stdio + Streamable HTTP, wrapping the REST API with per-org API keys.

### Data model (Convex)
```
organizations   { clerkOrgId, name, slug, imageUrl }             mirrored from Clerk
users           { clerkUserId, name, email, imageUrl }
memberships     { orgId, userId, role }                          mirrored from Clerk
projects        { orgId, name, kind, aspect, width, height, document: Project(JSON), posterStorageId?, updatedAt, createdBy }
templates       { name, kind, aspect, tags[], categories[], document: Project(JSON) with roles, scenePosters: storageId[], poster: storageId, published }
media           { orgId?, kind: image|video, storageId, width, height, duration?, name, tags[], source: upload|stock, sourceRef?, createdBy }
stockAssets     { provider: pexels, kind, externalId, url, thumbUrl, width, height, duration?, categories[], query terms }   (cache)
audioTracks     { provider: soundstripe, kind: music|sfx, externalId, title, artist, duration, mood[], genre[], bpm?, previewUrl(expiring), fetchedAt }
apiKeys         { orgId, hash, label, createdBy, lastUsedAt }
renderJobs      { orgId, projectId, format, status, outputStorageIds[], error? }
```
The studio keeps its zustand document store; Convex replaces `localStorage` in `lib/editor/persistence.ts` (load/save/list/duplicate/rename/delete become Convex functions, autosave debounced to a mutation).

### Content semantics for AI
Templates get two things so an AI can replace content well:
1. **Roles on blocks** — an optional `role` tag: `heading`, `subheading`, `body`, `benefit`, `cta`, `price`, `brand`, `quote`, `author`, `hook`, `logo`, `image:product`, `image:lifestyle`, `image:background`, `video:background`. Cheap to author, deterministic to consume, and they also drive the inspector ("Heading" label). Blocks inside components expose their schema fields the same way (`caption`, `messages[]`, …).
2. **A rendered poster per scene** — returned by the API alongside the roles, so the AI sees the visual hierarchy rather than guessing from tags.
The MCP ships a short skill document explaining the roles and how to write for each (length limits derived from the current text, tone, what "benefit" means). Roles are guidance, not a cage: `replace_content` accepts either `blockId` or `role`.

### Block platform
A block is a registered React component plus a schema:
```ts
type BlockDefinition = {
  id: string; name: string; category: BlockCategory; tags: string[];
  inputs: InputSchema;                 // composed from the primitives below
  defaults: Props; defaultDuration: number; aspectHint?: "square"|"portrait"|"landscape"|"free";
  render: (props, ctx: { mode: "static"|"video"; progress: 0..1; time: number; width; height }) => ReactNode;
  poster?: { progress: number };       // frame used for static mode and thumbnails (default 1)
  preview: string;                     // storage id / url of the animated preview for the picker
};
```
**Input primitives** (the only ones; every block composes from these): `text` (with `maxLength`, `multiline`), `image`, `video`, `color`, `number` (min/max/step/unit), `select` (options), `boolean`, `list` (item schema + `min`/`max`, reorderable, add/remove), `object` (named fields, for list items). The inspector renders any schema automatically (`components/editor/inspector/SchemaFields.tsx`); no block ships bespoke inspector UI. Examples: a carousel is `list<image>(min 2, max 6)` + `select(transition)` + `number(intervalSeconds)`; iMessage is `list<object{ side: select(sent|received), text, showTimestamp? }>` + `text(contactName)`; AirDrop is `text(title)` + `text(subtitle)` + `image(avatar)` + `text(declineLabel)` + `text(acceptLabel)`.

Document integration: a new block type `component` (`{ type: "component", componentId, props, ... }`) alongside text/image/video/shape. In video projects `progress` comes from the block's `start`/`end`, exactly like `animationStyle` today; in image/carousel projects `mode === "static"` and the poster frame renders. Exports use the same renderer, so static and video output match the canvas.

---

## 2. Phases and tickets

### Phase 0 — Scope trim (parallel-safe, do first)

**T-001 Remove out-of-scope chrome and dead controls**
- Goal: rail shows only Templates · Blocks · Text · Stock · Audio · Uploads; remove Build, Captions, BrandKit tabs and panels; remove the Comments icon, the unexplained toggle and the Export ▾ chevron (Export is one button that opens the dialog); remove Help if it has no target; hub nav becomes Templates · Projects · Media (Explore, Blocks, Favorites, Brandkit, Team go).
- Files: `Rail.tsx`, `LeftPanel.tsx`, `panels/misc.tsx`, `TopBar.tsx`, `components/hub/Hub.tsx`, `store.ts` (`LeftTab` union).
- Verify: every remaining control does something; Playwright walks each rail tab and each top-bar button.

### Phase 1 — Foundation (sequential; everything else waits on it)

**T-010 Clerk auth + organisations**
- Goal: Clerk provider, sign-in/up pages, middleware protecting `/`, `/editor/*`, `/media`, `/templates`; Organizations enabled; `<OrganizationSwitcher>` + `<UserButton>` bottom-left in the nav; personal workspace maps to a personal org.
- Files: `app/layout.tsx`, `middleware.ts`, `app/sign-in`, `components/hub/Hub.tsx` (footer).
- Verify: sign up, create two orgs, switch between them; screenshot of the switcher in place.
- Needs from you: Clerk application (dev + prod instances), Organizations turned on, keys as `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` in Vercel and Cloud Agent secrets.

**T-011 Convex project, schema, Clerk↔Convex auth, org mirroring**
- Goal: `convex/` with the schema above; `ConvexProviderWithClerk`; Clerk webhook (`user.*`, `organization.*`, `organizationMembership.*`) → Convex HTTP action keeping `organizations/users/memberships` current; helper `requireOrg(ctx)` used by every function.
- Files: `convex/*`, `app/providers.tsx`.
- Verify: webhook delivers in the Clerk dashboard test tool; `npx convex dev` types pass; a query under the wrong org returns nothing.
- Needs from you: Convex team/project (or let the agent create one with a deploy key), `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`, `CLERK_WEBHOOK_SECRET`, the Clerk JWT template `convex` with the Convex issuer.
- Depends on: T-010.

**T-012 Projects move from localStorage to Convex**
- Goal: `persistence.ts` calls Convex (`projects.list/get/save/rename/duplicate/remove`), autosave debounced to a mutation, optimistic list in the hub; one-time import of any localStorage projects into the current org on first sign-in.
- Files: `lib/editor/persistence.ts`, `components/hub/Hub.tsx`, `components/editor/Editor.tsx`, `convex/projects.ts`.
- Verify: create/edit/rename/duplicate/delete round-trips through Convex; reload restores; switching org shows a different list; hub cards and preview modal still work (they read the full document).
- Depends on: T-011.

**T-013 Org media storage (uploads)**
- Goal: uploads go to Convex file storage with metadata in `media`; the Uploads panel lists the org's media; blocks reference `media` ids (resolved to URLs) instead of `blob:` URLs, so saved projects keep their media. Posters for video uploads generated client-side on upload.
- Files: `convex/media.ts`, `panels/misc.tsx` (Uploads), `lib/editor/persistence.ts` (stop stripping), `BlockView.tsx` (URL resolution hook).
- Verify: upload an image and a video, use both in a project, reload, export — media present.
- Depends on: T-011.

### Phase 2 — Navigation surfaces (after Phase 1; parallel with each other)

**T-020 Projects page = current hub, org-scoped** (mostly done; tidy under Clerk)
- Depends on: T-012.

**T-021 Media page (Your media / Our media)**
- Goal: `/media` with a masonry grid reusing `ProjectCard`/`PreviewModal` via a `MediaItem` adapter (hover plays video, click opens the enlarged preview with a details sidebar: name, dimensions, duration, uploaded by, tags, "Used in" projects, "Similar" = same tags/category). Tabs: **Your media** (org uploads) and **Our media** (the stock cache from T-040/T-041). Upload button + drag-and-drop.
- Files: `app/media/page.tsx`, `components/hub/*` (extract a generic `LibraryGrid`), `convex/media.ts`.
- Verify: Playwright + desktop recording of hover play, click preview, sidebar scroll, upload.
- Depends on: T-013.

**T-022 Templates page**
- Goal: `/templates` styled after Butter's: search, category chips, Video/Static toggle, masonry of template cards (hover plays, click opens the enlarged preview with the sidebar: Create button, Info, scenes list, tags, More like this). **Create** makes a project from the template in the current org and opens the studio.
- Reference: butter.video/templates (agent logs in with the `BUTTER_*` secrets and records the grid, hover, preview and Create flow first).
- Files: `app/templates/page.tsx`, `components/hub/*`, `convex/templates.ts`.
- Depends on: T-012, T-030 (needs real templates to show; can start against seed fixtures).

### Phase 3 — Block platform (sequential; blocks Phase 4/5)

**T-030 Component block type + input primitives + schema inspector**
- Goal: the `BlockDefinition` contract, the input primitives, `SchemaFields` inspector renderer (labels from schema, list add/remove/reorder, image picker opens Uploads/Stock, colour picker reuses `ColorField`), `component` block in `types.ts`/`BlockView.tsx`, static vs video rendering, export support, timeline pill label from the block name. Ship with **one** reference block (the iMessage thread) to prove the whole path: picker → canvas → inspector edits → plays in video → static in image → exports both.
- Reference: Butter's "Blocks" tab and the inspector shown when a Butter block is selected (record it).
- Files: `lib/editor/types.ts`, `lib/blocks/registry.ts`, `lib/blocks/inputs.ts`, `components/editor/inspector/SchemaFields.tsx`, `BlockView.tsx`, `Inspector.tsx`, `export.ts`, `panels/library.tsx` (Blocks panel skeleton).
- Verify: the full loop above, recorded; headless assertions on the saved document.
- Depends on: T-012 (documents persist).

**T-031 Blocks panel UI**
- Goal: the Blocks flyout: search, category chips (Products · Carousels · Digital · Logos · Lines · Frames · Layouts), grid of animated previews (hover plays), click adds at a sensible size for the current aspect. Drop "Creator blocks"; the single tab is just "Blocks".
- Reference: Butter's Blocks flyout.
- Depends on: T-030.

**T-032 Block authoring guide + preview generator**
- Goal: `docs/blocks.md` (contract, primitives, static/video rules, the verification loop) and a script that renders each block's animated preview (webm/gif) and poster to storage for the picker.
- Depends on: T-030.

### Phase 4 — Blocks catalog (parallel; one ticket per block; each isolated in `lib/blocks/<id>/`)

Every block ticket has the same shape. **Reference step first, always**: log into Butter, add the equivalent block, record it playing on the timeline, screenshot its inspector, note every input. **Then** write the proposed input schema in the PR description before coding (we may deviate from Butter where our schema is cleaner — say why). **Then** build. **Then** verify: add from the picker → edit every input in the inspector → plays correctly in a video project → renders the poster frame in an image project → appears correctly in both exports → side-by-side still/recording against Butter. A block with fewer features that passes all of this beats a richer one that does not.

Proposed V1 catalog (12 blocks; cut from the bottom if time is short):

| Ticket | Block | Category | Inputs (draft) | Animation (video) |
|---|---|---|---|---|
| T-040 | iMessage thread (built in T-030) | Digital | `contactName`, `list<{side, text}>(1–8)`, `theme: light/dark` | messages pop in one by one, typing dots |
| T-041 | Search bar | Digital | `query`, `list<text> suggestions (1–5)`, `highlightIndex` | typed cursor → suggestions drop in → cursor hovers highlighted row |
| T-042 | AirDrop | Digital | `title`, `subtitle`, `image`, `declineLabel`, `acceptLabel` | card slides up, buttons fade in |
| T-043 | Notification banner | Digital | `appName`, `appIcon`, `title`, `body`, `time` | slides down, settles |
| T-044 | Image carousel | Carousels | `list<image>(2–6)`, `interval`, `transition: slide/fade`, `showDots` | auto-advances; static shows first image + dots |
| T-045 | Product card | Products | `image`, `name`, `price`, `compareAtPrice?`, `badge?`, `rating?` | image scales in, price counts up |
| T-046 | Phone frame | Frames | `screen: image/video`, `model: iPhone/Android`, `color` | none / subtle tilt |
| T-047 | Browser frame | Frames | `url`, `content: image/video`, `theme` | none |
| T-048 | Logo strip | Logos | `list<image>(2–8)`, `speed`, `grayscale` | marquee scroll; static = evenly spaced |
| T-049 | Arrow / line / underline | Lines | `style`, `color`, `weight`, `curve` | draws on |
| T-050 | Grid layout (2×2 / 3×1 / 1+2) | Layouts | `list<image>(2–4)`, `gap`, `radius` | tiles stagger in |
| T-051 | Split layout (image + text) | Layouts | `image`, `heading`, `body`, `side` | slide in from sides |

### Phase 5 — Text blocks (parallel; same loop; `lib/blocks/text/<id>/`)

Text blocks are components whose main input is text, with a designed look and an entrance. Static mode renders the settled state.

| Ticket | Text block | Inputs (draft) | Animation |
|---|---|---|---|
| T-060 | Basic (heading / subheading / body presets) | `text`, `preset`, `color` | fade/rise |
| T-061 | List (bullets / numbered / checks) | `list<text>(1–6)`, `marker` | items stagger in |
| T-062 | Callout (pill / label / tag) | `text`, `fill`, `textColor`, `shape` | pop |
| T-063 | Counter | `from`, `to`, `prefix`, `suffix`, `duration` | counts up; static shows `to` |
| T-064 | Marquee | `text`, `speed`, `direction`, `separator` | scrolls; static = one pass laid out |
| T-065 | Sticker (text on a shaped badge) | `text`, `shape`, `rotation`, `colors` | wobble in |
| T-066 | Button (CTA) | `label`, `style`, `icon?` | press pulse |
| T-067 | Star rating | `rating (0–5, 0.5 step)`, `count?`, `color` | stars fill left to right |
| T-068 | Review card | `quote`, `author`, `rating`, `avatar?` | fade in |
| T-069 | Press ("As seen in") | `list<image or text>(1–6)` | logos fade in |
| T-070 | Promo (price / % off) | `headline`, `amount`, `fineprint` | scale in |
| T-071 | Title card | `title`, `subtitle`, `align` | reveal |
| T-072 | TikTok hook (caption with background + safe zone) | `text`, `style`, `position` | word-by-word |

### Phase 6 — Templates

**T-030 → T-080 Template document format + roles + authoring guide**
- Goal: `isTemplate`, `role` on blocks, `scenePosters`, categories/tags; `docs/templates.md` on how to author one (aspect targets, roles, block usage, poster generation); a script to render posters.
- Depends on: T-030.

**T-081 Template scene picker in the studio (Templates flyout)**
- Goal: clicking a template in the flyout shows its **scenes** as a row/grid; hovering a scene plays its preview; "Add all" adds every scene as new scenes/slides; clicking one adds just that scene. Content is rescaled to the current project aspect. For image projects a multi-scene template offers its scenes as alternatives.
- Reference: **Look at Butter first** — its Templates flyout → click a template → the scene strip, hover previews, add all vs add one. Record it before building.
- Files: `panels/library.tsx`, `lib/editor/store.ts` (`insertScenes`), `Bottom.tsx` (new scenes appear).
- Verify: recording of hover preview, add one, add all; headless check of slide count/order and rescaled geometry.
- Depends on: T-080.

**T-082 Seed template library (authoring)**
- Goal: 15–20 published templates across image (4:5, 1:1), carousel (3–5 slides, 4:5) and video (9:16, 2–4 scenes), built from the V1 blocks, with roles on every content block and posters generated. Categories: Product showcase, Sale, Reviews, Feature callouts, Before/After, Listicle, Hook + CTA, Press, How-to, UGC reaction.
- Verify: each template opens, every scene renders, every `image:*` slot can be replaced from Uploads/Stock, the poster matches the scene, and the API (T-100) lists it with roles.
- Depends on: T-080, Phase 4/5 blocks it uses. Can be split into 3 tickets by kind.

### Phase 7 — Stock and audio (parallel with Phase 4–6)

**T-090 Stock provider + taxonomy (photos and videos)**
- Goal: Convex action that queries Pexels (photos + videos) and caches into `stockAssets`; a curated **organic-content taxonomy** with query terms per category: Cafe · Beach · Workspace · City · Gym · Home · Food · Fashion/OOTD · Travel · Nature · Tech/Desk · Night out · People/Hands · Textures/Backgrounds; nightly refresh of the top N per category; "Our media" in T-021 reads this table.
- Needs from you: a Pexels API key (free at pexels.com/api) as `PEXELS_API_KEY`. If you secure a Dupe partnership, this provider is the swap point.
- Depends on: T-011.

**T-091 Stock panel UI**
- Goal: Photos / Videos tabs, category chips under each, search box (live query through the Convex action), infinite grid, hover-to-play for videos, click adds as a block sized to the artboard; "Set as background" secondary action.
- Reference: Butter's Stock flyout (sections + See more + chips); ours uses two tabs + chips instead of stacked sections.
- Depends on: T-090.

**T-092 Reactions / UGC clips category — decision ticket**
- Goal: a "Reactions" category of short face-reaction clips for hook openers. Options: (a) curated CC0/licensed set uploaded to "Our media"; (b) an AI-avatar provider API (HeyGen/Creatify/D-ID) generating on demand — cost and latency; (c) defer to V1.1. Ticket produces a recommendation with samples; no build until you choose.

**T-093 Soundstripe indexing (music + sound effects)**
- Goal: Convex cron (nightly) indexing Soundstripe songs and sound effects into `audioTracks` with moods/genres/durations and CDN preview URLs (refreshed each run because URLs expire ≤7 days); a `getPlayableUrl` action that re-fetches on demand if stale. Server-side only.
- Needs from you: Soundstripe API key — request the 30-day trial at docs.soundstripe.com to start; production needs their partnership agreement (they'll ask about your app and volume). Store as `SOUNDSTRIPE_API_KEY`.
- Fallback if no key arrives: seed 30–50 CC0 tracks/SFX into "Our media" so the panel is real.
- Depends on: T-011.

**T-094 Audio panel UI**
- Goal: Music / Sound effects tabs, filter chips (mood/genre for music; category for SFX), search, inline play/pause preview with waveform, duration, "Add to timeline" placing an audio track at the playhead; the existing audio lane plays it.
- Reference: Butter's Audio flyout.
- Depends on: T-093.

### Phase 8 — API and MCP (after templates and blocks exist)

**T-100 Public REST API (Convex HTTP actions) + API keys**
- Goal: per-org API keys (create/revoke in a Settings dialog); endpoints: `GET /v1/templates` (filters, roles summary, posters), `GET /v1/templates/:id` (scenes → blocks with `id`, `type`, `role`, current text / image slot / constraints / component schema), `POST /v1/projects` (from template, optional scene subset), `GET /v1/projects/:id`, `PATCH /v1/projects/:id/content` (batch replace by `blockId` or `role`: text, image (URL or media id), component props), `GET /v1/media`, `POST /v1/media` (upload URL), `POST /v1/projects/:id/render` (format: png | carousel-zip | mp4) → job, `GET /v1/render-jobs/:id`.
- Verify: an end-to-end script that lists templates, creates a project, replaces a heading and a product image, requests a render and downloads it.
- Depends on: T-080, T-082, T-101.

**T-101 Render worker**
- Goal: a Node service with headless Chrome that opens `/render/:projectId?token=…` (a chrome-less route rendering artboards at 1:1) and produces PNGs per slide and MP4 for video using the existing exporter; uploads results to Convex storage; processes `renderJobs`.
- Needs from you: where to host it (Fly.io is the simplest for a long-running Chrome; a Vercel function with `@sparticuz/chromium` works for PNG but is tight for MP4). Decide before this ticket.
- Depends on: T-012.

**T-102 MCP server**
- Goal: `packages/mcp` exposing tools `list_templates`, `get_template`, `create_project_from_template`, `replace_content`, `list_media`, `upload_media`, `render_project`, `get_render`; resources for template posters; a bundled **skill** (`skills/on-brand-content.md`) explaining roles, hierarchy, length limits and how to pick images from the org's media. Auth via API key env var. Publishable to npm; usable from Cursor/Claude via `npx`.
- Verify: from Cursor, connect the MCP, ask it to make three variations of a template for a sample brand, and check the rendered outputs.
- Depends on: T-100.

### Phase 9 — Fundamentals still missing (independent; slot in alongside)

**T-110 Share links** — the Share dialog copies a fake URL. Make `/p/:projectId` a read-only viewer (reuses the hub preview) with org-level "anyone with the link" toggle. Depends on T-012.
**T-111 Export dialog completeness** — PNG per slide / ZIP for carousels / MP4 for video, size presets (1×/2×), progress and error states, and a "render in cloud" path once T-101 exists.
**T-112 Missing-media states** — clear placeholders and a "Replace" affordance when a media URL fails, in canvas, filmstrip and export.
**T-113 First-run and empty states** — empty Projects/Media pages with a call to action; a new project opens with a starter scene and a hint to add a template.
**T-114 Project posters** — generate a poster on save (client, debounced) so Projects cards and the API have thumbnails without loading full documents.
**T-115 Keyboard shortcut reference** — `?` opens a shortcuts sheet; audit that every listed shortcut works.
**T-116 Audio lane completeness** — trim start, volume, fade in/out, mute per track; audio in MP4 export (currently video export is silent unless verified).
**T-117 Carousel export and preview** — per-slide PNGs in order, ZIP download, and the hub preview's swipe uses the real slide count.
**T-118 Error boundary + autosave conflict** — an error boundary around the studio with "reload / report"; last-write-wins autosave with a "saved · just now" indicator in the top bar.

### Phase 10 — Integration QA (after each batch of merges)

**T-120 Walkthrough on production** — an agent walks: sign in → switch org → Templates → Create from template → replace text and image → add a block → add stock video → add music → export → share link → API creates a variant via MCP. Files bugs as tickets rather than fixing inline.

---

## 3. Order and parallelism

```
Phase 0  T-001
Phase 1  T-010 → T-011 → { T-012, T-013 }
Phase 2  { T-020, T-021 } (after T-012/T-013)   T-022 after T-080
Phase 3  T-030 → { T-031, T-032 }
Phase 4  T-041 … T-051 in parallel (each in its own folder)   after T-030
Phase 5  T-060 … T-072 in parallel                            after T-030
Phase 6  T-080 → T-081 → T-082 (needs blocks it uses)
Phase 7  { T-090 → T-091, T-093 → T-094, T-092 }              after T-011
Phase 8  T-101 → T-100 → T-102                                 after T-082
Phase 9  any time after their dependency
Phase 10 after each merge batch
```

Run 3–5 agents at once. Block and text-block tickets are the safest to parallelise because each lives in its own folder and only registers itself in `lib/blocks/registry.ts` (one-line conflicts, trivially rebased). Anything touching `Bottom.tsx`, `Inspector.tsx`, `store.ts` or `Hub.tsx` should be sequential.

Suggested batches: **B1** T-001 + T-010. **B2** T-011. **B3** T-012, T-013, T-030, T-090, T-093 (five agents; disjoint files). **B4** T-031, T-032, T-080, T-021, T-091, T-094 + first four blocks. **B5** remaining blocks and text blocks, T-081, T-101. **B6** T-082 (three authoring agents by kind), T-022, T-100. **B7** T-102, Phase 9 items, T-120.

---

## 4. What I need from you

| Item | Why | When |
|---|---|---|
| **Clerk application** with Organizations enabled; publishable + secret keys; a JWT template named `convex`; webhook signing secret | T-010, T-011 | Before B1 |
| **Convex project** (or a deploy key so the agent creates one), `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOYMENT` | T-011 | Before B2 |
| **Pexels API key** (free) | T-090 stock photos/videos | Before B3 |
| **Soundstripe API key** — request the trial at docs.soundstripe.com; tell them: video/creative editor, server-side indexing, previews served from their CDN | T-093 | Before B3 (fallback exists) |
| **Decision: Dupe Photos** — their terms forbid aggregating their library and there is no API. Either contact DupeBiz for a partnership (then T-090 gets a Dupe provider) or accept Pexels + our taxonomy for V1 | T-090 | Before B3 |
| **Decision: reactions/UGC clips source** (curated set, AI-avatar provider, or defer) | T-092 | Before B5 |
| **Decision: render worker hosting** (Fly.io recommended) + account | T-101 | Before B5 |
| **Vercel env vars** for all of the above on the production project, and the same as Cloud Agent secrets so agents can run the app | all | As each arrives |

All keys go into Cursor Cloud Agent secrets (repo-scoped to `rishdvn/contently`) and Vercel; the agents never see them in chat.

---

## 5. Open questions to settle before B3

1. **Roles in templates vs AI infers**: plan is both (roles authored, poster returned). Confirm.
2. **Static behaviour of animated blocks**: render the block's `poster.progress` (default: settled end state). Confirm, or prefer a "middle" frame for some blocks.
3. **Aspect handling when adding a template scene** to a project of a different aspect: rescale to fit width and centre (plan), vs. refuse with a prompt.
4. **Pexels vs Dupe** (above).
5. **Personal org**: every user gets a personal org on sign-up (plan), or require creating one.
