import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/*
  A project document with its `media` ids swapped for the URLs they resolve to
  right now, for readers that have no Clerk session to resolve them with — the
  render worker (`render.document`), a visitor on a share link
  (`projects.getShared`) — or no membership in the org that owns the files: a
  template (`templates.get`), which every organisation reads.

  The studio and the hub resolve ids in the browser through `media.resolve`,
  which is authorised by membership, so for either of these readers the answer
  there would be "no such media" for every photo. Resolving here instead,
  against the project's own org, hands out exactly the files the project shows
  and nothing else.
*/

type MediaRef =
  | { kind: "block"; slide: number; block: number }
  | { kind: "background"; slide: number }
  /* An `image`/`video` input inside a catalog block's props, by its path. */
  | { kind: "prop"; slide: number; block: number; path: (string | number)[] };

export type DocumentLike = {
  slides?: {
    background?: { type?: string; mediaId?: string; src?: string };
    blocks?: { type?: string; mediaId?: string; src?: string; props?: unknown }[];
  }[];
};

/* Every `media` id a document mentions, with where it sits, so the URLs can be
   written back in one pass. Mirrors `mediaIdsIn` in `lib/editor/media.tsx`,
   which cannot be imported here: it is a client module. */
function mediaRefs(document: unknown): Map<string, MediaRef[]> {
  const found = new Map<string, MediaRef[]>();
  const add = (id: string | undefined, at: MediaRef) => {
    if (!id) return;
    const list = found.get(id);
    if (list) list.push(at);
    else found.set(id, [at]);
  };

  const slides = (document as DocumentLike)?.slides ?? [];
  slides.forEach((slide, s) => {
    if (slide?.background?.type === "image") add(slide.background.mediaId, { kind: "background", slide: s });
    (slide?.blocks ?? []).forEach((block, b) => {
      if (block?.type === "image" || block?.type === "video") add(block.mediaId, { kind: "block", slide: s, block: b });
      /* The block's schema is client code, so its media values are found by
         shape — `{ mediaId, src }`, which is what `MediaValue` is. */
      if (block?.type === "component") {
        const walk = (value: unknown, path: (string | number)[]) => {
          if (Array.isArray(value)) value.forEach((item, i) => walk(item, [...path, i]));
          else if (value && typeof value === "object") {
            const record = value as Record<string, unknown>;
            if (typeof record.mediaId === "string" && typeof record.src === "string") add(record.mediaId, { kind: "prop", slide: s, block: b, path });
            else for (const [key, inner] of Object.entries(record)) walk(inner, [...path, key]);
          }
        };
        walk(block.props, []);
      }
    });
  });
  return found;
}

export async function withResolvedMedia(ctx: QueryCtx, orgId: Id<"organizations">, document: unknown): Promise<unknown> {
  const refs = mediaRefs(document);
  const urls = new Map<string, string>();

  for (const id of refs.keys()) {
    const mediaId = ctx.db.normalizeId("media", id);
    const row = mediaId ? await ctx.db.get(mediaId) : null;
    /* Stock is shared (no `orgId`); anything owned is owned by this project's
       org or it is not ours to hand out. */
    if (!row || (row.orgId && row.orgId !== orgId)) continue;
    const url = await ctx.storage.getUrl(row.storageId);
    if (url) urls.set(id, url);
  }

  const copy = JSON.parse(JSON.stringify(document)) as DocumentLike;
  for (const [id, places] of refs) {
    const url = urls.get(id) ?? "";
    for (const place of places) {
      const slide = copy.slides?.[place.slide];
      if (!slide) continue;
      /* The id goes with the URL. Left in place it would be looked up again in
         the browser, by a resolver that has no session, and its answer — "no
         such media" — would paint over a photo that is already on screen. */
      const target = (
        place.kind === "background"
          ? slide.background
          : place.kind === "block"
            ? slide.blocks?.[place.block]
            : place.path.reduce<unknown>((v, k) => (v as Record<string | number, unknown> | undefined)?.[k], slide.blocks?.[place.block]?.props)
      ) as { mediaId?: string; src?: string } | undefined;
      if (!target) continue;
      target.src = url;
      delete target.mediaId;
    }
  }
  return copy;
}
