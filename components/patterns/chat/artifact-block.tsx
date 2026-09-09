"use client";

import {
  ArrowUpRight,
  Compass,
  FileText,
  GalleryHorizontalEnd,
  KanbanSquare,
  MoreHorizontal,
  Pencil,
  Search,
  Target,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/feedback";
import { Menu, MenuDivider, MenuItem } from "@/components/ui/menu";
import { cn } from "@/lib/cn";

import type { Artifact, ArtifactKind } from "./types";

export const artifactKinds: Record<ArtifactKind, { label: string; icon: LucideIcon; noun: string }> = {
  persona: { label: "Persona", icon: Users, noun: "persona" },
  angle: { label: "Angle", icon: Target, noun: "angle" },
  strategy: { label: "Strategy", icon: Compass, noun: "strategy" },
  research: { label: "Research", icon: Search, noun: "report" },
  brief: { label: "Brief", icon: FileText, noun: "brief" },
  carousel: { label: "Carousel", icon: GalleryHorizontalEnd, noun: "carousel" },
};

/**
 * A document the model produced, inline in the thread.
 *
 * Shaped like the file blocks in Cursor and Codex rather than like a card: a
 * hairline box on the card fill, a header row that names the object, and a
 * body that previews it. Header and preview are the same for every kind so
 * the eye learns one shape; only the preview's content changes. Clicking the
 * header opens the drawer. Actions live in an overflow so the row stays quiet.
 *
 * While the model is still writing it, the block is the same size with a
 * shimmer where the preview will be, so the thread does not reflow on arrival.
 */
export function ArtifactBlock({
  artifact,
  onOpen,
  onGenerate,
  generateLabel,
  preview,
  className,
}: {
  artifact: Artifact;
  onOpen?: (artifact: Artifact) => void;
  onGenerate?: (artifact: Artifact) => void;
  generateLabel?: string;
  /** Kind-specific body; falls back to summary + meta. */
  preview?: ReactNode;
  className?: string;
}) {
  const kind = artifactKinds[artifact.kind];
  const Icon = kind.icon;
  const generating = artifact.status === "generating";

  return (
    <div
      className={cn(
        "group/art overflow-hidden rounded-nav bg-card ring-1 ring-line",
        "transition-shadow duration-150 hover:ring-line-strong",
        className,
      )}
    >
      <div className="flex h-11 items-center gap-2 pl-3 pr-1.5">
        <button
          type="button"
          onClick={() => !generating && onOpen?.(artifact)}
          disabled={generating}
          className="flex h-full min-w-0 flex-1 items-center gap-2 text-left outline-none disabled:cursor-default"
        >
          <Icon className="size-4 shrink-0 text-ink-secondary" />
          <span className="truncate text-default text-ink">{artifact.title}</span>
          <span className="shrink-0 text-cap text-ink-disabled">{kind.label}</span>
          {artifact.status === "draft" ? (
            <Badge tone="spectrum" dot={false} className="ml-1 px-1.5 py-0.5">
              Draft
            </Badge>
          ) : null}
        </button>
        {!generating ? (
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/art:opacity-100 focus-within:opacity-100">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-cap" onClick={() => onOpen?.(artifact)}>
              Open <ArrowUpRight />
            </Button>
            <Menu
              align="end"
              trigger={(props) => (
                <IconButton aria-label="More" size="sm" className="size-7" {...props}>
                  <MoreHorizontal />
                </IconButton>
              )}
            >
              <MenuItem icon={<Pencil />}>Edit</MenuItem>
              <MenuItem icon={<KanbanSquare />}>Add to board</MenuItem>
              {onGenerate ? (
                <MenuItem icon={<FileText />} onClick={() => onGenerate(artifact)}>
                  {generateLabel ?? "Generate briefs"}
                </MenuItem>
              ) : null}
              <MenuDivider />
              <MenuItem icon={<Trash2 />} destructive>
                Discard
              </MenuItem>
            </Menu>
          </div>
        ) : null}
      </div>

      <div className="border-t border-line px-3 py-2.5">
        {generating ? (
          <div className="flex flex-col gap-2 py-0.5">
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        ) : (
          preview ?? <ArtifactSummary artifact={artifact} />
        )}
      </div>
    </div>
  );
}

/** Default preview: summary, meta facts, and a slide strip for briefs and carousels. */
export function ArtifactSummary({ artifact }: { artifact: Artifact }) {
  return (
    <div className="flex flex-col gap-2">
      {artifact.summary ? <p className="text-ui leading-[18px] text-ink-secondary">{artifact.summary}</p> : null}
      {artifact.thumbnails?.length ? (
        <div className="flex gap-1.5 pt-0.5">
          {artifact.thumbnails.slice(0, 8).map((t, i) => (
            <span key={i} className="h-12 w-[38px] shrink-0 rounded-[5px] ring-1 ring-inset ring-white/10" style={{ backgroundImage: t }} />
          ))}
        </div>
      ) : null}
      {artifact.meta?.length ? (
        <p className="text-cap text-ink-disabled">{artifact.meta.join(" · ")}</p>
      ) : null}
    </div>
  );
}

/** Several blocks from one turn — briefs in a batch — stack with a hairline gap. */
export function ArtifactStack({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-1.5", className)}>{children}</div>;
}
