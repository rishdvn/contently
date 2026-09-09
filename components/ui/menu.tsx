"use client";

import type { ComponentProps, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

/**
 * Anchored menu for actions on a specific object — the overflow button on a
 * card, a right-click target, a picker.
 *
 * Unlike Dialog this is not a native modal: a menu should not trap focus or
 * make the page inert, because it is a shortcut rather than a task. That means
 * dismissal is ours to handle — pointer-down outside, Escape, or choosing an
 * item.
 */
export function Menu({
  trigger,
  children,
  align = "start",
  className,
}: {
  trigger: (props: { onClick: () => void; "aria-expanded": boolean }) => ReactNode;
  children: ReactNode;
  align?: "start" | "end";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative inline-flex">
      {trigger({ onClick: () => setOpen((o) => !o), "aria-expanded": open })}
      {open ? (
        <div
          role="menu"
          onClick={() => setOpen(false)}
          className={cn(
            "absolute top-[calc(100%+6px)] min-w-[200px] rounded-control bg-panel p-1.5 shadow-overlay",
            "origin-top animate-pop",
            align === "end" ? "right-0" : "left-0",
            className,
          )}
          style={{ zIndex: "var(--z-floating-bar)" }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function MenuItem({
  icon,
  shortcut,
  trailing,
  destructive = false,
  className,
  children,
  ...props
}: ComponentProps<"button"> & {
  icon?: ReactNode;
  shortcut?: string;
  /** Trailing slot for a check mark or a count. */
  trailing?: ReactNode;
  destructive?: boolean;
}) {
  return (
    <button
      role="menuitem"
      className={cn(
        "flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-default",
        "transition-colors duration-100 ease-out-quart outline-none",
        destructive
          ? "text-critical hover:bg-critical-surface"
          : "text-ink hover:bg-[var(--state-hover)]",
        "disabled:pointer-events-none disabled:text-ink-disabled",
        className,
      )}
      {...props}
    >
      {icon ? <span className="shrink-0 [&>svg]:size-4">{icon}</span> : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {shortcut ? (
        <span className="shrink-0 text-cap text-ink-disabled">{shortcut}</span>
      ) : null}
      {trailing ? <span className="shrink-0 [&>svg]:size-3.5">{trailing}</span> : null}
    </button>
  );
}

export function MenuDivider() {
  return <div role="separator" className="my-1.5 h-px bg-line" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-2.5 pt-1.5 pb-1 text-cap text-ink-disabled">{children}</div>;
}
