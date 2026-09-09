import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("animate-breathe rounded-control bg-raised", className)}
      {...props}
    />
  );
}

/**
 * Indeterminate progress for model work. The sweep carries the same gradient as
 * the action that started it, so the user can connect cause to effect.
 */
export function GeneratingBar({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      role="progressbar"
      aria-label="Generating"
      className={cn("h-0.5 w-full overflow-hidden rounded-full bg-raised", className)}
      {...props}
    >
      <div
        className="h-full w-1/3 animate-sweep rounded-full"
        style={{ backgroundImage: "var(--gradient-spectrum-fill)" }}
      />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-card bg-panel px-6 py-16 text-center",
        className,
      )}
    >
      {icon ? <span className="text-ink-disabled [&>svg]:size-6">{icon}</span> : null}
      <div className="flex flex-col gap-1">
        <p className="text-titles text-ink">{title}</p>
        {description ? (
          <p className="max-w-sm text-default text-ink-secondary">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
