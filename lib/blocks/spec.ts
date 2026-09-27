import type { ContentRole } from "../editor/types";

import type { FieldPath, InputSchema, Props, PropsOf } from "./inputs";

/*
  A block's data: everything about it except how it draws. Each block declares
  this once, in `lib/blocks/<id>/schema.ts`, and two readers share it:

  - the studio, which adds a render function (`registerBlock` in `registry.ts`,
    from the block's `index.tsx`);
  - the server, which cannot import React and reads the catalog
    (`catalog.ts`) to validate props and resolve roles for the public API.

  Pure TypeScript with no React, Convex or DOM, and relative imports only, so
  Convex's bundler takes it as it is.
*/

export type BlockCategory = "Products" | "Carousels" | "Digital" | "Logos" | "Lines" | "Frames" | "Layouts" | "Text";

/* The order categories appear in the Blocks panel. */
export const BLOCK_CATEGORIES: BlockCategory[] = ["Digital", "Products", "Carousels", "Logos", "Lines", "Frames", "Layouts", "Text"];

export type BlockSpec<S extends InputSchema = InputSchema> = {
  id: string;
  name: string;
  category: BlockCategory;
  tags: string[];
  inputs: S;
  defaults: PropsOf<S>;
  /* Seconds a freshly added block lasts in a video. */
  defaultDuration: number;
  aspectHint?: "square" | "portrait" | "landscape" | "free";
  /*
    What each content field is for in a template, in the same vocabulary as a
    block's own `role` (`CONTENT_ROLES`). Keys are field paths: a top-level
    input by name (`contactName`), a field inside list items with `[]`
    (`messages[].text`), a field of an object input with `.`. A role on a list
    of media or text (`logos`) describes each item. Fields left out are
    styling, not content.
  */
  roles?: Partial<Record<FieldPath<S>, ContentRole>>;
  /* The frame shown in static mode and in thumbnails. Default: settled (1). */
  poster?: { progress: number };
  /*
    A hand-made animated preview for the picker, overriding the generated one.
    Normally left out: `scripts/block-previews.ts` renders every block and the
    panel reads the result through `useBlockPreview` (`docs/blocks.md`).
  */
  preview?: string;
};

/* Stored erased: a block's own code sees typed props, the platform sees JSON. */
export type AnyBlockSpec = Omit<BlockSpec, "defaults" | "roles"> & {
  defaults: Props;
  roles?: Partial<Record<string, ContentRole>>;
};

/* Typed identity: keeps the schema's literal types so `defaults` and `roles`
   are checked against it, a typo in either being a compile error. */
export const defineBlock = <S extends InputSchema>(spec: BlockSpec<S>): BlockSpec<S> => spec;
