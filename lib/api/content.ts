import { getSpec } from "../blocks/catalog";
import { fieldSlots, formatPath, inputAt, parsePath } from "../blocks/fields";
import { getIn, setIn, validate, validateProps } from "../blocks/inputs";
import { findRole, isContentRole } from "../editor/roles";
import type { Block, ContentRole, Project } from "../editor/types";

import { maxCharsFor } from "./view";

/*
  Replacing a document's content, for `PATCH /v1/projects/:id/content`.

  A replacement names where (`blockId`, or `role` — optionally narrowed by
  `sceneIndex` and, for a role that occurs more than once, `index`) and what
  (`text`, `mediaId`, `mediaUrl` or `props`). A role reaches inside catalog
  blocks: the Product card's `image` is `image:product` (`lib/blocks/fields.ts`),
  so `{ role: "image:product", mediaUrl }` fills it; `blockId` + `field`
  addresses one field of one block (`messages[2].text`).

  The batch is all or nothing. `parseReplacements` rejects a malformed request
  before anything is fetched; `applyReplacements` then resolves every target
  and either returns the new document or the reasons it cannot. A target that
  does not exist is not an error — it is reported as unmatched — because a
  caller working from a template's roles should not have to know which scenes
  a project kept.

  Pure: no Convex, so the rules are unit-tested (`content.test.ts`).
*/

export type Replacement = {
  blockId?: string;
  role?: ContentRole;
  sceneIndex?: number;
  index?: number;
  field?: string;
  text?: string;
  mediaId?: string;
  mediaUrl?: string;
  props?: Record<string, unknown>;
};

export type Problem = { at: string; message: string };

const KEYS = new Set(["blockId", "role", "sceneIndex", "index", "field", "text", "mediaId", "mediaUrl", "props"]);
const VALUES = ["text", "mediaId", "mediaUrl", "props"] as const;
export const MAX_REPLACEMENTS = 100;
const MAX_TEXT = 5000;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isIndex = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;

/* The request body, checked for shape only: every problem at once, with where it is. */
export function parseReplacements(body: unknown): { replacements: Replacement[]; problems: Problem[] } {
  const problems: Problem[] = [];
  const list = isRecord(body) ? body.replacements : undefined;
  if (!Array.isArray(list)) return { replacements: [], problems: [{ at: "replacements", message: "Expected { replacements: [...] }" }] };
  if (!list.length) problems.push({ at: "replacements", message: "At least one replacement" });
  if (list.length > MAX_REPLACEMENTS) problems.push({ at: "replacements", message: `At most ${MAX_REPLACEMENTS} replacements per request` });

  const replacements = list.map((item, i): Replacement => {
    const at = (key?: string) => `replacements[${i}]${key ? `.${key}` : ""}`;
    const fail = (key: string | undefined, message: string) => problems.push({ at: at(key), message });
    if (!isRecord(item)) {
      fail(undefined, "Expected an object");
      return {};
    }
    for (const key of Object.keys(item)) if (!KEYS.has(key)) fail(key, `Unknown field; expected one of ${[...KEYS].join(", ")}`);

    const { blockId, role, sceneIndex, index, field, text, mediaId, mediaUrl, props } = item;
    if ((blockId === undefined) === (role === undefined)) fail(undefined, "Give exactly one of blockId or role");
    if (blockId !== undefined && (typeof blockId !== "string" || !blockId)) fail("blockId", "Expected a block id");
    if (role !== undefined && !isContentRole(role)) fail("role", `Unknown role; expected one of the content roles (heading, body, cta, image:product, …)`);
    if (sceneIndex !== undefined && !isIndex(sceneIndex)) fail("sceneIndex", "Expected a scene index (0, 1, …)");
    if (index !== undefined) {
      if (!isIndex(index)) fail("index", "Expected which match (0, 1, …)");
      if (role === undefined) fail("index", "Only with role: picks one of the blocks that carry it");
    }
    if (field !== undefined) {
      const path = typeof field === "string" ? parsePath(field) : null;
      if (!path || path.includes("[]")) fail("field", 'Expected a field path such as "image" or "messages[2].text"');
      if (blockId === undefined) fail("field", "Only with blockId: a role already says which field");
    }

    const given = VALUES.filter((k) => item[k] !== undefined);
    if (given.length !== 1) fail(undefined, `Give exactly one of ${VALUES.join(", ")}`);
    if (text !== undefined && (typeof text !== "string" || text.length > MAX_TEXT)) fail("text", `Expected text of at most ${MAX_TEXT} characters`);
    if (mediaId !== undefined && (typeof mediaId !== "string" || !mediaId)) fail("mediaId", "Expected a media id (GET /v1/media)");
    if (mediaUrl !== undefined && !(typeof mediaUrl === "string" && /^https?:\/\/\S+$/i.test(mediaUrl))) fail("mediaUrl", "Expected an http(s) URL");
    if (props !== undefined && !isRecord(props)) fail("props", "Expected an object of the block's inputs");
    if (props !== undefined && field !== undefined) fail("props", "props replaces a catalog block's inputs; address one field with text or media instead");

    return item as Replacement;
  });
  return { replacements, problems };
}

