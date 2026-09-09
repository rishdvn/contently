import { slugify } from "./registry";
import type { Body, BodyNode, DocBlock, Document } from "./types";

/*
  A deliberately small Markdown dialect that round-trips with the editor's
  node set. Bodies are stored as Tiptap JSON and mirrored to this Markdown on
  save; the agent reads and writes the Markdown and never sees the JSON.

    ## Heading / ### Heading         headings; the slug becomes the anchor id
    - item / 1. item / - [ ] item    bullet, ordered and task lists
    > quote                          blockquote
    | a | b | + |---|---|            table with a header row
    ---                              rule
    :::callout{tone=caution} … :::   callout
    :::angle{id=a1 status=winning title="…"} … :::   repeating block (angle | pillar | hypothesis)

    **bold** *italic* `code` [text](url)
    [[VOC-017]]                      citation chip
    @[doc_id] / @[doc_id#anchor]     document mention chip
    {{#d96f3a}}                      colour swatch
*/

const BLOCK_KINDS = new Set(["angle", "pillar", "hypothesis"]);

/* ------------------------------------------------------------ inline --- */

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[\[[^\]]+\]\]|@\[[^\]]+\]|\{\{#[0-9a-fA-F]{3,8}\}\}|\[[^\]]+\]\([^)]+\))/g;

export function parseInline(text: string): BodyNode[] {
  const out: BodyNode[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push({ type: "text", text: text.slice(last, idx) });
    const tok = m[0];
    if (tok.startsWith("**")) out.push({ type: "text", text: tok.slice(2, -2), marks: [{ type: "bold" }] });
    else if (tok.startsWith("`")) out.push({ type: "text", text: tok.slice(1, -1), marks: [{ type: "code" }] });
    else if (tok.startsWith("*")) out.push({ type: "text", text: tok.slice(1, -1), marks: [{ type: "italic" }] });
    else if (tok.startsWith("[[")) out.push({ type: "citation", attrs: { ref: tok.slice(2, -2) } });
    else if (tok.startsWith("@[")) {
      const [docId, anchor] = tok.slice(2, -1).split("#");
      out.push({ type: "docMention", attrs: { docId, anchor: anchor ?? null } });
    } else if (tok.startsWith("{{#")) out.push({ type: "swatch", attrs: { hex: `#${tok.slice(3, -2)}` } });
    else {
      const lm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok);
      if (lm) out.push({ type: "text", text: lm[1], marks: [{ type: "link", attrs: { href: lm[2] } }] });
    }
    last = idx + tok.length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out.length ? out : [];
}

function paragraph(text: string): BodyNode {
  const content = parseInline(text);
  return content.length ? { type: "paragraph", content } : { type: "paragraph" };
}

/* ------------------------------------------------------------- blocks --- */

function parseAttrs(src: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const m of src.matchAll(/(\w+)=("([^"]*)"|\S+)/g)) attrs[m[1]] = m[3] ?? m[2];
  return attrs;
}

function tableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

export function markdownToBody(md: string): Body {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const content = parseBlocks(lines);
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}

function parseBlocks(lines: string[]): BodyNode[] {
  const out: BodyNode[] = [];
  let i = 0;

  const flushPara = (buf: string[]) => {
    if (buf.length) out.push(paragraph(buf.join(" ")));
    buf.length = 0;
  };
  const para: string[] = [];

  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();

    if (!t) {
      flushPara(para);
      i++;
      continue;
    }

    const h = /^(#{1,3})\s+(.*)$/.exec(t);
    if (h) {
      flushPara(para);
      const level = h[1].length === 1 ? 2 : h[1].length;
      out.push({ type: "heading", attrs: { level, id: slugify(h[2]) }, content: parseInline(h[2]) });
      i++;
      continue;
    }

    if (/^---+$/.test(t)) {
      flushPara(para);
      out.push({ type: "horizontalRule" });
      i++;
      continue;
    }

    const fence = /^:::(\w+)(?:\{([^}]*)\})?\s*$/.exec(t);
    if (fence) {
      flushPara(para);
      const kind = fence[1];
      const attrs = parseAttrs(fence[2] ?? "");
      const inner: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== ":::") inner.push(lines[i++]);
      i++;
      const children = parseBlocks(inner);
      if (kind === "callout") {
        out.push({ type: "callout", attrs: { tone: attrs.tone ?? "info" }, content: children.length ? children : [{ type: "paragraph" }] });
      } else if (BLOCK_KINDS.has(kind)) {
        out.push({
          type: "anchorBlock",
          attrs: {
            kind,
            anchorId: attrs.id ?? slugify(attrs.title ?? kind),
            title: attrs.title ?? "",
            status: attrs.status ?? null,
          },
          content: children.length ? children : [{ type: "paragraph" }],
        });
      }
      continue;
    }

    if (t.startsWith("|")) {
      flushPara(para);
      const rows: string[][] = [];
      let header = false;
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const r = lines[i].trim();
        if (/^\|?\s*:?-{2,}/.test(r.replace(/^\|/, ""))) {
          header = rows.length === 1;
        } else rows.push(tableRow(r));
        i++;
      }
      out.push({
        type: "table",
        content: rows.map((cells, ri) => ({
          type: "tableRow",
          content: cells.map((c) => ({
            type: header && ri === 0 ? "tableHeader" : "tableCell",
            content: [paragraph(c)],
          })),
        })),
      });
      continue;
    }

    if (t.startsWith("> ")) {
      flushPara(para);
      const inner: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) inner.push(lines[i++].trim().replace(/^>\s?/, ""));
      out.push({ type: "blockquote", content: parseBlocks(inner) });
      continue;
    }

    const task = /^[-*]\s+\[( |x)\]\s+(.*)$/.exec(t);
    if (task) {
      flushPara(para);
      const items: BodyNode[] = [];
      while (i < lines.length) {
        const m = /^[-*]\s+\[( |x)\]\s+(.*)$/.exec(lines[i].trim());
        if (!m) break;
        items.push({ type: "taskItem", attrs: { checked: m[1] === "x" }, content: [paragraph(m[2])] });
        i++;
      }
      out.push({ type: "taskList", content: items });
      continue;
    }

    if (/^[-*]\s+/.test(t)) {
      flushPara(para);
      const items: BodyNode[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim()) && !/^[-*]\s+\[( |x)\]/.test(lines[i].trim())) {
        items.push({ type: "listItem", content: [paragraph(lines[i].trim().replace(/^[-*]\s+/, ""))] });
        i++;
      }
      out.push({ type: "bulletList", content: items });
      continue;
    }

    if (/^\d+[.)]\s+/.test(t)) {
      flushPara(para);
      const items: BodyNode[] = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
        items.push({ type: "listItem", content: [paragraph(lines[i].trim().replace(/^\d+[.)]\s+/, ""))] });
        i++;
      }
      out.push({ type: "orderedList", content: items });
      continue;
    }

    para.push(t);
    i++;
  }
  flushPara(para);
  return out;
}

