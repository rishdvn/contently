"use client";

import { catchError, type ErrorInfo } from "next/error";
import { useEffect, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { flushSave, lastSaveError, useSaveStatus } from "@/lib/editor/persistence";
import { useEditor } from "@/lib/editor/store";

import { Panel } from "./controls";

/*
  What the studio shows instead of a white screen. The boundary sits inside
  `Editor`, below its hooks, so a crash in the canvas or the chrome leaves the
  store and the autosave running: whatever was typed before the crash is still
  written, and Reload waits for that write before it reloads from Convex.
*/
export const StudioErrorBoundary = catchError(function StudioErrorFallback({ projectId }: { projectId: string }, { error }: ErrorInfo) {
  return <Crashed error={error instanceof Error ? error : new Error(String(error))} projectId={projectId} />;
});

function Crashed({ error, projectId }: { error: Error; projectId: string }) {
  const status = useSaveStatus();
  const [reloading, setReloading] = useState(false);
  const [copied, setCopied] = useState(false);

  /* Nothing is left on screen to stop playback from. */
  useEffect(() => {
    useEditor.getState().setPlaying(false);
  }, []);

  const reload = async () => {
    setReloading(true);
    /* If the write does not make it, the reload still happens; the browser's
       unsaved-changes prompt is the last word. */
    await flushSave();
    window.location.reload();
  };

  const copy = async () => {
    const saveError = lastSaveError();
    const details = [
      `${error.name}: ${error.message}`,
      error.stack ?? "",
      "",
      `Project: ${projectId}`,
      `URL: ${window.location.href}`,
      `Time: ${new Date().toISOString()}`,
      `Browser: ${navigator.userAgent}`,
      `Save status: ${status.state}`,
      saveError ? `Last save error: ${String(saveError)}` : "",
    ].filter((line, i, all) => line || all[i - 1]);
    await navigator.clipboard.writeText(details.join("\n").trim());
    setCopied(true);
  };

  const saved =
    status.state === "failed"
      ? "Your latest changes haven't saved yet. Reload will try once more before it goes."
      : status.state === "saving"
        ? "Saving your latest changes…"
        : "Your work is saved up to the moment this happened.";

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-canvas p-6" role="alert">
      <Panel className="flex w-full max-w-[400px] flex-col gap-4 p-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-titles text-ink">Something went wrong</h1>
          <p className="text-default text-ink-secondary">The studio hit an error and stopped. {saved}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" onClick={reload} disabled={reloading}>
            {reloading ? "Reloading…" : "Reload"}
          </Button>
          <Button variant="secondary" onClick={copy}>
            {copied ? "Copied" : "Copy error details"}
          </Button>
        </div>
      </Panel>
    </div>
  );
}

/*
  Development only: `window.crashStudio()` makes the next render inside the
  boundary throw, so the fallback can be seen and tested without breaking
  anything real.
*/
let crashRequested = false;
const crashListeners = new Set<() => void>();

if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  (window as unknown as { crashStudio: () => void }).crashStudio = () => {
    crashRequested = true;
    crashListeners.forEach((l) => l());
  };
}

export function CrashOnDemand() {
  const crash = useSyncExternalStore(
    (cb) => {
      crashListeners.add(cb);
      return () => void crashListeners.delete(cb);
    },
    () => crashRequested,
    () => false,
  );
  /* The flag stays set: React renders once more before giving up, and the
     retry has to throw too. A reload starts it afresh. */
  if (crash) throw new Error("Crash requested with window.crashStudio()");
  return null;
}
