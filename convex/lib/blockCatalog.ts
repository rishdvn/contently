import { getSpec, listSpecs } from "../../lib/blocks/catalog";
import { inputAt, parsePath } from "../../lib/blocks/fields";
import type { AnyBlockSpec } from "../../lib/blocks/spec";

/*
  The block catalog, server side. A block's data — its inputs, defaults and the
  roles of its content fields — is declared once, in `lib/blocks/<id>/schema.ts`,
  and bundled into Convex from there (`lib/blocks/catalog.ts`): the same module
  the studio registers its renders against, so what the server validates and
  what the studio draws cannot disagree. Nothing to publish or re-run when a
  block changes; the next `convex deploy` carries it.

  Everything the public API needs about a catalog block goes through here.
*/

export { getSpec, listSpecs };
export { expandPath, fieldSlots, formatPath, inputAt, parsePath, type FieldSlot } from "../../lib/blocks/fields";

/* A block as the API and `blocks:catalog` describe it: data only, with each
   role's field and the kind of value it takes spelled out. */
export function describeBlock(spec: AnyBlockSpec) {
  return {
    id: spec.id,
    name: spec.name,
    category: spec.category,
    tags: spec.tags,
    aspectHint: spec.aspectHint ?? "free",
    defaultDuration: spec.defaultDuration,
    inputs: spec.inputs,
    defaults: spec.defaults,
    roles: Object.entries(spec.roles ?? {}).flatMap(([field, role]) => {
      const input = role ? inputAt(spec.inputs, parsePath(field) ?? []) : undefined;
      return role && input ? [{ field, role, kind: input.kind === "list" ? input.item.kind : input.kind }] : [];
    }),
  };
}
