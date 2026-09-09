import type { Metadata } from "next";

import { DocumentsView } from "./documents-view";

export const metadata: Metadata = { title: "Documents · Contently" };

export default function DocumentsPage() {
  return <DocumentsView />;
}
