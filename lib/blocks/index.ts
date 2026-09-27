/*
  The catalog. Importing this module registers every block; each block adds
  exactly one line here, so block tickets never touch the same code twice.
*/
import "./imessage";
import "./text/counter";

export { aspectRatioOf, BLOCK_CATEGORIES, BLOCK_PREVIEW, definitionFingerprint, getBlock, listBlocks, placementFor, type AnyBlockDefinition, type BlockCategory, type BlockDefinition, type RenderContext } from "./registry";
export { useBlockPreview, type BlockPreview } from "./previews";
