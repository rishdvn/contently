import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full bg-field text-ink rounded-control " +
  "placeholder:text-ink/50 " +
  "border border-transparent transition-colors duration-150 ease-out-quart outline-none " +
  "hover:border-line-strong focus:border-line-strong " +
  "disabled:text-ink-disabled disabled:hover:border-transparent";

export function Input({
  className,
  leading,
  ...props
}: ComponentProps<"input"> & { leading?: ReactNode }) {
  const input = (
    <input
      className={cn(control, "h-9.5 px-3 text-default", leading && "pl-9", className)}
      {...props}
    />
  );

  if (!leading) return input;

  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink/50 [&>svg]:size-4">
        {leading}
      </span>
      {input}
    </div>
  );
}

/** Pill-shaped search field, as used above the template and block grids. */
export function SearchInput({ className, ...props }: ComponentProps<"input"> & { leading?: ReactNode }) {
  return <Input className={cn("rounded-full", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(control, "min-h-24 resize-y px-3 py-2.5 text-default", className)}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-cap text-ink-secondary">{label}</span>
      {children}
      {hint ? <span className="text-cap text-ink-disabled">{hint}</span> : null}
    </label>
  );
}
