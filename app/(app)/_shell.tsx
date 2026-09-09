"use client";

import { Archive, Bell, Files, Fingerprint, MessageSquare, Plus, RotateCcw } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { NavLink, Sidebar, SidebarGroup } from "@/components/ui/nav";
import { ToastProvider } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { brandTypes } from "@/lib/documents/registry";
import { isNeedsReview, isStale, relativeTime } from "@/lib/documents/selectors";
import { StoreProvider, useStore } from "@/lib/documents/store";

/*
  The product shell. Two tabs the PRD names — Brand and Documents — plus Chat
  where documents are made, Updates where the agent's proposals wait, and
  Archive. The sidebar carries counts so the founder knows what needs her
  before she clicks.
*/

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <StoreProvider>
      <ToastProvider>
        <div className="flex h-dvh overflow-hidden bg-canvas">
          <AppNav />
          <main className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
        </div>
      </ToastProvider>
    </StoreProvider>
  );
}

function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const store = useStore();

  const live = store.docs.filter((d) => d.status !== "archived");
  const work = live.filter((d) => !brandTypes.includes(d.type));
  const needsReview = work.filter(isNeedsReview).length;
  const brandAttention = live.filter((d) => brandTypes.includes(d.type) && (isStale(d, store.now) || d.pendingDiff)).length;
  const updates = live.filter((d) => d.pendingDiff).length + live.filter((d) => d.status === "generating").length;
  const archived = store.docs.filter((d) => d.status === "archived").length;
  const threads = [...store.threads].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);

  const is = (href: string) => (href === "/chat" ? pathname === "/chat" : pathname === href || pathname.startsWith(`${href}/`));

  const newChat = () => {
    const id = store.createThread();
    router.push(`/chat/${id}`);
  };

  return (
    <Sidebar
      className={cn(
        "h-dvh gap-5 overflow-y-auto border-r border-line py-4",
        /* Below lg the sidebar is an icon rail: labels, counts and recent chats fold away. */
        "w-16 px-2 lg:w-[248px] lg:px-3",
        "max-lg:[&_a>span:not(:first-child)]:hidden max-lg:[&_a]:justify-center max-lg:[&_a]:px-0",
      )}
    >
      <div className="flex items-center justify-between px-2.5 max-lg:justify-center max-lg:px-0">
        <Link href="/documents" className="text-titles text-ink italic max-lg:hidden">
          Contently
        </Link>
        <Avatar name="Terra Clays" shape="square" size="sm" />
      </div>

      <Button variant="spectrum" onClick={newChat} className="mx-1 justify-start max-lg:mx-0 max-lg:justify-center max-lg:px-0" title="New chat">
        <Plus /> <span className="max-lg:hidden">New chat</span>
      </Button>

      <SidebarGroup>
        <NavLink href="/chat" icon={<MessageSquare />} active={is("/chat")} title="Chat">
          Chat
        </NavLink>
        <NavLink href="/documents" icon={<Files />} active={is("/documents")} title="Documents" trailing={needsReview ? String(needsReview) : undefined}>
          Documents
        </NavLink>
        <NavLink href="/brand" icon={<Fingerprint />} active={is("/brand")} title="Brand" trailing={brandAttention ? String(brandAttention) : undefined}>
          Brand
        </NavLink>
        <NavLink href="/updates" icon={<Bell />} active={is("/updates")} title="Updates" trailing={updates ? String(updates) : undefined}>
          Updates
        </NavLink>
        <NavLink href="/archive" icon={<Archive />} active={is("/archive")} title="Archive" trailing={archived ? String(archived) : undefined}>
          Archive
        </NavLink>
      </SidebarGroup>

      {threads.length ? (
        <SidebarGroup label="Recent chats" className="max-lg:hidden">
          {threads.map((t) => {
            const streaming = t.messages.some((m) => m.role === "assistant" && m.streaming);
            return (
              <NavLink key={t.id} href={`/chat/${t.id}`} active={pathname === `/chat/${t.id}`} className="h-8 text-ui" trailing={streaming ? "●" : relativeTime(t.updatedAt, store.now).replace(" ago", "")}>
                {t.title}
              </NavLink>
            );
          })}
        </SidebarGroup>
      ) : null}

      <div className="mt-auto flex flex-col gap-2 px-2.5 max-lg:hidden">
        <Link href="/design" className="text-tiny text-ink-disabled hover:text-ink-secondary">
          Design system →
        </Link>
        <button
          type="button"
          onClick={() => {
            store.resetDemo();
            router.push("/documents");
          }}
          className="inline-flex items-center gap-1.5 text-tiny text-ink-disabled hover:text-ink-secondary"
        >
          <RotateCcw className="size-3" /> Reset demo data
        </button>
      </div>
    </Sidebar>
  );
}
