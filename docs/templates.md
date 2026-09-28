# Templates

How to author a template, and what one is. Written for two readers: a person
building a template in the studio, and the code (the scene picker, the
Templates page, the API and the MCP) that has to replace its content well.

A **template** is a project frozen as a starting point. Contently's own
templates are published to every organisation; any organisation can also keep
private ones of its own. Its content is meant to be replaced — by a person
picking scenes in the studio, or by an AI filling it with a brand's words and
pictures through the API — so a template is judged by how well it survives
that, not only by how it looks on the day it was made.

| | |
|---|---|
| `convex/templates.ts` | `list`, `get`, `createProjectFrom`, `createFromProject`, `publish`; `projectFromTemplate`, the one way a project is made from a template; the poster script's steps |
| `convex/schema.ts` → `templates` | The rows |
| `lib/editor/types.ts` → `CONTENT_ROLES` | The role vocabulary |
| `lib/editor/roles.ts` | Labels, which roles fit which block, a document's slots |
| `components/editor/chrome/Inspector.tsx` → Role | Where an author sets them |
| `scripts/template-posters.ts` | Renders the posters |

## What a template is

One row in `templates`:

| Field | |
|---|---|
| `document` | A whole `Project` (`lib/editor/types.ts`), roles included |
| `name`, `kind`, `aspect` | From the project; `kind` is `image`, `carousel` or `video` |
| `categories[]`, `tags[]` | Categories are the chips on the Templates page; tags are extra search words |
| `poster`, `scenePosters[]` | PNGs rendered by `scripts/template-posters.ts`, one per scene, in order |
| `published` | Off: visible only to the organisation it came from. On: to everyone. Only the publisher organisation publishes (below) |
| `orgId`, `sourceProjectId`, `createdBy` | Where it came from. That organisation's admins update it and can unpublish it |

Media in `document` keeps its `media` ids. Every read resolves them against the
source organisation and hands back plain URLs, so a template's photos show for
everyone without anyone being let into that organisation's library.

## Roles

A **role** says what a block is *for*: the slot a replacement fills. It is an
optional `role` on any block, from a closed list. The inspector shows it as a
label beside the block's title and sets it from the **Role** menu at the
bottom of the Design tab.

Roles are guidance, not a cage. The public API (Phase 8) will replace content
by `blockId` or by `role`; a role makes the second possible and tells the
writer what kind of text to write.

| Role | On | What goes there | Writing for it |
|---|---|---|---|
| `heading` | text | The one line the post is about | Short and concrete; about as long as the text it replaces. One per slide |
| `subheading` | text | Supports the heading | One sentence, a half-step quieter than the heading |
| `body` | text | Explanation, detail | Plain sentences; respect the box, don't grow it |
| `benefit` | text | One reason to care, usually in a set of 2–4 | Parallel phrasing across the set; each one stands alone |
| `cta` | text | What to do next | A verb first ("Order yours", "Book a call"); 1–3 words |
| `price` | text | A price or offer | The number and currency as they appear, nothing else |
| `brand` | text, block | The brand's name, or a block that stands for it (a logo strip) | Exactly as the brand writes it |
| `quote` | text | A testimonial or pull quote | Real words from a real person; no quotation marks if the design adds them |
| `author` | text | Who said the quote, or who a chat is with | Name, optionally "· role" |
| `hook` | text | The first words of a video, meant to stop the scroll | A question or a claim; under ~8 words. Scene 1 only — the video's opening line is the `hook`, not a `heading` |
| `logo` | image | The brand's logo | A transparent PNG or SVG from the org's media |
| `image:product` | image | The thing being sold, on its own | A cut-out or clean shot of the product |
| `image:lifestyle` | image | The product, or the feeling, in use | People, places, context |
| `image:background` | image | A full-bleed backdrop text sits on | Low-detail where the text is |
| `video:background` | video | A full-bleed clip text sits on | Slow, steady footage; loops cleanly |

