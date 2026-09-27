/*
  The input primitives every block's schema is built from.

  A block never ships its own inspector UI: it declares what it needs from these
  nine kinds and `SchemaFields` renders the controls. The same schema is what an
  API or an AI reads to know what a block's content slots are, so the list is
  deliberately closed — a tenth kind is a platform change, not a block change.

  Values are plain JSON so they live inside the document and survive a save.
  Media is stored the way image blocks store it: a `media` id when the org owns
  the file, plus the last URL we saw so the first paint has something to show.
*/

export type MediaValue = { mediaId?: string; src: string };

type Base<V> = { label?: string; default?: V };

export type TextInput = Base<string> & { kind: "text"; maxLength?: number; multiline?: boolean; placeholder?: string };
export type ImageInput = Base<MediaValue> & { kind: "image" };
export type VideoInput = Base<MediaValue> & { kind: "video" };
export type ColorInput = Base<string> & { kind: "color" };
export type NumberInput = Base<number> & { kind: "number"; min?: number; max?: number; step?: number; unit?: string };
export type SelectOption<V extends string = string> = { value: V; label: string };
export type SelectInput<V extends string = string> = Base<V> & { kind: "select"; options: readonly SelectOption<V>[] };
export type BooleanInput = Base<boolean> & { kind: "boolean" };
/*
  Interfaces rather than aliases for the two recursive kinds: TypeScript resolves
  interface members lazily, which is what lets `Input` contain lists of `Input`.
  Their `default` is loosely typed for the same reason; `defaults` on the block
  definition is where typed sample content lives.
*/
/* Items have no ids of their own: a list is its order, and reordering is moving values. */
export interface ListInput<I extends Input = Input> {
  kind: "list";
  label?: string;
  default?: unknown[];
  item: I;
  min?: number;
  max?: number;
  /* Singular noun for one item — "Message" gives "Message 1", "Add message". */
  itemLabel?: string;
}
export interface ObjectInput<F extends Fields = Fields> {
  kind: "object";
  label?: string;
  default?: Record<string, unknown>;
  fields: F;
}

export type Input =
  | TextInput
  | ImageInput
  | VideoInput
  | ColorInput
  | NumberInput
  | SelectInput
  | BooleanInput
  | ListInput
  | ObjectInput;

export type InputKind = Input["kind"];
interface Fields {
  [name: string]: Input;
}

/* A block's inputs: named fields, in the order the inspector shows them. */
export type InputSchema = Fields;

export type ValueOf<I> = I extends TextInput | ColorInput
  ? string
  : I extends ImageInput | VideoInput
    ? MediaValue
    : I extends NumberInput
      ? number
      : I extends SelectInput<infer V>
        ? V
        : I extends BooleanInput
          ? boolean
          : I extends ListInput<infer It>
            ? ValueOf<It>[]
            : I extends ObjectInput<infer F>
              ? { [K in keyof F]: ValueOf<F[K]> }
              : never;

export type PropsOf<S extends InputSchema> = { [K in keyof S]: ValueOf<S[K]> };

/* What a document stores: whatever the schema says, as JSON. */
export type Props = Record<string, unknown>;

/*
  Builders. Plain object literals would do, but these keep literal types —
  `select` options become a union, `list` knows its item — so a block's render
  function gets typed props without writing them out twice.
*/
export const input = {
  text: (o: Omit<TextInput, "kind"> = {}): TextInput => ({ kind: "text", ...o }),
  image: (o: Omit<ImageInput, "kind"> = {}): ImageInput => ({ kind: "image", ...o }),
  video: (o: Omit<VideoInput, "kind"> = {}): VideoInput => ({ kind: "video", ...o }),
  color: (o: Omit<ColorInput, "kind"> = {}): ColorInput => ({ kind: "color", ...o }),
  number: (o: Omit<NumberInput, "kind"> = {}): NumberInput => ({ kind: "number", ...o }),
  boolean: (o: Omit<BooleanInput, "kind"> = {}): BooleanInput => ({ kind: "boolean", ...o }),
  select: <const V extends string>(o: Omit<SelectInput<V>, "kind">): SelectInput<V> => ({ kind: "select", ...o }),
  list: <I extends Input>(o: Omit<ListInput<I>, "kind">): ListInput<I> => ({ kind: "list", ...o }),
  object: <F extends Fields>(o: Omit<ObjectInput<F>, "kind">): ObjectInput<F> => ({ kind: "object", ...o }),
};

