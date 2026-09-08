"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

/**
 * Anchored panel that stays open while the user works in it — a picker, a
 * grouped prompt browser, a small form. It is the non-modal sibling of Menu:
 * Menu closes on the first choice, Popover closes only on dismissal.
 *
 * Controlled or uncontrolled. Pass `side="top"` for anything anchored near the
 * bottom of the viewport, such as the chat composer.
 */
export function Popover({
  trigger,
  children,
  open: controlled,
  onOpenChange,
  align = "start",
  side = "bottom",
  className,
}: {
  trigger: (props: { onClick: () => void; "aria-expanded": boolean }) => ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: "start" | "end";
  side?: "top" | "bottom";
  className?: string;
}) {
  const [internal, setInternal] = useState(false);
  const open = controlled ?? internal;
  const setOpen = (next: boolean) => {
    setInternal(next);
    onOpenChange?.(next);
  };
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={wrap} className="relative inline-flex">
      {trigger({ onClick: () => setOpen(!open), "aria-expanded": open })}
      {open ? (
        <div
          role="dialog"
          className={cn(
            "absolute rounded-[var(--radius-overlay)] bg-panel shadow-overlay",
            "animate-pop",
            side === "bottom" ? "top-[calc(100%+8px)] origin-top" : "bottom-[calc(100%+8px)] origin-bottom",
            align === "end" ? "right-0" : "left-0",
            className,
          )}
          style={{ zIndex: "var(--z-floating-bar)" }}
        >
          {typeof children === "function" ? children(close) : children}
        </div>
      ) : null}
    </div>
  );
}
