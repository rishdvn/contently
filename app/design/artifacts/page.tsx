import type { Metadata } from "next";

import { ArtifactsDemo } from "./artifacts-demo";

export const metadata: Metadata = { title: "Artifacts · Contently Design" };

export default function ArtifactsPage() {
  return <ArtifactsDemo />;
}
