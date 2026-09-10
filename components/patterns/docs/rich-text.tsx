import { Quote } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { artifactKinds } from "@/components/patterns/chat/kinds";
import type { ArtifactKind, RichDoc, RichInline, RichNode } from "@/components/patterns/chat/types";

import { CoverageMatrix } from "./coverage-matrix";

/*
  Read-only rendering of a document body. This is what the artifact drawer and
  the doc page show until the Tiptap editor mounts in its place; the two agree
  on node names, so a body round-trips between them unchanged.

  Typography is the point. No boxes, no field labels: headings in ink, body in
  secondary ink at the default size, generous rhythm. A document should read
  like something a strategist wrote, because that is what it is standing in for.
*/

export function RichText({ doc, className }: { doc: RichDoc; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3.5", className)}>
      {doc.content.map((node, i) => (
        <Block key={i} node={node} />
      ))}
    </div>
  );
}

/** The plain text of the first paragraph — what a card shows under its title. */
export function excerpt(doc: RichDoc, max = 180): string {
  for (const node of doc.content) {
    if (node.type === "paragraph" || node.type === "blockquote") {
      const text = node.content.map((i) => (i.type === "text" ? i.text : i.attrs.label)).join("");
      return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
    }
  }
  return "";
}

function Block({ node }: { node: RichNode }) {
  switch (node.type) {
    case "heading": {
      const cls = {
        1: "text-titles text-ink pt-2",
        2: "text-panels text-ink pt-1.5",
        3: "text-cap uppercase tracking-[1.2px] text-ink-disabled pt-1",
      }[node.attrs.level];
      return <p className={cls}>{inline(node.content)}</p>;
    }
    case "paragraph":
      return <p className="text-default leading-6 text-ink-secondary">{inline(node.content)}</p>;
    case "bulletList":
    case "orderedList":
      return (
        <ul className="flex flex-col gap-1.5">
          {node.content.map((item, i) => (
            <li key={i} className="flex gap-2.5 text-default leading-6 text-ink-secondary">
              {node.type === "orderedList" ? (
                <span className="w-4 shrink-0 text-right font-mono text-cap leading-6 text-ink-disabled">
                  {i + 1}
                </span>
              ) : (
                <span className="mt-[11px] size-1 shrink-0 rounded-full bg-ink-disabled" />
              )}
              <span>{inline(item)}</span>
            </li>
          ))}
        </ul>
      );
    case "blockquote":
      return (
        <blockquote className="flex gap-3 border-l-2 border-line-strong pl-3.5 text-default leading-6 text-ink italic">
          <Quote className="mt-1 size-3.5 shrink-0 text-ink-disabled" />
          <span>{inline(node.content)}</span>
        </blockquote>
      );
    case "table": {
      const [head, ...rows] = node.attrs?.headerRow ? node.rows : [null, ...node.rows];
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-default">
            {head ? (
              <thead>
                <tr>
                  {head.map((c, i) => (
                    <th key={i} className="border-b border-line px-2.5 py-1.5 text-left text-cap font-normal text-ink-disabled">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
            ) : null}
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  {r!.map((c, j) => (
                    <td key={j} className={cn("px-2.5 py-2 leading-5", j === 0 ? "text-ink" : "text-ink-secondary")}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case "image":
      return (
        <figure className="flex flex-col gap-1.5">
          <div
            role="img"
            aria-label={node.attrs.alt}
            className="aspect-[16/9] w-full rounded-control bg-raised"
            style={{ backgroundImage: node.attrs.bg ?? (node.attrs.src ? `url(${node.attrs.src})` : undefined), backgroundSize: "cover" }}
          />
          {node.attrs.caption ? <figcaption className="text-cap text-ink-disabled">{node.attrs.caption}</figcaption> : null}
        </figure>
      );
    case "horizontalRule":
      return <hr className="my-1 border-line" />;
    case "coverageMatrix":
      return (
        <div className="flex flex-col gap-2">
          <CoverageMatrix personas={node.attrs.personas} pains={node.attrs.pains} cells={node.attrs.cells} />
          <p className="text-cap text-ink-disabled">
            Rows are pains, columns are personas. A number is how many angles exist for that intersection; a ring is a gap.
          </p>
        </div>
      );
  }
}

function inline(content: RichInline[]): ReactNode {
  return content.map((piece, i) => {
    if (piece.type === "mention") return <Mention key={i} {...piece.attrs} />;
    let node: ReactNode = piece.text;
    for (const mark of piece.marks ?? []) {
      switch (mark.type) {
        case "bold":
          node = <strong className="font-medium text-ink">{node}</strong>;
          break;
        case "italic":
          node = <em>{node}</em>;
          break;
        case "code":
          node = <code className="rounded bg-raised px-1 py-0.5 font-mono text-cap text-ink">{node}</code>;
          break;
        case "link":
          node = (
            <a href={mark.attrs.href} className="text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink">
              {node}
            </a>
          );
          break;
      }
    }
    return <span key={i}>{node}</span>;
  });
}

/**
 * A reference inside the prose. Document mentions carry the kind's icon and
 * open the document; citations (VOC-017) are the evidence a claim rests on
 * and resolve to the research it came from. Same chip, two meanings, which
 * is why it is the one styled inline element the body allows.
 */
export function Mention({ label, kind }: { id: string; label: string; kind: ArtifactKind | "citation" }) {
  const Icon = kind === "citation" ? null : artifactKinds[kind].icon;
  return (
    <a
      href="#"
      onClick={(e) => e.preventDefault()}
      className={cn(
        "mx-0.5 inline-flex h-[22px] items-center gap-1 rounded-[6px] px-1.5 align-[-4px] text-cap whitespace-nowrap not-italic",
        "transition-colors duration-100 hover:bg-line-strong",
        kind === "citation" ? "bg-raised font-mono text-ink-secondary" : "bg-raised text-ink",
      )}
    >
      {Icon ? <Icon className="size-3 text-ink-secondary" /> : null}
      {label}
    </a>
  );
}
