"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";

import { api } from "@/convex/_generated/api";
import { useActiveOrg } from "@/lib/auth/useActiveOrg";
import { cn } from "@/lib/cn";
import { ASPECTS, type AspectId, type Project } from "@/lib/editor/types";

import { CardCaption, type LibraryAdapter } from "./LibraryGrid";
import { LiveArt } from "./ProjectPreview";

/* A template as `templates.list` has it: enough to draw a card, not the document. */
export type TemplateSummary = FunctionReturnType<typeof api.templates.list>[number];

/*
  Which organisation's private templates to show beside the published ones:
  the active one's, and nobody else's. Pass it to `templates.list` and
  `templates.get`; switching organisation changes it, and the queries follow.
  Undefined until Clerk has loaded, so nothing is asked unscoped.
*/
export function useTemplateScope() {
  const { orgId, isLoaded } = useActiveOrg();
  return isLoaded ? { orgId: orgId ?? "" } : undefined;
}

export const TEMPLATE_KIND_LABEL: Record<string, string> = { video: "Video", carousel: "Carousel", image: "Image" };

/* The template's frame in artboard px, from its document or, failing that, its aspect. */
export function templateSize(t: Pick<TemplateSummary, "width" | "height" | "aspect">) {
  const fallback = ASPECTS[t.aspect as AspectId] ?? ASPECTS["4:5"];
  return { width: t.width ?? fallback.w, height: t.height ?? fallback.h };
}

/* "3 scenes · 12s" for a video, "5 slides" for a carousel, the aspect for a still: the card's hover badge. */
export function templateMeta(t: Pick<TemplateSummary, "kind" | "aspect" | "scenes">) {
  const n = t.scenes.length;
  if (t.kind === "video") return `${n} scene${n === 1 ? "" : "s"} · ${Math.round(t.scenes.reduce((a, s) => a + s.duration, 0))}s`;
  if (t.kind === "carousel") return `${n} slide${n === 1 ? "" : "s"}`;
  return t.aspect;
}

/*
  Templates in a library grid: the Templates page's cards and the preview's
  "More like this". At rest a card is the template's poster. Hovering plays the
  template itself — fetched on first hover, since the list carries no documents —
  over the poster, as Butter's cards do. A still has nothing to play and stays
  put. A template without a poster yet is drawn from its document.
*/
export const TEMPLATES: LibraryAdapter<TemplateSummary> = {
  key: (t) => t.id,
  label: (t) => t.name,
  aspect: (t) => {
    const { width, height } = templateSize(t);
    return width / height;
  },
  Art: TemplateArt,
  Overlay: ({ item, hover }) => (
    <>
      <CardCaption name={item.name} badge={hover ? templateMeta(item) : undefined} />
      {item.published ? null : <DraftBadge />}
    </>
  ),
};

export function TemplateArt({ item, playing, className }: { item: TemplateSummary; playing: boolean; className?: string }) {
  const { width, height } = templateSize(item);
  const live = (playing && item.kind !== "image") || !item.poster;
  const full = useQuery(api.templates.get, live ? { id: item.id } : "skip");
  const doc = live ? (full?.document as Project | undefined) : undefined;

  return (
    <div className={cn("relative w-full overflow-hidden bg-card", className)} style={{ aspectRatio: `${width} / ${height}` }}>
      {item.poster ? (
        // eslint-disable-next-line @next/next/no-img-element -- a Convex storage URL, already at card size
        <img src={item.poster} alt="" draggable={false} className="absolute inset-0 size-full object-cover" />
      ) : null}
      {doc ? (
        <div className="absolute inset-0">
          <LiveArt project={doc} playing={playing && doc.kind !== "image"} />
        </div>
      ) : null}
    </div>
  );
}

/* An unpublished template, which only its own organisation sees. */
export function DraftBadge() {
  return <span className="pointer-events-none absolute top-2 left-2 rounded-[6px] bg-black/60 px-1.5 py-0.5 text-tiny text-white">Draft</span>;
}
