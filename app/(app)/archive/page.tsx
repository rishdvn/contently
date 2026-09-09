import type { Metadata } from "next";

import { ArchiveView } from "./archive-view";

export const metadata: Metadata = { title: "Archive · Contently" };

export default function ArchivePage() {
  return <ArchiveView />;
}
