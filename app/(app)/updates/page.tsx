import type { Metadata } from "next";

import { UpdatesView } from "./updates-view";

export const metadata: Metadata = { title: "Updates · Contently" };

export default function UpdatesPage() {
  return <UpdatesView />;
}
