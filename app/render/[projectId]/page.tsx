import { RenderStage } from "@/components/render/RenderStage";

/*
  `/render/<projectId>?token=…&scene=…` — the surface the render worker points a
  headless Chrome at. Public in `proxy.ts` because the worker has no Clerk
  session; the token from `convex/render.ts` is the authorisation, and it is
  good for one project for ten minutes.

  Nothing here is meant for a person, but a person with a token can open it,
  which is the quickest way to see what the worker saw.
*/
export const metadata = {
  title: "Render · Contently",
  robots: { index: false, follow: false },
};

function sceneIndex(value: string | string[] | undefined) {
  if (typeof value !== "string") return undefined;
  const index = Number.parseInt(value, 10);
  return Number.isInteger(index) && index >= 0 ? index : undefined;
}

export default async function RenderPage(props: PageProps<"/render/[projectId]">) {
  const { projectId } = await props.params;
  const { token, scene } = await props.searchParams;
  return <RenderStage projectId={projectId} token={typeof token === "string" ? token : ""} scene={sceneIndex(scene)} />;
}