/* -------------------------------------------------------- serializer --- */

function inlineToMd(nodes: BodyNode[] | undefined): string {
  if (!nodes) return "";
  return nodes
    .map((n) => {
      if (n.type === "text") {
        let t = n.text ?? "";
        for (const m of n.marks ?? []) {
          if (m.type === "bold") t = `**${t}**`;
          else if (m.type === "italic") t = `*${t}*`;
          else if (m.type === "code") t = `\`${t}\``;
          else if (m.type === "link") t = `[${t}](${String(m.attrs?.href ?? "")})`;
        }
        return t;
      }
      if (n.type === "citation") return `[[${String(n.attrs?.ref ?? "")}]]`;
      if (n.type === "docMention") {
        const a = n.attrs?.anchor ? `#${String(n.attrs.anchor)}` : "";
        return `@[${String(n.attrs?.docId ?? "")}${a}]`;
      }
      if (n.type === "swatch") return `{{${String(n.attrs?.hex ?? "")}}}`;
      if (n.type === "hardBreak") return "  \n";
      return "";
    })
    .join("");
}

function blocksToMd(nodes: BodyNode[] | undefined, depth = 0): string {
  if (!nodes) return "";
  const out: string[] = [];
  for (const n of nodes) {
    switch (n.type) {
      case "paragraph":
        out.push(inlineToMd(n.content));
        break;
      case "heading": {
        const level = Number(n.attrs?.level ?? 2);
        out.push(`${"#".repeat(level)} ${inlineToMd(n.content)}`);
        break;
      }
      case "bulletList":
        out.push((n.content ?? []).map((li) => `- ${blocksToMd(li.content, depth + 1).trim()}`).join("\n"));
        break;
      case "orderedList":
        out.push((n.content ?? []).map((li, i) => `${i + 1}. ${blocksToMd(li.content, depth + 1).trim()}`).join("\n"));
        break;
      case "taskList":
        out.push(
          (n.content ?? [])
            .map((li) => `- [${li.attrs?.checked ? "x" : " "}] ${blocksToMd(li.content, depth + 1).trim()}`)
            .join("\n"),
        );
        break;
      case "blockquote":
        out.push(
          blocksToMd(n.content, depth + 1)
            .split("\n")
            .map((l) => `> ${l}`)
            .join("\n"),
        );
        break;
      case "horizontalRule":
        out.push("---");
        break;
      case "callout":
        out.push(`:::callout{tone=${String(n.attrs?.tone ?? "info")}}\n${blocksToMd(n.content, depth + 1)}\n:::`);
        break;
      case "anchorBlock": {
        const a = n.attrs ?? {};
        const status = a.status ? ` status=${String(a.status)}` : "";
        out.push(
          `:::${String(a.kind)}{id=${String(a.anchorId)}${status} title="${String(a.title ?? "").replace(/"/g, "'")}"}\n${blocksToMd(n.content, depth + 1)}\n:::`,
        );
        break;
      }
      case "table": {
        const rows = (n.content ?? []).map((r) => (r.content ?? []).map((c) => blocksToMd(c.content).replace(/\n/g, " ").trim()));
        if (!rows.length) break;
        const header = (n.content?.[0]?.content ?? []).some((c) => c.type === "tableHeader");
        const lines = rows.map((r) => `| ${r.join(" | ")} |`);
        if (header) lines.splice(1, 0, `| ${rows[0].map(() => "---").join(" | ")} |`);
        out.push(lines.join("\n"));
        break;
      }
      default:
        if (n.content) out.push(blocksToMd(n.content, depth));
    }
  }
  return out.join("\n\n");
}

