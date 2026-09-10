"use client";

import {
  Calendar,
  ChevronRight,
  ChevronsUpDown,
  KanbanSquare,
  LayoutTemplate,
  Library,
  MessageSquare,
  MoreHorizontal,
  PenTool,
  Plus,
} from "lucide-react";
import type { ReactNode } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Kbd } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { NavItem, Sidebar, SidebarGroup } from "@/components/ui/nav";
import { cn } from "@/lib/cn";

/*
  The product's frame, for the pattern pages. Every surface demo sits inside
  this so the reader sees it where it will live. It is deliberately not a
  scroll container: the frame grows with its content and the page scrolls.
*/

export type AppSection = "chat" | "board" | "calendar" | "library" | "editor" | "templates";

const sections: { id: AppSection; label: string; icon: typeof MessageSquare; count?: string }[] = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "board", label: "Board", icon: KanbanSquare, count: "6" },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "library", label: "Library", icon: Library },
  { id: "editor", label: "Editor", icon: PenTool },
  { id: "templates", label: "Templates", icon: LayoutTemplate },
];

export function AppSidebar({ active, recents = [] }: { active: AppSection; recents?: string[] }) {
  return (
    <Sidebar className="w-[232px] gap-4 px-3 py-3">
      <button className="flex h-10 items-center gap-2.5 rounded-nav px-2 text-left hover:bg-[var(--state-hover)]">
        <Avatar name="Glow Labs" shape="square" size="sm" />
        <span className="min-w-0 flex-1 truncate text-default text-ink">Glow Labs</span>
        <ChevronsUpDown className="size-3.5 text-ink-disabled" />
      </button>

      <SidebarGroup>
        <NavItem icon={<Plus />} trailing={<Kbd>⌘K</Kbd>} className="h-8 text-ui">
          New chat
        </NavItem>
      </SidebarGroup>

      <SidebarGroup label="Workspace">
        {sections.map((s) => (
          <NavItem key={s.id} icon={<s.icon />} active={s.id === active} trailing={s.count} className="h-8 text-ui">
            {s.label}
          </NavItem>
        ))}
      </SidebarGroup>

      {recents.length ? (
        <SidebarGroup label="Recent">
          {recents.map((r, i) => (
            <NavItem key={r} active={active === "chat" && i === 0} className="h-7.5 text-cap text-ink-secondary">
              {r}
            </NavItem>
          ))}
        </SidebarGroup>
      ) : null}

      <div className="mt-auto flex items-center gap-2.5 px-2 pt-2">
        <Avatar name="Hanna Moore" size="sm" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-cap text-ink">Hanna Moore</span>
          <span className="truncate text-tiny text-ink-disabled">hanna@glowlabs.co</span>
        </div>
        <IconButton aria-label="Account" size="sm">
          <MoreHorizontal />
        </IconButton>
      </div>
    </Sidebar>
  );
}

export function AppHeader({ crumbs, children }: { crumbs: string[]; children?: ReactNode }) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-4 px-5">
      <div className="flex min-w-0 items-center gap-1.5 text-cap">
        {crumbs.map((c, i) => (
          <span key={c} className="contents">
            {i > 0 ? <ChevronRight className="size-3 text-ink-disabled" /> : null}
            <span className={cn("truncate", i === crumbs.length - 1 ? "text-ink" : "text-ink-secondary")}>{c}</span>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-1">{children}</div>
    </header>
  );
}

export function AppFrame({
  active,
  recents,
  className,
  children,
}: {
  active: AppSection;
  recents?: string[];
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex min-h-[640px] overflow-hidden rounded-[var(--radius-overlay)] bg-canvas ring-1 ring-line", className)}>
      <AppSidebar active={active} recents={recents} />
      <div className="flex min-w-0 flex-1 flex-col bg-panel">{children}</div>
    </div>
  );
}
