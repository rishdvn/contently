# Blocks

How to add a block to the catalog. Written so that someone who has read only
this page, and the iMessage block it keeps pointing at, can build the next one.

A **block** is a designed, animated component — an iMessage thread, a product
card, a logo strip — that a person drops onto a slide and fills in from the
inspector. The studio owns where it is, how big, and when it plays; the block
owns what it looks like and how it moves.

| | |
|---|---|
| `lib/blocks/registry.ts` | The contract (`BlockDefinition`), `registerBlock`, placement, the preview spec |
| `lib/blocks/inputs.ts` | The nine input primitives, defaults, validation and repair |
| `lib/blocks/media.tsx` | `BlockImage`: painting an `image` input |
| `lib/blocks/index.ts` | The catalog: one import line per block |
| `lib/blocks/previews.ts` | `useBlockPreview(id)`: the generated preview and poster |
| `lib/blocks/imessage/` | The reference block. Copy its shape |
| `components/editor/inspector/SchemaFields.tsx` | The inspector every block gets, generated from its inputs |
| `scripts/block-previews.ts` | Renders each block's picker preview and poster into Convex |

## The contract

```ts
registerBlock({
  id: "imessage",              // kebab-case, unique, never renamed (documents store it)
  name: "iMessage",            // what the panel, the timeline pill and the layer list say
  category: "Digital",         // one of BLOCK_CATEGORIES
  tags: ["chat", "message"],   // what the panel's search matches besides the name
  inputs,                      // the schema — see below
  defaults: { … },             // sample content a freshly added block shows
  defaultDuration: 6,          // seconds on the timeline when added to a video
  aspectHint: "portrait",      // square | portrait (4:5) | landscape (16:9) | free (1:1)
  render: (props, ctx) => <Thread props={props} ctx={ctx} />,
  poster: { progress: 1 },     // optional: the frame shown as a still (default 1, settled)
  roles: { contactName: "author", "messages[].text": "body" },  // optional: see below
});
```

A block lives in its own folder, `lib/blocks/<id>/` (text blocks:
`lib/blocks/text/<id>/`), with `index.tsx` holding the definition and the
render code beside it. It is listed by adding one line to `lib/blocks/index.ts`:

```ts
import "./imessage";
```

That is the only shared file a block ticket touches, and the line is unique to
the block, so parallel block tickets rebase without conflicts.

The skeleton, as iMessage lays it out:

```tsx
// lib/blocks/<id>/index.tsx
import { input } from "../inputs";
import { registerBlock } from "../registry";

import { View } from "./View";

/* Exported so the render code can type its props from it. */
export const inputs = { /* … */ };

registerBlock({ id: "<id>", /* … */ inputs, defaults: { /* every key */ }, render: (props, ctx) => <View props={props} ctx={ctx} /> });
```

```tsx
// lib/blocks/<id>/View.tsx
import type { PropsOf } from "../inputs";
import { BlockImage } from "../media";
import type { RenderContext } from "../registry";

import type { inputs } from "./index";

type Props = PropsOf<typeof inputs>;

export function View({ props, ctx }: { props: Props; ctx: RenderContext }) {
  const u = ctx.width / 390;
  return <div className="size-full overflow-hidden">{/* … */}</div>;
}
```

The render output is placed in an `absolute inset-0` box the size of the block:
make the root fill it (`size-full`) and clip its own overflow.

### `render(props, ctx)`

`props` are the block's input values, already checked against the schema
(`coerceProps`): a document written by an older schema, or by an API caller,
arrives repaired, so `render` can trust every field is present and in range.

`ctx` is everything else:

| Field | |
|---|---|
| `mode` | `"video"` in video projects; `"static"` in images, carousels and thumbnails |
| `progress` | 0 → 1 across the block's time on the timeline. In static mode, `poster.progress` |
| `time` | Seconds since the block's in point (`progress × duration`) |
| `duration` | The block's length on the timeline (its `defaultDuration` in static mode) |
| `width`, `height` | The block's box in artboard px. Lay out inside it |

**`render` must be a pure function of `props` and `ctx`.** Scrubbing, export,
hub previews and the preview generator all call it at arbitrary times and in
any order, so:

