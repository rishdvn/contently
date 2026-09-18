"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/cn";

/**
 * Names an unlabelled control. It must never carry information that is not
 * available elsewhere — it is unreachable by touch and by keyboard-only users,
 * so anything essential belongs in the interface itself.
 *
 * Rendered into the document body at a fixed position, so a tooltip is never
 * clipped by a scrolling or overflow-hidden panel and never widens one.
 */
export function Tooltip({
  label,
  side = "top",
  children,
  className,
}: {
  label: string;
  side?: "top" | "bottom" | "left" | "right";
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const id = useId();

  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const gap = 6;
    setPos(
      side === "top"
        ? { x: r.left + r.width / 2, y: r.top - gap }
        : side === "bottom"
          ? { x: r.left + r.width / 2, y: r.bottom + gap }
          : side === "left"
            ? { x: r.left - gap, y: r.top + r.height / 2 }
            : { x: r.right + gap, y: r.top + r.height / 2 },
    );
  };
  const hide = () => setPos(null);

  /* Anything that moves the trigger — scrolling a panel, a pointer drag — dismisses rather than leaving a stale label. */
  useEffect(() => {
    if (!pos) return;
    window.addEventListener("scroll", hide, true);
    window.addEventListener("pointerdown", hide, true);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("pointerdown", hide, true);
    };
  }, [pos]);

  /* Keep the label on screen when its trigger sits against a window edge. */
  const clamp = (el: HTMLSpanElement | null) => {
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = r.left < 8 ? 8 - r.left : r.right > window.innerWidth - 8 ? window.innerWidth - 8 - r.right : 0;
    if (dx) el.style.marginLeft = `${dx}px`;
  };

  const transform = {
    top: "translate(-50%, -100%)",
    bottom: "translate(-50%, 0)",
    left: "translate(-100%, -50%)",
    right: "translate(0, -50%)",
  }[side];

  return (
    <span
      ref={ref}
      className={cn("relative inline-flex", className)}
      onPointerEnter={show}
      onPointerLeave={hide}
      onFocusCapture={show}
      onBlurCapture={hide}
      aria-describedby={pos ? id : undefined}
    >
      {children}
      {pos
        ? createPortal(
            <span
              ref={clamp}
              id={id}
              role="tooltip"
              className="pointer-events-none fixed"
              style={{ left: pos.x, top: pos.y, transform, zIndex: "var(--z-tooltip)" }}
            >
              {/* The entrance animates transform, so it lives on an inner element and leaves the positioning alone. */}
              <span className="block whitespace-nowrap rounded-[8px] bg-tooltip px-2 py-1 text-cap text-ink animate-pop">{label}</span>
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