/* ------------------------------------------------------------ defaults --- */

/* The value an input starts with when the block's own defaults say nothing. */
export function defaultFor(i: Input): unknown {
  if (i.default !== undefined) return structuredClone(i.default);
  switch (i.kind) {
    case "text":
      return "";
    case "image":
    case "video":
      return { src: "" };
    case "color":
      return "#000000";
    case "number":
      return clampNumber(i, 0);
    case "select":
      return i.options[0]?.value ?? "";
    case "boolean":
      return false;
    case "list":
      return Array.from({ length: i.min ?? 0 }, () => defaultFor(i.item));
    case "object":
      return defaultsFor(i.fields);
  }
}

export function defaultsFor<S extends InputSchema>(schema: S): PropsOf<S> {
  return Object.fromEntries(Object.entries(schema).map(([k, i]) => [k, defaultFor(i)])) as PropsOf<S>;
}

/* ---------------------------------------------------------- validation --- */

export type Issue = { path: (string | number)[]; message: string };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const COLOR = /^(#[0-9a-f]{3}|#[0-9a-f]{6}|#[0-9a-f]{8}|rgba?\([^)]*\)|transparent)$/i;

function clampNumber(i: NumberInput, n: number) {
  const lo = i.min ?? -Infinity;
  const hi = i.max ?? Infinity;
  const clamped = Math.min(hi, Math.max(lo, n));
  return Number.isFinite(clamped) ? clamped : Number.isFinite(lo) ? lo : 0;
}

/*
  Every way `value` fails `i`, with a path to each. Nothing here throws: the
  inspector only ever writes valid values, so issues come from documents written
  by something else — an API caller, an older schema — and they are reported,
  then repaired by `coerce`.
*/
export function validate(i: Input, value: unknown, path: (string | number)[] = []): Issue[] {
  const fail = (message: string): Issue[] => [{ path, message }];
  switch (i.kind) {
    case "text":
      if (typeof value !== "string") return fail("Expected text");
      if (i.maxLength !== undefined && value.length > i.maxLength) return fail(`At most ${i.maxLength} characters`);
      if (!i.multiline && value.includes("\n")) return fail("Must be a single line");
      return [];
    case "image":
    case "video":
      if (!isRecord(value) || typeof value.src !== "string") return fail(`Expected ${i.kind === "image" ? "an image" : "a video"}`);
      if (value.mediaId !== undefined && typeof value.mediaId !== "string") return fail("Media id must be text");
      return [];
    case "color":
      return typeof value === "string" && COLOR.test(value.trim()) ? [] : fail("Expected a colour");
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) return fail("Expected a number");
      if (i.min !== undefined && value < i.min) return fail(`At least ${i.min}`);
      if (i.max !== undefined && value > i.max) return fail(`At most ${i.max}`);
      return [];
    case "select":
      return i.options.some((o) => o.value === value) ? [] : fail(`One of ${i.options.map((o) => o.value).join(", ")}`);
    case "boolean":
      return typeof value === "boolean" ? [] : fail("Expected true or false");
    case "list": {
      if (!Array.isArray(value)) return fail("Expected a list");
      const issues: Issue[] = [];
      if (i.min !== undefined && value.length < i.min) issues.push({ path, message: `At least ${i.min} items` });
      if (i.max !== undefined && value.length > i.max) issues.push({ path, message: `At most ${i.max} items` });
      value.forEach((v, n) => issues.push(...validate(i.item, v, [...path, n])));
      return issues;
    }
    case "object":
      if (!isRecord(value)) return fail("Expected an object");
      return validateProps(i.fields, value, path);
  }
}

