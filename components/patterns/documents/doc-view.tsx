"use client";

import {
  Archive,
  Check,
  Copy,
  FileCode2,
  Maximize2,
  MessageSquare,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { DocEditor, type Mentionable } from "@/components/patterns/editor";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog, DialogBody, DialogHeader } from "@/components/ui/dialog";
import { GeneratingBar } from "@/components/ui/feedback";
import { Menu, MenuDivider, MenuItem } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { useMediaQuery } from "@/lib/use-media-query";
import { frontmatter } from "@/lib/documents/markdown";
import { brandTypes, docTypes, typeSuffix } from "@/lib/documents/registry";
import { outgoing, relativeTime } from "@/lib/documents/selectors";
import { useStore } from "@/lib/documents/store";
import type { Document } from "@/lib/documents/types";

import { AskModal } from "./ask-modal";
import { FreshnessPill, OwnerMark, StatusPill, TypeIcon } from "./atoms";
import { PendingDiffPanel } from "./pending-diff";
import { DocRail } from "./rail";

/*
  Stage 3, and Stage 4 when Edit is on. One component for the full page and
  for the pane beside a chat, because the document must look the same in both
  — the only difference in the pane is that the rail is folded away.
*/

export function useMentionables(): Mentionable[] {
  const { docs } = useStore();
  return useMemo(
    () =>
      docs
        .filter((d) => d.status !== "archived")
        .map((d) => ({ id: d.id, label: d.title.split(" — ")[0], detail: typeSuffix(d.type, d.subtype) + (d.title.includes(" — ") ? ` · ${d.title.split(" — ").slice(1).join(" — ")}` : ""), type: d.type, hue: docTypes[d.type].hue })),
    [docs],
  );
}

