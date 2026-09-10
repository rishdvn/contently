import type { Metadata } from "next";

import { MessagesDemo } from "./messages-demo";

export const metadata: Metadata = { title: "Messages · Contently Design" };

export default function MessagesPage() {
  return <MessagesDemo />;
}
