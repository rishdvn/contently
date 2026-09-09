"use client";

import { ArrowLeft, FilePlus2, Sparkles } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Chip, ChipRow } from "@/components/ui/chip";
import { Dialog, DialogBody, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { brandTypes, docTypes, workTypes } from "@/lib/documents/registry";
import type { DocType, Document, Subtype } from "@/lib/documents/types";

import { TypeIcon } from "./atoms";

/*
  New → pick a type. Two steps because the second depends on the first: the
  type decides which subtypes exist and what the skill needs. "Start with the
  agent" is the default path and the spectrum action; "Start blank" is there
  for the founder who already knows what she wants to write.
*/
type NewDocumentDialogProps = {
  open: boolean;
  onClose: () => void;
  docs: Document[];
  onAgent: (type: DocType, subtype: Subtype | null, prompt: string) => void;
  onBlank: (type: DocType, subtype: Subtype | null) => void;
  initialType?: DocType | null;
};

/** The picker starts over each time it opens, so the body remounts on open. */
export function NewDocumentDialog(props: NewDocumentDialogProps) {
  const [openings, setOpenings] = useState(0);
  const [wasOpen, setWasOpen] = useState(props.open);
  if (props.open !== wasOpen) {
    setWasOpen(props.open);
    if (props.open) setOpenings((n) => n + 1);
  }
  return (
    <Dialog open={props.open} onClose={props.onClose} size="lg">
      <NewDocumentBody key={openings} {...props} />
    </Dialog>
  );
}

function NewDocumentBody({ onClose, docs, onAgent, onBlank, initialType = null }: NewDocumentDialogProps) {
  const [type, setType] = useState<DocType | null>(initialType);
  const [subtype, setSubtype] = useState<Subtype | null>(null);
  const [prompt, setPrompt] = useState("");

  const meta = type ? docTypes[type] : null;
  const brandExists = (t: DocType) => brandTypes.includes(t) && docs.some((d) => d.type === t && d.status !== "archived");

  const placeholder = type
    ? {
        research_snapshot: 'Scan the "cozy hobby" trend on TikTok and Instagram',
        persona: "Draft a persona for the gift-giver in a hurry, from the VoC mine and the category search",
        content_strategy: "Plan a Q4 gifting campaign, Nov 1 to Dec 20, six posts a week",
        brief: "Write a carousel brief for P1 from Angle 1 — hooks first",
        brand_core: "Refresh Brand Core against the latest site and reviews",
        product_facts: "Refresh Product Facts from the current Shopify catalogue",
        visual_system: "Refresh the Visual System from the last 30 posts",
      }[type]
    : "";

  return (
    <>
      <DialogHeader
        icon={
          type ? (
            <button type="button" aria-label="Back to types" onClick={() => setType(null)} className="flex size-9 items-center justify-center rounded-control bg-raised text-ink hover:bg-line-strong">
              <ArrowLeft className="size-4" />
            </button>
          ) : undefined
        }
        title={meta ? `New ${meta.label.toLowerCase()}` : "New document"}
        description={meta ? meta.intent : "Pick a type. Each one has a skill that knows how to write it and what it needs to read first."}
        onClose={onClose}
      />
      <DialogBody>
        {!type ? (
          <div className="flex flex-col gap-4">
            <TypeGrid types={workTypes} onPick={setType} disabled={() => false} />
            <div className="flex flex-col gap-2 border-t border-line pt-4">
              <p className="text-cap text-ink-disabled">Brand · living documents, one of each</p>
              <TypeGrid types={brandTypes} onPick={setType} disabled={brandExists} note={(t) => (brandExists(t) ? "Exists — refresh it from the Brand tab" : undefined)} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {meta!.subtypes.length ? (
              <div className="flex flex-col gap-2">
                <p className="text-cap text-ink-secondary">Kind</p>
                <ChipRow wrap>
                  {meta!.subtypes.map((s) => (
                    <Chip key={s.value} selected={subtype === s.value} onClick={() => setSubtype(subtype === s.value ? null : s.value)} className="h-8 text-cap" title={s.description}>
                      {s.label}
                    </Chip>
                  ))}
                </ChipRow>
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-control bg-card p-3.5">
                <p className="pb-1 text-cap text-ink-disabled">Will contain</p>
                <p className="text-default leading-5 text-ink-secondary">{meta!.contains}</p>
              </div>
              <div className="rounded-control bg-card p-3.5">
                <p className="pb-1 text-cap text-ink-disabled">The skill reads</p>
                <p className="text-default leading-5 text-ink-secondary">{meta!.needs}</p>
              </div>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-cap text-ink-secondary">Tell the agent what you want</span>
              <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={placeholder} className="min-h-20" autoFocus />
            </label>
            <div className="flex flex-col gap-1.5">
              <p className="text-cap text-ink-disabled">Sections the skill fills</p>
              <p className="text-cap leading-5 text-ink-secondary">{meta!.sections.join(" · ")}</p>
            </div>
          </div>
        )}
      </DialogBody>
      {type ? (
        <DialogFooter
          secondary={
            <Button variant="ghost" onClick={() => onBlank(type, subtype)}>
              <FilePlus2 /> Start blank
            </Button>
          }
        >
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="spectrum" onClick={() => onAgent(type, subtype, prompt.trim() || placeholder)}>
            <Sparkles /> Start with the agent
          </Button>
        </DialogFooter>
      ) : null}
    </>
  );
}

function TypeGrid({ types, onPick, disabled, note }: { types: DocType[]; onPick: (t: DocType) => void; disabled: (t: DocType) => boolean; note?: (t: DocType) => string | undefined }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {types.map((t) => {
        const m = docTypes[t];
        const off = disabled(t);
        return (
          <button
            key={t}
            type="button"
            disabled={off}
            onClick={() => onPick(t)}
            className={cn(
              "flex items-start gap-3 rounded-control bg-card p-3.5 text-left outline-none transition-colors",
              "hover:bg-raised focus-visible:ring-2 focus-visible:ring-ink/25",
              off && "opacity-60 hover:bg-card",
            )}
          >
            <TypeIcon type={t} />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-default text-ink">{m.label}</span>
              <span className="line-clamp-2 text-cap leading-4 text-ink-secondary">{m.intent}</span>
              {note?.(t) ? <span className="pt-0.5 text-tiny text-ink-disabled">{note(t)}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
