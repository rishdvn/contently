# Templates

How to author a template, and what one is. Written for two readers: a person
building a template in the studio, and the code (the scene picker, the
Templates page, the API and the MCP) that has to replace its content well.

A **template** is a project frozen as a starting point, shared by every
organisation. Its content is meant to be replaced — by a person picking scenes
in the studio, or by an AI filling it with a brand's words and pictures through
the API — so a template is judged by how well it survives that, not only by
how it looks on the day it was made.

| | |
|---|---|
| `convex/templates.ts` | `list`, `get`, `createFromProject`, `publish`; the poster script's steps |
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
| `published` | Off: visible only to the organisation it came from. On: to everyone |
| `orgId`, `sourceProjectId`, `createdBy` | Where it came from. That organisation's admins update and publish it |

Media in `document` keeps its `media` ids. Every read resolves them against the
source organisation and hands back plain URLs, so a template's photos show for
everyone without anyone being let into that organisation's library.

## Roles

A **role** says what a block is *for*: the slot a replacement fills. It is an
optional `role` on any block, from a closed list. The inspector shows it as a
label beside the block's title and sets it from the **Role** menu at the
bottom of the Design tab.

Roles are guidance, not a cage. The API replaces content by `blockId` or by
`role`; a role makes the second possible and tells the writer what kind of
text to write.

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
| `hook` | text | The first words of a video, meant to stop the scroll | A question or a claim; under ~8 words. Scene 1 only |
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
content fields to roles (`roles` in `registry.ts`; `docs/blocks.md`). iMessage
says `contactName` is the `author` and each `messages[].text` is `body`. The
inspector lists these under the Role menu. They belong to the block, not to
the template, and the author doesn't set them.

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
rescales scenes into a project of another aspect (fit width, centre, text
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
  poster script draws a video scene at the latest moment the most blocks are
  on screen, and so do people skimming.
- **End on the `cta`**, held for at least a second after it lands.
- Durations differ per scene. That's what makes "add one scene" in the picker
  useful.

## Building one

1. **Build it as a project** in an organisation where you're an admin, with
   stock media or the org's own media, never a pasted URL (it will not
   survive).
2. **Set the roles.** Select each content block → Role. Everything a
   replacement should touch gets one; layout gets none.
3. **Make it a template.** `createFromProject` as yourself. On the dev
   deployment the CLI can act as you:

   ```bash
   npx convex run templates:createFromProject \
     '{"orgId":"org_…","projectId":"…","categories":["product"],"tags":["launch"]}' \
     --identity '{"subject":"user_…"}'
   # → the template id; it starts unpublished
   ```

   From the app, it is the same mutation (`api.templates.createFromProject`)
   with the same arguments. To update a template after editing the project,
   pass its `templateId`. The document is replaced; the id, the published state
   and anything else you leave out are kept.
4. **Render the posters.** `npm run template-posters` (needs the app running
   and `npm --prefix workers/render install` once; see `docs/blocks.md` →
   "Previews" for the machinery). It renders a PNG per scene, 540 px wide, and
   uses the first as the template's poster. It skips templates whose document
   hasn't changed; pass `--id <templateId>` for one, `--force` to redo, and
   `-- --prod` for production.
5. **Check it.** `templates:get` shows the slots. Every content block should
   be there, with the role you meant. Open the posters: every scene should
   look finished, nothing half-animated.
6. **Publish.** `templates:publish` with `{ orgId, id }` (`published: false`
   takes it back).

A checklist before publishing:

- [ ] Every text a brand would change has a role; nothing decorative does
- [ ] Every photo/clip is an `image`/`video` block or a block input, with a role
- [ ] No words inside images
- [ ] Text boxes have slack for longer copy
- [ ] Posters are rendered and show every scene settled
- [ ] Video: scene names, a hook in scene 1, the CTA held at the end
- [ ] Categories set (they are the Templates page's chips)

## Reading templates from code

```ts
// Published templates, newest first. `drafts: true` adds your orgs' unpublished ones.
const cards = useQuery(api.templates.list, { kind: "video", category: "product" });
// → [{ id, name, kind, aspect, width, height, categories, tags, published,
//      poster, scenePosters[], scenes: [{ id, name, duration }], roles[], updatedAt }]

// One template: the card fields plus the document (media as URLs) and its slots.
const t = useQuery(api.templates.get, { id });
// t.slots → [{ scene, blockId, type, role?, name?, componentId?, current? }]
```

Both need a signed-in user. `createFromProject` and `publish` need an admin
of the template's organisation (`org:admin` in Clerk).
