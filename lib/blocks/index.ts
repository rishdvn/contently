/*
  The studio's catalog. Importing this module registers every block's render;
  each block adds exactly one line here and one in `catalog.ts` (its data, for
  the server), so block tickets never touch the same code twice.
*/
import "./imessage";
import "./text/counter";
import "./product-card";
import "./logo-strip";
import "./search-bar";

import { listSpecs } from "./catalog";
import { getBlock } from "./registry";

/* The other half of the check in `registerBlock`: a block the server knows
   but the studio cannot draw. */
if (process.env.NODE_ENV !== "production") {
  const unregistered = listSpecs().filter((spec) => !getBlock(spec.id));
  if (unregistered.length) throw new Error(`In lib/blocks/catalog.ts but never registered: ${unregistered.map((s) => s.id).join(", ")}. Import the block in lib/blocks/index.ts`);
}

export { aspectRatioOf, BLOCK_CATEGORIES, BLOCK_PREVIEW, definitionFingerprint, getBlock, listBlocks, placementFor, type AnyBlockDefinition, type BlockCategory, type BlockDefinition, type RenderContext } from "./registry";
export { useBlockPreview, type BlockPreview } from "./previews";
export { getSpec, listSpecs } from "./catalog";
export type { AnyBlockSpec, BlockSpec } from "./spec";