/* The URLs a batch asks to import, deduplicated: fetched once each. */
export const mediaUrlsIn = (replacements: Replacement[]) => [...new Set(replacements.flatMap((r) => (r.mediaUrl ? [r.mediaUrl] : [])))];
export const mediaIdsIn = (replacements: Replacement[]) => [...new Set(replacements.flatMap((r) => (r.mediaId ? [r.mediaId] : [])))];

/* A media file the batch will place, resolved by the caller: `kind` is null
   while a URL has not been fetched yet (planning, before any import). */
export type Media = { id: string | null; kind: "image" | "video" | null; url: string };
export type MediaLookup = (r: Replacement) => Media | undefined;

export type Change = { replacement: number; scene: number; blockId: string; field?: string; before: unknown; after: unknown };
export type Unmatched = { replacement: number; reason: string };
export type Skipped = { replacement: number; scene: number; blockId: string; field?: string; reason: string };

export type Outcome = {
  document: Pick<Project, "slides">;
  changed: Change[];
  unmatched: Unmatched[];
  /* Matches of a role whose type could not take the value (a `brand` logo
     strip sent text); the others were still replaced. */
  skipped: Skipped[];
  /* Applied, but worth knowing: text longer than the slot's room. */
  warnings: Problem[];
  problems: Problem[];
};

type Target = { scene: number; blockIndex: number; field?: string };

function targetsOf(doc: Pick<Project, "slides">, r: Replacement): Target[] {
  const out: Target[] = [];
  if (r.blockId !== undefined) {
    doc.slides.forEach((slide, scene) => {
      if (r.sceneIndex !== undefined && scene !== r.sceneIndex) return;
      slide.blocks.forEach((b, blockIndex) => b.id === r.blockId && out.push({ scene, blockIndex, field: r.field }));
    });
    return out;
  }
  const found = findRole(doc, r.role!, r.sceneIndex).map((t) => ({
    scene: t.scene,
    blockIndex: doc.slides[t.scene]!.blocks.findIndex((b) => b.id === t.blockId),
    field: t.field,
  }));
  return r.index === undefined ? found : found.slice(r.index, r.index + 1);
}

const mediaValue = (m: Media) => ({ ...(m.id ? { mediaId: m.id } : {}), src: m.url });

