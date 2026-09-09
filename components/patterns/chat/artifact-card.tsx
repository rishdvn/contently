"use client";

import {
  ArrowUpRight,
  AtSign,
  Bookmark,
  BookmarkCheck,
  Copy,
  MoreHorizontal,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { GeneratingBar, Skeleton } from "@/components/ui/feedback";
import { Menu, MenuDivider, MenuItem } from "@/components/ui/menu";
import { cn } from "@/lib/cn";

import { excerpt } from "@/components/patterns/docs/rich-text";

import { artifactKinds } from "./kinds";
import type { Artifact, ArtifactProperty } from "./types";

export type ArtifactActions = {
  onOpen?: (artifact: Artifact) => void;
  /** Attach this document as context for the next message. */
  onAttach?: (artifact: Artifact) => void;
  /** Briefs only: keep it in Ideas without producing it yet. */
  onSave?: (artifact: Artifact) => void;
  /** Briefs only: produce the content now. */
  onProduce?: (artifact: Artifact) => void;
};

/**
 * A document the model made, sitting in the thread.
 *
 * It is a card and not a link because it needs to be findable when the user
 * scrolls back: kind, title, the opening line of the body and the few
 * properties that matter are enough to recognise it without opening it. It
 * shows no field grid because a document has no fields — it has a body, and
 * the card shows how that body begins.
 *
 * The whole card opens the document; the overflow menu is for everything
 * else. Only a brief has anywhere to go: Ideas (save) or Content (make).
 * Every other kind is context the agent will read from later.
 */
export function ArtifactCard({
  artifact,
  onOpen,
  onAttach,
  onSave,
  onProduce,
  className,
}: ArtifactActions & {
  artifact: Artifact;
  className?: string;
}) {
  const kind = artifactKinds[artifact.kind];
  const Icon = kind.icon;
  const generating = artifact.status === "generating";
  const isBrief = artifact.kind === "brief";
  const summary = excerpt(artifact.body);

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
            {isBrief && artifact.saved ? (
              <Badge dot={false} className="gap-1 [&>svg]:size-3">
                <BookmarkCheck /> In ideas
              </Badge>
            ) : null}
          </div>
          <p className="text-tiny text-ink-disabled">{kind.label}</p>
          {summary ? <p className="line-clamp-2 pt-0.5 text-cap leading-4 text-ink-secondary">{summary}</p> : null}
          {artifact.properties?.length ? <PropertyRow properties={artifact.properties} className="pt-1.5" /> : null}
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
            {isBrief ? (
              <>
                <MenuItem icon={<Sparkles />} onClick={() => onProduce?.(artifact)}>
                  Make this
                </MenuItem>
                <MenuItem
                  icon={artifact.saved ? <BookmarkCheck /> : <Bookmark />}
                  onClick={() => onSave?.(artifact)}
                  disabled={artifact.saved}
                >
                  {artifact.saved ? "Saved to ideas" : "Save to ideas"}
                </MenuItem>
                <MenuDivider />
              </>
            ) : null}
            <MenuItem icon={<AtSign />} onClick={() => onAttach?.(artifact)}>
              Attach to chat
            </MenuItem>
            <MenuItem icon={<ArrowUpRight />} onClick={() => onOpen?.(artifact)}>
              Open page
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
              className="aspect-[4/5] w-12 shrink-0 rounded-[6px] bg-raised"
              style={{ backgroundImage: bg }}
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

/**
 * The properties a document is filtered or related on — subtype, channel,
 * the persona a brief targets. Small, quiet, and the only structured thing on
 * a card. A relation gets the kind's icon so it reads as a pointer.
 */
export function PropertyRow({ properties, className }: { properties: ArtifactProperty[]; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {properties.map((p) => {
        const Icon = p.relation ? artifactKinds[p.relation.kind].icon : null;
        return (
          <span
            key={`${p.label}:${p.value}`}
            title={p.label}
            className="inline-flex h-5 items-center gap-1 rounded-[6px] bg-raised px-1.5 text-tiny text-ink-secondary [&>svg]:size-3"
          >
            {Icon ? <Icon /> : null}
            {p.value}
          </span>
        );
      })}
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
