import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Sidebar({ className, ...props }: ComponentProps<"nav">) {
  return (
    <nav
      className={cn(
        "flex w-56 shrink-0 flex-col gap-6 border-r border-line bg-canvas px-3 py-4",
        className,
      )}
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
        <div className="px-2.5 pb-1.5 text-xs text-ink-faint">{label}</div>
      ) : null}
      {children}
    </div>
  );
}

/**
 * Active state is a fill, not a colour or a left-edge marker. Labels stay at
 * full contrast in both states so the nav never looks half-disabled.
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
        "flex h-8 items-center gap-2.5 rounded-control px-2.5 text-sm",
        "transition-colors duration-150 ease-out-quart outline-none",
        "focus-visible:ring-2 focus-visible:ring-ink/25",
        active ? "bg-selected text-ink" : "text-ink-secondary hover:bg-raised hover:text-ink",
        className,
      )}
      {...props}
    >
      {icon ? <span className="shrink-0 [&>svg]:size-4">{icon}</span> : null}
      <span className="truncate">{children}</span>
    </button>
  );
}

/** Narrow icon rail used beside the editor canvas: glyph over a micro label. */
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
        "flex w-14 flex-col items-center gap-1 rounded-control py-2",
        "transition-colors duration-150 ease-out-quart outline-none",
        "focus-visible:ring-2 focus-visible:ring-ink/25",
        active ? "bg-selected text-ink" : "text-ink-muted hover:bg-raised hover:text-ink",
        className,
      )}
      {...props}
    >
      <span className="[&>svg]:size-4.5">{icon}</span>
      <span className="text-micro">{children}</span>
    </button>
  );
}
