"use client";

import { Folder, Images, LayoutTemplate } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { NavLink, Sidebar, SidebarGroup } from "@/components/ui/nav";

/* V1 navigation: three destinations, nothing that leads nowhere. */
const DESTINATIONS: { href: string; label: string; icon: ReactNode }[] = [
  { href: "/templates", label: "Templates", icon: <LayoutTemplate /> },
  { href: "/", label: "Projects", icon: <Folder /> },
  { href: "/media", label: "Media", icon: <Images /> },
];

/* The sidebar every workspace page shares, so the three routes cross-link. */
export function HubNav() {
  const pathname = usePathname();
  return (
    <Sidebar className="sticky top-0 h-dvh">
      <div className="px-2.5 pt-1 pb-2 text-titles text-ink italic">Contently</div>
      <SidebarGroup>
        {DESTINATIONS.map((d) => (
          <NavLink key={d.href} href={d.href} icon={d.icon} active={pathname === d.href}>
            {d.label}
          </NavLink>
        ))}
      </SidebarGroup>
      <div className="mt-auto flex items-center gap-2.5 px-2.5 py-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-spectrum-green text-[13px] font-semibold text-canvas">P</span>
        <div className="min-w-0">
          <div className="truncate text-ui text-ink">Personal</div>
          <div className="truncate text-cap text-ink-secondary">Local workspace</div>
        </div>
      </div>
    </Sidebar>
  );
}
