import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Sidebar({ className, ...props }: ComponentProps<"nav">) {
  return (
    <nav
      className={cn("flex w-[289px] shrink-0 flex-col gap-6 bg-canvas px-[22px] py-4", className)}
      {...props}
    />
  );
}

export function SidebarGroup({
  label,
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {label ? (
        <div className="px-2.5 pb-1.5 text-cap text-ink-disabled">{label}</div>
      ) : null}
      {children}
    </div>
  );
}

/*
  One class builder shared by the button and link forms, so the two can never
  drift apart. Active state is a solid fill, not a colour or an edge marker,
  and labels stay at full contrast in both states so the nav never looks
  half-disabled.
*/
function navItemClass(active: boolean, className?: string) {
  return cn(
    "flex h-[39px] items-center gap-2.5 rounded-nav px-[9px] text-body text-ink",
    "transition-colors duration-150 ease-out-quart outline-none",
    "focus-visible:ring-2 focus-visible:ring-ink/25",
    active ? "bg-raised" : "hover:bg-[var(--state-hover)]",
    className,
  );
}

function NavItemInner({
  icon,
  trailing,
  children,
}: {
  icon?: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      {icon ? <span className="shrink-0 [&>svg]:size-4">{icon}</span> : null}
      <span className="min-w-0 flex-1 truncate text-left">{children}</span>
      {trailing ? <span className="shrink-0 text-cap text-ink-disabled">{trailing}</span> : null}
    </>
  );
}

export function NavItem({
  icon,
  trailing,
  active = false,
  className,
  children,
  ...props
}: ComponentProps<"button"> & { icon?: ReactNode; trailing?: ReactNode; active?: boolean }) {
  return (
    <button aria-current={active ? "page" : undefined} className={navItemClass(active, className)} {...props}>
      <NavItemInner icon={icon} trailing={trailing}>
        {children}
      </NavItemInner>
    </button>
  );
}

/** Same item, rendered as a route link. */
export function NavLink({
  icon,
  trailing,
  active = false,
  className,
  children,
  ...props
}: ComponentProps<typeof Link> & { icon?: ReactNode; trailing?: ReactNode; active?: boolean }) {
  return (
    <Link aria-current={active ? "page" : undefined} className={navItemClass(active, className)} {...props}>
      <NavItemInner icon={icon} trailing={trailing}>
        {children}
      </NavItemInner>
    </Link>
  );
}

/** Narrow icon rail beside the editor canvas: glyph over a small label. */
export function RailItem({
  icon,
  active = false,
  className,
  children,
  ...props
}: ComponentProps<"button"> & { icon?: ReactNode; active?: boolean }) {
  return (
    <button
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-14 flex-col items-center gap-1 rounded-nav py-2",
        "transition-colors duration-150 ease-out-quart outline-none",
        "focus-visible:ring-2 focus-visible:ring-ink/25",
        active
          ? "bg-[var(--state-selected)] text-ink"
          : "text-ink-secondary hover:bg-[var(--state-hover)] hover:text-ink",
        className,
      )}
      {...props}
    >
      <span className="[&>svg]:size-4.5">{icon}</span>
      <span className="text-tiny">{children}</span>
    </button>
  );
}
