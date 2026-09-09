"use client";

import {
  ArrowUpRight,
  Copy,
  FileText,
  Images,
  KanbanSquare,
  type LucideIcon,
  Map,
  MoreHorizontal,
  Search,
  Target,
  Trash2,
  User,
} from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { GeneratingBar, Skeleton } from "@/components/ui/feedback";
import { Menu, MenuDivider, MenuItem } from "@/components/ui/menu";
import { cn } from "@/lib/cn";

import type { Artifact, ArtifactKind } from "./types";

export const artifactKinds: Record<ArtifactKind, { label: string; icon: LucideIcon; noun: string }> = {
  persona: { label: "Persona", icon: User, noun: "persona" },
  angle: { label: "Angle", icon: Target, noun: "angle" },
  strategy: { label: "Strategy", icon: Map, noun: "strategy" },
  research: { label: "Research", icon: Search, noun: "research" },
  brief: { label: "Brief", icon: FileText, noun: "brief" },
  carousel: { label: "Carousel", icon: Images, noun: "carousel" },
};

/**
 * A thing the model made, sitting in the thread.
 *
 * It is a card and not a link because it needs to be findable when the user
 * scrolls back: a title, a one-line summary and a few facts are enough to
 * recognise it without opening it. The whole card opens the artifact in the
 * drawer; the overflow menu is for everything else, and stops the click from
 * reaching the card.
 *
 * Status is spoken by the badge and, while generating, by the sweep at the
 * foot — the one time the spectrum appears on a card.
 */
export function ArtifactCard({
  artifact,
  onOpen,
  onAddToBoard,
  className,
}: {
  artifact: Artifact;
  onOpen?: (artifact: Artifact) => void;
  onAddToBoard?: (artifact: Artifact) => void;
  className?: string;
}) {
  const kind = artifactKinds[artifact.kind];
  const Icon = kind.icon;
  const generating = artifact.status === "generating";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.(artifact)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen?.(artifact);
        }
      }}
      className={cn(
        "group/card relative flex w-full flex-col overflow-hidden rounded-[var(--radius-overlay)] bg-card text-left outline-none",
        "transition-colors duration-150 ease-out-quart hover:bg-raised",
        "focus-visible:ring-2 focus-visible:ring-ink/25",
        className,
      )}
    >
      <div className="flex items-start gap-3.5 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-raised text-ink transition-colors group-hover/card:bg-line-strong [&>svg]:size-[18px]">
          <Icon />
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-default text-ink">{artifact.title}</span>
            {artifact.status === "draft" ? <Badge dot={false}>Draft</Badge> : null}
            {generating ? (
              <Badge tone="spectrum" dot={false}>
                Generating
              </Badge>
            ) : null}
          </div>
          <p className="line-clamp-2 text-cap leading-4 text-ink-secondary">{artifact.summary}</p>
          {artifact.meta?.length ? (
            <p className="truncate pt-0.5 text-tiny text-ink-disabled">
              <span className="text-ink-secondary">{kind.label}</span>
              {artifact.meta.map((m) => (
                <span key={m}>
                  <span className="mx-1.5">&middot;</span>
                  {m}
                </span>
              ))}
            </p>
          ) : null}
        </div>

        {/* Clicks inside the menu must not also open the card. */}
        <div
          className="-mt-1 -mr-1.5 flex shrink-0 items-center"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Menu
            align="end"
            trigger={(props) => (
              <IconButton
                aria-label="More"
                size="sm"
                className="opacity-0 group-hover/card:opacity-100 aria-expanded:opacity-100"
                {...props}
              >
                <MoreHorizontal />
              </IconButton>
            )}
          >
            <MenuItem icon={<KanbanSquare />} onClick={() => onAddToBoard?.(artifact)}>
              Add to board
            </MenuItem>
            <MenuItem icon={<Copy />}>Duplicate</MenuItem>
            <MenuDivider />
            <MenuItem icon={<Trash2 />} destructive>
              Delete
            </MenuItem>
          </Menu>
          <span className="flex size-8 items-center justify-center text-ink-disabled transition-colors group-hover/card:text-ink">
            <ArrowUpRight className="size-4" />
          </span>
        </div>
      </div>

      {artifact.thumbnails?.length ? (
        <div className="flex gap-1.5 px-4 pb-4">
          {artifact.thumbnails.slice(0, 6).map((bg, i) => (
            <span
              key={i}
              className="aspect-[4/5] w-12 shrink-0 rounded-[6px]"
              style={{ backgroundImage: bg, backgroundColor: "#2a2a2a" }}
            />
          ))}
          {artifact.thumbnails.length > 6 ? (
            <span className="flex aspect-[4/5] w-12 shrink-0 items-center justify-center rounded-[6px] bg-raised text-cap text-ink-secondary">
              +{artifact.thumbnails.length - 6}
            </span>
          ) : null}
        </div>
      ) : null}

      {generating ? <GeneratingBar className="rounded-none" /> : null}
    </div>
  );
}

/** Placeholder while the model is still deciding what it will produce. */
export function ArtifactCardSkeleton({ label = "Drafting…" }: { label?: string }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-[var(--radius-overlay)] bg-card">
      <div className="flex items-start gap-3.5 p-4">
        <Skeleton className="size-10 shrink-0" />
        <div className="flex flex-1 flex-col gap-2 pt-0.5">
          <Skeleton className="h-3.5 w-1/2" />
          <Skeleton className="h-3 w-4/5" />
          <span className="pt-0.5 text-tiny text-ink-disabled">{label}</span>
        </div>
      </div>
      <GeneratingBar className="rounded-none" />
    </div>
  );
}

/** Several artifacts from one turn. Two-up above 640px so a pair of personas reads as a pair. */
export function ArtifactGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-2 sm:grid-cols-2", className)}>{children}</div>;
}
