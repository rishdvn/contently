import type { ContentRole } from "../editor/types";

import { getSpec } from "./catalog";
import { getIn, type Input, type InputKind, type InputSchema, type MediaValue } from "./inputs";

/*
  The fields inside a catalog block that hold content, found from its spec
  rather than guessed from the shape of its props: what the template functions
  list as slots and what the public API writes to when it replaces a role.

  Two spellings of a path:

  - A spec's `roles` key names a field for every item at once:
    `messages[].text`, `product.name`, `logos` (a role on a list of media or
    text describes each item).
  - A concrete path names one value in one block's props:
    `messages[2].text`, `logos[0]`, `image`. It is what a slot reports and what
    an API caller sends back to address a single field.
*/

export type FieldPath = (string | number)[];

/* One content value in a block's props. */
export type FieldSlot = {
  /* The concrete path, `messages[2].text`. */
  path: string;
  /* The spec's `roles` key it came from, `messages[].text`. */
  field: string;
  role: ContentRole;
  kind: InputKind;
  /* What the field holds now: the text, or the media's URL and id. */
  current?: string;
  media?: MediaValue;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/* `messages[2].text` → ["messages", 2, "text"]; `messages[].text` → ["messages", "[]", "text"]. */
export function parsePath(path: string): FieldPath | null {
  const steps: FieldPath = [];
  for (const part of path.split(".")) {
    const m = /^([A-Za-z_$][\w$]*)((?:\[\d*\])*)$/.exec(part);
    if (!m) return null;
    steps.push(m[1]!);
    for (const [, index] of m[2]!.matchAll(/\[(\d*)\]/g)) steps.push(index === "" ? "[]" : Number(index));
  }
  return steps;
}

export function formatPath(path: FieldPath): string {
  return path.reduce<string>((out, step) => (typeof step === "number" || step === "[]" ? `${out}[${step === "[]" ? "" : step}]` : out ? `${out}.${step}` : step), "");
}

/*
  The input a path points at, whether the path is concrete (`messages[2].text`)
  or a roles key (`messages[].text`). Undefined when the schema has no such
  field — a typo, or a path into a list item that is not an object.
*/
export function inputAt(inputs: InputSchema, path: FieldPath): Input | undefined {
  let fields: InputSchema | undefined = inputs;
  let current: Input | undefined;
  for (const step of path) {
    if (typeof step === "number" || step === "[]") {
      if (current?.kind !== "list") return undefined;
      current = current.item;
      fields = current.kind === "object" ? current.fields : undefined;
      continue;
    }
    if (!fields || !(step in fields)) return undefined;
    current = fields[step];
    fields = current!.kind === "object" ? current!.fields : undefined;
  }
  return current;
}

/*
  Every concrete path a roles key covers in these props: one per list item for
  each `[]`, and one per item when the key ends on a list (`logos`). Items the
  props do not have are not invented, so an empty list covers nothing.
*/
export function expandPath(inputs: InputSchema, props: unknown, key: string): FieldPath[] {
  const steps = parsePath(key);
  if (!steps || !inputAt(inputs, steps)) return [];
  const leaf = inputAt(inputs, steps)!;
  const all = leaf.kind === "list" && leaf.item.kind !== "object" ? [...steps, "[]"] : steps;

  let paths: FieldPath[] = [[]];
  for (const step of all) {
    if (step !== "[]") {
      paths = paths.map((p) => [...p, step]);
      continue;
    }
    paths = paths.flatMap((p) => {
      const list = getIn(props, p);
      return Array.isArray(list) ? list.map((_, i) => [...p, i]) : [];
    });
  }
  return paths;
}

/*
  The content fields of one catalog block, in the order its spec lists their
  roles, each with its current value. Empty for a block the catalog does not
  know (a document written by a newer deployment) or one with no roles.
*/
export function fieldSlots(componentId: string, props: unknown): FieldSlot[] {
  const spec = getSpec(componentId);
  if (!spec?.roles) return [];
  const slots: FieldSlot[] = [];
  for (const [field, role] of Object.entries(spec.roles)) {
    if (!role) continue;
    for (const path of expandPath(spec.inputs, props, field)) {
      const input = inputAt(spec.inputs, path)!;
      const value = getIn(props, path);
      slots.push({
        path: formatPath(path),
        field,
        role,
        kind: input.kind,
        ...(input.kind === "text" && typeof value === "string" ? { current: value } : {}),
        ...((input.kind === "image" || input.kind === "video") && isRecord(value) && typeof value.src === "string"
          ? { media: { src: value.src, ...(typeof value.mediaId === "string" ? { mediaId: value.mediaId } : {}) } }
          : {}),
      });
    }
  }
  return slots;
}
