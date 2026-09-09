"use client";

import { useSyncExternalStore } from "react";

/**
 * Subscribes to a CSS media query. The server snapshot is `fallback`, so the
 * first client render agrees with the server and corrects itself right after.
 */
export function useMediaQuery(query: string, fallback = true) {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => fallback,
  );
}
