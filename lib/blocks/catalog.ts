import type { AnyBlockSpec } from "./spec";

/* One import and one `SPECS` entry per block, alphabetical by path, like `index.ts`. */
import { airdrop } from "./airdrop/schema";
import { arrowLineUnderline } from "./arrow-line-underline/schema";
import { browserFrame } from "./browser-frame/schema";
import { imageCarousel } from "./image-carousel/schema";
import { imessage } from "./imessage/schema";
import { logoStrip } from "./logo-strip/schema";
import { notificationBanner } from "./notification-banner/schema";
import { phoneFrame } from "./phone-frame/schema";
import { productCard } from "./product-card/schema";
import { searchBar } from "./search-bar/schema";
import { splitLayout } from "./split-layout/schema";
import { basic } from "./text/basic/schema";
import { button } from "./text/button/schema";
import { callout } from "./text/callout/schema";
import { counter } from "./text/counter/schema";
import { list } from "./text/list/schema";
import { marquee } from "./text/marquee/schema";
import { press } from "./text/press/schema";
import { sticker } from "./text/sticker/schema";
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
  browserFrame,
  imageCarousel,
  airdrop,
  arrowLineUnderline,
  imessage,
  logoStrip,
  phoneFrame,
  notificationBanner,
  productCard,
  searchBar,
  basic,
  button,
  callout,
  splitLayout,
  counter,
  tiktokHook,
  list,
  marquee,
  press,
  sticker,
] as unknown as AnyBlockSpec[];

const byId = new Map(SPECS.map((spec) => [spec.id, spec]));

export function getSpec(id: string): AnyBlockSpec | undefined {
  return byId.get(id);
}

export function listSpecs(): AnyBlockSpec[] {
  return [...SPECS];
}