Which roles a block can take follows from its type (`rolesFor`): text takes
the text roles, images the `image:*` roles and `logo`, videos
`video:background`. Shapes carry none, being layout. A catalog block can take
any role, and that role describes the whole block.

**Catalog blocks describe their own fields.** A block definition maps its
content fields to roles (`roles` in its `schema.ts`; `docs/blocks.md`). iMessage
says `contactName` is the `author` and each `messages[].text` is `body`. The
inspector lists these under the Role menu. They belong to the block, not to
the template, and the author doesn't set them. The server reads them from the
block catalog (`lib/blocks/catalog.ts`), so a template's `roles[]` include
them, and a catalog block's slot names its `componentId` and lists its content
`fields`, each with a role and a concrete path into its props
(`messages[2].text`). `findRole` in `roles.ts` finds a role wherever it is, on
a block or inside one.

## Slots, and what makes one replaceable

`templates.get` returns the document and its **slots** (`slotsOf` in
`roles.ts`). A slot is every block that carries a role, holds media, or is a
catalog block, scene by scene, with its `blockId`, `type`, `role` and, for
text, its `current` wording, which is the best guide to how long a
replacement should be. Untagged text and shapes are layout, not content, and
are not slots.

A slot is **replaceable** when a replacement can go in without redrawing
anything:

- **Media is a block or an input, never part of a picture.** Photos and clips
  are `image`/`video` blocks, or a catalog block's `image`/`video` inputs.
  A background painted into a slide's `background`, or a logo inside a
  screenshot, cannot be swapped by anything but a designer.
- **Text is text.** Never bake words into an image. A heading that is a PNG
  cannot be translated, rewritten or read by the API.
- **One idea per text block.** A heading and its subheading in one block
  cannot be given two roles.
- **Boxes have room.** Leave a line of slack in a text box: a replacement is
  rarely the same length. Prefer a fixed width and a line count the design
  can take over text fitted to the last pixel.
- **Media is cropped by `fit: cover` with a sensible focal point**, so any
  photo of roughly the right shape works. Put faces and products near the
  focal point, and keep text off the part of a background that will change.

## Aspect targets

Author at the size the template will mostly be used at. The scene picker
(the studio's Templates flyout) rescales scenes into a project of another aspect (fit width, centre, text
sizes proportional), and a template designed at its native aspect survives
that best.

| Kind | Author at | Also works at |
|---|---|---|
| Image | 4:5 (1080 × 1350) | 1:1 |
| Carousel | 4:5, 3–7 slides | 1:1 |
| Video | 9:16 (1080 × 1920) | 4:5 |

Keep text and faces inside the middle 1080 × 1350 of a 9:16 frame, so a 4:5
crop keeps them.

## Video: scenes and timing

- **Name scenes for what they do** ("Hook", "Demo", "Offer"), because the
  scene picker shows the names.
- **Scene 1 is the hook**, 2–3 s, with a `hook` text that is on screen within
  the first half second.
- **Most scenes are 3–6 s.** Longer scenes want something moving: a catalog
  block's animation, a video background, a text entrance.
- **Blocks in a scene overlap in time** unless the design says otherwise. The
  poster script draws a video scene one frame before the first block leaves,
  choosing the earliest such moment with the most blocks on screen — for a
  scene whose blocks all run to its end, the last frame. Entrances are over by
  then, and a catalog block has settled if it runs at least that long; so let
  the blocks that matter share the scene's final moment.
- **End on the `cta`**, held for at least a second after it lands.
- Durations differ per scene. That's what makes "add one scene" in the picker
  useful.

## Building one

1. **Build it as a project** in an organisation where you're an admin (Clerk
   role `org:admin`): Projects → Create → Video (9:16), Image or Carousel (4:5). Use
   stock media or the org's own uploads: they resolve for every reader,
   whereas a pasted URL depends on someone else's server staying up.
