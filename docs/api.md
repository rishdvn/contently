# Public API

How a script, or an AI through the MCP server, takes a template, reads its
content slots, fills them with a brand's words and pictures, and renders the
result. One organisation per API key.

| | |
|---|---|
| `convex/api/router.ts` | Every `/v1/…` route: auth, rate limit, errors, the handlers |
| `convex/api/*.ts` | The internal functions behind them, scoped to the key's organisation |
| `convex/apiKeys.ts` | Keys: make, list, revoke, authenticate + rate limit |
| `lib/api/content.ts` | Replacing content (by `blockId` or `role`, into catalog blocks too) |
| `lib/api/view.ts` | What a template or project looks like to a caller |
| `lib/api/limits.ts` | Render quota and media import limits, in one config |
| `components/hub/ApiKeysDialog.tsx` | Settings → API keys, in the hub's nav |
| `scripts/api-e2e.mjs` | The whole flow, end to end, against a deployment |
| `scripts/api-limits-e2e.mjs` | The limits, end to end: 413, 415, 429 |

Base URL: the Convex deployment's HTTP origin, `https://<deployment>.convex.site`
(production: `https://chatty-giraffe-3.convex.site`). Machine-readable spec:
`GET /v1/openapi.json`, no key needed.

## Keys

Make one in the hub: **Settings → API keys** in the left nav → name it →
**Create key** → copy it. It is shown once. Only its SHA-256 is stored, so it
cannot be shown again; make a new one instead.

```http
Authorization: Bearer ctly_…
```

- A key belongs to the organisation that was active when it was made, and
  acts as the member who made it (new projects and uploads are theirs). If
  that member leaves the organisation, their keys stop working.
- **Revoke** stops a key at once.
- **Rate limit:** 60 requests a minute per key. Every answer carries
  `X-RateLimit-Limit`, `X-RateLimit-Remaining` and `X-RateLimit-Reset` (epoch
  seconds); past the limit it is `429` with `Retry-After`.
- Other organisations' projects, media and render jobs are `404`, the same as
  ids that do not exist.

## Errors

Always the same shape, with the matching status:

```json
{ "error": { "code": "invalid_request", "message": "The replacements are malformed; nothing was changed",
             "details": [{ "at": "replacements[0].role", "message": "Unknown role; expected one of the content roles (heading, body, cta, image:product, …)" }] } }
```

| Status | `code` | When |
|---|---|---|
| 400 | `invalid_request` | Malformed JSON, a bad parameter, a replacement that cannot apply |
| 401 | `unauthorized` | No key, a wrong key, a revoked key |
| 404 | `not_found` | No such template/project/job — or another organisation's |
| 413 | `payload_too_large` | An image over 20 MB or a video over 40 MB (Limits, below) |
| 415 | `unsupported_media` | Not an image or video we accept: a type or a codec (HEVC, ProRes, AV1…) outside the list |
| 429 | `rate_limited` | Over 60 requests this minute |
| 429 | `quota_exceeded` | Over the organisation's render quota (Limits, below) |
| 503 | `unavailable` | Rendering is not configured on this deployment |

## The flow

```bash
API=https://chatty-giraffe-3.convex.site
KEY=ctly_…
```

### 1. Find a template

```bash
curl -s "$API/v1/templates?kind=video" -H "Authorization: Bearer $KEY"
```

```json
{ "data": [{ "id": "kh7…", "name": "Hook → demo → CTA", "kind": "video", "aspect": "9:16", "width": 1080, "height": 1920,
             "sceneCount": 3, "duration": 12, "poster": "https://…", "scenePosters": ["https://…", "…"],
             "roles": { "benefit": 2, "cta": 1, "hook": 1, "image:product": 1 }, "categories": ["product"], "tags": [] }] }
```

Filters: `kind` (`image` | `carousel` | `video`), `category`, `q` (words in
the name, categories or tags). Published templates, plus the organisation's
own unpublished ones.

### 2. Read its slots

```bash
curl -s "$API/v1/templates/kh7…" -H "Authorization: Bearer $KEY"
```

Scenes, and in each the blocks a caller can fill (shapes are layout and are
left out). This is what to read before writing:

```json
{ "scenes": [
  { "index": 0, "name": "Hook", "duration": 3, "poster": "https://…",
    "blocks": [
      { "id": "NM20oehnbI", "type": "text", "role": "hook", "text": "Tired of dull skin?",
        "textConstraints": { "maxChars": 25, "lines": 2 }, "box": { "x": 90, "y": 700, "w": 900, "h": 300 } },
      { "id": "mR7ncQjcEG", "type": "image", "role": "image:background", "mediaSlot": { "kind": "image", "aspect": 0.563, "src": "https://…" } } ] },
  { "index": 1, "name": "Demo", "duration": 5,
    "blocks": [
      { "id": "9-iVoHYGtA", "type": "component",
        "component": { "id": "product-card", "name": "Product card", "schema": { "image": { "kind": "image", … }, "name": { "kind": "text", "maxLength": 60, … }, … },
                       "props": { "name": "Daily Glow Vitamin C Serum", "price": "$38", … },
                       "fields": [{ "path": "image", "field": "image", "role": "image:product", "kind": "image", "media": { "src": "…" } }] } } ] } ] }
```

- **`role`** says what a block is for (`docs/templates.md` → Roles). Catalog
  blocks list theirs per field in `component.fields`: the Product card's
  `image` is `image:product`, iMessage's `messages[2].text` is `body`.
- **`textConstraints`**: `maxChars` is the current text's length + 30% (write
  about as much as is there); `lines` is how many lines of this size the box
  holds. A catalog field's `constraints.maxLength` is a hard limit.
- **`mediaSlot.aspect`** is width ÷ height of the slot. Media is cropped to
  fill it, so any picture of roughly that shape works.
- **`component.schema`** is the block's inputs (`docs/blocks.md` → Inputs), in
  the inspector's order; `props` are its values now.
- **`poster`** per scene is a PNG of the scene: look at it to see which text is
  the big one.

### 3. Make a project

```bash
curl -s -X POST "$API/v1/projects" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{ "templateId": "kh7…", "name": "Glowco launch", "scenes": [0, 2] }'
```

`scenes` keeps some scenes, in the order given; leave it out for all. **Block
ids are kept from the template**, so the ids read in step 2 address the same
blocks. Answers `201` with the project, in the same shape as a template.

It is the same copy the Templates page's **Create** makes (`docs/templates.md`
→ "Making a project from a template"): stock media keeps its id, media from
the template's organisation comes across as URLs, and library audio keeps
playing. With `scenes`, the audio is cut to the length of the scenes kept.

### 4. Replace content

```bash
curl -s -X PATCH "$API/v1/projects/k57…/content" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d '{
  "replacements": [
    { "role": "hook", "text": "Still dull by noon?" },
    { "role": "benefit", "index": 0, "text": "Glows in a week" },
    { "role": "benefit", "index": 1, "text": "Vegan formula" },
    { "role": "image:product", "mediaUrl": "https://example.com/serum.jpg" },
    { "blockId": "9-iVoHYGtA", "field": "price", "text": "$29" },
    { "blockId": "9-iVoHYGtA", "props": { "name": "Night Serum", "rating": 5 } },
    { "blockId": "mR7ncQjcEG", "mediaId": "j57…" }
  ] }'
```

Each replacement says **where** — exactly one of:

- `role`: every block with that role, and every catalog-block field with it.
  Narrow with `sceneIndex` (one scene) and `index` (the nth match, in document
  order). Without `index`, all matches get the same value — right for a
  repeated brand name, wrong for three benefits.
- `blockId`: one block. With `field`, one field of a catalog block
  (`price`, `messages[2].text`).

…and **what** — exactly one of:

- `text` — text blocks and text fields. Catalog fields enforce their own
  `maxLength`; a text block does not, but text longer than its
  `textConstraints.maxChars` comes back as a warning.
- `mediaId` — the organisation's media or stock (`GET /v1/media`).
- `mediaUrl` — fetched by the server (public http(s); what "Limits" below
  accepts) into the organisation's media, then placed. Inside a batch, a URL
  refused for its size or type fails the batch with `400`, like any other
  replacement, and its `details` entry says why.
- `props` — catalog blocks: inputs to merge into the block's props, checked
  against its `schema`.

The batch is **all or nothing**. A malformed replacement, a value of the wrong
kind for a block named by id (text into an image), a field over its
`maxLength`, or a URL that cannot be fetched fails the whole request with
`400` and a `details` entry each; nothing changes and nothing is imported.
A target that **does not exist** is not an error: it is listed in `unmatched`,
so a caller can send a template's full set of roles to a project that kept
only some scenes. A role that also sits on blocks that cannot take the value
(a `brand` logo strip, sent text) replaces the rest and lists those in
`skipped`.

```json
{ "changed": [{ "replacement": 0, "scene": 0, "blockId": "NM20oehnbI", "before": "Tired of dull skin?", "after": "Still dull by noon?" },
              { "replacement": 3, "scene": 1, "blockId": "9-iVoHYGtA", "field": "image",
                "before": { "src": "/blocks/product-card/serum.svg" }, "after": { "mediaId": "js7…", "src": "https://…" } }],
  "unmatched": [], "skipped": [], "warnings": [],
  "project": { … the project, as in step 3 … } }
```