- Anything that moves is computed from `ctx.time` or `ctx.progress` — never
  `setTimeout`, `requestAnimationFrame`, CSS `animation`/`transition`, or state
  that accumulates between renders. The export steps the clock one frame at a
  time and rasterises each frame; a CSS transition would be caught half-way,
  differently on every run. The render pages switch transitions off outright.
- Hooks are fine inside child components (`Thread` is one); `render` itself is
  called like a function, not mounted as a component, so it cannot use them.
- No fetching. Media arrives through `image`/`video` inputs (below).

### Size

The block is laid out in artboard pixels at whatever size the person gives it,
so derive every length from `ctx.width` (or `height`) rather than hard-coding
px. iMessage lays itself out in iPhone points and scales: `u = ctx.width / 390`,
then every size is `n * u`. That one line is why the same thread looks right
as a 300 px sticker and as a full-width 1080 px story.

Decide what the other axis does. iMessage: wider scales the type, taller shows
more history — the newest message stays pinned to the bottom. Say which in a
comment at the top of the block.

`aspectHint` sets the box a freshly added block gets (`placementFor`: centred,
as large as the aspect allows inside 80 % of the artboard). Pick the one the
design reads best at; `free` is 1:1.

### Static and video

The same `render` draws both. In **video** mode `progress` runs from the
block's in point to its out point, so stretching the block on the timeline
slows the animation down rather than adding a hold. In **static** mode the
block shows one frame: `poster.progress`, default `1`.

- Design the settled state first. It is what images, carousels, every
  thumbnail and the picker poster show, and most blocks spend their last
  stretch holding it. Leave it on screen for the final fifth or so of the
  duration (iMessage: messages arrive across the first 80 %).
- If the settled state is not the best still — a counter should show its end
  value, but a "typing…" block might want the middle — set `poster.progress`.
- Branch on `ctx.mode` only for things that make no sense frozen (a cursor
  blink, a loading spinner); otherwise let static be "video at poster time".
- Keep entrances readable at 0.3–0.5 s each. The preview generator compresses
  the whole animation into three seconds, which is a good test of whether it
  still reads.

## Inputs

A block never ships its own inspector. It declares its content slots from nine
primitives and `SchemaFields` renders the controls — and the same schema is
what the public API and MCP (Phase 8) will read to know what can be replaced. The list is
closed: a tenth kind is a platform change, not a block change.

| Builder | Value | Inspector | Options |
|---|---|---|---|
| `input.text` | `string` | Text field / text area | `maxLength`, `multiline`, `placeholder` |
| `input.image` | `{ mediaId?, src }` | Thumbnail; opens Uploads/Stock | |
| `input.video` | `{ mediaId?, src }` | Thumbnail; opens Uploads/Stock | |
| `input.color` | `string` (CSS colour) | Colour field with brand swatches | |
| `input.number` | `number` | Number field | `min`, `max`, `step`, `unit` |
| `input.select` | one of the option values | Segmented strip when ≤ 3 options with labels ≤ 10 characters; a menu otherwise | `options: { value, label }[]` |
| `input.boolean` | `boolean` | Switch | |
| `input.list` | `item[]` | Reorderable rows, add/remove | `item`, `min`, `max`, `itemLabel` |
| `input.object` | `{ …fields }` | A group of fields | `fields` |

Every builder also takes `label` (what the inspector says; without one the key
is turned into words, `contactName` → "Contact name") and `default` (what a new
list item or a missing field starts as).

Rules of thumb:

- **Text has a `maxLength`.** It is what keeps a design from breaking when an
  AI fills it, and the API reports it as the slot's limit. Measure: the longest
  string the design still looks right with.
- **Media goes through `image`/`video` inputs.** That is what makes a slot
  replaceable from Uploads and Stock and lets the save path strip temporary
  `blob:` URLs. Never bake text into an image.
