"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { useEditor } from "@/lib/editor/store";

import { Panel } from "../controls";

/*
  Export and Share are not modals in the reference: they drop out of the
  command pill as floating cards, and the canvas stays live behind them.
  Dismiss on outside pointer-down or Escape (handled by the hotkey layer).
*/
export function Flyout({
  id,
  title,
  className,
  children,
}: {
  id: "export" | "share";
  title: string;
  className?: string;
  children: ReactNode;
}) {
  const open = useEditor((s) => s.dialog === id);
  const setDialog = useEditor((s) => s.setDialog);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (ref.current?.contains(t)) return;
      /* Clicks on the pill button that toggles this flyout are its own business. */
      if (t.closest("[data-flyout-trigger]")) return;
      setDialog(null);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open, setDialog]);

  if (!open) return null;
  return (
    <Panel
      ref={ref}
      role="dialog"
      aria-label={title}
      className={cn("absolute top-[58px] left-1/2 z-[var(--z-floating-bar)] flex w-[264px] flex-col gap-2 p-3 animate-pop", className)}
      style={{ marginLeft: 30 }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between pl-0.5">
        <span className="text-default text-ink">{title}</span>
        <button type="button" aria-label="Close" className="flex size-6 items-center justify-center rounded-[6px] text-ink-secondary hover:bg-[var(--state-hover)] hover:text-ink" onClick={() => setDialog(null)}>
          <X className="size-3.5" />
        </button>
      </div>
      {children}
    </Panel>
  );
}

export function FlyoutTabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; disabled?: boolean }[] }) {
  return (
    <div className="flex items-center gap-3 px-0.5 pt-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={o.disabled}
          aria-pressed={o.value === value}
          className={cn("text-default transition-colors disabled:text-ink-disabled", o.value === value ? "text-ink" : "text-ink-secondary hover:text-ink")}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function FlyoutRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex h-8 items-center justify-between gap-3 px-0.5">
      <span className="text-ui text-ink-secondary">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function PrimaryButton({ className, children, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-9 w-full items-center justify-center gap-2 rounded-[8px] bg-ink text-ui font-medium text-canvas transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:bg-[var(--state-disabled-bg)] disabled:text-ink-disabled",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
