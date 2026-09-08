import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Sidebar({ className, ...props }: ComponentProps<"nav">) {
  return (
    <nav
      className={cn("flex w-52 shrink-0 flex-col gap-6 bg-canvas px-3 py-4", className)}
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

/**
 * Active state is a light overlay, not a colour or an edge marker. Labels stay
 * at full contrast in both states so the nav never looks half-disabled.
 */
export function NavItem({
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
        "flex h-9.5 items-center gap-2.5 rounded-nav px-2.5 text-default text-ink",
        "transition-colors duration-150 ease-out-quart outline-none",
        "focus-visible:ring-2 focus-visible:ring-ink/25",
        active ? "bg-[var(--state-selected)]" : "hover:bg-[var(--state-hover)]",
        className,
      )}
      {...props}
    >
      {icon ? <span className="shrink-0 [&>svg]:size-4">{icon}</span> : null}
      <span className="truncate">{children}</span>
    </button>
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
