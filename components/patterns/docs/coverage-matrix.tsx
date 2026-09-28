import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

import type { CoverageCell } from "@/components/patterns/chat/types";

/*
  The strategy is the pain × persona matrix. Each cell is the number of angles
  drafted for that intersection; an empty cell is a gap the model can be asked
  to fill. It is the single most important visual in the product, so it is a
  custom node inside the rich body rather than a table the author has to draw.
*/
export function CoverageMatrix({
  personas,
  pains,
  cells,
  onCell,
  className,
}: {
  personas: string[];
  pains: string[];
  cells: CoverageCell[][];
  onCell?: (pain: number, persona: number) => void;
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
                          "flex h-11 w-full items-center justify-center rounded-control text-default outline-none",
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
