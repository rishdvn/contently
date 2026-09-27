---
name: on-brand-content
description: Make on-brand images, carousels and videos from Contently templates with the Contently MCP tools. Read the template, fill each slot for its role and within its room, use the brand's own media, vary the right slots across variations, render, and return the URLs.
---

# On-brand content from Contently templates

A Contently **template** is a finished design whose content is meant to be
replaced: scenes (slides of a carousel, scenes of a video) made of blocks, and
each block that holds content carries a **role** saying what it is for. Your
job is to fill those slots with a brand's words and pictures so the result
looks as designed, then render it.

## The loop

1. **Find a template.** `list_templates` (filter by `kind`: `image`,
   `carousel` or `video`). Each has `roles` — how many slots of each kind it
   has. Pick one whose slots fit what the brand has to say.
2. **Read it before writing anything.** `get_template(id)` gives scenes →
   blocks, each with its `id`, `role`, current `text` and `textConstraints`,
   media slots, and catalog blocks (`component`) with their own role-carrying
   `fields`. Look at the scene posters (`include_posters: true`, or the
   `contently://templates/{id}/scenes/{n}/poster` resources) to see which text
   is big and which is small. The current text is the best guide to length and
   tone.
3. **Make a project** per variation: `create_project_from_template`. Block
   ids stay the same as in the template.
4. **Fill it** with one `replace_content` call per project: every
   replacement in one batch. Read the answer: `changed`, `unmatched` (a role
   the project does not have — fine), `skipped`, and `warnings` (text longer
   than its slot — shorten it and send that replacement again).
5. **Render** with `render_project` (`mp4` for video, `png` for image, and
   `carousel-zip` or `png` for carousels), then `get_render(jobId)` until it
   is `done`. An MP4 takes about its own length plus a minute, so call
   `get_render` again if it is still running.
6. **Return the download URLs**, one per variation, with a line on what each
   one says. A variation that is not rendered is not finished.

## Writing for each role

| Role | What it is | How to write it |
|---|---|---|
| `hook` | The first words of a video, there to stop the scroll | A question or a sharp claim, under ~8 words. Scene 1 only. Specific beats clever ("Still drinking last month's coffee?") |
| `heading` | The one line a slide is about | Short, concrete, about as long as the text it replaces. One idea |
| `subheading` | Supports the heading | One sentence, quieter than the heading |
| `body` | Explanation or detail | Plain sentences; stay inside the box |
| `benefit` | One reason to care, usually in a set of 2–4 | Parallel phrasing across the set, each one standing alone ("Roasted Monday" / "At your door Friday" / "Cancel anytime") |
| `cta` | What to do next | **1–4 words, verb first**: "Shop now", "Order yours", "Book a call" |
| `price` | A price or offer | **Keep the currency format exactly** as the brand writes it ("$38", "£12.50", "€9/month"). Nothing but the price |
| `brand` | The brand's name, or a block standing for it | Exactly as the brand writes it, including capitalisation |
| `quote` | A testimonial | Real words from a real customer. Never invent one; if the brand gave none, leave the slot as it is |
| `author` | Who said the quote, or who a chat is with | A name, optionally "· role" |
| `logo` | The brand's logo | The brand's own file (transparent PNG or SVG) |
| `image:product` | The product on its own | A clean shot or cut-out of the product |
| `image:lifestyle` | The product, or the feeling, in use | People, places, context |
| `image:background` | A full-bleed backdrop text sits on | Low detail where the text is |
| `video:background` | A full-bleed clip | Slow, steady footage |

## Staying inside the design

- **Respect `textConstraints`.** `maxChars` is the current text + 30%: write
  about as much as is there, not more. `lines` is how many lines of that size
  the box holds. If the current text breaks across lines, keep a similar
  shape. A catalog field's `constraints.maxLength` is a hard limit; the API
  refuses anything longer.
- **Match the register of what you replace.** If the template's heading is
  three punchy words, don't send a sentence.
- **One idea per slot.** Don't put the CTA in the heading or the price in the
  body.
- **Catalog blocks** (`component`) — a Product card, an iMessage thread, a
  search bar — have their own fields. A role reaches them: `image:product`
  fills the Product card's photo as well as any image block with that role,
  `heading` fills its product name. To set one field, use
  `{ blockId, field: "price", text: "$29" }`. To change several inputs at
  once, or non-content inputs (theme, colours, list length), use
  `{ blockId, props: { … } }`, checked against `component.schema`.
- **A role on several blocks** gets the same value everywhere unless you pick
  one with `index` (0-based, in document order) or `sceneIndex`. Three
  `benefit`s need three replacements with `index: 0/1/2`, or three
  `blockId`s. A repeated `brand` name is fine all at once.
- **Roles are guidance, not a cage.** A block with no role can still be
  replaced by its `blockId`. Untagged text is usually decoration: change it
  only if it would contradict the brand (another brand's name, a wrong price).

## Pictures and clips

- **Prefer the brand's own media.** Check `list_media` (the organisation's
  library) first, especially for `image:product` and `logo`: a product slot
  must show *their* product. Stock (`list_media` with `source: "stock"`) suits
  `image:lifestyle`, `image:background` and `video:background`, never the
  product itself.
- **Given a URL?** Pass it as `mediaUrl` in `replace_content` (imported for
  you), or `upload_media` first and reuse the `mediaId` across variations: it
  is imported once, not once per project.
- **Mind the shape.** `mediaSlot.aspect` is the slot's width ÷ height. Media
  is cropped to fill it, so pick pictures of roughly that shape with the
  subject near the centre.
- Put images in image slots and videos in video slots; the API refuses the
  other way round.

## Variations

"Make N variations" means N projects from the same template, each rendered.

- **Hold the brand slots steady**: `brand`, `logo`, `price`, `image:product`
  and the `cta` verb stay the same (or nearly) in every variation, so the
  set reads as one campaign.
- **Vary what persuades**: the `hook` (a different angle each time: a
  question, a number, a pain point), the `heading`, and which `benefit`s lead.
  Each variation should test a genuinely different idea, not a synonym.
- Name each project after its angle ("Glowco — hook: morning routine") so the
  renders are easy to tell apart.
- Work through them one at a time, or create all the projects, fill them, and
  queue all the renders before waiting on any: renders run in a queue.

## When something goes wrong

- **400** lists each bad field (`replacements[2].text: At most 16 characters`).
  Fix those and resend the whole batch; nothing was applied.
- **404**: an id from another organisation, or a typo. Use ids from the tools.
- **401**: the API key is wrong or revoked. Tell the user to make one in
  Contently → Settings → API keys.
- **429**: wait the number of seconds given, then continue.
- A render that stays `queued` with nothing ahead of it means no render
  worker is running. Say so; don't loop.
