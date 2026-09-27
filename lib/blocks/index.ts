/*
  The catalog. Importing this module registers every block; each block adds
  exactly one line here, so block tickets never touch the same code twice.
*/

export { aspectRatioOf, BLOCK_CATEGORIES, getBlock, listBlocks, placementFor, type AnyBlockDefinition, type BlockCategory, type BlockDefinition, type RenderContext } from "./registry";
