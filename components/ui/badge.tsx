import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "positive" | "caution" | "critical" | "spectrum";

const tones: Record<Tone, { chip: string; dot: string }> = {
  neutral: { chip: "bg-raised text-ink-secondary", dot: "bg-ink-faint" },
  positive: { chip: "bg-raised text-positive", dot: "bg-positive" },
  caution: { chip: "bg-raised text-caution", dot: "bg-caution" },
  critical: { chip: "bg-raised text-critical", dot: "bg-critical" },
  spectrum: { chip: "spectrum-edge spectrum-text", dot: "bg-spectrum-green" },
};

/**
 * Status marker. Tone is carried by a dot plus the label so state never depends
 * on hue alone; the text stays legible if the dot is missed.
 */
export function Badge({
  tone = "neutral",
  dot = true,
  className,
  children,
  ...props
}: ComponentProps<"span"> & { tone?: Tone; dot?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-chip px-2 py-0.5 text-micro font-medium",
        tones[tone].chip,
        className,
      )}
      {...props}
    >
      {dot && tone !== "spectrum" ? (
        <span className={cn("size-1.5 rounded-full", tones[tone].dot)} />
      ) : null}
      {children}
    </span>
  );
}

export function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded px-1.5",
        "border border-line-strong bg-raised font-sans text-micro text-ink-muted",
        className,
      )}
      {...props}
    />
  );
}
