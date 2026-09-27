"use client";

import { useQuery } from "convex/react";
import { useMemo } from "react";

import { api } from "@/convex/_generated/api";

import { getBlock } from "./registry";

/*
  The picker's pictures of a block: an animated preview to play on hover and a
  poster to show the rest of the time. Both are rendered ahead of time by
  `scripts/block-previews.ts` and stored in Convex (`blockAssets`), so a panel
  full of tiles plays files rather than running every block's renderer at once.

  Either field is undefined until the script has run for that block — a new
  block before its first run, or a deployment nobody has run it against. A
  caller then draws the block live, which is what the panel did before there
  were previews.
*/

export type BlockPreview = {
  /* MP4, `BLOCK_PREVIEW.duration` seconds, square, loops cleanly enough to play on hover. */
  video?: string;
  /* PNG of the static-mode frame, same size. */
  poster?: string;
};

export function useBlockPreview(blockId: string): BlockPreview {
  /* One subscription however many tiles ask: Convex shares identical queries. */
  const rows = useQuery(api.blocks.assets, {});
  const override = getBlock(blockId)?.preview;
  return useMemo(() => {
    const row = rows?.find((r) => r.blockId === blockId);
    return { video: override || row?.preview || undefined, poster: row?.poster || undefined };
  }, [rows, blockId, override]);
}
