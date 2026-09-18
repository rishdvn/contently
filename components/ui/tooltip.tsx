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
    if (side === "left") return setPos({ x: r.left - gap, y: r.top + r.height / 2 });
    if (side === "right") return setPos({ x: r.right + gap, y: r.top + r.height / 2 });
    /* Centred on the trigger, then nudged so the label stays inside the window when the trigger sits at an edge. */
    const half = measure(label) / 2;
    const x = Math.min(Math.max(r.left + r.width / 2, 8 + half), window.innerWidth - 8 - half);
    setPos({ x, y: side === "top" ? r.top - gap : r.bottom + gap });
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
              id={id}
              role="tooltip"
              className="pointer-events-none fixed"
              style={{ left: pos.x, top: pos.y, transform, zIndex: "var(--z-tooltip)" }}
            >
              {/* The entrance animates transform, so it lives on an inner element and leaves the positioning alone. */}
              <span className={cn("block bg-tooltip text-ink animate-pop", LABEL_CLASS)}>{label}</span>
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}

const LABEL_CLASS = "whitespace-nowrap rounded-[8px] px-2 py-1 text-cap";

/* Width the label will take, measured off-screen with the same styling. */
function measure(label: string) {
  const probe = document.createElement("span");
  probe.className = LABEL_CLASS;
  probe.style.cssText = "position:fixed;left:-9999px;top:0;visibility:hidden";
  probe.textContent = label;
  document.body.appendChild(probe);
  const w = probe.offsetWidth;
  probe.remove();
  return w;
}
