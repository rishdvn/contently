import { Stage } from "@/components/render/Stage";

/*
  `/render/stage` — a render page with nothing on it until a script puts
  something there: the block preview generator and the template poster script
  (`components/render/Stage.tsx`). Public under `/render` in `proxy.ts`; it
  fetches nothing, so there is nothing for a token to protect.
*/
export const metadata = {
  title: "Stage · Contently",
  robots: { index: false, follow: false },
};

export default function StagePage() {
  return <Stage />;
}
