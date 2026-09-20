"use client";

import { useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import type { ReactNode } from "react";

/*
  The Convex client, authenticated with Clerk: `ConvexProviderWithClerk` hands
  Convex a Clerk token and refreshes it, so `ctx.auth.getUserIdentity()` resolves
  inside every query and mutation.

  Our Clerk instance has the Convex integration enabled, which puts
  `aud: "convex"` on the session token itself — the audience `auth.config.ts`
  requires — so there is no `convex` JWT template to look for. The provider falls
  back to asking for one only when the session token lacks that audience.

  It must be rendered inside `ClerkProvider` (see `app/layout.tsx`).
*/

const url = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!url) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is missing; the app has no datastore without it");
}

/*
  One client for the whole tab, created at module scope so that a re-render — or
  a route change — does not tear down the websocket and re-run every query.

  `expectAuth` holds requests until the first token is in hand. Every route is
  signed-in-only, so the alternative is a pointless unauthenticated pass whose
  results would be thrown away as soon as Clerk loads.
*/
const convex = new ConvexReactClient(url, { expectAuth: true });

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
