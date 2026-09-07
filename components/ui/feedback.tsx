import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("animate-breathe rounded-card bg-raised", className)}
      {...props}
    />
  );
}

/**
 * Indeterminate progress for model work. The spectrum sweep is the same mark
 * used on the action that started it, so the user can connect cause to effect.
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
        style={{ backgroundImage: "var(--gradient-spectrum)" }}
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
        "flex flex-col items-center justify-center gap-3 rounded-panel border border-dashed border-line px-6 py-14 text-center",
        className,
      )}
    >
      {icon ? <span className="text-ink-faint [&>svg]:size-6">{icon}</span> : null}
      <div className="flex flex-col gap-1">
        <p className="text-base font-medium text-ink">{title}</p>
        {description ? (
          <p className="max-w-sm text-sm text-ink-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
