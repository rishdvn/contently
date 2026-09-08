import type { ReactNode } from "react";

import { SectionLabel } from "@/components/ui/surface";
import { cn } from "@/lib/cn";

/*
  Primitives for rendering a generated document — persona, strategy, brief.
  They exist so every document reads the same way: a label in disabled ink,
  then content. No boxes; the vertical rhythm does the grouping.
*/

export function Doc({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("flex flex-col gap-6 pb-2", className)}>{children}</div>;
}

export function DocSection({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <SectionLabel>{label}</SectionLabel>
        {hint ? <span className="text-tiny text-ink-disabled">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

/** A quoted line in the persona's own words. */
export function DocQuote({ children }: { children: ReactNode }) {
  return (
    <p className="border-l-2 border-line-strong pl-3 text-default leading-6 text-ink italic">{children}</p>
  );
}

export function DocList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5 text-default leading-6 text-ink">
          <span className="mt-[11px] size-1 shrink-0 rounded-full bg-ink-disabled" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

/** Key–value facts laid out in two columns. */
export function DocFacts({ facts }: { facts: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1.5">
      {facts.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-cap leading-6 text-ink-secondary">{k}</dt>
          <dd className="text-default leading-6 text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
