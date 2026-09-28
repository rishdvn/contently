import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";

import { Hub } from "@/components/hub/Hub";
import { Landing } from "@/components/hub/Landing";

/*
  `/` is the Projects page once signed in and the landing page before. It is
  public in `proxy.ts` for that reason; every other workspace route still
  sends a signed-out visitor to sign in.
*/
export async function generateMetadata(): Promise<Metadata> {
  const { userId } = await auth();
  return { title: userId ? "Projects · Contently" : "Contently" };
}

export default async function Home() {
  const { userId } = await auth();
  return userId ? <Hub /> : <Landing />;
}
