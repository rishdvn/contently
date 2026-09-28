/*
  Which moment of a scene its template poster shows. Shared by the poster
  script (`scripts/template-posters.ts`) and the studio's Save as template
  (`components/editor/dialogs/SaveTemplateDialog.tsx`), so a poster looks the
  same whichever made it.

  The moment just before the first block leaves among those at which the most
  blocks are on screen — so every block has arrived and settled, and nothing
  that is never on screen together overlaps. For a scene whose blocks all run
  to its end, that is its last frame. Image and carousel slides are stills,
  taken at 0.

  Pure, with no editor imports: the script runs it in Node.
*/

type Timed = { start?: number; end?: number; hidden?: boolean };

/* Output width of a poster in px; the height follows the template's aspect. */
export const POSTER_WIDTH = 540;

export function posterTime(scene: { duration: number; blocks: Timed[] }): number {
  const blocks = scene.blocks.filter((b) => !b.hidden);
  const epsilon = 1 / 30;
  const candidates = [...blocks.map((b) => Math.min(b.end ?? scene.duration, scene.duration)), scene.duration].map((t) => Math.max(0, t - epsilon));
  const visibleAt = (t: number) => blocks.filter((b) => (b.start ?? 0) <= t && t < (b.end ?? scene.duration)).length;
  let best = candidates[0]!;
  for (const t of candidates) if (visibleAt(t) > visibleAt(best) || (visibleAt(t) === visibleAt(best) && t < best)) best = t;
  return best;
}
