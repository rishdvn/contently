import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { fail } from "./templates";

/*
  Posters drawn in the studio as it saves a template
  (`components/editor/dialogs/SaveTemplateDialog.tsx`): one image per scene,
  in order, rendered by the studio's own exporter at the moment `posterTime`
  picks (the poster script's choice too). The first is the template's poster.

  The bytes come here rather than as storage ids from an upload URL so that
  every file this attaches is one it stored itself: posters are deleted with
  their template, and an id passed in could be anybody's file.

  Its own file only because it is an action; the rules are `templates.ts`'s
  (`posterTarget`, `setPosters`).
*/

/* Marks posters the studio drew: never the hash of a document, so the poster
   script redraws them with its own renderer the next time it runs. */
const STUDIO_POSTERS = "studio";

/* JPEG or PNG, a scene each, a few hundred KB at 540 px wide. */
const MAX_POSTER_BYTES = 2 * 1024 * 1024;
const isJpeg = (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8;
const isPng = (b: Uint8Array) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;

export const savePosters = action({
  args: { orgId: v.string(), id: v.string(), posters: v.array(v.bytes()) },
  handler: async (ctx, { orgId, id, posters }): Promise<null> => {
    const target: { id: Id<"templates">; scenes: number } = await ctx.runQuery(internal.templates.posterTarget, { orgId, id });
    if (posters.length !== target.scenes) fail("invalid", `This template has ${target.scenes} scene(s); send a poster for each`);
    const files = posters.map((buffer) => new Uint8Array(buffer));
    for (const bytes of files) {
      if (bytes.byteLength > MAX_POSTER_BYTES) fail("invalid", "A poster is larger than 2 MB");
      if (!isJpeg(bytes) && !isPng(bytes)) fail("invalid", "Posters are JPEG or PNG");
    }
    const ids: Id<"_storage">[] = [];
    for (const bytes of files) ids.push(await ctx.storage.store(new Blob([bytes as BlobPart], { type: isPng(bytes) ? "image/png" : "image/jpeg" })));
    await ctx.runMutation(internal.templates.setPosters, { id: target.id, scenePosters: ids, poster: ids[0]!, postersHash: STUDIO_POSTERS });
    return null;
  },
});
