/*
  The studio's catalog. Importing this module registers every block's render;
  each block adds exactly one line here and one in `catalog.ts` (its data, for
  the server).

  Keep the imports in alphabetical order by path and add yours in its place,
  not at the end: parallel block PRs then touch different lines and merge
  cleanly. Within a category the Blocks panel lists blocks in this order.
*/
import "./airdrop";
import "./arrow-line-underline";
import "./browser-frame";
import "./grid-layout";
import "./image-carousel";
import "./imessage";
import "./logo-strip";
import "./notification-banner";
import "./phone-frame";
import "./product-card";
import "./search-bar";
import "./split-layout";
import "./text/basic";
import "./text/button";
import "./text/callout";
import "./text/counter";
import "./text/list";
import "./text/marquee";
import "./text/press";
import "./text/review-card";
import "./text/star-rating";
import "./text/sticker";
import "./text/tiktok-hook";

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