/*
  One value into one place. Returns the new block, or why not: a text block
  wants `text`, a media block `mediaId`/`mediaUrl` of its own kind, a catalog
  block `props` (or, with a field, the field's kind of value).
*/
function put(block: Block, field: string | undefined, r: Replacement, media: Media | undefined): { block: Block; before: unknown; after: unknown; long?: string } | { reason: string } {
  const sent = r.text !== undefined ? "text" : r.props !== undefined ? "props" : "media";

  if (field !== undefined) {
    if (block.type !== "component") return { reason: `Block ${block.id} is ${block.type}, not a catalog block; drop "field"` };
    const spec = getSpec(block.componentId);
    if (!spec) return { reason: `Block ${block.id} is "${block.componentId}", which this deployment's catalog does not know` };
    const path = parsePath(field)!;
    const input = inputAt(spec.inputs, path);
    if (!input) return { reason: `${spec.name} has no field "${field}"; its content fields are ${fieldSlots(block.componentId, block.props).map((f) => f.path).join(", ") || "none"}` };
    const parent = getIn(block.props, path.slice(0, -1));
    const last = path[path.length - 1]!;
    if (typeof last === "number" ? !Array.isArray(parent) || last >= parent.length : !(parent && typeof parent === "object")) {
      return { reason: `${formatPath(path.slice(0, -1))} has no item ${last}; send props to change the list` };
    }
    const before = getIn(block.props, path);
    let value: unknown;
    if (input.kind === "text") {
      if (sent !== "text") return { reason: `${spec.name} ${field} is text; send text` };
      value = r.text;
    } else if (input.kind === "image" || input.kind === "video") {
      if (sent !== "media") return { reason: `${spec.name} ${field} is ${input.kind === "image" ? "an image" : "a video"}; send mediaId or mediaUrl` };
      if (media?.kind && media.kind !== input.kind) return { reason: `${spec.name} ${field} takes ${input.kind === "image" ? "an image" : "a video"}, and that media is ${media.kind === "image" ? "an image" : "a video"}` };
      value = mediaValue(media!);
    } else {
      return { reason: `${spec.name} ${field} is a ${input.kind}, not content; send props for the whole block` };
    }
    const issue = validate(input, value)[0];
    if (issue) return { reason: `${field}: ${issue.message}` };
    const soft = typeof before === "string" && typeof value === "string" && before && value.length > maxCharsFor(before) ? field : undefined;
    return { block: { ...block, props: setIn(block.props, path, value) }, before, after: value, ...(soft ? { long: soft } : {}) };
  }

  switch (block.type) {
    case "text":
      if (sent !== "text") return { reason: `Block ${block.id} is text; send text` };
      return { block: { ...block, text: r.text! }, before: block.text, after: r.text, ...(block.text && r.text!.length > maxCharsFor(block.text) ? { long: block.id } : {}) };
    case "image":
    case "video":
      if (sent !== "media") return { reason: `Block ${block.id} is ${block.type === "image" ? "an image" : "a video"}; send mediaId or mediaUrl` };
      if (media?.kind && media.kind !== block.type) return { reason: `Block ${block.id} takes ${block.type === "image" ? "an image" : "a video"}, and that media is ${media.kind === "image" ? "an image" : "a video"}` };
      {
        const { mediaId, ...rest } = block;
        return { block: { ...rest, ...mediaValue(media!) }, before: { ...(mediaId ? { mediaId } : {}), src: block.src }, after: mediaValue(media!) };
      }
    case "component": {
      const spec = getSpec(block.componentId);
      if (!spec) return { reason: `Block ${block.id} is "${block.componentId}", which this deployment's catalog does not know` };
      if (sent !== "props") {
        const fields = fieldSlots(block.componentId, block.props).map((f) => f.path);
        return { reason: `Block ${block.id} is a ${spec.name}; send props, or address a field with blockId + field${fields.length ? ` (${fields.join(", ")})` : ""}` };
      }
      const unknown = Object.keys(r.props!).filter((k) => !(k in spec.inputs));
      if (unknown.length) return { reason: `${spec.name} has no input ${unknown.map((k) => `"${k}"`).join(", ")}; its inputs are ${Object.keys(spec.inputs).join(", ")}` };
      const next = { ...block.props, ...r.props };
      const issue = validateProps(spec.inputs, next)[0];
      if (issue) return { reason: `${formatPath(issue.path)}: ${issue.message}` };
      return { block: { ...block, props: next }, before: Object.fromEntries(Object.keys(r.props!).map((k) => [k, block.props[k]])), after: r.props };
    }
    case "shape":
      return { reason: `Block ${block.id} is a shape, which holds no content` };
  }
}

export function applyReplacements(doc: Pick<Project, "slides">, replacements: Replacement[], lookup: MediaLookup): Outcome {
  const slides = doc.slides.map((s) => ({ ...s, blocks: [...s.blocks] }));
  const out: Outcome = { document: { slides }, changed: [], unmatched: [], skipped: [], warnings: [], problems: [] };

  replacements.forEach((r, i) => {
    const media = r.mediaId !== undefined || r.mediaUrl !== undefined ? lookup(r) : undefined;
    if ((r.mediaId !== undefined || r.mediaUrl !== undefined) && !media) {
      out.problems.push({ at: `replacements[${i}].${r.mediaId !== undefined ? "mediaId" : "mediaUrl"}`, message: r.mediaId !== undefined ? "No such media in this organisation or in stock" : "Could not import this URL" });
      return;
    }
    const targets = targetsOf({ slides }, r);
    if (!targets.length) {
      const where = r.sceneIndex !== undefined ? ` in scene ${r.sceneIndex}` : "";
      out.unmatched.push({ replacement: i, reason: r.blockId !== undefined ? `No block ${r.blockId}${where}` : r.index !== undefined ? `No match ${r.index} of role ${r.role}${where}` : `No block or field has role ${r.role}${where}` });
      return;
    }
    let applied = 0;
    const refused: Skipped[] = [];
    for (const t of targets) {
      const block = slides[t.scene]!.blocks[t.blockIndex]!;
      const result = put(block, t.field, r, media);
      if ("reason" in result) {
        refused.push({ replacement: i, scene: t.scene, blockId: block.id, ...(t.field ? { field: t.field } : {}), reason: result.reason });
        continue;
      }
      slides[t.scene]!.blocks[t.blockIndex] = result.block;
      applied++;
      out.changed.push({ replacement: i, scene: t.scene, blockId: block.id, ...(t.field ? { field: t.field } : {}), before: result.before, after: result.after });
      if (result.long) out.warnings.push({ at: `replacements[${i}]`, message: `Longer than the slot's room (${r.text!.length} characters where about ${maxCharsFor(String(result.before))} fit); check the render` });
    }
    /* A block named by id is exactly what the caller meant, so a mismatch is
       their mistake. A role can sit on blocks of different types; the ones
       that could not take the value are reported, the rest replaced. */
    if (r.blockId !== undefined || !applied) out.problems.push(...refused.map((s) => ({ at: `replacements[${i}]`, message: s.reason })));
    else out.skipped.push(...refused);
  });
  return out;
}
