import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

type Tone = "info" | "positive" | "caution" | "critical";

const tones: Record<Tone, { surface: string; ink: string; icon: ReactNode }> = {
  info: {
    surface: "bg-info-surface",
    ink: "text-info-ink",
    icon: <Info className="text-info" />,
  },
  positive: {
    surface: "bg-positive-surface",
    ink: "text-positive-ink",
    icon: <CheckCircle2 className="text-positive" />,
  },
  caution: {
    surface: "bg-caution-surface",
    ink: "text-caution-ink",
    icon: <AlertTriangle className="text-caution" />,
  },
  critical: {
    surface: "bg-critical-surface",
    ink: "text-critical-ink",
    icon: <XCircle className="text-critical" />,
  },
};

/**
 * Inline banner for a condition attached to the surface it sits on.
 *
 * The fill is a near-black tinted with the tone rather than a saturated block,
 * so a warning inside a dialog does not out-shout the dialog's own content. Use
 * a Toast instead when the message is about something that just happened, and a
 * Dialog when the user has to respond before continuing.
 */
export function Alert({
  tone = "info",
  title,
  action,
  className,
  children,
  ...props
}: ComponentProps<"div"> & { tone?: Tone; title?: string; action?: ReactNode }) {
  const t = tones[tone];
  return (
    <div
      role={tone === "critical" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-control px-3.5 py-3",
        t.surface,
        className,
      )}
      {...props}
    >
      <span className="mt-px shrink-0 [&>svg]:size-4">{t.icon}</span>
      <div className={cn("flex min-w-0 flex-1 flex-col gap-1", t.ink)}>
        {title ? <p className="text-default">{title}</p> : null}
        {children ? <div className="text-cap opacity-80">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
