import type { AnyBlockSpec } from "./spec";

/* One import and one `SPECS` entry per block, alphabetical by path, like `index.ts`. */
import { imessage } from "./imessage/schema";
import { logoStrip } from "./logo-strip/schema";
import { productCard } from "./product-card/schema";
import { searchBar } from "./search-bar/schema";
import { basic } from "./text/basic/schema";
import { counter } from "./text/counter/schema";
import { tiktokHook } from "./text/tiktok-hook/schema";

/*
  Every block's data, with no render code: what the server reads to validate a
  block's props and to find the field behind a role (`fields.ts`). The studio's
  registry pairs each of these with a render function (`registry.ts`), and
  refuses one that is not listed here, so the two cannot drift apart.

  One line per block, like `index.ts`. Imports are relative and nothing here
  reaches React, so `convex/` imports this module as it is.
*/
const SPECS = [
  imessage,
  logoStrip,
  productCard,
  searchBar,
  basic,
  counter,
  tiktokHook,
] as unknown as AnyBlockSpec[];

const byId = new Map(SPECS.map((spec) => [spec.id, spec]));

export function getSpec(id: string): AnyBlockSpec | undefined {
  return byId.get(id);
}

export function listSpecs(): AnyBlockSpec[] {
  return [...SPECS];
}
