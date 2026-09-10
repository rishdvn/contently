import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

import { Doc, DocList, DocSection } from "./doc";

/*
  The strategy is the pain × persona matrix. Each cell is the number of angles
  drafted for that intersection; an empty cell is a gap the model can be asked
  to fill. It is the single most important visual in the product, so it is a
  first-class pattern rather than a table.
*/
export type CoverageCell = { angles: number; hooks?: number };

export type StrategyDocData = {
  thesis: string;
  personas: string[];
  pains: string[];
  /** cells[painIndex][personaIndex] */
  cells: CoverageCell[][];
  angleTypes: { type: string; count: number }[];
  next: string[];
};

export function CoverageMatrix({
  personas,
  pains,
  cells,
  onCell,
  compact = false,
  className,
}: {
  personas: string[];
  pains: string[];
  cells: CoverageCell[][];
  onCell?: (pain: number, persona: number) => void;
  /** Shorter cells for a preview inside an artifact block. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full table-fixed border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="w-[36%]" />
            {personas.map((p) => (
              <th key={p} className="px-1 pb-1 text-center text-cap font-normal text-ink-secondary">
                <span className="line-clamp-2">{p}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pains.map((pain, pi) => (
            <tr key={pain}>
              <th className="pr-2 text-left text-cap font-normal text-ink-secondary">{pain}</th>
              {personas.map((persona, ci) => {
                const cell = cells[pi]?.[ci] ?? { angles: 0 };
                const empty = cell.angles === 0;
                return (
                  <td key={persona} className="p-0">
                    <Tooltip
                      label={
                        empty
                          ? `No angles for ${persona} × ${pain}`
                          : `${cell.angles} angle${cell.angles === 1 ? "" : "s"}${cell.hooks ? ` · ${cell.hooks} hooks` : ""}`
                      }
                      className="flex w-full"
                    >
                      <button
                        type="button"
                        onClick={() => onCell?.(pi, ci)}
                        className={cn(
                          compact ? "flex h-7 w-full items-center justify-center rounded-[6px] text-cap outline-none" : "flex h-11 w-full items-center justify-center rounded-control text-default outline-none",
                          "transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-ink/25",
                          empty
                            ? "text-ink-disabled ring-1 ring-inset ring-line hover:ring-line-strong"
                            : "bg-raised text-ink hover:bg-line-strong",
                        )}
                      >
                        {empty ? (
                          <span className="size-1.5 rounded-full ring-1 ring-inset ring-line-strong" />
                        ) : (
                          cell.angles
                        )}
                      </button>
                    </Tooltip>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StrategyDoc({ data }: { data: StrategyDocData }) {
  const gaps = data.cells.flat().filter((c) => c.angles === 0).length;
  return (
    <Doc>
      <DocSection label="Thesis">
        <p className="text-default leading-6 text-ink">{data.thesis}</p>
      </DocSection>

      <DocSection
        label="Coverage"
        hint={gaps ? `${gaps} empty ${gaps === 1 ? "cell" : "cells"}` : "no gaps"}
      >
        <CoverageMatrix personas={data.personas} pains={data.pains} cells={data.cells} />
        <p className="text-cap text-ink-disabled">
          Rows are pains, columns are personas. A number is how many angles exist for that
          intersection; a ring is a gap.
        </p>
      </DocSection>

      <DocSection label="Angle types in play" hint="diversity check">
        <div className="flex flex-wrap gap-1.5">
          {data.angleTypes.map((a) => (
            <Badge key={a.type} dot={false} tone={a.count === 0 ? "caution" : "neutral"}>
              {a.type} &middot; {a.count}
            </Badge>
          ))}
        </div>
      </DocSection>

      <DocSection label="Recommended next">
        <DocList items={data.next} />
      </DocSection>
    </Doc>
  );
}
