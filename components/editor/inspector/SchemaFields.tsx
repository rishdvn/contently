"use client";

import { GripVertical, ImagePlus, Plus, X } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Switch } from "@/components/ui/switch";
import type { Input, InputSchema, ListInput, MediaValue, ObjectInput, Props } from "@/lib/blocks/inputs";
import { defaultFor } from "@/lib/blocks/inputs";
import { cn } from "@/lib/cn";
import { useMediaUrl } from "@/lib/editor/media";
import type { MediaTarget } from "@/lib/editor/store";

import { Card, CardButton, ColorField, NumberField, Section, Segmented, Select } from "../controls";

type Path = (string | number)[];

export type SchemaFieldsProps = {
  schema: InputSchema;
  value: Props;
  onChange: (path: Path, value: unknown) => void;
  /* An image/video input asking for media; the caller opens a picker. */
  onPickMedia: (path: Path, kind: "image" | "video", label: string) => void;
  /* The input currently waiting on the picker, if any, so it can say so. */
  pendingMedia?: MediaTarget["path"] | null;
  brandColors?: string[];
};

/*
  The inspector for any block in the catalog, generated from its input schema.
  No block ships controls of its own: a label, a limit or a list bound in the
  schema is all the inspector knows, which is what keeps every block editable
  the same way — and editable by an API that has never seen its UI.

  Consecutive scalar inputs share a card; lists and nested objects get one each.
*/
export function SchemaFields(props: SchemaFieldsProps) {
  const runs: { key: string; entries: [string, Input][]; own: boolean }[] = [];
  for (const [name, input] of Object.entries(props.schema)) {
    const own = input.kind === "list" || input.kind === "object";
    const last = runs[runs.length - 1];
    if (!own && last && !last.own) last.entries.push([name, input]);
    else runs.push({ key: name, entries: [[name, input]], own });
  }
  return (
    <>
      {runs.map((run) =>
        run.own ? (
          <Field key={run.key} input={run.entries[0][1]} name={run.entries[0][0]} path={[run.entries[0][0]]} value={props.value[run.entries[0][0]]} ctx={props} />
        ) : (
          <Card key={run.key} className="flex flex-col gap-2 p-2">
            {run.entries.map(([name, input]) => (
              <Field key={name} input={input} name={name} path={[name]} value={props.value[name]} ctx={props} />
            ))}
          </Card>
        ),
      )}
    </>
  );
}

