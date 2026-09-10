"use client";

import {
  Calendar,
  FileText,
  Image,
  KanbanSquare,
  Layers,
  LayoutTemplate,
  Library,
  MessageSquare,
  MessageSquareText,
  PanelsTopLeft,
  Palette,
  PenTool,
  Rows3,
  SlidersHorizontal,
  SquareStack,
  type LucideIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";

import { NavLink, Sidebar, SidebarGroup } from "@/components/ui/nav";

/*
  One page per item, nothing else. Elements are grouped the way Mobbin groups
  them — Controls, Views, Overlays, Imagery — and each page lists every element
  in its group in full. Patterns are the product's surfaces, one page each.

  The sidebar never scrolls: if the list outgrows the viewport, the fix is to
  regroup, not to add a scrollbar.
*/
type Item = { label: string; href: string; icon: LucideIcon };
type Group = { label: string; items: Item[] };

export const designNav: Group[] = [
  {
    label: "Foundations",
    items: [
      { label: "Tokens", href: "/design", icon: Palette },
      { label: "Hierarchy", href: "/design/hierarchy", icon: Layers },
    ],
  },
  {
    label: "Elements",
    items: [
      { label: "Controls", href: "/design/controls", icon: SlidersHorizontal },
      { label: "Views", href: "/design/views", icon: Rows3 },
      { label: "Overlays", href: "/design/overlays", icon: SquareStack },
      { label: "Imagery", href: "/design/imagery", icon: Image },
    ],
  },
  {
    label: "Patterns",
    items: [
      { label: "Chat", href: "/design/chat", icon: MessageSquare },
      { label: "Messages", href: "/design/messages", icon: MessageSquareText },
      { label: "Artifacts", href: "/design/artifacts", icon: FileText },
      { label: "Board", href: "/design/board", icon: KanbanSquare },
      { label: "Calendar", href: "/design/calendar", icon: Calendar },
      { label: "Library", href: "/design/library", icon: Library },
      { label: "Editor", href: "/design/editor", icon: PenTool },
      { label: "Templates", href: "/design/templates", icon: LayoutTemplate },
    ],
  },
  {
    label: "Reference",
    items: [{ label: "Parity", href: "/design/parity", icon: PanelsTopLeft }],
  },
];

export function DesignNav() {
  const pathname = usePathname();
  return (
    <Sidebar className="sticky top-0 h-dvh w-[220px] gap-5 overflow-hidden px-3 py-5">
      <div className="flex items-center gap-2 px-2.5 pb-1">
        <span className="text-titles text-ink italic">Contently</span>
        <span className="text-cap text-ink-disabled">Design</span>
      </div>
      {designNav.map((group) => (
        <SidebarGroup key={group.label} label={group.label}>
          {group.items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.href}
                href={item.href}
                icon={<Icon />}
                active={pathname === item.href}
                className="h-[32px] gap-2 text-ui [&>span:first-child>svg]:size-3.5"
              >
                {item.label}
              </NavLink>
            );
          })}
        </SidebarGroup>
      ))}
    </Sidebar>
  );
}
