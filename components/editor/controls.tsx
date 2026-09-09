"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useRef, useState, type ComponentProps, type ReactNode } from "react";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";

/* Floating surface. No border: surfaces separate by value alone. */
export function Panel({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("pointer-events-auto rounded-[16px] bg-panel shadow-overlay", className)} {...props} />;
}

/* The inspector's inner card, one shade up from the panel. */
export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-[12px] bg-card", className)} {...props} />;
}

/*
  Collapsible property group with an optional enable switch, matching the
  reference's "Color Adjustment ○" rows. Turning the switch on expands the
  group; turning it off collapses it and removes the property.
*/
export function Group({
  label,
  enabled,
  onEnabledChange,
  defaultOpen = false,
  children,
  trailing,
}: {
  label: string;
  enabled?: boolean;
  onEnabledChange?: (v: boolean) => void;
  defaultOpen?: boolean;
  children?: ReactNode;
  trailing?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const toggleable = enabled !== undefined;
  const expanded = toggleable ? enabled && open : open;
  return (
    <Card>
      <div className="flex h-11 items-center gap-1.5 pr-2 pl-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-ui text-ink outline-none"
          onClick={() => {
            if (toggleable && !enabled) onEnabledChange?.(true);
            setOpen((o) => (toggleable && !enabled ? true : !o));
          }}
        >
          <span className="text-ink-disabled [&>svg]:size-3.5">{expanded ? <ChevronDown /> : <ChevronRight />}</span>
          <span className="truncate">{label}</span>
        </button>
        {trailing}
        {toggleable ? (
          <Switch
            checked={enabled}
            onCheckedChange={(v) => {
              onEnabledChange?.(v);
              setOpen(v);
            }}
          />
        ) : null}
      </div>
      {expanded && children ? <div className="flex flex-col gap-2 px-2 pb-2.5">{children}</div> : null}
    </Card>
  );
}

/* Un-collapsible card with a heading, e.g. "Position". */
export function Section({ label, children, trailing }: { label: string; children: ReactNode; trailing?: ReactNode }) {
  return (
    <Card className="flex flex-col gap-2 p-2">
      <div className="flex h-7 items-center justify-between pl-1">
        <span className="text-ui text-ink">{label}</span>
        {trailing}
      </div>
      {children}
    </Card>
  );
}

export function Row({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-1.5", className)} style={{ gridTemplateColumns: `repeat(${Array.isArray(children) ? children.filter(Boolean).length : 1}, minmax(0, 1fr))` }}>{children}</div>;
}

/*
  Compact numeric field: label on the left, value right-aligned, exactly the
  "X  -112" treatment in the reference. Commits on blur or Enter, and supports
  drag-to-scrub on the label.
*/
export function NumberField({
  label,
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  suffix,
  className,
}: {
  label: ReactNode;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const shown = draft ?? formatNum(value);
  const drag = useRef<{ x: number; v: number } | null>(null);

  return (
    <label
      className={cn(
        "flex h-8 items-center gap-1 rounded-[8px] bg-raised px-2 text-ui",
        "focus-within:ring-1 focus-within:ring-line-strong",
        className,
      )}
    >
      <span
        className="shrink-0 cursor-ew-resize select-none text-ink-secondary [&>svg]:size-3.5"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, v: value };
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const dx = e.clientX - drag.current.x;
          onChange(clamp(roundTo(drag.current.v + dx * step * (e.shiftKey ? 10 : 1), step)));
        }}
        onPointerUp={() => (drag.current = null)}
      >
        {label}
      </span>
      <input
        className="min-w-0 flex-1 bg-transparent text-right text-ink outline-none"
        value={shown}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={() => {
          if (draft !== null) {
            const n = parseFloat(draft);
            if (Number.isFinite(n)) onChange(clamp(n));
          }
          setDraft(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const d = (e.key === "ArrowUp" ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
            onChange(clamp(roundTo(value + d, step)));
          }
        }}
      />
      {suffix ? <span className="shrink-0 text-ink-disabled">{suffix}</span> : null}
    </label>
  );
}

const roundTo = (n: number, step: number) => {
  const dp = step < 1 ? Math.ceil(-Math.log10(step)) : 0;
  return parseFloat((Math.round(n / step) * step).toFixed(dp));
};
const formatNum = (n: number) => (Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(2))));

/* Labelled slider with a numeric readout. */
export function SliderField({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="flex flex-col gap-1 px-1">
      <div className="flex items-center justify-between text-ui">
        <span className="text-ink-secondary">{label}</span>
        <span className="text-ink">
          {formatNum(value)}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        className="slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onDoubleClick={() => onChange(min < 0 ? 0 : min)}
      />
    </div>
  );
}

