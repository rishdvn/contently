"use client";

import { useAuth } from "@clerk/nextjs";

/*
  The active organisation is the brand everything else is scoped to, so read it
  from one place. `orgId` is `null` when the user is on their personal account
  and `undefined` until Clerk has loaded, which is why `isLoaded` comes along:
  a Convex query keyed on the org must wait rather than run unscoped.
*/
export function useActiveOrg() {
  const { isLoaded, orgId, orgSlug, orgRole } = useAuth();
  return { orgId, orgSlug, role: orgRole, isLoaded };
}
