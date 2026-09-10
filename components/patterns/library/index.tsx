"use client";

import { Check, Download, MoreHorizontal, Sparkles } from "lucide-react";

import { IconButton } from "@/components/ui/button";
import { Thumbnail, type Ratio } from "@/components/ui/imagery";
import { cn } from "@/lib/cn";

/*
  The Library: every asset the brand owns and everything the model has made,
  on one wall. A masonry of thumbnails, because assets come in every ratio and
  a uniform grid would crop the very thing being judged. Chrome stays out of
  the way: title and actions appear on hover, selection is a ring, and the
  only persistent mark is the spectrum badge on generated work.
*/

export type Asset = {
  id: string;
  title: string;
  ratio: Ratio;
  art: string;
  source: "product" | "ugc" | "before-after" | "generated" | "brand";
  meta?: string;
};

export const assetSources: { id: Asset["source"] | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "product", label: "Product" },
  { id: "ugc", label: "UGC" },
  { id: "before-after", label: "Before / after" },
  { id: "generated", label: "Generated" },
  { id: "brand", label: "Brand" },
];

export function AssetTile({
  asset,
  selected,
  selecting,
  onToggle,
  onOpen,
}: {
  asset: Asset;
  selected?: boolean;
  selecting?: boolean;
  onToggle?: (a: Asset) => void;
  onOpen?: (a: Asset) => void;
}) {
  return (
    <div className="group/tile relative mb-3 break-inside-avoid">
      <Thumbnail
        ratio={asset.ratio}
        style={{ backgroundImage: asset.art }}
        selected={selected}
        onClick={() => (selecting ? onToggle?.(asset) : onOpen?.(asset))}
        className="cursor-pointer"
        overlay={
          <div className="flex items-end justify-between gap-2 opacity-0 transition-opacity group-hover/tile:opacity-100">
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-cap text-white">{asset.title}</span>
              {asset.meta ? <span className="truncate text-tiny text-white/70">{asset.meta}</span> : null}
            </div>
            <div className="flex shrink-0 items-center">
              <IconButton aria-label="Download" size="sm" className="size-7 text-white hover:bg-white/15 hover:text-white" onClick={(e) => e.stopPropagation()}>
                <Download />
              </IconButton>
              <IconButton aria-label="More" size="sm" className="size-7 text-white hover:bg-white/15 hover:text-white" onClick={(e) => e.stopPropagation()}>
                <MoreHorizontal />
              </IconButton>
            </div>
          </div>
        }
      />
      <button
        type="button"
        aria-label={selected ? "Deselect" : "Select"}
        aria-pressed={selected}
        onClick={(e) => {
          e.stopPropagation();
          onToggle?.(asset);
        }}
        className={cn(
          "absolute top-2.5 left-2.5 flex size-5 items-center justify-center rounded-full transition-opacity",
          selected ? "bg-ink text-canvas opacity-100" : "bg-black/40 text-white opacity-0 ring-1 ring-inset ring-white/60 group-hover/tile:opacity-100",
          selecting && "opacity-100",
        )}
      >
        {selected ? <Check className="size-3" strokeWidth={3} /> : null}
      </button>
      {asset.source === "generated" ? (
        <span aria-label="Generated" className="spectrum-edge pointer-events-none absolute top-2.5 right-2.5 flex size-5 items-center justify-center rounded-full bg-black/45 text-white">
          <Sparkles className="size-2.5" />
        </span>
      ) : null}
    </div>
  );
}

export function AssetWall({
  assets,
  selected,
  onToggle,
  onOpen,
  className,
}: {
  assets: Asset[];
  selected: Set<string>;
  onToggle: (a: Asset) => void;
  onOpen?: (a: Asset) => void;
  className?: string;
}) {
  const selecting = selected.size > 0;
  return (
    <div className={cn("columns-2 gap-3 sm:columns-3 lg:columns-4", className)}>
      {assets.map((a) => (
        <AssetTile key={a.id} asset={a} selected={selected.has(a.id)} selecting={selecting} onToggle={onToggle} onOpen={onOpen} />
      ))}
    </div>
  );
}
