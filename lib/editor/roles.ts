import { fieldSlots, type FieldSlot } from "../blocks/fields";

import { CONTENT_ROLES, type Block, type BlockType, type ContentRole, type Project } from "./types";

/*
  Content roles, for people and for code. The list itself is `CONTENT_ROLES` in
  `types.ts`; what each one means, and how to write for it, is
  `docs/templates.md`. This file is what the inspector and the template
  functions need: a label, which roles make sense on which kind of block, and a
  flat list of a document's slots.

  Pure TypeScript with no React or Convex, so `convex/templates.ts` imports it
  too and the server and the studio agree on what a slot is. Catalog blocks'
  own fields come from the block catalog (`lib/blocks/catalog.ts`), which is
  data only for the same reason.
*/

export const ROLE_LABEL: Record<ContentRole, string> = {
  heading: "Heading",
  subheading: "Subheading",
  body: "Body",
  benefit: "Benefit",
  cta: "Call to action",
  price: "Price",
  brand: "Brand",
  quote: "Quote",
  author: "Author",
  hook: "Hook",
  logo: "Logo",
  "image:product": "Product image",
  "image:lifestyle": "Lifestyle image",
  "image:background": "Background image",
  "video:background": "Background video",
};

const TEXT_ROLES: ContentRole[] = ["heading", "subheading", "body", "benefit", "cta", "price", "brand", "quote", "author", "hook"];

/*
  The roles a block of this type can carry. A role promises what kind of
  content replaces it — text for `heading`, a photo for `image:product` — so an
  image cannot be a heading. Shapes carry no content and so no role. A catalog
  block can be any: its own content is described per field by the definition's
  `roles`, and a role on the block itself says what the whole thing stands for
  (a logo strip is `brand`).
*/
export function rolesFor(type: BlockType): ContentRole[] {
  switch (type) {
    case "text":
      return TEXT_ROLES;
    case "image":
      return ["image:product", "image:lifestyle", "image:background", "logo"];
    case "video":
      return ["video:background"];
    case "shape":
      return [];
    case "component":
      return [...CONTENT_ROLES];
  }
}

export const isContentRole = (value: unknown): value is ContentRole => typeof value === "string" && (CONTENT_ROLES as readonly string[]).includes(value);

/* A block's role, if it has one that is still in the vocabulary. */
export const roleOf = (block: Pick<Block, "role">): ContentRole | undefined => (isContentRole(block.role) ? block.role : undefined);

/*
  One replaceable thing in a document: what the API lists for a template and
  what an AI fills. `current` is the text a text slot holds now — the best
  guide to how long its replacement should be. A catalog block's slot lists
  its content `fields` (`fieldSlots`), each with the role its definition gives
  it and a concrete path into `props`.
*/
export type Slot = {
  scene: number;
  blockId: string;
  type: BlockType;
  role?: ContentRole;
  name?: string;
  componentId?: string;
  current?: string;
  fields?: FieldSlot[];
};

/*
  Every block in a document that carries a role, or is a media or catalog block
  (replaceable whether or not the author tagged it), scene by scene. Shapes and
  untagged text are layout, not content, and are left out.
*/
export function slotsOf(project: Pick<Project, "slides">): Slot[] {
  const slots: Slot[] = [];
  project.slides.forEach((slide, scene) => {
    for (const block of slide.blocks) {
      const role = roleOf(block);
      const media = block.type === "image" || block.type === "video";
      if (!role && !media && block.type !== "component") continue;
      slots.push({
        scene,
        blockId: block.id,
        type: block.type,
        ...(role ? { role } : {}),
        ...(block.name ? { name: block.name } : {}),
        ...(block.type === "component" ? { componentId: block.componentId, fields: fieldSlots(block.componentId, block.props) } : {}),
        ...(block.type === "text" ? { current: block.text } : {}),
      });
    }
  });
  return slots;
}

/* The distinct roles a document uses, catalog blocks' fields included, in
   vocabulary order — a template's summary in a list. */
export function rolesIn(project: Pick<Project, "slides">): ContentRole[] {
  const used = new Set<ContentRole | undefined>();
  for (const block of project.slides.flatMap((s) => s.blocks)) {
    used.add(roleOf(block));
    if (block.type === "component") for (const f of fieldSlots(block.componentId, block.props)) used.add(f.role);
  }
  return CONTENT_ROLES.filter((r) => used.has(r));
}

/*
  Where a role is in a document: every block that carries it and every catalog
  block field its definition gives it, in document order, optionally in one
  scene. `field` is the concrete path into the block's `props`
  (`messages[2].text`); absent, the role is on the block itself.
*/
export type RoleTarget = { scene: number; blockId: string; field?: string };

export function findRole(project: Pick<Project, "slides">, role: ContentRole, scene?: number): RoleTarget[] {
  const found: RoleTarget[] = [];
  project.slides.forEach((slide, s) => {
    if (scene !== undefined && s !== scene) return;
    for (const block of slide.blocks) {
      if (roleOf(block) === role) found.push({ scene: s, blockId: block.id });
      if (block.type !== "component") continue;
      for (const f of fieldSlots(block.componentId, block.props)) if (f.role === role) found.push({ scene: s, blockId: block.id, field: f.path });
    }
  });
  return found;
}
