"use client";

import { ArrowUp, AtSign, Images, Paperclip, Plus, Square, Wand2, X } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Kbd } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { Menu, MenuDivider, MenuItem, MenuLabel } from "@/components/ui/menu";
import { cn } from "@/lib/cn";

import { contextKinds } from "./kinds";
import { MentionMenu, mentionHits, type MentionHit } from "./mention-menu";
import type { Attachment, ContextKind, ContextSource } from "./types";

/**
 * The one place the user talks to the model.
 *
 * A tray holds two things: the panel, and the pill row beneath it. The panel
 * is the message — attached documents along its top, the text, and a bar of
 * tools that change *this* message (add, prompts, send). The pills beneath
 * change what the model knows for the whole conversation, so they sit outside
 * the message but inside the tray: one object, two jobs.
 *
 * Typing `@` opens the mention menu over the panel; choosing a document
 * attaches it and removes the `@query` from the text. The `+` button reaches
 * the same places for people who do not know the shortcut.
 */
export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  generating = false,
  placeholder = "Ask for a strategy, a persona, a brief — or @ a document to work from",
  attachments = [],
  onRemoveAttachment,
  mentionSources = [],
  onMention,
  onBrowse,
  tools,
  context,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  generating?: boolean;
  placeholder?: string;
  /** Documents attached to this message by @-mention or from the + menu. */
  attachments?: Attachment[];
  onRemoveAttachment?: (id: string) => void;
  /** What `@` can reach. Usually every document source plus assets. */
  mentionSources?: ContextSource[];
  onMention?: (hit: MentionHit) => void;
  /** Open the full picker for a kind — from the + menu or the mention menu's footer. */
  onBrowse?: (kind?: ContextKind) => void;
  /** Extra controls for the bottom-left of the bar — QuickPrompts lives here. */
  tools?: ReactNode;
  /** The pill row beneath the panel. */
  context?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const canSend = value.trim().length > 0 && !generating;

  /* Grow with the content, up to roughly eight lines; scroll after that. */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.max(48, Math.min(el.scrollHeight, 8 * 24))}px`;
  }, [value]);

  /* ---- @ mentions ------------------------------------------------- */
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [active, setActive] = useState(0);

  const hits = useMemo(
    () => (mention ? mentionHits(mentionSources, mention.query) : []),
    [mention, mentionSources],
  );
  const attachedIds = attachments.map((a) => a.id);

  const detect = (text: string, caret: number) => {
    const before = text.slice(0, caret);
    const m = /(^|\s)@([^\s@]*)$/.exec(before);
    if (m && mentionSources.length) {
      setMention({ start: caret - m[2].length - 1, query: m[2] });
      setActive(0);
    } else {
      setMention(null);
    }
  };

  const pick = (hit: MentionHit) => {
    if (mention) {
      const el = ref.current;
      const caret = el?.selectionStart ?? value.length;
      const next = value.slice(0, mention.start) + value.slice(caret);
      onChange(next.replace(/\s{2,}/g, " "));
      setMention(null);
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(mention.start, mention.start);
      });
    }
    onMention?.(hit);
  };

  const insertAt = () => {
    const el = ref.current;
    const caret = el?.selectionStart ?? value.length;
    const needsSpace = caret > 0 && !/\s$/.test(value.slice(0, caret));
    const next = `${value.slice(0, caret)}${needsSpace ? " " : ""}@${value.slice(caret)}`;
    onChange(next);
    const pos = caret + (needsSpace ? 2 : 1);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(pos, pos);
      detect(next, pos);
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => Math.min(i + 1, Math.max(hits.length - 1, 0)));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        return;
      }
      if ((e.key === "Enter" || e.key === "Tab") && hits[active]) {
        e.preventDefault();
        pick(hits[active]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMention(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSend();
    }
  };

  return (
    <div className={cn("flex flex-col gap-1.5 rounded-[24px] bg-panel p-1.5", className)}>
      <div
        className={cn(
          "relative flex flex-col rounded-[var(--radius-overlay)] bg-card p-3 pb-2",
          "ring-1 ring-transparent transition-shadow duration-150 focus-within:ring-line-strong",
        )}
      >
        {mention ? (
          <div className="absolute bottom-[calc(100%+8px)] left-0" style={{ zIndex: "var(--z-floating-bar)" }}>
            <MentionMenu
              hits={hits}
              query={mention.query}
              activeIndex={active}
              attached={attachedIds}
              onPick={pick}
              onHover={setActive}
              onBrowse={onBrowse ? () => {
                setMention(null);
                onBrowse();
              } : undefined}
            />
          </div>
        ) : null}

        {attachments.length ? (
          <div className="flex flex-wrap items-center gap-1.5 px-0.5 pb-2.5">
            {attachments.map((a) => (
              <AttachedChip key={a.id} attachment={a} onRemove={onRemoveAttachment} />
            ))}
          </div>
        ) : null}

        <textarea
          ref={ref}
          rows={2}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            detect(e.target.value, e.target.selectionStart ?? e.target.value.length);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => setTimeout(() => setMention(null), 120)}
          placeholder={placeholder}
          aria-label="Message"
          aria-autocomplete="list"
          aria-haspopup="listbox"
          className={cn(
            "min-h-12 w-full resize-none bg-transparent px-1 pt-0.5 text-default leading-6 text-ink outline-none",
            "placeholder:text-ink/45",
          )}
        />

        <div className="flex items-center justify-between gap-2 pt-2">
          <div className="flex items-center gap-0.5">
            <Menu
              trigger={(props) => (
                <IconButton aria-label="Add" size="sm" variant="secondary" {...props}>
                  <Plus />
                </IconButton>
              )}
            >
              <MenuLabel>Add to this message</MenuLabel>
              <MenuItem icon={<AtSign />} shortcut="@" onClick={insertAt}>
                Mention a document
              </MenuItem>
              <MenuItem icon={<Images />} onClick={() => onBrowse?.("asset")}>
                Add from assets
              </MenuItem>
              <MenuItem icon={<Paperclip />}>Attach files</MenuItem>
              <MenuDivider />
              <MenuItem icon={<Wand2 />} shortcut="/" onClick={() => onBrowse?.("skill")}>
                Use a skill
              </MenuItem>
            </Menu>
            {tools}
          </div>
          <div className="flex items-center gap-2.5">
            {canSend ? (
              <span className="hidden items-center gap-1 text-cap text-ink-disabled sm:flex">
                <Kbd>⏎</Kbd>
              </span>
            ) : null}
            {generating ? (
              <IconButton aria-label="Stop generating" variant="secondary" size="sm" onClick={onStop}>
                <Square className="fill-current" />
              </IconButton>
            ) : (
              <IconButton aria-label="Send" variant="primary" size="sm" disabled={!canSend} onClick={onSend}>
                <ArrowUp strokeWidth={2.25} />
              </IconButton>
            )}
          </div>
        </div>
      </div>

      {context ? <div className="flex flex-wrap items-center gap-1.5 px-1.5 pt-0.5 pb-1">{context}</div> : null}
    </div>
  );
}

/**
 * A document attached to this message. Small and inside the panel, so it is
 * clearly part of what is about to be sent — unlike a pill, which is part of
 * the conversation.
 */
export function AttachedChip({
  attachment,
  onRemove,
}: {
  attachment: Attachment;
  onRemove?: (id: string) => void;
}) {
  const Icon = contextKinds[attachment.kind].icon;
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-[8px] bg-raised pr-1 pl-2 text-cap text-ink">
      <Icon className="size-3.5 text-ink-secondary" />
      <span className="max-w-[180px] truncate">{attachment.label}</span>
      {onRemove ? (
        <button
          type="button"
          aria-label={`Remove ${attachment.label}`}
          onClick={() => onRemove(attachment.id)}
          className="flex size-5 items-center justify-center rounded-[6px] text-ink-secondary hover:bg-line-strong hover:text-ink"
        >
          <X className="size-3" />
        </button>
      ) : (
        <span className="w-1" />
      )}
    </span>
  );
}
