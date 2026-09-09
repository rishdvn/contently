"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { cn } from "@/lib/cn";

type Toast = {
  id: number;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  duration?: number;
};

const ToastContext = createContext<((t: Omit<Toast, "id">) => void) | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback((t: Omit<Toast, "id">) => {
    setToasts((prev) => [...prev, { ...t, id: Date.now() + Math.random() }]);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastRegion toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastRegion({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      /*
        `polite` rather than `assertive`: a toast reports something that already
        happened, so it should wait its turn rather than interrupt.
      */
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 flex w-[360px] flex-col gap-2"
      style={{ zIndex: "var(--z-toast)" }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    const timer = setTimeout(onDismiss, toast.duration ?? 5000);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [onDismiss, toast.duration]);

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-control px-4 py-3 shadow-overlay",
        /*
          Toasts invert to light-on-dark. In an interface this dark, a light
          slab is the only thing that reliably reads as "new" without borrowing
          the gradient, which belongs to generation.
        */
        "bg-inverse-surface text-inverse-ink",
        "transition-all duration-200 ease-out-quart",
        shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-default">{toast.title}</p>
        {toast.description ? (
          <p className="text-cap opacity-70">{toast.description}</p>
        ) : null}
      </div>
      {toast.action ? (
        <button
          onClick={() => {
            toast.action?.onClick();
            onDismiss();
          }}
          className="shrink-0 text-default underline underline-offset-2 outline-none hover:opacity-70"
        >
          {toast.action.label}
        </button>
      ) : null}
      <button
        aria-label="Dismiss"
        onClick={onDismiss}
        className="-mt-0.5 -mr-1 shrink-0 rounded p-1 opacity-50 outline-none hover:opacity-100"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
