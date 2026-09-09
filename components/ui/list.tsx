import { ChevronRight } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Rows of objects that are not alike enough for a table — sessions in the
 * chat sidebar, sources in the library, steps in an inspector. Each row has a
 * leading slot, a title, an optional description and a trailing slot; rows
 * separate with hairlines and the whole row is the target.
 */
export function StackedList({ className, ...props }: ComponentProps<"ul">) {
  return <ul className={cn("flex flex-col rounded-nav bg-card", className)} {...props} />;
}

export function ListRow({
  leading,
  title,
  description,
  trailing,
  chevron = false,
  selected,
  className,
  ...props
}: Omit<ComponentProps<"button">, "title"> & {
  leading?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  trailing?: ReactNode;
  chevron?: boolean;
  selected?: boolean;
}) {
  return (
    <li className="border-b border-line last:border-b-0">
      <button
        type="button"
        aria-current={selected ? "true" : undefined}
        className={cn(
          "flex w-full items-center gap-3 px-3 py-2.5 text-left outline-none",
          "transition-colors duration-100 hover:bg-[var(--state-hover)] focus-visible:bg-[var(--state-hover)]",
          selected && "bg-[var(--state-selected)]",
          className,
        )}
        {...props}
      >
        {leading ? <span className="flex shrink-0 items-center [&>svg]:size-4 [&>svg]:text-ink-secondary">{leading}</span> : null}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-default text-ink">{title}</span>
          {description ? <span className="truncate text-cap text-ink-secondary">{description}</span> : null}
        </span>
        {trailing ? <span className="shrink-0 text-cap text-ink-secondary">{trailing}</span> : null}
        {chevron ? <ChevronRight className="size-4 shrink-0 text-ink-disabled" /> : null}
      </button>
    </li>
  );
}
