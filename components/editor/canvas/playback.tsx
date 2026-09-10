"use client";

import { createContext, useContext } from "react";

import type { ProjectKind } from "@/lib/editor/types";

/*
  Artboards normally read their clock from the editor store. Anything that
  paints a slide outside the studio — the hub's project previews — supplies
  one here instead, so the same block renderers can be driven by a local
  transport without touching global state.
*/
export type Playback = {
  kind: ProjectKind;
  /* Seconds into the active scene. Ignored for image and carousel kinds. */
  time: number;
  playing: boolean;
  muted: boolean;
};

export const PlaybackContext = createContext<Playback | null>(null);

export function usePlaybackOverride() {
  return useContext(PlaybackContext);
}
