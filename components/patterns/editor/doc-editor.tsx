"use client";

import { TableKit } from "@tiptap/extension-table";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Placeholder, TrailingNode } from "@tiptap/extensions";
import { EditorContent, useEditor, type Editor, type JSONContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import {
  ArrowUpRight,
  Bold,
  Code,
  Compass,
  FlaskConical,
  Heading2,
  Heading3,
  Italic,
  Lightbulb,
  Link as LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  MessageSquareText,
  Minus,
  Quote,
  Sparkles,
  Table2,
  Target,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Toolbar, ToolbarDivider } from "@/components/ui/toolbar";
import { cn } from "@/lib/cn";
import { slugify } from "@/lib/documents/registry";
import type { Body, BodyNode, Citation as CitationData, DocType } from "@/lib/documents/types";

import { AnchorBlock, Callout, Citation, DocMention, HeadingWithId, MentionContext, Swatch, type MentionResolver } from "./extensions";

/*
  Stage 4. One component draws documents in both states — read and edit — so
  nothing moves when the user starts typing. The read view is the editor with
  editing off; the chips, blocks and TOC anchors are identical in both.

  Two menus are ours rather than Tiptap's: the "/" block menu and the "@"
  mention menu share one trigger detector, because both are "what did the user
  just type at the caret". The bubble toolbar is Tiptap's, with one addition:
  Ask about this, which sends the selection to the agent.
*/

export type Mentionable = { id: string; label: string; detail?: string; type: DocType; hue: string };

export type DocEditorProps = {
  body: Body;
  /** Bump to force the editor to reload `body` — the agent wrote, or a version was restored. */
  revision: number;
  editable: boolean;
  onChange?: (body: Body) => void;
  /** Fires when focus leaves the editor after edits; the store folds these into a version. */
  onCommit?: () => void;
  mentionables?: Mentionable[];
  citations?: Record<string, CitationData>;
  onAskAbout?: (selection: string) => void;
  onOpenDoc?: (docId: string, anchor?: string | null) => void;
  /** Anchor id (heading slug or block anchor) to flash after the next reload. */
  highlightAnchor?: string | null;
  placeholder?: string;
  className?: string;
};

type Trigger = { mode: "slash" | "mention"; query: string; from: number; to: number; left: number; top: number; caretTop: number };

/** Fixed-position menus open below their anchor, or above it when the viewport runs out. */
function place(left: number, below: number, above: number, width: number, estHeight: number): React.CSSProperties {
  const flip = below + estHeight > window.innerHeight - 8;
  return {
    left: Math.max(8, Math.min(left, window.innerWidth - width - 8)),
    ...(flip ? { bottom: window.innerHeight - above } : { top: below }),
  };
}

type SlashItem = { label: string; hint: string; icon: LucideIcon; keywords: string; run: (e: Editor) => void };

const slashItems: SlashItem[] = [
  { label: "Section", hint: "H2 — a section the agent can address", icon: Heading2, keywords: "heading h2 section", run: (e) => e.chain().focus().setNode("heading", { level: 2 }).run() },
  { label: "Subheading", hint: "H3", icon: Heading3, keywords: "heading h3 sub", run: (e) => e.chain().focus().setNode("heading", { level: 3 }).run() },
  { label: "Bullet list", hint: "", icon: List, keywords: "bullet list ul", run: (e) => e.chain().focus().toggleBulletList().run() },
  { label: "Numbered list", hint: "", icon: ListOrdered, keywords: "numbered ordered list ol", run: (e) => e.chain().focus().toggleOrderedList().run() },
  { label: "Checklist", hint: "QA checks, to-dos", icon: ListChecks, keywords: "task check todo qa", run: (e) => e.chain().focus().toggleTaskList().run() },
  { label: "Quote", hint: "", icon: Quote, keywords: "quote blockquote", run: (e) => e.chain().focus().toggleBlockquote().run() },
  { label: "Table", hint: "3 × 3 with a header row", icon: Table2, keywords: "table grid", run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { label: "Callout", hint: "Info, caution, positive, critical", icon: Lightbulb, keywords: "callout note warning", run: (e) => e.chain().focus().setCallout("info").run() },
  { label: "Angle", hint: "Repeating block with a stable anchor", icon: Target, keywords: "angle block anchor", run: (e) => e.chain().focus().insertAnchorBlock("angle").run() },
  { label: "Pillar", hint: "Repeating block with a stable anchor", icon: Compass, keywords: "pillar block anchor", run: (e) => e.chain().focus().insertAnchorBlock("pillar").run() },
  { label: "Hypothesis", hint: "Repeating block with a stable anchor", icon: FlaskConical, keywords: "hypothesis test block", run: (e) => e.chain().focus().insertAnchorBlock("hypothesis").run() },
  { label: "Divider", hint: "", icon: Minus, keywords: "divider rule hr", run: (e) => e.chain().focus().setHorizontalRule().run() },
];

/** Every heading gets its slug as id, so the JSON the store keeps is addressable. */
function normalize(json: JSONContent): Body {
  const walk = (n: JSONContent): BodyNode => {
    const out: BodyNode = { type: n.type ?? "paragraph" };
    if (n.attrs) out.attrs = { ...n.attrs };
    if (n.text !== undefined) out.text = n.text;
    if (n.marks) out.marks = n.marks.map((m) => ({ type: m.type, ...(m.attrs ? { attrs: m.attrs } : {}) }));
    if (n.content) out.content = n.content.map(walk);
    if (out.type === "heading") {
      const text = (out.content ?? []).map((c) => c.text ?? (c.type === "citation" ? String(c.attrs?.ref ?? "") : "")).join("");
      out.attrs = { ...out.attrs, id: slugify(text) || out.attrs?.id || null };
    }
    return out;
  };
  return { type: "doc", content: (json.content ?? []).map(walk) };
}

export function DocEditor({
  body,
  revision,
  editable,
  onChange,
  onCommit,
  mentionables = [],
  citations = {},
  onAskAbout,
  onOpenDoc,
  highlightAnchor,
  placeholder = "Write, or type / for blocks and @ to mention a document",
  className,
}: DocEditorProps) {
  const [trigger, setTrigger] = useState<Trigger | null>(null);
  const triggerRef = useRef<Trigger | null>(null);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const itemsRef = useRef<{ run: () => void }[]>([]);
  const wrap = useRef<HTMLDivElement>(null);

  const extensions = useMemo(
    () => [
      StarterKit.configure({ heading: false, link: { openOnClick: false, autolink: true } }),
      HeadingWithId,
      TaskList,
      TaskItem.configure({ nested: false }),
      TableKit.configure({ table: { resizable: true } }),
      Callout,
      AnchorBlock,
      Citation,
      DocMention,
      Swatch,
      /* There is always a paragraph after the last table or block, so the caret has somewhere to go. */
      TrailingNode,
      Placeholder.configure({
        placeholder: ({ node, editor }) => {
          if (node.type.name === "heading") return "Section heading";
          if (editor.state.doc.childCount <= 1) return placeholder;
          return "Type / for a block";
        },
        includeChildren: false,
      }),
    ],
    [placeholder],
  );

  const detectTrigger = (editor: Editor) => {
    const { state } = editor;
    const { $from, empty } = state.selection;
    if (!empty || !editor.isEditable) {
      triggerRef.current = null;
      setTrigger(null);
      return;
    }
    const before = $from.parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");
    const slash = /(?:^|\s)\/([\w-]*)$/.exec(before);
    const mention = /(?:^|\s)@([^@\n]{0,40})$/.exec(before);
    const m = slash ?? mention;
    if (!m) {
      triggerRef.current = null;
      setTrigger(null);
      return;
    }
    const mode = slash ? "slash" : "mention";
    const from = $from.pos - m[1].length - 1;
    const coords = editor.view.coordsAtPos(from);
    const next: Trigger = { mode, query: m[1], from, to: $from.pos, left: coords.left, top: coords.bottom + 6, caretTop: coords.top - 6 };
    triggerRef.current = next;
    setTrigger(next);
    indexRef.current = 0;
    setIndex(0);
  };

  const editor = useEditor({
    extensions,
    content: body as JSONContent,
    editable,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: { class: "doc-prose", spellcheck: "false" },
      handleKeyDown: (_view, event) => {
        const t = triggerRef.current;
        if (!t) return false;
        const items = itemsRef.current;
        if (event.key === "ArrowDown") {
          indexRef.current = (indexRef.current + 1) % Math.max(1, items.length);
          setIndex(indexRef.current);
          return true;
        }
        if (event.key === "ArrowUp") {
          indexRef.current = (indexRef.current - 1 + Math.max(1, items.length)) % Math.max(1, items.length);
          setIndex(indexRef.current);
          return true;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          if (items[indexRef.current]) {
            items[indexRef.current].run();
            return true;
          }
        }
        if (event.key === "Escape") {
          triggerRef.current = null;
          setTrigger(null);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(normalize(editor.getJSON()));
      detectTrigger(editor);
    },
    onSelectionUpdate: ({ editor }) => detectTrigger(editor),
    onBlur: () => {
      /* Let a click on the trigger menu land before the menu goes away. */
      setTimeout(() => {
        triggerRef.current = null;
        setTrigger(null);
      }, 120);
      onCommit?.();
    },
  });

  useEffect(() => {
    if (editor && editor.isEditable !== editable) editor.setEditable(editable);
  }, [editor, editable]);

  /* Mention chips read their labels from this, so they follow the live document list. */
  const resolveMention = useMemo<MentionResolver>(
    () => (id) => {
      const m = mentionables.find((x) => x.id === id);
      return m ? { label: m.label, hue: m.hue } : null;
    },
    [mentionables],
  );

  /* Reload when someone other than this editor wrote the body. */
  const seen = useRef(revision);
  useEffect(() => {
    if (!editor || seen.current === revision) return;
    seen.current = revision;
    /*
      Deferred past React's commit: new node views render with flushSync, which
      React refuses to do from inside an effect.
    */
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled || editor.isDestroyed) return;
      const wasFocused = editor.isFocused;
      editor.commands.setContent(body as JSONContent, { emitUpdate: false });
      if (wasFocused) editor.commands.focus("end");
    });
    return () => {
      cancelled = true;
    };
  }, [editor, revision, body]);

  /* Flash the section the agent just touched. */
  useEffect(() => {
    if (!editor || !highlightAnchor || !wrap.current) return;
    const raf = requestAnimationFrame(() => {
      const root = wrap.current;
      if (!root) return;
      const el = root.querySelector<HTMLElement>(`[id="${CSS.escape(highlightAnchor)}"]`);
      if (!el) return;
      const targets: HTMLElement[] = [el];
      if (el.tagName === "H2") {
        let sib = el.nextElementSibling as HTMLElement | null;
        while (sib && sib.tagName !== "H2") {
          targets.push(sib);
          sib = sib.nextElementSibling as HTMLElement | null;
        }
      }
      targets.forEach((t) => t.classList.add("doc-patched"));
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      setTimeout(() => targets.forEach((t) => t.classList.remove("doc-patched")), 2600);
    });
    return () => cancelAnimationFrame(raf);
  }, [editor, highlightAnchor, revision]);

  /* ------------------------------------------------------ trigger menu --- */

  const menuItems = buildMenuItems(trigger, editor, mentionables, () => setTrigger(null));
  /* The key handler reads these through refs so it never sees a stale closure. */
  useEffect(() => {
    itemsRef.current = menuItems;
    triggerRef.current = trigger;
  });

  /* -------------------------------------------------------- chip hover --- */

  const [hover, setHover] = useState<{ kind: "citation" | "mention"; ref: string; anchor: string | null; left: number; top: number; chipTop: number } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onMouseOver = (e: React.MouseEvent) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>(".doc-chip");
    if (!chip) return;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    const r = chip.getBoundingClientRect();
    const kind = chip.dataset.kind === "citation" ? "citation" : "mention";
    setHover({ kind, ref: kind === "citation" ? (chip.dataset.ref ?? "") : (chip.dataset.docId ?? ""), anchor: chip.dataset.anchor ?? null, left: r.left, top: r.bottom + 6, chipTop: r.top - 6 });
  };
  const onMouseOut = (e: React.MouseEvent) => {
    const chip = (e.target as HTMLElement).closest(".doc-chip");
    if (!chip) return;
    hoverTimer.current = setTimeout(() => setHover(null), 160);
  };
  const onClick = (e: React.MouseEvent) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>(".doc-chip");
    if (!chip) return;
    if (chip.dataset.kind === "mention" && chip.dataset.docId) {
      e.preventDefault();
      onOpenDoc?.(chip.dataset.docId, chip.dataset.anchor ?? null);
    } else if (chip.dataset.kind === "citation" && chip.dataset.ref) {
      const c = citations[chip.dataset.ref];
      if (c) {
        e.preventDefault();
        onOpenDoc?.(c.source, c.anchor ?? null);
      }
    }
  };

  const hoverCitation = hover?.kind === "citation" ? citations[hover.ref] : undefined;
  const hoverMention = hover?.kind === "mention" ? mentionables.find((m) => m.id === hover.ref) : undefined;

  const askSelection = () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    onAskAbout?.(editor.state.doc.textBetween(from, to, " "));
  };

  return (
    <div
      ref={wrap}
      className={cn("doc-editor relative", className)}
      onMouseOver={onMouseOver}
      onMouseOut={onMouseOut}
      onMouseLeave={() => setHover(null)}
      onClick={onClick}
    >
      <MentionContext.Provider value={resolveMention}>
        <EditorContent editor={editor} />
      </MentionContext.Provider>

      {editor ? (
        <BubbleMenu
          editor={editor}
          shouldShow={({ editor: e, from, to }) => from !== to && e.state.doc.textBetween(from, to, " ").trim().length > 0}
          options={{ placement: "top", offset: 8 }}
          style={{ zIndex: "var(--z-floating-bar)" }}
        >
          <Toolbar className="animate-pop">
            {editable ? (
              <>
                <ToolButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
                  <Bold />
                </ToolButton>
                <ToolButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
                  <Italic />
                </ToolButton>
                <ToolButton label="Code" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}>
                  <Code />
                </ToolButton>
                <ToolButton
                  label="Link"
                  active={editor.isActive("link")}
                  onClick={() => {
                    const prev = editor.getAttributes("link").href as string | undefined;
                    const href = window.prompt("Link URL", prev ?? "https://");
                    if (href === null) return;
                    if (!href) editor.chain().focus().unsetLink().run();
                    else editor.chain().focus().setLink({ href }).run();
                  }}
                >
                  <LinkIcon />
                </ToolButton>
                <ToolbarDivider />
                <ToolButton label="Section" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
                  <Heading2 />
                </ToolButton>
                <ToolButton label="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
                  <List />
                </ToolButton>
                <ToolButton label="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
                  <Quote />
                </ToolButton>
                <ToolbarDivider />
              </>
            ) : null}
            {onAskAbout ? (
              <Button variant="spectrum" size="sm" onClick={askSelection} className="h-8">
                <Sparkles /> Ask about this
              </Button>
            ) : null}
          </Toolbar>
        </BubbleMenu>
      ) : null}

      {trigger && !menuItems.length && trigger.query ? (
        <div
          role="status"
          className="fixed w-[300px] rounded-control bg-panel px-3 py-2 text-cap text-ink-disabled shadow-overlay animate-pop"
          style={{ ...place(trigger.left, trigger.top, trigger.caretTop, 300, 40), zIndex: "var(--z-floating-bar)" }}
        >
          {trigger.mode === "slash" ? `No block matches “${trigger.query}”` : `No document matches “${trigger.query}”`}
        </div>
      ) : null}

      {trigger && menuItems.length ? (
        <div
          role="listbox"
          aria-label={trigger.mode === "slash" ? "Insert block" : "Mention a document"}
          className="fixed w-[300px] rounded-control bg-panel p-1.5 shadow-overlay animate-pop"
          style={{ ...place(trigger.left, trigger.top, trigger.caretTop, 300, 44 + menuItems.length * 36), zIndex: "var(--z-floating-bar)" }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="px-2.5 pt-1 pb-1.5 text-cap text-ink-disabled">{trigger.mode === "slash" ? "Insert" : "Mention a document"}</div>
          {menuItems.map((it, i) => (
            <button
              key={it.key}
              type="button"
              role="option"
              aria-selected={i === index}
              onMouseEnter={() => {
                indexRef.current = i;
                setIndex(i);
              }}
              onClick={it.run}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-1.5 text-left text-default text-ink outline-none",
                i === index ? "bg-[var(--state-selected)]" : "hover:bg-[var(--state-hover)]",
              )}
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded bg-raised text-ink-secondary">{it.icon}</span>
              <span className="min-w-0 flex-1 truncate">{it.label}</span>
              {it.hint ? <span className="max-w-[45%] truncate text-tiny text-ink-disabled">{it.hint}</span> : null}
            </button>
          ))}
        </div>
      ) : null}

      {hover && (hoverCitation || hoverMention) ? (
        <div
          role="tooltip"
          className="fixed w-[320px] rounded-control bg-panel p-3 shadow-overlay animate-pop"
          style={{ ...place(hover.left, hover.top, hover.chipTop, 320, 140), zIndex: "var(--z-tooltip)" }}
          onMouseEnter={() => hoverTimer.current && clearTimeout(hoverTimer.current)}
          onMouseLeave={() => setHover(null)}
        >
          {hoverCitation ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <MessageSquareText className="size-3.5 text-ink-disabled" />
                <span className="font-mono text-tiny text-ink-secondary">{hoverCitation.ref}</span>
                {hoverCitation.meta ? <span className="truncate text-tiny text-ink-disabled">{hoverCitation.meta}</span> : null}
              </div>
              <p className="text-default leading-5 text-ink">“{hoverCitation.text}”</p>
              <button
                type="button"
                className="mt-0.5 inline-flex items-center gap-1 self-start text-cap text-ink-secondary hover:text-ink"
                onClick={() => onOpenDoc?.(hoverCitation.source, hoverCitation.anchor ?? null)}
              >
                {hoverCitation.sourceLabel} <ArrowUpRight className="size-3" />
              </button>
            </div>
          ) : hoverMention ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ background: `var(--color-type-${hoverMention.hue})` }} />
                <span className="truncate text-default text-ink">{hoverMention.label}</span>
              </div>
              {hoverMention.detail ? <p className="text-cap text-ink-secondary">{hoverMention.detail}</p> : null}
              {hover.anchor ? <p className="font-mono text-tiny text-ink-disabled">#{hover.anchor}</p> : null}
              <button
                type="button"
                className="mt-0.5 inline-flex items-center gap-1 self-start text-cap text-ink-secondary hover:text-ink"
                onClick={() => onOpenDoc?.(hoverMention.id, hover.anchor)}
              >
                Open <ArrowUpRight className="size-3" />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

type MenuItemSpec = { key: string; label: string; hint: string; icon: React.ReactNode; run: () => void };

function buildMenuItems(trigger: Trigger | null, editor: Editor | null, mentionables: Mentionable[], close: () => void): MenuItemSpec[] {
  if (!trigger || !editor) return [];
  const q = trigger.query.toLowerCase().trim();
  const finish = (fn: () => void) => () => {
    editor.chain().focus().deleteRange({ from: trigger.from, to: trigger.to }).run();
    /* A block command inside an empty list item has nothing to act on; leave the list first. */
    for (let guard = 0; guard < 4; guard++) {
      const { $from } = editor.state.selection;
      const item = $from.depth >= 2 ? $from.node(-1).type.name : null;
      if ($from.parent.content.size !== 0 || (item !== "listItem" && item !== "taskItem")) break;
      if (!editor.chain().focus().liftListItem(item).run()) break;
    }
    fn();
    close();
  };
  if (trigger.mode === "slash") {
    return slashItems
      .filter((it) => !q || it.label.toLowerCase().includes(q) || it.keywords.includes(q))
      .map((it) => ({ key: it.label, label: it.label, hint: it.hint, icon: <it.icon className="size-4" />, run: finish(() => it.run(editor)) }));
  }
  return mentionables
    .filter((m) => !q || m.label.toLowerCase().includes(q) || m.detail?.toLowerCase().includes(q))
    .slice(0, 8)
    .map((m) => ({
      key: m.id,
      label: m.label,
      hint: m.detail ?? "",
      icon: <span className="size-2 rounded-full" style={{ background: `var(--color-type-${m.hue})` }} />,
      run: finish(() => editor.chain().focus().insertDocMention(m.id).run()),
    }));
}

function ToolButton({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-[8px] outline-none transition-colors [&>svg]:size-4",
        active ? "bg-[var(--state-selected)] text-ink" : "text-ink-secondary hover:bg-[var(--state-hover)] hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