### 5. Render

```bash
curl -s -X POST "$API/v1/projects/k57…/render" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d '{ "format": "mp4" }'
# → 202 { "id": "k97…", "status": "queued", … }
curl -s "$API/v1/render-jobs/k97…" -H "Authorization: Bearer $KEY"
# → { "status": "done", "outputs": [{ "name": "Glowco launch.mp4", "url": "https://…" }] }
```

| `format` | For | Files |
|---|---|---|
| `png` | any project | One PNG per scene, or the one in `scene` |
| `carousel-zip` | carousels | One ZIP of every slide |
| `mp4` | videos | One MP4 |

Optional: `scene` (index, PNG only), `scale` (1 or 2, stills), `fps` (24, 25,
30 or 60, video). Poll every few seconds; `queuePosition` says how many jobs
are ahead while queued. An MP4 takes about as long as the video to render,
plus a few seconds. Renders run on the render worker (`docs/render-worker.md`),
the same queue as the studio's Export.

## Media

```bash
curl -s "$API/v1/media?kind=image&q=serum" -H "Authorization: Bearer $KEY"             # the organisation's own
curl -s "$API/v1/media?kind=video&source=stock&q=beach" -H "Authorization: Bearer $KEY"  # the shared stock library
curl -s -X POST "$API/v1/media" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{ "url": "https://example.com/logo.png", "name": "Logo", "tags": ["brand"] }'
```

`source`: `org` (default), `stock`, or `all` (own first). For a file on disk:

```bash
UPLOAD=$(curl -s -X POST "$API/v1/media/upload-url" -H "Authorization: Bearer $KEY" | jq -r .uploadUrl)
STORAGE=$(curl -s -X POST "$UPLOAD" -H "Content-Type: image/png" --data-binary @logo.png | jq -r .storageId)
curl -s -X POST "$API/v1/media" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d "{ \"storageId\": \"$STORAGE\", \"name\": \"Logo\" }"
```

Width, height and a video's duration are read from the file itself.

## Limits

One config, `lib/api/limits.ts` (`DEFAULT_LIMITS`); every organisation has the
same limits until there are plans.

**Renders.** Each organisation may ask the API for **100 renders a UTC day**,
and have **3 render jobs queued or running at once** — its studio exports
included, since both share the render worker. Past either:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 30

{ "error": { "code": "quota_exceeded", "message": "This organisation already has 3 renders queued or running, the most it may have at once (3); retry when one finishes" } }
```

`Retry-After` is the seconds until midnight UTC for the daily quota, and 30
for the concurrent one. Only renders that were queued count; a request
refused as invalid costs nothing. The day's count is in the `apiUsage` table.
This is separate from the per-key rate limit (`rate_limited`, 60 requests a
minute).

**Media imports** (`POST /v1/media`, and `mediaUrl` in a content batch):

| Kind | Up to | Types | Codecs |
|---|---|---|---|
| Image | 20 MB | PNG, JPEG, GIF, WebP | |
| Video | 40 MB | MP4, MOV | H.264 (`avc1`, `avc3`) |

The type comes from the file's own bytes, not its name or `Content-Type`. A
file over its kind's size is `413 payload_too_large`, with both sizes in the
message; a URL whose `Content-Length` is over 40 MB is refused before it is
downloaded. Anything else — an unreadable file, a TIFF, an HEVC, ProRes, AV1 or
VP9 video — is `415 unsupported_media`, naming the codec and how to re-encode
it (`ffmpeg -i in.mov -c:v libx264 -pix_fmt yuv420p -c:a aac out.mp4`). HEVC is
refused because not every browser the studio runs in can play it. A refused upload made through
`upload-url` is left in storage and never registered.

## Projects

`GET /v1/projects?limit=20&cursor=…` pages through the organisation's
projects, newest edit first (`nextCursor` is null on the last page).
`GET /v1/projects/:id` is one project in the template shape, with what its
blocks hold now.

## Checking it end to end

```bash
CONTENTLY_API_KEY=ctly_… OTHER_ORG_API_KEY=ctly_… node scripts/api-e2e.mjs
```

Walks steps 1–5 against a video template, downloads the MP4 and checks its
duration with `ffprobe`, then checks the failures: no key and a wrong key
(`401`), another organisation's key (`404`), malformed and wrong-kind
replacements (`400`). The render step needs a worker draining the queue
(`workers/render`, `npm run once`).