export function DocView({
  doc,
  compact = false,
  onClose,
  onNavigate,
  className,
}: {
  doc: Document;
  /** Pane mode beside a chat: rail folded, smaller header. */
  compact?: boolean;
  onClose?: () => void;
  /** In compact mode, mention clicks swap the pane instead of routing. */
  onNavigate?: (id: string, anchor?: string | null) => void;
  className?: string;
}) {
  const store = useStore();
  const router = useRouter();
  const toast = useToast();
  const mentionables = useMentionables();

  const [editing, setEditing] = useState(false);
  /* The rail starts folded where two columns would not fit; the toggle still opens it. */
  const wide = useMediaQuery("(min-width: 1024px)");
  const [railPref, setRailPref] = useState<boolean | null>(null);
  const railOpen = railPref ?? (!compact && wide);
  const [ask, setAsk] = useState<{ open: boolean; question: string | null }>({ open: false, question: null });
  const [agentView, setAgentView] = useState(false);
  /* The title field follows the store unless the user is mid-edit of it. */
  const [title, setTitle] = useState(doc.title);
  const [seenTitle, setSeenTitle] = useState(doc.title);
  if (doc.title !== seenTitle) {
    setSeenTitle(doc.title);
    setTitle(doc.title);
  }

  const living = docTypes[doc.type].living;
  const generating = doc.status === "generating";

  /* Highlight the agent's last write once, then forget it. Derived during render, cleared on a timer. */
  const patchKey = doc.lastPatch ? `${doc.lastPatch.anchor}@${doc.lastPatch.at}` : null;
  const [seenPatch, setSeenPatch] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  if (patchKey && patchKey !== seenPatch) {
    setSeenPatch(patchKey);
    setHighlight(doc.lastPatch!.anchor);
  }
  useEffect(() => {
    if (!highlight) return;
    const t = setTimeout(() => setHighlight(null), 3000);
    return () => clearTimeout(t);
  }, [highlight]);

  const body = useRef<HTMLDivElement>(null);
  const jump = (anchor: string) => {
    const el = body.current?.querySelector<HTMLElement>(`[id="${CSS.escape(anchor)}"]`);
    el?.scrollIntoView({ block: "start", behavior: "smooth" });
    if (el) {
      el.classList.add("doc-patched");
      setTimeout(() => el.classList.remove("doc-patched"), 2000);
    }
  };

  /* Deep links: /documents/id#anchor. */
  useEffect(() => {
    if (compact) return;
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const t = setTimeout(() => {
      const el = body.current?.querySelector<HTMLElement>(`[id="${CSS.escape(hash)}"]`);
      el?.scrollIntoView({ block: "start" });
      el?.classList.add("doc-patched");
      setTimeout(() => el?.classList.remove("doc-patched"), 2000);
    }, 150);
    return () => clearTimeout(t);
  }, [doc.id, compact]);

  const openDoc = (id: string, anchor?: string | null) => {
    if (onNavigate) onNavigate(id, anchor);
    else router.push(`/documents/${id}${anchor ? `#${anchor}` : ""}`);
  };

  const openInChat = (question?: string) => {
    const id = store.createThread({ title: `About ${doc.title.split(" — ")[0]}`, docIds: [doc.id], scopedDocId: doc.id });
    if (question?.trim()) store.sendMessage(id, question, [doc.id]);
    router.push(`/chat/${id}`);
  };

  const createBrief = () => {
    const id = store.createThread({ title: `Brief from ${doc.title.split(" — ")[0]}`, docIds: [doc.id] });
    store.sendMessage(id, `Write a carousel brief from ${doc.title.split(" — ")[0]}. Hooks first.`, [doc.id], { type: "brief", subtype: "carousel" });
    router.push(`/chat/${id}`);
  };

  const toggleEdit = () => {
    if (editing) {
      store.commitEdit(doc.id);
      if (title.trim() && title !== doc.title) store.setTitle(doc.id, title.trim());
      toast({ title: "Saved", description: `v${doc.version + 1} of ${doc.title.split(" — ")[0]}` });
    }
    setEditing((e) => !e);
  };

  const copyAgentView = async () => {
    const rels = outgoing(store.relations, doc.id).map((r) => ({ type: r.type, target: r.to, anchor: r.anchor }));
    await navigator.clipboard?.writeText(`---\n${frontmatter(doc, rels)}\n---\n\n${doc.bodyMd}`);
    toast({ title: "Copied the agent view", description: "Frontmatter plus Markdown — exactly what the skills read." });
  };

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <header className={cn("flex items-start gap-3 border-b border-line", compact ? "px-5 py-3" : "px-8 pt-6 pb-4")}>
        <TypeIcon type={doc.type} size={compact ? "md" : "lg"} className="mt-0.5" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {editing ? (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => title.trim() && title !== doc.title && store.setTitle(doc.id, title.trim())}
              aria-label="Title"
              className={cn("w-full bg-transparent text-ink outline-none", compact ? "text-titles" : "text-sections")}
            />
          ) : (
            <h1 className={cn("text-ink", compact ? "truncate text-titles leading-6" : "text-sections")}>{doc.title}</h1>
          )}
          <div className="flex flex-wrap items-center gap-2 text-cap text-ink-secondary">
            <span>{typeSuffix(doc.type, doc.subtype)}</span>
            <StatusPill status={doc.status} />
            {living ? <FreshnessPill doc={doc} now={store.now} /> : null}
            <OwnerMark doc={doc} size="xs" withName />
            <span className="text-ink-disabled">
              · v{doc.version} · {relativeTime(doc.updatedAt, store.now)}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {!generating ? (
            <Button variant={editing ? "primary" : "secondary"} size="sm" onClick={toggleEdit}>
              {editing ? (
                <>
                  <Check /> Done
                </>
              ) : (
                <>
                  <Pencil /> Edit
                </>
              )}
            </Button>
          ) : null}
          <Button variant="spectrum" size="sm" onClick={() => setAsk({ open: true, question: null })} disabled={generating}>
            <Sparkles /> Ask
          </Button>
          {!compact ? (
            <Button variant="ghost" size="sm" onClick={() => openInChat()}>
              <MessageSquare /> Chat
            </Button>
          ) : null}
          <Menu
            align="end"
            trigger={(props) => (
              <IconButton aria-label="More" size="sm" {...props}>
                <MoreHorizontal />
              </IconButton>
            )}
          >
            <MenuItem icon={<FileCode2 />} onClick={() => setAgentView(true)}>
              Agent view
            </MenuItem>
            <MenuItem icon={<Copy />} onClick={copyAgentView}>
              Copy agent view
            </MenuItem>
            <MenuItem
              icon={<Copy />}
              onClick={() => {
                const id = store.duplicate(doc.id);
                openDoc(id);
              }}
            >
              Duplicate
            </MenuItem>
            {living ? (
              <>
                <MenuDivider />
                <MenuItem icon={<ShieldCheck />} onClick={() => store.verify([doc.id], 90)}>
                  Verify for 90 days
                </MenuItem>
                <MenuItem icon={<TriangleAlert />} onClick={() => store.flagOutdated([doc.id])}>
                  Flag as outdated
                </MenuItem>
                <MenuItem
                  icon={<RefreshCw />}
                  onClick={() => {
                    store.requestRefresh([doc.id]);
                    toast({ title: "Refresh queued", description: "The skill will propose a diff you accept per section." });
                  }}
                >
                  Request refresh
                </MenuItem>
              </>
            ) : null}
            {!brandTypes.includes(doc.type) && doc.status !== "archived" ? (
              <>
                <MenuDivider />
                <MenuItem
                  icon={<Archive />}
                  destructive
                  onClick={() => {
                    store.archive([doc.id]);
                    toast({ title: "Archived", action: { label: "Undo", onClick: () => store.restore([doc.id]) } });
                    if (!compact) router.push("/documents");
                  }}
                >
                  Archive
                </MenuItem>
              </>
            ) : null}
          </Menu>
          {!compact ? (
            <IconButton aria-label={railOpen ? "Hide rail" : "Show rail"} size="sm" onClick={() => setRailPref(!railOpen)}>
              {railOpen ? <PanelRightClose /> : <PanelRightOpen />}
            </IconButton>
          ) : (
            <Tooltip label="Open full page">
              <IconButton aria-label="Open full page" size="sm" onClick={() => router.push(`/documents/${doc.id}`)}>
                <Maximize2 />
              </IconButton>
            </Tooltip>
          )}
          {onClose ? (
            <IconButton aria-label="Close document" size="sm" onClick={onClose}>
              <X />
            </IconButton>
          ) : null}
        </div>
      </header>

      {generating ? <GeneratingBar className="rounded-none" /> : null}

      <div className="flex min-h-0 flex-1">
        <div ref={body} className={cn("min-w-0 flex-1 overflow-y-auto", compact ? "px-6 py-5" : "px-8 py-8")}>
          <div className={cn("mx-auto flex flex-col gap-6", compact ? "max-w-[640px]" : "max-w-[720px]")}>
            {doc.pendingDiff ? (
              <PendingDiffPanel
                doc={doc}
                diff={doc.pendingDiff}
                now={store.now}
                onResolve={(anchor, accept) => store.resolveDiffSection(doc.id, anchor, accept)}
                onResolveAll={(accept) => store.resolveDiffAll(doc.id, accept)}
              />
            ) : null}
            {doc.status === "archived" ? (
              <div className="flex items-center justify-between rounded-control bg-card px-4 py-2.5 text-cap text-ink-secondary">
                This document is archived. It still resolves as a source for anything that pointed at it.
                <Button size="sm" variant="secondary" onClick={() => store.restore([doc.id])}>
                  Restore
                </Button>
              </div>
            ) : null}
            <DocEditor
              body={doc.body}
              revision={doc.bodyRevision}
              editable={editing && !generating}
              onChange={(b) => store.updateBody(doc.id, b)}
              onCommit={() => store.commitEdit(doc.id)}
              mentionables={mentionables}
              citations={store.citations}
              onAskAbout={(sel) => setAsk({ open: true, question: sel ? `About “${sel.slice(0, 140)}${sel.length > 140 ? "…" : ""}” — ` : null })}
              onOpenDoc={openDoc}
              highlightAnchor={highlight}
            />
            {generating ? (
              <p className="flex items-center gap-2 text-cap text-ink-disabled">
                <span className="size-1.5 animate-breathe rounded-full bg-spectrum-green" />
                The {docTypes[doc.type].skill} skill is writing. Sections appear as they finish.
              </p>
            ) : null}
            {!generating && !editing && doc.body.content.length <= 1 && !doc.bodyMd.trim() ? (
              <div className="rounded-card bg-panel px-6 py-10 text-center">
                <p className="text-titles text-ink">Nothing here yet</p>
                <p className="pt-1 text-default text-ink-secondary">Start writing, or ask the agent to draft it from the template.</p>
                <div className="flex justify-center gap-2 pt-4">
                  <Button onClick={toggleEdit}>
                    <Pencil /> Write
                  </Button>
                  <Button variant="spectrum" onClick={() => setAsk({ open: true, question: "Draft this from the template" })}>
                    <Sparkles /> Ask the agent
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
        {railOpen ? <DocRail doc={doc} onJump={jump} className="border-l border-line px-4 py-3 overflow-y-auto" /> : null}
      </div>

      <AskModal
        doc={doc}
        open={ask.open}
        onClose={() => setAsk((a) => ({ ...a, open: false }))}
        initialQuestion={ask.question}
        onContinueInChat={(q) => {
          setAsk({ open: false, question: null });
          openInChat(q);
        }}
        onCreateBrief={() => {
          setAsk({ open: false, question: null });
          createBrief();
        }}
      />

      <Dialog open={agentView} onClose={() => setAgentView(false)} size="lg">
        <DialogHeader title="Agent view" description="Frontmatter plus Markdown. This is the whole document as far as any skill is concerned; the editor's JSON never leaves the client." onClose={() => setAgentView(false)} />
        <DialogBody>
          <pre className="overflow-x-auto rounded-control bg-canvas p-4 font-mono text-cap leading-5 whitespace-pre-wrap text-ink-secondary">
            {`---\n${frontmatter(
              doc,
              outgoing(store.relations, doc.id).map((r) => ({ type: r.type, target: r.to, anchor: r.anchor })),
            )}\n---\n\n${doc.bodyMd}`}
          </pre>
        </DialogBody>
      </Dialog>
    </div>
  );
}
