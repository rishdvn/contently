import type { ReactNode } from "react";

import { HubNav } from "./HubNav";

/* Page frame shared by the workspace routes: the nav, a title, a body. */
export function WorkspaceShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-canvas text-ink">
      <HubNav />
      <main className="min-w-0 flex-1 px-8 py-6">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-panels text-ink">{title}</h1>
        </header>
        <div className="mt-10">{children}</div>
      </main>
    </div>
  );
}
