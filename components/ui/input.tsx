import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full bg-field text-ink placeholder:text-ink-faint rounded-control " +
  "border border-transparent transition-colors duration-150 ease-out-quart outline-none " +
  "hover:border-line-strong focus:border-line-strong focus:bg-raised " +
  "disabled:text-ink-disabled disabled:hover:border-transparent";

export function Input({
  className,
  leading,
  ...props
}: ComponentProps<"input"> & { leading?: ReactNode }) {
  const input = (
    <input
      className={cn(control, "h-8 px-2.5 text-sm", leading && "pl-8", className)}
      {...props}
    />
  );

  if (!leading) return input;

  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-ink-faint">
        {leading}
      </span>
      {input}
    </div>
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(control, "min-h-20 resize-y px-2.5 py-2 text-sm", className)}
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
      <span className="text-xs font-medium text-ink-secondary">{label}</span>
      {children}
      {hint ? <span className="text-xs text-ink-faint">{hint}</span> : null}
    </label>
  );
}
