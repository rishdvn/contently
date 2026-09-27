import type { ReactNode } from "react";

import type { InputSchema, Props, PropsOf } from "./inputs";

/*
  The block platform's contract. A block is a render function plus the schema of
  its inputs; the studio supplies geometry, timing and the inspector. Blocks live
  in `lib/blocks/<id>/`, call `registerBlock` once, and are listed by one import
  line in `lib/blocks/index.ts`.
*/

export type BlockCategory = "Products" | "Carousels" | "Digital" | "Logos" | "Lines" | "Frames" | "Layouts" | "Text";

/* The order categories appear in the Blocks panel. */
export const BLOCK_CATEGORIES: BlockCategory[] = ["Digital", "Products", "Carousels", "Logos", "Lines", "Frames", "Layouts", "Text"];

export type RenderContext = {
  /* "video" in video projects; "static" for images, carousels and thumbnails. */
  mode: "static" | "video";
  /* 0 → 1 across the block's time on the timeline. In static mode, the poster frame. */
  progress: number;
  /* Seconds since the block's in point; `progress × duration` in static mode. */
  time: number;
  /* The block's length on the timeline in seconds (its default length in static mode). */
  duration: number;
  /* Artboard px. The block lays itself out in this box; the canvas zoom is applied outside. */
  width: number;
  height: number;
};

export type BlockDefinition<S extends InputSchema = InputSchema> = {
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
    Must be a pure function of its arguments: scrubbing, export and hub previews
    all call it with arbitrary times, so anything animated derives from `ctx`
    rather than from timers or CSS transitions. Hooks belong in child components.
  */
  render: (props: PropsOf<S>, ctx: RenderContext) => ReactNode;
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
export type AnyBlockDefinition = Omit<BlockDefinition, "render" | "defaults"> & {
  defaults: Props;
  render: (props: Props, ctx: RenderContext) => ReactNode;
};

const blocks = new Map<string, AnyBlockDefinition>();

/* Registering an id twice replaces it, which is what fast refresh needs. */
export function registerBlock<S extends InputSchema>(def: BlockDefinition<S>): BlockDefinition<S> {
  blocks.set(def.id, def as unknown as AnyBlockDefinition);
  return def;
}

export function getBlock(id: string): AnyBlockDefinition | undefined {
  return blocks.get(id);
}

export function listBlocks(category?: BlockCategory): AnyBlockDefinition[] {
  const all = [...blocks.values()];
  return category ? all.filter((b) => b.category === category) : all;
}

/* Width over height for a block's aspect hint. */
export const aspectRatioOf = (def: AnyBlockDefinition) => ({ square: 1, portrait: 4 / 5, landscape: 16 / 9, free: 1 })[def.aspectHint ?? "free"];

/* Where a block lands when added: centred, as large as its aspect allows within 80% of the artboard. */
export function placementFor(def: AnyBlockDefinition, artW: number, artH: number) {
  const ratio = aspectRatioOf(def);
  let w = Math.min(artW * 0.8, artH * 0.8 * ratio);
  let h = w / ratio;
  if (h > artH * 0.8) {
    h = artH * 0.8;
    w = h * ratio;
  }
  return { x: Math.round((artW - w) / 2), y: Math.round((artH - h) / 2), w: Math.round(w), h: Math.round(h) };
}

/*
  How `scripts/block-previews.ts` stages a block for its picker preview and
  poster: centred on a square artboard exactly as `placementFor` would add it
  to a 1:1 project, over the panel's card colour, encoded at half size. Part of
  every block's preview hash, so changing a value here re-renders the catalog.
*/
export const BLOCK_PREVIEW = {
  /* Artboard px, square. The block is laid out at studio scale, not tile scale. */
  artboard: 1080,
  /* Output px = artboard × scale: 540 × 540. */
  scale: 0.5,
  /* Seconds. The block's whole animation is played across this, whatever its
     `defaultDuration`, so every tile loops at the same pace. */
  duration: 3,
  fps: 30,
  background: "#151515",
} as const;

/*
  Everything about a definition that is data rather than code, for the preview
  hash. The render function cannot be fingerprinted from here, so the script
  also hashes the block's source folder.
*/
export function definitionFingerprint(def: AnyBlockDefinition): string {
  const { id, name, category, tags, inputs, defaults, defaultDuration, aspectHint, poster } = def;
  return JSON.stringify({ id, name, category, tags, inputs, defaults, defaultDuration, aspectHint, poster, BLOCK_PREVIEW });
}