/* Swatch + hex, with the native picker underneath the swatch. */
export function ColorField({
  label,
  value,
  onChange,
  presets,
  allowAlpha = false,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  presets?: string[];
  allowAlpha?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const hex = toHex(value);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-8 items-center gap-2 rounded-[8px] bg-raised px-2 text-ui">
        {label ? <span className="shrink-0 text-ink-secondary">{label}</span> : null}
        <span className="relative size-5 shrink-0 overflow-hidden rounded-[5px] ring-1 ring-white/15" style={{ background: value }}>
          <input
            type="color"
            aria-label={label ?? "Colour"}
            className="absolute -inset-2 size-[200%] cursor-pointer opacity-0"
            value={hex}
            onChange={(e) => onChange(e.target.value)}
          />
        </span>
        <input
          className="min-w-0 flex-1 bg-transparent font-mono text-[12px] tracking-wide text-ink uppercase outline-none"
          value={draft ?? (value.startsWith("#") ? value : value === "transparent" ? "none" : value)}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => e.target.select()}
          onBlur={() => {
            if (draft !== null) {
              const v = normaliseColor(draft, allowAlpha);
              if (v) onChange(v);
            }
            setDraft(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
      </div>
      {presets?.length ? (
        <div className="flex flex-wrap gap-1.5 px-0.5">
          {presets.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              className={cn("size-5 rounded-full ring-1 ring-white/15 transition-transform hover:scale-110", c === value && "ring-2 ring-ink")}
              style={{ background: c }}
              onClick={() => onChange(c)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function toHex(c: string) {
  if (/^#[0-9a-f]{6}$/i.test(c)) return c;
  if (/^#[0-9a-f]{3}$/i.test(c)) return "#" + c.slice(1).split("").map((x) => x + x).join("");
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c);
  if (m) return "#" + [m[1], m[2], m[3]].map((n) => parseInt(n).toString(16).padStart(2, "0")).join("");
  return "#ffffff";
}

function normaliseColor(v: string, allowAlpha: boolean) {
  const t = v.trim();
  if (t === "none" || t === "transparent") return "transparent";
  if (/^[0-9a-f]{6}$/i.test(t)) return `#${t}`;
  if (/^#[0-9a-f]{6}$/i.test(t) || /^#[0-9a-f]{3}$/i.test(t)) return t;
  if (allowAlpha && /^rgba?\(/.test(t)) return t;
  return null;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className={cn("relative flex h-8 items-center rounded-[8px] bg-raised text-ui text-ink", className)}>
      <select className="size-full appearance-none bg-transparent pr-7 pl-2 outline-none" {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-ink-secondary" />
    </div>
  );
}

/* Exclusive choice rendered as a segmented strip, e.g. None | Pan | Zoom. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; title?: string }[];
  className?: string;
}) {
  return (
    <div className={cn("flex h-8 items-center gap-0.5 rounded-[8px] bg-raised p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          aria-pressed={o.value === value}
          className={cn(
            "flex h-full flex-1 items-center justify-center rounded-[6px] px-2 text-ui transition-colors [&>svg]:size-3.5",
            o.value === value ? "bg-ink text-canvas" : "text-ink-secondary hover:text-ink",
          )}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function IconToggle({ pressed, className, ...props }: ComponentProps<"button"> & { pressed: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        "flex size-8 items-center justify-center rounded-[8px] transition-colors [&>svg]:size-4",
        pressed ? "bg-ink text-canvas" : "bg-raised text-ink-secondary hover:text-ink",
        className,
      )}
      {...props}
    />
  );
}

/* Wide, low-emphasis action inside a card ("Set as Background", "Add Effect"). */
export function CardButton({ className, ...props }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-9 w-full items-center justify-center gap-2 rounded-[8px] bg-raised text-ui text-ink transition-colors hover:bg-line-strong disabled:pointer-events-none disabled:text-ink-disabled [&>svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}

/* Debounced text input that commits on blur/Enter but reflects external changes. */
export function TextField({ value, onCommit, className, ...props }: Omit<ComponentProps<"input">, "value" | "onChange"> & { value: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setDraft(value);
  }
  return (
    <input
      className={cn("h-8 w-full rounded-[8px] bg-raised px-2 text-ui text-ink outline-none focus:ring-1 focus:ring-line-strong", className)}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      {...props}
    />
  );
}
