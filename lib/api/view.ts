import { getSpec } from "../blocks/catalog";
import { fieldSlots, inputAt, parsePath, type FieldSlot } from "../blocks/fields";
import type { Input } from "../blocks/inputs";
import { roleOf } from "../editor/roles";
import { CONTENT_ROLES, type Block, type ContentRole, type Project } from "../editor/types";

/*
  What the public API says about a document: its scenes, and in each the
  blocks a caller can replace, with what they hold now and how much room they
  have. The same view serves a template (what an AI reads before writing) and
  a project (what it reads back after a replacement), so block ids and roles
  line up between the two.

  Pure: built in the HTTP action from a document a query returned, with the
  block catalog imported directly — so a component's `schema` keeps its
  declaration order, which a Convex return value would not.
*/

export type Doc = Pick<Project, "slides" | "width" | "height"> & Partial<Pick<Project, "kind">>;

/*
  A text slot's room: `maxChars` is the current wording's length plus 30%, the
  ticket's rule of thumb for "about as long as what it replaces"; `lines` is
  how many lines of this size fit the box. Guidance, not a limit — a longer
  replacement is applied and reported as a warning.
*/
export type TextConstraints = { maxChars: number; lines: number };

export const maxCharsFor = (current: string) => Math.max(1, Math.ceil(current.length * 1.3));

export function textConstraints(block: Extract<Block, { type: "text" }>): TextConstraints {
  const line = block.fontSize * (block.lineHeight || 1.2);
  return { maxChars: maxCharsFor(block.text), lines: line > 0 ? Math.max(1, Math.floor(block.h / line)) : 1 };
}

const ratio = (w: number, h: number) => (h > 0 ? Math.round((w / h) * 1000) / 1000 : 1);

/* A catalog block field, with its room: the input's own `maxLength` is a hard
   limit, the 30% rule a soft one within it. */
export type FieldView = FieldSlot & { constraints?: { maxChars: number; maxLength?: number; multiline: boolean } };

function fieldView(input: Input | undefined, slot: FieldSlot): FieldView {
  if (input?.kind !== "text") return slot;
  const soft = slot.current ? maxCharsFor(slot.current) : (input.maxLength ?? 40);
  return {
    ...slot,
    constraints: {
      maxChars: Math.min(soft, input.maxLength ?? Infinity),
      ...(input.maxLength !== undefined ? { maxLength: input.maxLength } : {}),
      multiline: !!input.multiline,
    },
  };
}

export function blockView(block: Block, kind?: string) {
  const role = roleOf(block);
  const base = {
    id: block.id,
    type: block.type,
    ...(block.name ? { name: block.name } : {}),
    ...(role ? { role } : {}),
    box: { x: Math.round(block.x), y: Math.round(block.y), w: Math.round(block.w), h: Math.round(block.h) },
    ...(kind === "video" ? { time: { start: block.start, end: block.end } } : {}),
  };
  switch (block.type) {
    case "text":
      return { ...base, text: block.text, textConstraints: textConstraints(block) };
    case "image":
    case "video":
      return {
        ...base,
        mediaSlot: { kind: block.type, aspect: ratio(block.w, block.h), src: block.src || null, ...(block.mediaId ? { mediaId: block.mediaId } : {}) },
      };
    case "component": {
      const spec = getSpec(block.componentId);
      const fields = fieldSlots(block.componentId, block.props).map((slot) => fieldView(spec && inputAt(spec.inputs, parsePath(slot.path) ?? []), slot));
      return {
        ...base,
        component: {
          id: block.componentId,
          name: spec?.name ?? block.componentId,
          /* Absent for a block this deployment's catalog does not know. */
          schema: spec?.inputs ?? null,
          props: block.props,
          fields,
        },
      };
    }
    case "shape":
      return base;
  }
}

/* Shapes are layout: never content, so left out of the view. */
const isContent = (block: Block) => block.type !== "shape";

export function sceneViews(doc: Doc, posters: (string | null)[] = []) {
  return doc.slides.map((slide, index) => ({
    index,
    id: slide.id,
    name: slide.name,
    ...(doc.kind === "video" ? { duration: slide.duration } : {}),
    poster: posters[index] ?? null,
    blocks: slide.blocks.filter(isContent).map((b) => blockView(b, doc.kind)),
  }));
}

/* How many of each role a document has, blocks and catalog fields alike, in
   vocabulary order: a list's "what can I fill here". */
export function roleCounts(doc: Pick<Project, "slides">): Partial<Record<ContentRole, number>> {
  const counts = new Map<ContentRole, number>();
  const add = (role: ContentRole | undefined) => role && counts.set(role, (counts.get(role) ?? 0) + 1);
  for (const block of doc.slides.flatMap((s) => s.blocks)) {
    add(roleOf(block));
    if (block.type === "component") for (const f of fieldSlots(block.componentId, block.props)) add(f.role);
  }
  return Object.fromEntries(CONTENT_ROLES.filter((r) => counts.has(r)).map((r) => [r, counts.get(r)!]));
}

/* Seconds, for a video; null for stills. */
export const durationOf = (doc: Doc) => (doc.kind === "video" ? Math.round(doc.slides.reduce((t, s) => t + (s.duration || 0), 0) * 1000) / 1000 : null);