export function bodyToMarkdown(body: Body): string {
  return blocksToMd(body.content).trim();
}

/* ------------------------------------------------------------ helpers --- */

/** Every H2 in the body, with the anchor id the TOC and section patches use. */
export function outline(body: Body): { id: string; text: string; level: number }[] {
  return body.content
    .filter((n) => n.type === "heading")
    .map((n) => ({
      id: String(n.attrs?.id ?? slugify(nodeText(n))),
      text: nodeText(n),
      level: Number(n.attrs?.level ?? 2),
    }));
}

export function nodeText(n: BodyNode): string {
  if (n.type === "text") return n.text ?? "";
  if (n.type === "citation") return String(n.attrs?.ref ?? "");
  return (n.content ?? []).map(nodeText).join("");
}

/** Index of the H2 that owns `anchor`, plus the index just past its last child block. */
export function sectionRange(body: Body, anchor: string): [number, number] | null {
  const start = body.content.findIndex(
    (n) => n.type === "heading" && Number(n.attrs?.level ?? 2) === 2 && String(n.attrs?.id) === anchor,
  );
  if (start < 0) return null;
  let end = start + 1;
  while (end < body.content.length) {
    const n = body.content[end];
    if (n.type === "heading" && Number(n.attrs?.level ?? 2) <= 2) break;
    end++;
  }
  return [start, end];
}

/** Replace the blocks under one H2 (keeping the heading) with new Markdown. */
export function replaceSection(body: Body, anchor: string, md: string): Body {
  const range = sectionRange(body, anchor);
  const blocks = markdownToBody(md).content;
  if (!range) {
    return { type: "doc", content: [...body.content, ...blocks] };
  }
  const [start, end] = range;
  return { type: "doc", content: [...body.content.slice(0, start + 1), ...blocks, ...body.content.slice(end)] };
}

export function appendSection(body: Body, heading: string, md: string): Body {
  const blocks = markdownToBody(`## ${heading}\n\n${md}`).content;
  return { type: "doc", content: [...body.content, ...blocks] };
}

/** Markdown of one section, for diffs and the Ask modal's summary. */
export function sectionMarkdown(body: Body, anchor: string): string {
  const range = sectionRange(body, anchor);
  if (!range) return "";
  return blocksToMd(body.content.slice(range[0] + 1, range[1]));
}

/** Mirrors repeating blocks into the lightweight index the PRD calls `doc_blocks`. */
export function extractBlocks(doc: Document): DocBlock[] {
  const blocks: DocBlock[] = [];
  const walk = (nodes: BodyNode[]) => {
    for (const n of nodes) {
      if (n.type === "anchorBlock") {
        const a = n.attrs ?? {};
        blocks.push({
          docId: doc.id,
          anchor: String(a.anchorId),
          blockType: (String(a.kind) as DocBlock["blockType"]) ?? "angle",
          title: String(a.title ?? ""),
          status: a.status ? String(a.status) : undefined,
          text: blocksToMd(n.content),
        });
      }
      if (n.content) walk(n.content);
    }
  };
  walk(doc.body.content);
  return blocks;
}

/** Frontmatter shown to the agent (and in the doc's "Agent view"). */
export function frontmatter(doc: Document, relations: { type: string; target: string; anchor?: string | null }[]) {
  const lines = [
    `id: ${doc.id}`,
    `brand_id: ${doc.brandId}`,
    `type: ${doc.type}`,
    `subtype: ${doc.subtype ?? "null"}`,
    `title: "${doc.title.replace(/"/g, '\\"')}"`,
    `status: ${doc.status}`,
    `version: ${doc.version}`,
    `created_by: ${doc.createdBy}`,
    `run_id: ${doc.runId ?? "null"}`,
    `channels: [${doc.channels.join(", ")}]`,
    `accounts: [${doc.accounts.map((a) => `"${a}"`).join(", ")}]`,
    `tags: [${doc.tags.join(", ")}]`,
  ];
  if (relations.length) {
    lines.push("relations:");
    for (const r of relations) {
      lines.push(`  - { type: ${r.type}, target: ${r.target}${r.anchor ? `, anchor: ${r.anchor}` : ""} }`);
    }
  }
  lines.push(`created_at: ${doc.createdAt}`, `updated_at: ${doc.updatedAt}`);
  return lines.join("\n");
}
