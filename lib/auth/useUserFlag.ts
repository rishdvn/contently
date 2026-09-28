"use client";

import { useMutation, useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { UserFlag } from "@/convex/users";

/*
  A per-person switch kept in Convex (`users.flags`), so something dismissed on
  one machine stays dismissed on the next. `value` is `undefined` until the
  answer arrives, which a first-run hint must wait for rather than flash.
  Setting it updates the viewer optimistically.
*/
export function useUserFlag(flag: UserFlag): { value: boolean | undefined; set: (value: boolean) => void } {
  const viewer = useQuery(api.users.viewer);
  const setFlag = useMutation(api.users.setFlag).withOptimisticUpdate((store, args) => {
    const current = store.getQuery(api.users.viewer, {});
    if (current) store.setQuery(api.users.viewer, {}, { ...current, flags: { ...current.flags, [args.flag]: args.value } });
  });
  return {
    value: viewer ? (viewer.flags[flag] ?? false) : undefined,
    set: (value) => void setFlag({ flag, value }),
  };
}
