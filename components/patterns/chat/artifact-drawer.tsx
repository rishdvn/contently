"use client";

import { ArrowUpRight, KanbanSquare, Pencil, Sparkles, X } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { DialogBody, DialogFooter, Drawer } from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";

import { artifactKinds } from "./artifact-card";
import type { Artifact } from "./types";

/**
 * Where an artifact card opens.
 *
 * A drawer rather than a dialog because the conversation is the context for
 * the document: the user reads the persona while the message that produced it
 * is still visible behind the scrim. A drawer rather than a page because most
 * openings are a glance, not an edit. "Open page" is there for the edit.
 *
 * The header and footer are the same for every kind; only the body changes.
 * That is what makes a new artifact type cheap to add.
 */
export function ArtifactDrawer({
  artifact,
  open,
  onClose,
  onGenerate,
  generateLabel = "Generate briefs",
  children,
}: {
  artifact: Artifact | null;
  open: boolean;
  onClose: () => void;
  onGenerate?: (artifact: Artifact) => void;
  generateLabel?: string;
  children: ReactNode;
}) {
  const kind = artifact ? artifactKinds[artifact.kind] : null;

  return (
    <Drawer open={open} onClose={onClose} className="w-[560px]">
      <header className="flex items-start gap-3 px-6 pt-5 pb-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-2">
            {kind ? <Badge dot={false}>{kind.label}</Badge> : null}
            {artifact?.status === "draft" ? (
              <Badge tone="spectrum" dot={false}>
                AI draft
              </Badge>
            ) : null}
          </div>
          <h2 className="text-sections leading-tight text-ink">{artifact?.title}</h2>
          {artifact?.summary ? (
            <p className="text-default text-ink-secondary">{artifact.summary}</p>
          ) : null}
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

      <DialogBody className="px-6">{children}</DialogBody>

      <DialogFooter
        className="px-6"
        secondary={
          <Button variant="ghost" size="sm">
            <KanbanSquare /> Add to board
          </Button>
        }
      >
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        {artifact && onGenerate ? (
          <Button variant="spectrum" onClick={() => onGenerate(artifact)}>
            <Sparkles /> {generateLabel}
          </Button>
        ) : null}
      </DialogFooter>
    </Drawer>
  );
}
