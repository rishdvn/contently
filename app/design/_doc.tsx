import type { ReactNode } from "react";

import { SectionLabel } from "@/components/ui/surface";

/* Shared scaffolding for every design-system page, so the pages themselves are only content. */

export function PageHeader({
  eyebrow = "Contently",
  title,
  lede,
  note,
  children,
}: {
  eyebrow?: string;
  title: string;
  lede: ReactNode;
  note?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3">
      <SectionLabel>{eyebrow}</SectionLabel>
      <h1 className="text-sections">{title}</h1>
      <p className="max-w-2xl text-panels text-ink-secondary">{lede}</p>
      {note ? <p className="max-w-2xl text-cap text-ink-disabled">{note}</p> : null}
      {children}
    </header>
  );
}

export function Section({
  id,
  title,
  rule,
  children,
}: {
  id?: string;
  title: string;
  rule: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="flex flex-col gap-4 border-t border-line pt-8">
      <header className="flex flex-col gap-1">
        <h2 className="text-titles text-ink">{title}</h2>
        <p className="max-w-2xl text-default text-ink-secondary">{rule}</p>
      </header>
      {children}
    </section>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="w-24 shrink-0 text-cap text-ink-disabled">{label}</span>
      {children}
    </div>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex max-w-5xl flex-col gap-8 px-8 py-12">{children}</div>;
}
