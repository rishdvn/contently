"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect } from "react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { PlayableTrack } from "@/convex/audio/library";

/*
  The Audio flyout's "Recently used": the tracks this person last previewed or
  put on a timeline, newest first, one list per tab. It lives on the account
  (`convex/audio/recent.ts`), as Butter keeps it, so it follows them to another
  browser.

  Recording a use is optimistic: the row jumps to the top as the click lands,
  not a round trip later.
*/

export type RecentTrack = PlayableTrack;

const EMPTY: RecentTrack[] = [];

export function useRecentTracks(kind: RecentTrack["kind"]): RecentTrack[] {
  return useQuery(api.audio.recent.list, { kind }) ?? EMPTY;
}

export function useRememberTrack() {
  return useMutation(api.audio.recent.remember).withOptimisticUpdate((store, { trackId }) => {
    for (const kind of ["music", "sfx"] as const) {
      const list = store.getQuery(api.audio.recent.list, { kind });
      if (!list) continue;
      const known = list.find((t) => t.id === trackId) ?? pending.get(trackId);
      if (!known || known.kind !== kind) continue;
      store.setQuery(api.audio.recent.list, { kind }, [known, ...list.filter((t) => t.id !== trackId)]);
    }
  });
}

/* The row a use is about to be recorded for, so the optimistic update can put
   a track at the top that was not in the list yet. Set just before the
   mutation is called; the update runs synchronously inside that call. */
const pending = new Map<string, RecentTrack>();

export function rememberWith(remember: ReturnType<typeof useRememberTrack>, track: RecentTrack) {
  pending.set(track.id, track);
  void remember({ trackId: track.id as Id<"audioTracks"> })
    .catch(() => {
      /* Not worth interrupting anyone over: the list just doesn't move. */
    })
    .finally(() => pending.delete(track.id));
}

/*
  The list used to live in this browser's localStorage. Whatever a browser still
  has there is carried onto the account once, newest first, and then cleared.
*/
const LEGACY_KEYS = ["contently.audio.recent.v1.music", "contently.audio.recent.v1.sfx"];

export function useImportLocalRecent() {
  const importLocal = useMutation(api.audio.recent.importLocal);
  useEffect(() => {
    let ids: string[] = [];
    try {
      for (const key of LEGACY_KEYS) {
        const list = JSON.parse(window.localStorage.getItem(key) ?? "[]");
        if (Array.isArray(list)) ids = ids.concat(list.map((t: { id?: unknown }) => t?.id).filter((id): id is string => typeof id === "string"));
      }
    } catch {
      /* Unreadable: nothing to carry over. */
    }
    if (!ids.length) return;
    importLocal({ trackIds: ids })
      .then(() => LEGACY_KEYS.forEach((key) => window.localStorage.removeItem(key)))
      .catch(() => {
        /* Left in place; the next visit tries again. */
      });
  }, [importLocal]);
}
