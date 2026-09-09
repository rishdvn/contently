"use client";

import { Heading } from "@tiptap/extension-heading";
import { mergeAttributes, Node } from "@tiptap/core";
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { AlertTriangle, CheckCircle2, Info, Link2, XCircle } from "lucide-react";
import { createContext, useContext } from "react";

import { Badge } from "@/components/ui/badge";
import { Menu, MenuItem } from "@/components/ui/menu";
import { slugify } from "@/lib/documents/registry";

/*
  The node set the Markdown dialect round-trips with. Everything else in the
  editor comes from StarterKit, the list kit and the table kit. These five are
  ours because the PRD needs them: stable heading ids for the TOC and for
  section patches; repeating blocks other docs can point at; citation and
  mention chips that resolve on hover; colour swatches in the Visual System.
*/

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: { setCallout: (tone?: string) => ReturnType };
    anchorBlock: { insertAnchorBlock: (kind: "angle" | "pillar" | "hypothesis") => ReturnType };
    docMention: { insertDocMention: (docId: string, anchor?: string | null) => ReturnType };
  }
}

/* ------------------------------------------------------------- heading --- */

/** Headings carry an `id` so the TOC and the agent can address a section. */
export const HeadingWithId = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute("id"),
        renderHTML: (attrs) => (attrs.id ? { id: attrs.id } : {}),
      },
    };
  },
}).configure({ levels: [2, 3] });

/* ------------------------------------------------------------- callout --- */

const toneIcon = {
  info: <Info />,
  caution: <AlertTriangle />,
  positive: <CheckCircle2 />,
  critical: <XCircle />,
} as const;

function CalloutView({ node, updateAttributes, editor }: NodeViewProps) {
  const tone = (node.attrs.tone as keyof typeof toneIcon) ?? "info";
  const editable = editor.isEditable;
  const icon = (
    <span className="mt-[3px] shrink-0 [&>svg]:size-4" contentEditable={false}>
      {toneIcon[tone] ?? toneIcon.info}
    </span>
  );
  return (
    <NodeViewWrapper className="doc-callout flex items-start gap-2.5" data-tone={tone}>
      {editable ? (
        <span contentEditable={false} className="shrink-0">
          <Menu
            trigger={(props) => (
              <button type="button" aria-label="Change tone" className="mt-[3px] rounded p-0.5 hover:bg-[var(--state-hover)] [&>svg]:size-4" {...props}>
                {toneIcon[tone] ?? toneIcon.info}
              </button>
            )}
          >
            {(Object.keys(toneIcon) as (keyof typeof toneIcon)[]).map((t) => (
              <MenuItem key={t} icon={toneIcon[t]} onClick={() => updateAttributes({ tone: t })}>
                {t[0].toUpperCase() + t.slice(1)}
              </MenuItem>
            ))}
          </Menu>
        </span>
      ) : (
        icon
      )}
      <NodeViewContent className="min-w-0 flex-1" />
    </NodeViewWrapper>
  );
}

export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    return { tone: { default: "info" } };
  },
  parseHTML() {
    return [{ tag: "div.doc-callout", getAttrs: (el) => ({ tone: (el as HTMLElement).dataset.tone ?? "info" }) }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { class: "doc-callout", "data-tone": HTMLAttributes.tone }), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },
  addCommands() {
    return {
      setCallout:
        (tone = "info") =>
        ({ commands, state }) => {
          if (commands.wrapIn(this.name, { tone })) return true;
          /* Somewhere a wrap is not allowed (a table cell, a nested block): insert one after instead. */
          const end = state.selection.$from.after(1);
          return commands.insertContentAt(end, { type: this.name, attrs: { tone }, content: [{ type: "paragraph" }] });
        },
    };
  },
});

/* -------------------------------------------------------- anchor block --- */

const kindLabel = { angle: "Angle", pillar: "Pillar", hypothesis: "Hypothesis" } as const;
const statusTone = (s: string | null) =>
  s === "winning" || s === "active" || s === "validated" ? "positive" : s === "testing" || s === "untested" ? "caution" : s === "retired" || s === "killed" ? "critical" : "neutral";

function AnchorBlockView({ node, updateAttributes, editor }: NodeViewProps) {
  const kind = node.attrs.kind as keyof typeof kindLabel;
  const title = String(node.attrs.title ?? "");
  const status = (node.attrs.status as string | null) ?? null;
  const anchorId = String(node.attrs.anchorId ?? "");
  const editable = editor.isEditable;

  return (
    <NodeViewWrapper className="doc-anchor-block" data-anchor-id={anchorId} id={anchorId}>
      <header className="mb-2 flex items-center gap-2" contentEditable={false}>
        <span className="text-tiny tracking-[0.8px] text-ink-disabled uppercase">{kindLabel[kind] ?? kind}</span>
        {editable ? (
          <input
            value={title}
            onChange={(e) => updateAttributes({ title: e.target.value, anchorId: anchorId || slugify(e.target.value) })}
            placeholder="Title"
            aria-label={`${kindLabel[kind] ?? kind} title`}
            className="min-w-0 flex-1 bg-transparent text-panels text-ink outline-none placeholder:text-ink-disabled"
          />
        ) : (
          <span className="min-w-0 flex-1 truncate text-panels text-ink">{title}</span>
        )}
        {status ? (
          editable ? (
            <Menu
              align="end"
              trigger={(props) => (
                <button type="button" {...props} className="rounded-control outline-none focus-visible:ring-2 focus-visible:ring-ink/25">
                  <Badge tone={statusTone(status)}>{status}</Badge>
                </button>
              )}
            >
              {["untested", "testing", "winning", "active", "validated", "retired", "killed"].map((s) => (
                <MenuItem key={s} onClick={() => updateAttributes({ status: s })}>
                  {s}
                </MenuItem>
              ))}
            </Menu>
          ) : (
            <Badge tone={statusTone(status)}>{status}</Badge>
          )
        ) : null}
        <span className="inline-flex items-center gap-1 font-mono text-tiny text-ink-disabled" title="Stable anchor other documents can point at">
          <Link2 className="size-3" />#{anchorId}
        </span>
      </header>
      <NodeViewContent className="doc-anchor-body" />
    </NodeViewWrapper>
  );
}

