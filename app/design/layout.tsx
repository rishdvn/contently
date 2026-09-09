import type { ReactNode } from "react";

import { DesignNav } from "./_nav";

export default function DesignLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-canvas">
      <DesignNav />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
