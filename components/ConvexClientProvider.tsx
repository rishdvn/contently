"use client";

import { useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import type { ReactNode } from "react";

import { MediaUrlResolver } from "@/lib/editor/media";

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

/*
  One client for the whole tab, created at module scope so that a re-render — or
  a route change — does not tear down the websocket and re-run every query.

  `expectAuth` holds requests until the first token is in hand. Every route is
  signed-in-only, so the alternative is a pointless unauthenticated pass whose
  results would be thrown away as soon as Clerk loads.
*/
const convex = url ? new ConvexReactClient(url, { expectAuth: true }) : null;

if (!convex && typeof window !== "undefined") {
  console.error(
    "NEXT_PUBLIC_CONVEX_URL is missing; set it on the Vercel project and in .env.local. Anything backed by Convex will fail until it is there.",
  );
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  /*
    Without a URL there is no client to provide, and the tree renders anyway.
    Neither failing the build nor throwing here is worth it for a value only
    needed at runtime: the first took every branch preview down, the second
    blanked every page behind "this page couldn't load". Convex hooks then fail
    at their own call site with "Could not find Convex client!", next to the code
    that needs one, and the console says which variable is missing.
  */
  if (!convex) return children;

  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
      {/* Media ids become URLs here, for the whole tab: the studio, the hub
          previews and the media library all render documents, and one
          subscription for all of them beats one per image. */}
      <MediaUrlResolver />
    </ConvexProviderWithClerk>
  );
}
