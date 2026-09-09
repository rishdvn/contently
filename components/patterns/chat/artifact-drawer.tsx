"use client";

import { ArrowUpRight, AtSign, Bookmark, BookmarkCheck, Pencil, Sparkles, X } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { DialogBody, DialogFooter, Drawer } from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";

import { RichText } from "@/components/patterns/docs/rich-text";

import { PropertyRow, type ArtifactActions } from "./artifact-card";
import { artifactKinds } from "./kinds";
import type { Artifact } from "./types";

/**
 * Where an artifact card opens.
 *
 * A drawer rather than a dialog because the conversation is the context for
 * the document: the user reads the persona while the message that produced it
 * is still visible behind the scrim. A drawer rather than a page because most
 * openings are a glance, not an edit. "Open page" is there for the edit.
 *
 * Header, body and footer are the same for every kind. The header is the
 * properties; the body is the rich text; the footer is the one generative
 * next step. Nothing in here knows what a persona is — that is what makes an
 * eighth document type free.
 */
export function ArtifactDrawer({
  artifact,
  open,
  onClose,
  onNext,
  onAttach,
  onSave,
  onProduce,
  children,
}: Pick<ArtifactActions, "onAttach" | "onSave" | "onProduce"> & {
  artifact: Artifact | null;
  open: boolean;
  onClose: () => void;
  /** The kind's spectrum action for non-brief documents ("Fill the gaps", "Brief this persona"). */
  onNext?: (artifact: Artifact) => void;
  /** Override the body — for the editor once it exists. */
  children?: ReactNode;
}) {
  const kind = artifact ? artifactKinds[artifact.kind] : null;
  const isBrief = artifact?.kind === "brief";

  return (
    <Drawer open={open} onClose={onClose} className="w-[600px]">
      <header className="flex items-start gap-3 px-6 pt-5 pb-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <div className="flex items-center gap-2">
            {kind ? (
              <Badge dot={false} className="gap-1.5 [&>svg]:size-3">
                <kind.icon /> {kind.label}
              </Badge>
            ) : null}
            {artifact?.status === "draft" ? (
              <Badge tone="spectrum" dot={false}>
                AI draft
              </Badge>
            ) : null}
            {isBrief && artifact?.saved ? (
              <Badge dot={false} className="gap-1 [&>svg]:size-3">
                <BookmarkCheck /> In ideas
              </Badge>
            ) : null}
          </div>
          <h2 className="text-sections leading-tight text-ink">{artifact?.title}</h2>
          {artifact?.properties?.length ? <PropertyRow properties={artifact.properties} /> : null}
        </div>
        <div className="-mt-1 -mr-2 flex items-center gap-0.5">
          <Tooltip label="Edit">
            <IconButton aria-label="Edit" size="sm">
              <Pencil />
            </IconButton>
          </Tooltip>
          <Tooltip label="Open page">
            <IconButton aria-label="Open page" size="sm">
              <ArrowUpRight />
            </IconButton>
          </Tooltip>
          <IconButton aria-label="Close" size="sm" onClick={onClose}>
            <X />
          </IconButton>
        </div>
      </header>

      <DialogBody className="px-6 pt-1">
        {children ?? (artifact ? <RichText doc={artifact.body} /> : null)}
      </DialogBody>

      <DialogFooter
        className="px-6"
        secondary={
          artifact ? (
            isBrief ? (
              <Button variant="ghost" size="sm" disabled={artifact.saved} onClick={() => onSave?.(artifact)}>
                {artifact.saved ? <BookmarkCheck /> : <Bookmark />}
                {artifact.saved ? "Saved to ideas" : "Save to ideas"}
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => onAttach?.(artifact)}>
                <AtSign /> Attach to chat
              </Button>
            )
          ) : null
        }
      >
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        {artifact && kind?.next ? (
          <Button
            variant="spectrum"
            onClick={() => (isBrief ? onProduce?.(artifact) : onNext?.(artifact))}
          >
            <Sparkles /> {kind.next}
          </Button>
        ) : null}
      </DialogFooter>
    </Drawer>
  );
}