export const AnchorBlock = Node.create({
  name: "anchorBlock",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,
  addAttributes() {
    return {
      kind: { default: "angle" },
      anchorId: { default: "" },
      title: { default: "" },
      status: { default: null },
    };
  },
  parseHTML() {
    return [
      {
        tag: "section.doc-anchor-block",
        getAttrs: (el) => {
          const e = el as HTMLElement;
          return { kind: e.dataset.kind ?? "angle", anchorId: e.dataset.anchorId ?? "", title: e.dataset.title ?? "", status: e.dataset.status ?? null };
        },
      },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      "section",
      mergeAttributes(HTMLAttributes, {
        class: "doc-anchor-block",
        id: node.attrs.anchorId,
        "data-kind": node.attrs.kind,
        "data-anchor-id": node.attrs.anchorId,
        "data-title": node.attrs.title,
        "data-status": node.attrs.status ?? undefined,
      }),
      0,
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(AnchorBlockView);
  },
  addCommands() {
    return {
      insertAnchorBlock:
        (kind) =>
        ({ commands }) => {
          const n = Math.floor(Math.random() * 900 + 100);
          return commands.insertContent({
            type: this.name,
            attrs: { kind, anchorId: `${kind}-${n}`, title: "", status: "untested" },
            content: [{ type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Promise: " }] }] }] }],
          });
        },
    };
  },
});

/* ------------------------------------------------------------ citation --- */

/** `[[VOC-017]]`. An inline atom; the hover card is drawn by the editor wrapper. */
export const Citation = Node.create({
  name: "citation",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return { ref: { default: "" } };
  },
  parseHTML() {
    return [{ tag: 'span[data-kind="citation"]', getAttrs: (el) => ({ ref: (el as HTMLElement).dataset.ref ?? "" }) }];
  },
  renderHTML({ node }) {
    return ["span", { class: "doc-chip", "data-kind": "citation", "data-ref": node.attrs.ref }, String(node.attrs.ref)];
  },
  renderText({ node }) {
    return `[[${node.attrs.ref}]]`;
  },
});

/* --------------------------------------------------------- doc mention --- */

export type MentionResolver = (docId: string) => { label: string; hue: string } | null;

/**
 * The editor provides this around `EditorContent`; the chip node views read it,
 * so titles come from the live document list and re-render when it changes.
 */
export const MentionContext = createContext<MentionResolver>(() => null);

function DocMentionView({ node }: NodeViewProps) {
  const resolve = useContext(MentionContext);
  const docId = String(node.attrs.docId);
  const r = resolve(docId);
  const anchor = node.attrs.anchor ? `#${node.attrs.anchor}` : "";
  return (
    <NodeViewWrapper
      as="span"
      className="doc-chip"
      data-kind="mention"
      data-doc-id={docId}
      data-anchor={node.attrs.anchor ?? undefined}
      style={r ? ({ "--chip-hue": `var(--color-type-${r.hue})` } as React.CSSProperties) : undefined}
    >
      {r?.label ?? docId}
      {anchor}
    </NodeViewWrapper>
  );
}

/** `@[doc_id#anchor]`. The node stores only the id; the label is resolved at render. */
export const DocMention = Node.create({
  name: "docMention",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return { docId: { default: "" }, anchor: { default: null } };
  },
  parseHTML() {
    return [{ tag: 'span[data-kind="mention"]', getAttrs: (el) => ({ docId: (el as HTMLElement).dataset.docId ?? "", anchor: (el as HTMLElement).dataset.anchor ?? null }) }];
  },
  renderHTML({ node }) {
    return [
      "span",
      { class: "doc-chip", "data-kind": "mention", "data-doc-id": node.attrs.docId, "data-anchor": node.attrs.anchor ?? undefined },
      `${node.attrs.docId}${node.attrs.anchor ? `#${node.attrs.anchor}` : ""}`,
    ];
  },
  renderText({ node }) {
    return `@[${node.attrs.docId}${node.attrs.anchor ? `#${node.attrs.anchor}` : ""}]`;
  },
  addNodeView() {
    return ReactNodeViewRenderer(DocMentionView, { as: "span", className: "inline" });
  },
  addCommands() {
    return {
      insertDocMention:
        (docId, anchor = null) =>
        ({ commands }) =>
          commands.insertContent([{ type: this.name, attrs: { docId, anchor } }, { type: "text", text: " " }]),
    };
  },
});

/* -------------------------------------------------------------- swatch --- */

export const Swatch = Node.create({
  name: "swatch",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes() {
    return { hex: { default: "#000000" } };
  },
  parseHTML() {
    return [{ tag: "span.doc-swatch", getAttrs: (el) => ({ hex: (el as HTMLElement).dataset.hex ?? "#000000" }) }];
  },
  renderHTML({ node }) {
    return ["span", { class: "doc-swatch", "data-hex": node.attrs.hex, style: `--swatch: ${node.attrs.hex}` }, String(node.attrs.hex)];
  },
  renderText({ node }) {
    return `{{${node.attrs.hex}}}`;
  },
});