2. **Set the roles.** Select each content block → Role. Everything a
   replacement should touch gets one; layout gets none. Give autosave a
   second after the last change (it runs about half a second later, with no
   indicator): the next step copies what is stored, not what is on screen.
3. **Make it a template.** `createFromProject` as yourself. You need two ids,
   both from the browser console on any signed-in page:
   `window.Clerk.organization.id` (the `org_…` id every call here takes) and
   `window.Clerk.user.id` (the `user_…` id to act as); the project id is the
   last part of the studio URL. On the dev deployment the CLI can act as you:

   ```bash
   npx convex run templates:createFromProject \
     '{"orgId":"org_…","projectId":"…","categories":["product"],"tags":["launch"]}' \
     --identity '{"subject":"user_…"}'
   # → the template id; it starts unpublished
   ```

   There is no button for this in the app yet, and `--identity` works on dev
   deployments only; on production, call the same mutation
   (`api.templates.createFromProject`) from code running as an org admin.

   **After every edit to the project**, run it again with `"templateId"` —
   the template is a copy, not a link. The document is replaced; the id, the
   name, the published state and anything else you leave out are kept. Then
   re-render the posters.
4. **Render the posters.** Needs the app running (`npm run dev`), the Convex
   functions deployed to the same deployment, and
   `npm --prefix workers/render install` once (`docs/blocks.md` → "Previews"
   has the machinery). It renders a PNG per scene, 540 px wide, and uses the
   first as the template's poster.

   ```bash
   npm run template-posters                          # every template whose document changed
   npm run template-posters -- --id k57…,k58…        # some templates
   npm run template-posters -- --force               # redraw regardless
   npm run template-posters -- --out /tmp/posters    # keep local copies
   npm run template-posters -- -- --prod             # the second -- passes --prod to `npx convex run`
   ```

   A template is skipped while its stored document, the poster width and the
   stage page are unchanged. A change to block code or the exporter does not
   count: use `--force` after one.
5. **Check it.** `templates:get` shows the slots. Every content block should
   be there, with the role you meant. Open the posters: every scene should
   look finished, nothing half-animated.
   Your unpublished templates are in `templates:list` with
   `{ "drafts": true, "orgId": "org_…" }`.
6. **Publish.** `templates:publish` with `{ orgId, id }` (`published: false`
   takes it back), the same way as step 3. Only the publisher organisation
   can publish ("Who can publish", below); anywhere else, stop at step 5 and
   the template stays your organisation's own.

## Who can publish

A published template is shown to every customer, so the shared library is
Contently's alone:

- **Publishing** needs an admin (`org:admin`) of the **publisher
  organisation**, the Clerk organisation whose id is in the Convex environment
  variable `TEMPLATE_PUBLISHER_ORG`. Anyone else gets `forbidden`. With the
  variable unset, nobody can publish.
- **Making and updating** a template (`createFromProject`) is open to the
  admins of any organisation. Its templates stay **private**: that
  organisation sees them in its Templates flyout and on its Templates page
  (`list` with `drafts: true` and that `orgId`), and nobody else does — not
  even its members while another organisation is the active one.
- **Unpublishing** (`published: false`) is open to the template's own
  organisation's admins, so whoever owns a public template can always take it
  back.

To name the publisher, take the organisation's `org_…` id (Clerk dashboard, or
`window.Clerk.organization.id` while it is the active organisation) and set it
on the deployment:

```bash
npx convex env set TEMPLATE_PUBLISHER_ORG org_…
npx convex env get TEMPLATE_PUBLISHER_ORG     # check
```

It takes effect on the next function call; nothing needs redeploying. Build
the library's templates in that organisation, so its admins own them.

A checklist before publishing:

- [ ] Every text a brand would change has a role; nothing decorative does
- [ ] Every photo/clip is an `image`/`video` block or a block input, with a role
- [ ] No words inside images
- [ ] Text boxes have slack for longer copy
- [ ] Posters are rendered and show every scene settled
- [ ] Video: scene names, a hook in scene 1, the CTA held at the end
- [ ] Categories set: lowercase words, reusing ones other templates already
      use (`templates:list` shows them) — they will be the Templates page's
      chips. There is no fixed list yet

