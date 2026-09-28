"use client";

import Image from "next/image";

import type { MediaItem } from "@/convex/media";
import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/editor/geometry";

import { CardCaption, type LibraryAdapter } from "./LibraryGrid";

/* Cards keep the media's own shape within limits: a panorama would be a sliver
   and a long screenshot would take a column to itself. */
export const mediaAspect = (item: MediaItem) => Math.min(Math.max(item.width && item.height ? item.width / item.height : 1, 1 / 2), 2);

/* "0:06" for a clip, "3024 × 4032" for a photo. */
export const mediaFacts = (item: MediaItem) => (item.kind === "video" && item.duration ? formatTime(item.duration) : `${item.width} × ${item.height}`);

/* Media in a library grid: the Media page's cards and the preview's Similar strip. */
export const MEDIA: LibraryAdapter<MediaItem> = {
  key: (item) => item.id,
  label: (item) => item.name,
  aspect: mediaAspect,
  Art: MediaArt,
  Overlay: ({ item, hover }) => <CardCaption name={item.name} badge={hover ? mediaFacts(item) : undefined} />,
};

/*
  A photo, or a video's poster frame, through Next's image optimiser — the
  originals are camera files several megabytes each. A video is only fetched
  while it plays, muted and from the start, which is while the card is hovered,
  and then as its small preview rendition when it has one.
*/
export function MediaArt({ item, playing, sizes = "(min-width: 1280px) 20vw, 25vw", aspect, className }: { item: MediaItem; playing: boolean; sizes?: string; aspect?: number; className?: string }) {
  const thumb = item.kind === "image" ? item.url : item.posterUrl;
  return (
    <div className={cn("relative w-full bg-card", className)} style={{ aspectRatio: aspect ?? mediaAspect(item) }}>
      {thumb ? (
        <Image src={thumb} alt="" fill sizes={sizes} className="object-cover" />
      ) : item.kind === "video" && item.url ? (
        /* An upload from before posters were generated: its first frame. */
        <video src={item.url} muted playsInline preload="metadata" className="absolute inset-0 size-full object-cover" />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-cap text-ink-disabled">Unavailable</span>
      )}
      {item.kind === "video" && playing && item.url ? (
        /* No `poster`: that would fetch the full-size frame. Until the first
           frame paints the video is transparent over the optimised one. */
        <video src={item.previewUrl ?? item.url} autoPlay muted loop playsInline className="absolute inset-0 size-full object-cover" />
      ) : null}
    </div>
  );
}
