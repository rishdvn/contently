import { cn } from "@/lib/cn";

/**
 * Determinate progress — a brief's slides generated, a schedule's posts
 * published, a strategy's coverage. Ink on raised, hairline tall. Set `spectrum`
 * only when the progress is the AI's: it is the one place the gradient means
 * something.
 */
export function Progress({
  value,
  max = 100,
  label,
  spectrum = false,
  size = "md",
  className,
}: {
  value: number;
  max?: number;
  label?: string;
  spectrum?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <div className="flex items-baseline justify-between text-cap text-ink-secondary">
          <span>{label}</span>
          <span className="tabular-nums">
            {value}/{max}
          </span>
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        className={cn("w-full overflow-hidden rounded-full bg-raised", size === "sm" ? "h-0.5" : "h-1")}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-300 ease-out-quart", spectrum ? "spectrum-fill" : "bg-ink")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** Small ring for a cell or a card corner — the same value at a glance. */
export function ProgressRing({
  value,
  max = 100,
  size = 20,
  className,
}: {
  value: number;
  max?: number;
  size?: number;
  className?: string;
}) {
  const r = (size - 3) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemax={max}
      className={cn("-rotate-90", className)}
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={2} className="stroke-raised" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
        className="stroke-ink transition-[stroke-dashoffset] duration-300 ease-out-quart"
      />
    </svg>
  );
}