## The mock templates

Three published templates, one per kind, are the fixtures the scene picker,
the Templates page, the API and the MCP are checked against. They are built
to exercise every code path, not to be the library:

| Template | Kind | Exercises |
|---|---|---|
| Product spotlight | Image, 4:5 | `heading` (highlight-style), `body`, `cta`, `image:product`, `image:background`; a Product card (static) and a shape |
| 3 reasons | Carousel, 3 slides, 4:5 | A `heading` per slide, three `benefit`s, `image:lifestyle` on slide 1, `cta` on slide 3, a Logo strip (`brand`) on every slide |
| Hook → demo → CTA | Video, 9:16, 3 s / 6 s / 4 s | A `hook` that slides in word by word, `video:background`, an animated Search bar, a Counter with a `body` caption, a held `cta` |

All their media is stock. `scripts/mock-templates.ts` draws them as projects
in the publisher organisation and makes (or refreshes) the templates, so they
can be rebuilt on another deployment or after a change; they stay ordinary
projects, and editing one in the studio and re-running `createFromProject`
works as for any template. Render the posters after either.

```bash
npm run mock-templates -- --org org_… --user user_…             # unpublished
npm run mock-templates -- --org org_… --user user_… --publish
npm run template-posters
```

## Making a project from a template

There is one way, `projectFromTemplate` in `convex/templates.ts`. The
Templates page's **Create** (`templates.createProjectFrom`) and the API's
`POST /v1/projects` (`api/projects.createFromTemplate`) both call it, so a
project made either way is the same project:

- **Ids are kept.** Scene and block ids in the project are the template's, so
  a `blockId` read from the template (`templates.get`, `GET /v1/templates/:id`)
  addresses the same block in the project. Ids only have to be unique within
  one document.
- **Media carries over by who can resolve it.** Stock, and media the new
  project's own organisation owns, keep their `media` ids: they stay in the
  project's library and in "Used in", and the studio and the render worker
  resolve them as usual. Media owned by the template's organisation, which the
  new project's organisation cannot resolve, becomes the URL it resolves to at
  that moment, with the id removed.
- **Audio carries over as it is.** Library tracks (`audioTracks`) are shared by
  every organisation, so each keeps its `trackId`, which the studio and the
  render worker turn into a live URL, and its last `src` as the fallback. When
  only some scenes are taken (the API's `scenes`), tracks are cut to the length
  of the scenes kept, and a track that would start after the end is dropped.
- **Who may.** Any member of the organisation the project goes into, from a
  template that is published or is that organisation's own.
- **Scenes** (API only): some scenes by index, in the order given.

The project is a copy: editing it never changes the template, and deleting
the template leaves it alone.

## Reading templates from code

```ts
// Published templates, newest first. `drafts: true` adds the active organisation's
// unpublished ones; `useTemplateScope()` (components/hub/TemplateCard.tsx) gives the `orgId`.
const cards = useQuery(api.templates.list, { kind: "video", category: "product", drafts: true, orgId });
// → [{ id, name, kind, aspect, width, height, categories, tags, published,
//      poster, scenePosters[], scenes: [{ id, name, duration }], roles[], updatedAt }]

// One template: the card fields plus the document (media as URLs) and its slots.
const t = useQuery(api.templates.get, { id, orgId });
// t.slots → [{ scene, blockId, type, role?, name?, componentId?, current?, fields? }]
//   fields, on catalog blocks → [{ path: "messages[2].text", field: "messages[].text", role, kind, current?, media? }]
```

Both need a signed-in user. `createFromProject` needs an admin of the
project's organisation (`org:admin` in Clerk); `publish`, an admin of the
publisher organisation ("Who can publish").