export function validateProps(schema: InputSchema, props: unknown, path: (string | number)[] = []): Issue[] {
  if (!isRecord(props)) return [{ path, message: "Expected an object" }];
  return Object.entries(schema).flatMap(([k, i]) => validate(i, props[k], [...path, k]));
}

/*
  The nearest valid value: text is cut to length, numbers clamped, unknown
  options and missing fields fall back to their defaults, lists are trimmed or
  padded to their bounds. Renderers go through this, so a block can trust its
  props and a malformed document still draws something sensible.
*/
export function coerce(i: Input, value: unknown): unknown {
  switch (i.kind) {
    case "text": {
      if (typeof value !== "string") return defaultFor(i);
      const line = i.multiline ? value : value.replace(/\n/g, " ");
      return i.maxLength !== undefined ? line.slice(0, i.maxLength) : line;
    }
    case "image":
    case "video":
      if (!isRecord(value) || typeof value.src !== "string") return defaultFor(i);
      return typeof value.mediaId === "string" ? { mediaId: value.mediaId, src: value.src } : { src: value.src };
    case "color":
      return typeof value === "string" && COLOR.test(value.trim()) ? value.trim() : defaultFor(i);
    case "number":
      return typeof value === "number" && Number.isFinite(value) ? clampNumber(i, value) : defaultFor(i);
    case "select":
      return i.options.some((o) => o.value === value) ? value : defaultFor(i);
    case "boolean":
      return typeof value === "boolean" ? value : defaultFor(i);
    case "list": {
      if (!Array.isArray(value)) return defaultFor(i);
      const items = value.slice(0, i.max ?? Infinity).map((v) => coerce(i.item, v));
      while (items.length < (i.min ?? 0)) items.push(defaultFor(i.item));
      return items;
    }
    case "object":
      return coerceProps(i.fields, value);
  }
}

export function coerceProps<S extends InputSchema>(schema: S, props: unknown): PropsOf<S> {
  const src = isRecord(props) ? props : {};
  return Object.fromEntries(Object.entries(schema).map(([k, i]) => [k, k in src ? coerce(i, src[k]) : defaultFor(i)])) as PropsOf<S>;
}

/* ----------------------------------------------------------------- media --- */

/*
  Rewrite every image/video value in `props`, e.g. to drop a `blob:` URL before
  a save or to collect ids for the resolver. Walks the schema rather than
  guessing from shape, so an object that merely has a `src` field is left alone.
*/
export function mapMedia(schema: InputSchema, props: Props, fn: (m: MediaValue) => MediaValue): Props {
  const walk = (i: Input, v: unknown): unknown => {
    if (i.kind === "image" || i.kind === "video") return isRecord(v) && typeof v.src === "string" ? fn(v as MediaValue) : v;
    if (i.kind === "list") return Array.isArray(v) ? v.map((x) => walk(i.item, x)) : v;
    if (i.kind === "object") return isRecord(v) ? mapMedia(i.fields, v, fn) : v;
    return v;
  };
  return Object.fromEntries(Object.entries(props).map(([k, v]) => [k, schema[k] ? walk(schema[k], v) : v]));
}

/* ------------------------------------------------------------ paths --- */

/* Immutable set at a path of object keys and list indices. */
export function setIn<T>(root: T, path: (string | number)[], value: unknown): T {
  if (!path.length) return value as T;
  const [head, ...rest] = path;
  if (Array.isArray(root)) {
    const copy = [...root];
    copy[head as number] = setIn(copy[head as number], rest, value);
    return copy as T;
  }
  const obj: Record<string, unknown> = isRecord(root) ? root : {};
  return { ...obj, [head]: setIn(obj[head as string], rest, value) } as T;
}

export function getIn(root: unknown, path: (string | number)[]): unknown {
  return path.reduce<unknown>((v, k) => (v == null ? undefined : (v as Record<string | number, unknown>)[k]), root);
}
