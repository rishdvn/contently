"use client";

import { useSyncExternalStore } from "react";

import { Tooltip } from "@/components/ui/tooltip";
import { retrySave, useSaveStatus } from "@/lib/editor/persistence";

/*
  Autosave feedback beside the project name: `Saving…`, then `Saved · just now`
  ageing into minutes, or `Not saved — retrying` with a way to retry at once.
  Nothing shows until the first edit; a project that was just opened has
  nothing to report.
*/
export function SaveStatus() {
  const status = useSaveStatus();
  const now = useClock();

  if (status.state === "idle") return null;
  if (status.state === "saving") return <span className="text-cap text-ink-disabled">Saving…</span>;
  if (status.state === "saved") return <span className="text-cap text-ink-disabled">Saved · {ago(now - status.at)}</span>;

  const detail = status.offline
    ? "You're offline. Changes stay in this tab and save when you reconnect."
    : status.retryAt
      ? `Trying again in ${Math.max(1, Math.ceil((status.retryAt - now) / 1000))}s`
      : "Waiting for the server to answer";
  return (
    <span className="flex items-center gap-1.5 text-cap" role="status">
      <Tooltip label={detail} side="bottom">
        <span className="text-caution">Not saved — retrying</span>
      </Tooltip>
      <button type="button" className="rounded-[6px] px-1.5 py-0.5 text-ink-secondary hover:bg-[var(--state-hover)] hover:text-ink" onClick={retrySave}>
        Retry
      </button>
    </span>
  );
}

function ago(ms: number) {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} h ago`;
}

/* A clock that ticks every few seconds while something is watching it: enough
   for "just now" to age and for a retry countdown to move. */
let clockNow = Date.now();
const clockListeners = new Set<() => void>();
let clockTimer: ReturnType<typeof setInterval> | null = null;

function subscribeClock(cb: () => void) {
  clockListeners.add(cb);
  /* Nothing was ticking while nobody watched; React re-reads after subscribing. */
  if (!clockTimer) clockNow = Date.now();
  clockTimer ??= setInterval(() => {
    clockNow = Date.now();
    clockListeners.forEach((l) => l());
  }, 5000);
  return () => {
    clockListeners.delete(cb);
    if (clockListeners.size === 0 && clockTimer) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  };
}

function useClock() {
  return useSyncExternalStore(subscribeClock, () => clockNow, () => 0);
}
