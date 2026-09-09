"use client";

import { ArrowUpRight, MessageSquare, X } from "lucide-react";

import { Button, IconButton } from "@/components/ui/button";
import { Drawer } from "@/components/ui/dialog";
import { DocEditor, type Mentionable } from "@/components/patterns/editor";
import { docTypes, typeSuffix } from "@/lib/documents/registry";
import { relativeTime } from "@/lib/documents/selectors";
import type { Citation, Document } from "@/lib/documents/types";

import { FreshnessPill, OwnerMark, StatusPill, TypeIcon } from "./atoms";

/*
  A glance at a document without leaving the list. Read-only on purpose:
  the moment the founder wants to change something she should be in Stage 3,
  where the rail and the history are. The drawer keeps the list visible
  behind it so she can peek at three briefs in a row.
*/
export function PeekSheet({
  doc,
  now,
  mentionables,
  citations,
  onClose,
  onOpen,
  onChat,
  onOpenDoc,
}: {
  doc: Document | null;
  now: Date;
  mentionables: Mentionable[];
  citations: Record<string, Citation>;
  onClose: () => void;
  onOpen: (id: string) => void;
  onChat: (id: string) => void;
  onOpenDoc: (id: string, anchor?: string | null) => void;
}) {
  return (
    <Drawer open={Boolean(doc)} onClose={onClose} side="right" className="w-[640px] max-w-[92vw]">
      {doc ? (
        <>
          <header className="flex items-start gap-3 px-6 pt-5 pb-4">
            <TypeIcon type={doc.type} size="lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <h2 className="text-titles leading-6 text-ink">{doc.title}</h2>
              <div className="flex flex-wrap items-center gap-2 text-cap text-ink-secondary">
                <span>{typeSuffix(doc.type, doc.subtype)}</span>
                <StatusPill status={doc.status} />
                {docTypes[doc.type].living ? <FreshnessPill doc={doc} now={now} /> : null}
                <OwnerMark doc={doc} size="xs" withName />
                <span className="text-ink-disabled">· v{doc.version} · {relativeTime(doc.updatedAt, now)}</span>
              </div>
            </div>
            <IconButton aria-label="Close" size="sm" onClick={onClose} className="-mt-1 -mr-2">
              <X />
            </IconButton>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
            <DocEditor body={doc.body} revision={doc.bodyRevision} editable={false} mentionables={mentionables} citations={citations} onOpenDoc={onOpenDoc} />
          </div>
          <footer className="flex items-center justify-between gap-2 border-t border-line px-6 py-3">
            <Button variant="ghost" onClick={() => onChat(doc.id)}>
              <MessageSquare /> Open in chat
            </Button>
            <Button variant="primary" onClick={() => onOpen(doc.id)}>
              Open document <ArrowUpRight />
            </Button>
          </footer>
        </>
      ) : null}
    </Drawer>
  );
}