- **Paint an `image` input with `BlockImage`** (`lib/blocks/media.tsx`):
  `<BlockImage value={props.avatar} style={…} className={…} />`. It resolves org
  media by id, sets `crossOrigin` so the export is not tainted, defaults to
  `object-fit: cover`, and renders nothing while the value is empty — so draw a
  fallback underneath (iMessage shows the contact's initial). No block uses a
  `video` input yet; the first one adds a `BlockVideo` beside `BlockImage`,
  seeking the element to `ctx.time` rather than letting it play.
- **An empty media value is `{ src: "" }`**, and `defaults` lists every key,
  empty media included (iMessage: `avatar: { src: "" }`).
- **Lists are for repeated content**, with honest bounds: `min` is what the
  design needs to make sense, `max` is where it stops fitting.
- **Selects are for designed variants** (theme, layout), not for things a
  number or a colour would express.
- Keys are camelCase and stable: documents store values by key, so renaming
  one loses everyone's content for that field. Add a field instead, and let
  `coerce` default it in old documents.
- The inspector shows inputs in declaration order, grouping consecutive scalar
  fields into one card. Order them as a person fills them in: content first,
  styling after.

**Roles.** A block that holds content says what each content field is for, in
the template role vocabulary (`CONTENT_ROLES`, `docs/templates.md`): `roles`
maps a field path to a role — `name` for a top-level input, `list[].field`
for a field of every list item, `object.field` inside an object. Paths are
checked against the schema at compile time. Leave styling fields (theme,
colours, toggles) out. The inspector lists these roles, and the public API will use them
to fill a template's catalog blocks.

`defaults` on the definition is the sample content a freshly added block
shows; it is typed from the schema (`PropsOf<typeof inputs>`), so a typo there
is a compile error. Make it look like a real post, not "Lorem ipsum": it is
also the preview in the picker.

- **Type** with the families in `lib/editor/fonts.ts` (`FONTS`): the render
  pages load exactly those, so anything else falls back to the system stack in
  exports and previews.

### Worked examples

**iMessage** (`lib/blocks/imessage/index.tsx`) — a list of objects, a select
inside the list, and a media input:

```ts
export const inputs = {
  contactName: input.text({ label: "Contact name", maxLength: 40, default: "Contact" }),
  avatar: input.image({ label: "Contact photo" }),
  messages: input.list({
    label: "Messages", itemLabel: "Message", min: 1, max: 8,
    item: input.object({
      fields: {
        side: input.select({ label: "From", options: [{ value: "received", label: "Them" }, { value: "sent", label: "You" }] }),
        text: input.text({ label: "Text", maxLength: 200, multiline: true, default: "New message" }),
      },
    }),
  }),
  theme: input.select({ label: "Theme", options: [{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }] }),
  showTyping: input.boolean({ label: "Typing indicator", default: true }),
};
```

Its animation is a schedule computed from the inputs and `ctx.duration`
(`schedule()` in `Thread.tsx`): each message gets a slot, received messages a
longer one with typing dots first, and the last fifth holds the finished
thread. Every frame is `f(t)` against that schedule.

The next two are schema sketches for blocks in the catalog plan, not yet in
the repo — the shapes to reach for, not code to copy.

**Image carousel** — a list of one primitive, plus timing:

```ts
export const inputs = {
  images: input.list({ label: "Images", itemLabel: "Image", min: 2, max: 6, item: input.image() }),
  transition: input.select({ label: "Transition", options: [{ value: "slide", label: "Slide" }, { value: "fade", label: "Fade" }] }),
  intervalSeconds: input.number({ label: "Each image", min: 0.5, max: 5, step: 0.5, unit: "s", default: 1.5 }),
};
```

Frame at time `t`: image `floor(t / interval) % images.length`, transitioning
over the last 0.3 s of each interval. Static mode shows the first image.

**AirDrop** — flat fields, no lists:

```ts
export const inputs = {
  title: input.text({ label: "Title", maxLength: 32, default: "AirDrop" }),
  subtitle: input.text({ label: "Subtitle", maxLength: 80 }),
  avatar: input.image({ label: "Sender photo" }),
  declineLabel: input.text({ label: "Decline", maxLength: 12, default: "Decline" }),
  acceptLabel: input.text({ label: "Accept", maxLength: 12, default: "Accept" }),
};
```

The sheet rises and settles in the first 0.5 s; static mode shows it settled.

## Naming

- `id`: kebab-case noun for the thing (`imessage`, `product-card`,
  `logo-strip`). It is stored in documents: never rename it.
- `name`: what a person calls it, title case, short (`Product card`). The
  timeline pill uses it.
- Folder: `lib/blocks/<id>/`, or `lib/blocks/text/<id>/` for text blocks.
- Category: the Blocks panel chips — Digital (phone UI, apps), Products,
  Carousels, Logos, Lines, Frames, Layouts, Text.
- Tags: the words someone would search for that are not already in the name.

## Previews

The Blocks panel shows each block's **poster** (a PNG of static mode) and
plays its **preview** (an MP4 of video mode) on hover. Both are rendered ahead
of time, because a panel of live-rendering tiles would run every block's
animation at once.

```bash
npm --prefix workers/render install   # once: the script runs on the render worker's Playwright
npm run dev                           # the script renders through the app
npm run block-previews                # every block whose hash changed
npm run block-previews -- --only product-card --out /tmp/previews   # some blocks (comma-separated), plus local copies
```

Other flags: `--force` (ignore hashes), `--prune` (remove rows for blocks no
longer registered); anything after a second `--` goes to `npx convex run`
(`-- --prod`). `APP_URL` defaults to `http://localhost:$CONDUCTOR_PORT` (or
3000); `CHROME_PATH` is found automatically in the usual places.

How it works, in the order it happens:

1. The script opens the app's `/render/stage` page in headless Chrome
   (`components/render/Stage.tsx`) — the render worker's page model, with
   nothing on it until the script puts something there.
2. For each block, the page builds a one-block project from `BLOCK_PREVIEW`
   in `registry.ts`: a 1080 × 1080 artboard on `#151515`, the block placed
   exactly as `placementFor` would add it, lasting 3 s.
3. The studio's own exporter (`lib/editor/export.ts`) takes a PNG in static
   mode and an H.264 MP4 in video mode, both at half size (540 × 540), and the
   worker's `drain` carries the bytes out.
4. The script uploads both to Convex storage and records them in
   `blockAssets` (`convex/blocks.ts`), deleting the files they replace.

A block is **skipped** when its hash matches the stored one. The hash covers
the block's folder, `inputs.ts`, `media.tsx`, the stage page, and the
definition's data including `BLOCK_PREVIEW`. A change elsewhere that alters
how blocks paint (`BlockView`, the exporter) needs `--force`.

Previews are MP4 rather than WebM: they come out of the same WebCodecs H.264
encoder as the studio's export — one renderer — and play in every browser,
Safari included.

### Reading them

```tsx
import { useBlockPreview } from "@/lib/blocks";

const { poster, video } = useBlockPreview(def.id);
```

Both are URLs, and both are `undefined` for a block that has not been rendered
yet on this deployment; draw the block live in that case (`def.render` with
`mode: "static"` and `progress: def.poster?.progress ?? 1`), as `BlockThumb`
in `panels/library.tsx` does. The hook shares one Convex subscription between
every tile. A block can set `preview` on its definition to override the
generated video, which is rarely what you want.

## The verification loop

Every block ticket goes round this loop, in this order, and the PR shows each
step. A block with fewer features that passes all of it beats a richer one
that does not.

1. **Reference.** Log into Butter (`BUTTER_USERNAME` / `BUTTER_PASSWORD`), add
   the equivalent block, record it playing on the timeline, screenshot its
   inspector, and list every input it has.
2. **Schema first.** Put the proposed `inputs` in the PR description before
   writing the renderer: each field, its primitive, its limits, and where you
   deviate from Butter and why. Schema changes after content exists cost
   people their content; this is the cheap moment to get it right.
3. **Build** in `lib/blocks/<id>/`, register it with one line in `index.ts`.
4. **Add from the picker.** It lands centred at a sensible size in a 9:16, a
   4:5 and a 1:1 project, and is selected.
5. **Edit every input** in the inspector: text to its `maxLength`, lists to
   `min` and `max`, every select option, media from Uploads and from Stock.
   Nothing overflows its box or breaks the layout.
6. **Plays in a video.** Scrub the timeline back and forth — frames are the
   same whichever direction you arrive from. Stretch and shrink the block on
   the timeline; the animation stretches with it.
7. **Poster in an image project.** The settled frame, nothing half-animated.
8. **Both exports.** PNG from an image project and MP4 from a video project
   match the canvas.
9. **Previews.** `npm run block-previews -- --only <id>`; the Blocks panel
   shows the poster and plays the preview on hover.
10. **Side by side** with Butter: a still or a short recording of both.

Stills and recordings go on the Linear issue (`scripts/attach-evidence.mjs`),
and the PR says what was attached.
