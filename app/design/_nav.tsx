"use client";

import {
  Activity,
  AppWindow,
  AtSign,
  Bell,
  CircleUser,
  Compass,
  FileText,
  Layers,
  MessageSquare,
  MessageSquareMore,
  MousePointerClick,
  PanelRight,
  PanelsTopLeft,
  Palette,
  Rows3,
  SlidersHorizontal,
  Sparkles,
  SquareStack,
  Tag,
  TextCursorInput,
  ToggleLeft,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { NavLink, Sidebar, SidebarGroup } from "@/components/ui/nav";

/*
  Groupings follow Mobbin's element taxonomy — Control, View, Overlay, Imagery —
  because that is the vocabulary designers already search in. Two groups wrap
  it: Foundations beneath (tokens and the layering rules) and Patterns above
  (domain compositions, one per product surface). Reference is the live diff
  against the source product.

  Each item is an anchor into a page, so the nav doubles as the inventory.
  Planned elements are listed in one quiet line per group: the shape of the
  finished system should be visible before it exists.
*/
type Item = { label: string; href: string; icon: LucideIcon };
type Group = { label: string; items: Item[]; planned?: string[] };

export const designNav: Group[] = [
  {
    label: "Foundations",
    items: [
      { label: "Tokens", href: "/design", icon: Palette },
      { label: "Hierarchy", href: "/design/hierarchy", icon: Layers },
    ],
  },
  {
    label: "Controls",
    items: [
      { label: "Button", href: "/design/controls#buttons", icon: MousePointerClick },
      { label: "Input", href: "/design/controls#inputs", icon: TextCursorInput },
      { label: "Chip & tab", href: "/design/controls#chips", icon: Tag },
      { label: "Switch & checkbox", href: "/design/controls#toggles", icon: ToggleLeft },
    ],
    planned: ["Select", "Segmented", "Slider", "Date picker"],
  },
  {
    label: "Views",
    items: [
      { label: "Badge", href: "/design/views#badges", icon: Activity },
      { label: "Card", href: "/design/views#cards", icon: Rows3 },
      { label: "Navigation", href: "/design/views#navigation", icon: Compass },
      { label: "Toolbar", href: "/design/views#toolbar", icon: Wrench },
      { label: "Feedback", href: "/design/views#feedback", icon: Sparkles },
    ],
    planned: ["Table", "Stacked list", "Tab bar", "Progress"],
  },
  {
    label: "Overlays",
    items: [
      { label: "Dialog", href: "/design/overlays#dialogs", icon: AppWindow },
      { label: "Drawer", href: "/design/overlays#drawers", icon: PanelRight },
      { label: "Menu & tooltip", href: "/design/overlays#menus", icon: SquareStack },
      { label: "Popover", href: "/design/chat#pickers", icon: SlidersHorizontal },
      { label: "Alert & toast", href: "/design/overlays#toasts", icon: Bell },
    ],
    planned: ["Command palette", "Bottom sheet", "Coach marks"],
  },
  {
    label: "Imagery",
    items: [{ label: "Avatar & mark", href: "/design/views#imagery", icon: CircleUser }],
    planned: ["Thumbnail", "Logo", "Illustration"],
  },
  {
    label: "Patterns",
    items: [
      { label: "Chat", href: "/design/chat", icon: MessageSquare },
      { label: "Composer & mentions", href: "/design/chat#composer", icon: AtSign },
      { label: "Messages", href: "/design/chat#messages", icon: MessageSquareMore },
      { label: "Artifacts", href: "/design/chat#artifacts", icon: FileText },
    ],
    planned: ["Ideas", "Content", "Calendar", "Documents", "Editor"],
  },
  {
    label: "Reference",
    items: [{ label: "Parity", href: "/design/parity", icon: PanelsTopLeft }],
  },
];

/**
 * Which anchor is current. Sections carry ids; the topmost one crossing the
 * upper third of the viewport wins. Falls back to the page when there is none.
 */
function useActiveHref(pathname: string) {
  const [hash, setHash] = useState("");

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>("main section[id]"));

    const pick = () => {
      const line = window.innerHeight * 0.33;
      let current = "";
      for (const s of sections) {
        if (s.getBoundingClientRect().top <= line) current = s.id;
      }
      setHash(current);
    };
    /* First measurement waits a frame so the new page has painted. */
    const frame = requestAnimationFrame(pick);
    window.addEventListener("scroll", pick, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", pick);
    };
  }, [pathname]);

  return hash ? `${pathname}#${hash}` : pathname;
}

export function DesignNav() {
  const pathname = usePathname();
  const active = useActiveHref(pathname);

  const isActive = (href: string) => {
    if (href === active) return true;
    /* Before any section is reached, the first anchor on the page is current. */
    if (!active.includes("#") && href.startsWith(`${pathname}#`)) {
      const first = designNav.flatMap((g) => g.items).find((i) => i.href.startsWith(`${pathname}#`));
      return first?.href === href;
    }
    return false;
  };

  return (
    <Sidebar className="sticky top-0 h-dvh w-[232px] gap-4 overflow-y-auto px-3 py-5">
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
                active={isActive(item.href)}
                className="h-[30px] gap-2 text-ui [&>span:first-child>svg]:size-3.5"
              >
                {item.label}
              </NavLink>
            );
          })}
          {group.planned?.length ? (
            <p className="px-2.5 pt-1.5 text-tiny leading-4 text-ink-disabled">
              Planned &middot; {group.planned.join(", ")}
            </p>
          ) : null}
        </SidebarGroup>
      ))}
    </Sidebar>
  );
}