/* A label for inputs that did not bring one: "contactName" → "Contact name". */
const humanise = (name: string) => {
  const words = name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const samePath = (a: Path | null | undefined, b: Path) => !!a && a.length === b.length && a.every((x, i) => x === b[i]);

function Field({ input, name, path, value, ctx }: { input: Input; name: string; path: Path; value: unknown; ctx: SchemaFieldsProps }) {
  const label = input.label ?? humanise(name);
  const set = (v: unknown) => ctx.onChange(path, v);

  switch (input.kind) {
    case "text":
      return <TextInputField label={label} value={String(value ?? "")} maxLength={input.maxLength} multiline={input.multiline} placeholder={input.placeholder} onChange={set} />;
    case "number":
      return <NumberField label={label} value={Number(value ?? 0)} min={input.min} max={input.max} step={input.step} suffix={input.unit} onChange={set} />;
    case "color":
      return <ColorField label={label} value={String(value ?? "#000000")} onChange={set} presets={ctx.brandColors} />;
    case "boolean":
      return (
        <div className="flex h-8 items-center justify-between pr-1 pl-1">
          <span className="text-ui text-ink-secondary">{label}</span>
          <Switch checked={Boolean(value)} onCheckedChange={set} />
        </div>
      );
    case "select":
      /* A few short options read best as a strip; anything longer drops down. */
      return input.options.length <= 3 && input.options.every((o) => o.label.length <= 10) ? (
        <div className="flex items-center justify-between gap-2 pl-1">
          <span className="truncate text-ui text-ink-secondary">{label}</span>
          <Segmented className="w-[160px] shrink-0" value={String(value)} onChange={set} options={input.options.map((o) => ({ value: o.value, label: o.label }))} />
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <span className="pl-1 text-ui text-ink-secondary">{label}</span>
          <Select value={String(value)} onChange={(e) => set(e.target.value)} aria-label={label}>
            {input.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      );
    case "image":
    case "video":
      return (
        <MediaField
          kind={input.kind}
          label={label}
          value={(value as MediaValue) ?? { src: "" }}
          pending={samePath(ctx.pendingMedia, path)}
          onPick={() => ctx.onPickMedia(path, input.kind as "image" | "video", label)}
          onClear={() => set({ src: "" })}
        />
      );
    case "list":
      return <ListField input={input} label={label} path={path} value={Array.isArray(value) ? value : []} ctx={ctx} />;
    case "object":
      return (
        <Section label={label}>
          <ObjectFields input={input} path={path} value={value} ctx={ctx} />
        </Section>
      );
  }
}

function ObjectFields({ input, path, value, ctx }: { input: ObjectInput; path: Path; value: unknown; ctx: SchemaFieldsProps }) {
  const obj = (value ?? {}) as Record<string, unknown>;
  return (
    <>
      {Object.entries(input.fields).map(([name, field]) => (
        <Field key={name} input={field} name={name} path={[...path, name]} value={obj[name]} ctx={ctx} />
      ))}
    </>
  );
}

/* ---------------------------------------------------------------- text --- */

/* Edits land on the canvas as you type; the store folds the keystrokes into one undo step. */
function TextInputField({
  label,
  value,
  maxLength,
  multiline,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  maxLength?: number;
  multiline?: boolean;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  const field = "w-full rounded-[8px] bg-raised px-2 text-ui text-ink outline-none placeholder:text-ink-disabled focus:ring-1 focus:ring-line-strong";
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-baseline justify-between gap-2 px-1 text-ui text-ink-secondary">
        <span className="truncate">{label}</span>
        {maxLength !== undefined ? (
          <span className={cn("shrink-0 text-cap tabular-nums", value.length >= maxLength ? "text-ink" : "text-ink-disabled")}>
            {value.length}/{maxLength}
          </span>
        ) : null}
      </span>
      {multiline ? (
        <textarea
          className={cn(field, "field-sizing-content min-h-8 resize-none py-[7px] leading-[18px]")}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          rows={1}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className={cn(field, "h-8")}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
      )}
    </label>
  );
}

/* --------------------------------------------------------------- media --- */

function MediaField({
  kind,
  label,
  value,
  pending,
  onPick,
  onClear,
}: {
  kind: "image" | "video";
  label: string;
  value: MediaValue;
  pending: boolean;
  onPick: () => void;
  onClear: () => void;
}) {
  const src = useMediaUrl(value.mediaId, value.src);
  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-label={`Choose ${label.toLowerCase()}`} className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-raised text-ink-disabled" onClick={onPick}>
        {src ? (
          kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element -- user media
            <img src={src} alt="" className="size-full object-cover" />
          ) : (
            <video src={src} muted className="size-full object-cover" />
          )
        ) : (
          <ImagePlus className="size-4" />
        )}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate pl-1 text-ui text-ink-secondary">{label}</span>
        <div className="flex gap-1.5">
          <CardButton className="h-7" onClick={onPick} aria-pressed={pending}>
            {pending ? "Picking…" : src ? "Replace" : "Choose"}
          </CardButton>
          {src ? (
            <CardButton className="h-7 w-auto px-2.5" onClick={onClear} aria-label={`Remove ${label.toLowerCase()}`}>
              <X />
            </CardButton>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- list --- */

type Drag = { from: number; over: number; dy: number; startY: number; mids: number[]; height: number };

/* Matches the list's `gap-1.5`. */
const ITEM_GAP = 6;

/*
  A list input: one card per item with a grip to drag it into a new position
  (arrow keys on the grip do the same), a remove button, and an add button at
  the foot. `min` and `max` from the schema disable remove and add at the bounds.
*/
function ListField({ input, label, path, value, ctx }: { input: ListInput; label: string; path: Path; value: unknown[]; ctx: SchemaFieldsProps }) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const noun = input.itemLabel ?? "Item";
  const min = input.min ?? 0;
  const max = input.max ?? Infinity;
  const set = (items: unknown[]) => ctx.onChange(path, items);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length || from === to) return;
    const items = [...value];
    const [it] = items.splice(from, 1);
    items.splice(to, 0, it);
    set(items);
  };

  const startDrag = (i: number, e: React.PointerEvent<HTMLElement>) => {
    const list = e.currentTarget.closest("[data-list]");
    const cards = list ? Array.from(list.querySelectorAll<HTMLElement>(":scope > [data-item]")) : [];
    if (!cards[i]) return;
    const rects = cards.map((c) => c.getBoundingClientRect());
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ from: i, over: i, dy: 0, startY: e.clientY, mids: rects.map((r) => r.top + r.height / 2), height: rects[i].height });
  };

  /* Where the dragged card would land with the pointer at `clientY`. */
  const slotAt = (d: Drag, clientY: number) => {
    const centre = d.mids[d.from] + clientY - d.startY;
    let over = d.from;
    d.mids.forEach((m, j) => {
      if (j < d.from && centre < m) over = Math.min(over, j);
      if (j > d.from && centre > m) over = Math.max(over, j);
    });
    return over;
  };

  const moveDrag = (e: React.PointerEvent) => {
    if (drag) setDrag({ ...drag, dy: e.clientY - drag.startY, over: slotAt(drag, e.clientY) });
  };

  /* The slot comes from the release itself: the last move may not have rendered yet. */
  const endDrag = (e: React.PointerEvent) => {
    if (drag) move(drag.from, slotAt(drag, e.clientY));
    setDrag(null);
  };

  /* While dragging, the items between the old and new slot step aside by one card. */
  const offset = (j: number) => {
    if (!drag) return 0;
    if (j === drag.from) return drag.dy;
    const step = drag.height + ITEM_GAP;
    if (drag.from < drag.over && j > drag.from && j <= drag.over) return -step;
    if (drag.from > drag.over && j < drag.from && j >= drag.over) return step;
    return 0;
  };

  return (
    <Section
      label={label}
      trailing={
        <span className="pr-1 text-cap text-ink-disabled tabular-nums">
          {value.length}
          {Number.isFinite(max) ? `/${max}` : ""}
        </span>
      }
    >
      <div data-list className="flex flex-col gap-1.5">
        {value.map((item, i) => (
          <div
            key={i}
            data-item
            className={cn("flex flex-col gap-2 rounded-[10px] bg-raised/60 p-2", drag?.from === i && "relative z-10 shadow-overlay ring-1 ring-line-strong")}
            style={{ transform: drag ? `translateY(${offset(i)}px)` : undefined, transition: drag && drag.from !== i ? "transform 120ms ease-out" : undefined }}
          >
            <div className="-mt-0.5 -mb-1 flex h-6 items-center gap-1">
              <button
                type="button"
                aria-label={`Reorder ${noun.toLowerCase()} ${i + 1}`}
                className="flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-[6px] text-ink-disabled hover:text-ink active:cursor-grabbing disabled:cursor-default disabled:opacity-40"
                disabled={value.length < 2}
                onPointerDown={(e) => startDrag(i, e)}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={() => setDrag(null)}
                onKeyDown={(e) => {
                  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                  e.preventDefault();
                  e.stopPropagation();
                  move(i, i + (e.key === "ArrowUp" ? -1 : 1));
                }}
              >
                <GripVertical className="size-3.5" />
              </button>
              <span className="min-w-0 flex-1 truncate text-cap text-ink-secondary">
                {noun} {i + 1}
              </span>
              <button
                type="button"
                aria-label={`Remove ${noun.toLowerCase()} ${i + 1}`}
                disabled={value.length <= min}
                className="flex size-6 shrink-0 items-center justify-center rounded-[6px] text-ink-secondary hover:text-critical disabled:pointer-events-none disabled:opacity-30"
                onClick={() => set(value.filter((_, j) => j !== i))}
              >
                <X className="size-3.5" />
              </button>
            </div>
            <ItemFields input={input.item} path={[...path, i]} value={item} ctx={ctx} />
          </div>
        ))}
      </div>
      <CardButton
        className="h-8"
        disabled={value.length >= max}
        onClick={() => set([...value, freshItem(input.item, value[value.length - 1])])}
      >
        <Plus /> Add {noun.toLowerCase()}
      </CardButton>
    </Section>
  );
}

/*
  A new item copies the settings of the last one — the same side of the
  conversation, the same style — but not its content, which starts from the
  schema's default so the user is not left editing a duplicate.
*/
function freshItem(item: Input, last: unknown): unknown {
  if (item.kind !== "object" || typeof last !== "object" || last === null) return defaultFor(item);
  const base = defaultFor(item) as Record<string, unknown>;
  const prev = last as Record<string, unknown>;
  for (const [k, f] of Object.entries(item.fields)) {
    if (f.kind !== "text" && f.kind !== "image" && f.kind !== "video" && k in prev) base[k] = structuredClone(prev[k]);
  }
  return base;
}

function ItemFields({ input, path, value, ctx }: { input: Input; path: Path; value: unknown; ctx: SchemaFieldsProps }): ReactNode {
  if (input.kind === "object") return <ObjectFields input={input} path={path} value={value} ctx={ctx} />;
  return <Field input={input} name={String(path[path.length - 1])} path={path} value={value} ctx={ctx} />;
}
