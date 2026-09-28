/*
  The "words" text entrance: Butter's Slide In (up) with Animate By set to Word.
  Each word fades in while rising from 0.75 × the font size below its place,
  one after another in reading order. Timing is Butter's, in seconds from the
  block's start and independent of the block's length:

    per word   0.75 s, ease-out cubic for both opacity and position
    stagger    0.5 s / N^0.9 between word starts (N = words on every line)

  so a hook of five words has fully landed after about 1.23 s. Like Butter, a
  block shorter than that cuts the entrance off rather than squeezing it.
*/
export const WORD_DURATION = 0.75;
export const WORD_RISE = 0.75;

/* Words and the whitespace between them, in order. Whitespace (spaces and line
   breaks) is kept as-is so the text wraps exactly as it does unanimated. */
export function splitWords(text: string): { text: string; word: boolean }[] {
  return text
    .split(/(\s+)/)
    .filter((t) => t !== "")
    .map((t) => ({ text: t, word: !/^\s+$/.test(t) }));
}

export function wordStagger(count: number) {
  return count > 1 ? 0.5 / Math.pow(count, 0.9) : 0;
}

/* Seconds from the block's start until the last word has landed. */
export function wordsDuration(count: number) {
  return count > 0 ? WORD_DURATION + wordStagger(count) * (count - 1) : 0;
}

/* Eased 0 → 1 for word `index` of `count`, `elapsed` seconds into the block. */
export function wordProgress(index: number, count: number, elapsed: number) {
  const p = Math.min(1, Math.max(0, (elapsed - index * wordStagger(count)) / WORD_DURATION));
  return 1 - Math.pow(1 - p, 3);
}
