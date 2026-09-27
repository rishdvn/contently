import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { SharedViewer } from "@/components/hub/SharedViewer";
import { api } from "@/convex/_generated/api";

/*
  `/p/<projectId>?t=<token>` — the read-only viewer a share link opens. Public
  in `proxy.ts`: the token (or, without one, the visitor's membership of the
  project's org) is the authorisation, and `projects.getShared` checks both.

  Read here, on the server, rather than through the app's Convex provider: the
  provider holds every query until Clerk hands it a token, and a signed-out
  visitor never gets one. A signed-in visitor's session goes along so that a
  teammate can open the link without a token.

  Anything that does not resolve is a 404, whatever the reason — the link was
  never shared, was turned off, or the project is gone — so a visitor cannot
  tell which. `not-found.tsx` offers sign-in to someone who is signed out.
*/

const loadShared = cache(async (id: string, token: string | undefined) => {
  const { getToken } = await auth();
  /* Our Clerk instance stamps `aud: "convex"` on the session token itself (see
     `ConvexClientProvider`), so the plain session token is what Convex takes. */
  const session = (await getToken()) ?? undefined;
  return await fetchQuery(api.projects.getShared, { id, token }, { token: session });
});

async function shareArgs(props: PageProps<"/p/[projectId]">) {
  const { projectId } = await props.params;
  const { t } = await props.searchParams;
  return { projectId, token: typeof t === "string" && t ? t : undefined };
}

export async function generateMetadata(props: PageProps<"/p/[projectId]">): Promise<Metadata> {
  const { projectId, token } = await shareArgs(props);
  const shared = await loadShared(projectId, token);
  return {
    title: shared ? `${shared.project.name} · Contently` : "Contently",
    /* A share link is for the people it was sent to, not for search. */
    robots: { index: false, follow: false },
  };
}

export default async function SharedProjectPage(props: PageProps<"/p/[projectId]">) {
  const { projectId, token } = await shareArgs(props);
  const shared = await loadShared(projectId, token);
  if (!shared) notFound();
  return <SharedViewer shared={shared} shareUrl={`/p/${projectId}${token ? `?t=${encodeURIComponent(token)}` : ""}`} />;
}
