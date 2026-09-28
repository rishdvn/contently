/*
  Estimated text layout for text blocks. A block's `render` is a pure function
  of its props and ctx (docs/blocks.md): it cannot measure the DOM to shrink
  copy that would overflow its box. Instead it asks this module how wide a
  string is in Inter, wraps it into lines, and picks the largest type that fits.

  The estimate is deliberately wide. Advances are rounded up and kerning is
  ignored, so the browser's line is never longer than the one computed here.
  Draw the returned `lines` one per row (`white-space: pre`) and the browser
  breaks exactly where this module did, which is also what lets a block style
  each line (a highlight behind it) or reveal it word by word.

  Blocks that use this set their type in Inter (`FONT`), the only family
  measured. Plain TypeScript with relative imports, so `npm test` runs it in Node.
*/

export const FONT = `"Inter", -apple-system, system-ui, sans-serif`;

export type Weight = 400 | 500 | 600 | 700 | 800 | 900;

export type TextStyle = {
  weight: Weight;
  /* In em, as CSS `letter-spacing` would take it. Added after every character. */
  letterSpacing?: number;
};

/*
  Inter's advance widths in hundredths of an em, for printable ASCII (32 → 126),
  measured in Chrome from the Google Fonts stylesheet the studio and render
  pages load, rounded up.
*/
const ADVANCES: Record<Weight, number[]> = {
  400: [29, 29, 47, 64, 65, 99, 65, 30, 37, 37, 51, 67, 29, 46, 29, 37, 64, 41, 61, 62, 65, 60, 63, 57, 62, 63, 29, 31, 67, 67, 67, 52, 97, 69, 66, 74, 73, 61, 60, 75, 75, 27, 58, 68, 57, 91, 76, 77, 64, 77, 65, 65, 65, 75, 69, 99, 69, 68, 63, 37, 37, 37, 48, 46, 33, 57, 62, 58, 62, 59, 38, 62, 60, 25, 25, 55, 25, 88, 60, 60, 62, 62, 38, 53, 33, 60, 57, 82, 55, 57, 56, 43, 34, 43, 67],
  500: [27, 31, 50, 64, 65, 100, 66, 32, 37, 37, 53, 67, 31, 47, 31, 37, 65, 42, 62, 63, 66, 61, 63, 58, 63, 63, 31, 32, 67, 67, 67, 53, 99, 71, 66, 74, 73, 61, 59, 75, 75, 28, 58, 69, 57, 92, 76, 77, 65, 77, 65, 65, 66, 75, 71, 101, 71, 70, 65, 37, 37, 37, 48, 47, 34, 57, 62, 58, 62, 59, 38, 62, 61, 26, 26, 56, 26, 89, 61, 61, 62, 62, 39, 54, 35, 61, 58, 83, 56, 58, 56, 45, 35, 45, 67],
  600: [26, 33, 53, 65, 66, 101, 67, 33, 38, 38, 54, 68, 32, 47, 32, 38, 66, 43, 63, 64, 67, 62, 64, 58, 65, 64, 32, 33, 68, 68, 68, 55, 100, 73, 66, 74, 73, 61, 59, 75, 75, 28, 58, 71, 57, 93, 76, 77, 65, 78, 66, 66, 67, 74, 73, 103, 72, 72, 66, 38, 38, 38, 49, 47, 36, 58, 63, 59, 63, 60, 39, 63, 62, 27, 27, 57, 27, 91, 62, 61, 63, 63, 40, 55, 36, 62, 59, 84, 57, 59, 57, 46, 36, 46, 68],
  700: [24, 34, 56, 65, 66, 102, 68, 34, 38, 38, 56, 68, 34, 47, 34, 39, 68, 44, 63, 65, 68, 63, 65, 59, 66, 65, 34, 35, 68, 68, 68, 56, 102, 75, 67, 74, 73, 61, 59, 76, 75, 29, 59, 72, 57, 94, 77, 78, 65, 78, 66, 66, 67, 74, 75, 104, 74, 74, 67, 38, 39, 38, 49, 48, 37, 59, 64, 59, 64, 60, 40, 64, 63, 28, 28, 59, 28, 92, 63, 62, 64, 64, 41, 57, 37, 63, 60, 86, 59, 61, 58, 47, 38, 47, 68],
  800: [22, 36, 59, 66, 67, 103, 69, 36, 39, 39, 59, 69, 36, 48, 36, 40, 70, 45, 64, 66, 69, 64, 67, 59, 67, 67, 36, 36, 69, 69, 69, 58, 104, 77, 67, 75, 73, 61, 59, 76, 75, 29, 59, 74, 57, 95, 77, 78, 66, 79, 67, 67, 68, 73, 77, 106, 77, 76, 68, 39, 40, 39, 50, 49, 39, 59, 64, 60, 64, 61, 41, 64, 64, 29, 29, 60, 29, 93, 64, 62, 64, 64, 42, 58, 39, 64, 62, 87, 60, 62, 59, 49, 39, 49, 69],
  900: [20, 39, 63, 67, 67, 105, 70, 38, 39, 39, 61, 70, 38, 48, 38, 42, 72, 46, 65, 67, 71, 65, 68, 60, 68, 68, 38, 38, 70, 70, 70, 61, 106, 80, 67, 75, 73, 62, 59, 76, 75, 30, 60, 76, 57, 96, 77, 78, 66, 79, 67, 67, 69, 73, 80, 109, 79, 78, 70, 39, 42, 39, 50, 50, 41, 60, 65, 61, 65, 61, 43, 65, 65, 30, 30, 61, 30, 95, 65, 63, 65, 65, 44, 59, 40, 65, 64, 88, 61, 64, 59, 51, 41, 51, 70],
};

/* Common punctuation and symbols past ASCII, in em: the wider of Inter's 400 and 900. */
const SYMBOLS: Record<string, number> = {
  "—": 1, "–": 0.5, "“": 0.63, "”": 0.63, "‘": 0.36, "’": 0.36, "…": 1.12, "•": 0.57, "·": 0.38,
  "→": 1, "←": 1, "↑": 0.97, "↓": 0.97, "★": 0.78, "☆": 0.78, "✓": 0.6, "✔": 0.78, "✗": 0.78,
  "€": 0.71, "£": 0.67, "¥": 0.59, "×": 0.7, "÷": 0.7, "°": 0.47, "©": 0.92, "®": 0.67, "™": 0.67, "½": 0.92,
};

/* Everything else, in em, erring wide: emoji, ideographs, other letters, other symbols. */
const WIDE = 1.25;
const CJK = 1.02;
const LETTER = 0.8;
const SYMBOL = 1;

const EMOJI = /\p{Extended_Pictographic}/u;
const IDEOGRAPH = /[\u2E80-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\uFF00-\uFFEF]/u;
/* Variation selectors, joiners and combining marks take no width of their own. */
const ZERO = /[\u0300-\u036F\u200B-\u200D\uFE00-\uFE0F]/u;

function advance(ch: string, table: number[]): number {
  const code = ch.codePointAt(0)!;
  if (code >= 32 && code < 127) return table[code - 32] / 100;
  if (ZERO.test(ch)) return 0;
  if (ch in SYMBOLS) return SYMBOLS[ch];
  /* An accented letter is as wide as its base letter: é → e. */
  const base = ch.normalize("NFD")[0];
  const b = base.codePointAt(0)!;
  if (b >= 32 && b < 127) return table[b - 32] / 100;
  if (EMOJI.test(ch)) return WIDE;
  if (IDEOGRAPH.test(ch)) return CJK;
  return /\p{L}/u.test(ch) ? LETTER : SYMBOL;
}

/* How wide `text` sets on one line, in em. */
export function measure(text: string, style: TextStyle): number {
  const table = ADVANCES[style.weight];
  const spacing = style.letterSpacing ?? 0;
  let width = 0;
  for (const ch of text) {
    const w = advance(ch, table);
    width += w ? w + spacing : 0;
  }
  return width;
}

/*
  `text` broken into lines no wider than `maxEm`: greedy, at spaces, keeping
  the author's own line breaks. A word wider than a whole line is split between
  characters, as CSS `overflow-wrap: anywhere` would. Lines are trimmed; an
  empty paragraph stays as an empty line.
*/
export function wrapLines(text: string, maxEm: number, style: TextStyle): string[] {
  const lines: string[] = [];
  const space = measure(" ", style);
  for (const paragraph of text.split("\n")) {
    let line = "";
    let width = 0;
    for (const word of paragraph.split(" ").filter(Boolean)) {
      const w = measure(word, style);
      if (line && width + space + w <= maxEm) {
        line += ` ${word}`;
        width += space + w;
        continue;
      }
      if (line) lines.push(line);
      if (w <= maxEm) {
        line = word;
        width = w;
        continue;
      }
      /* Longer than a line on its own: fill lines character by character. */
      line = "";
      width = 0;
      for (const ch of word) {
        const c = measure(ch, style);
        if (line && width + c > maxEm) {
          lines.push(line);
          line = "";
          width = 0;
        }
        line += ch;
        width += c;
      }
    }
    lines.push(line);
  }
  return lines;
}

export type Fit = {
  /* Px. */
  fontSize: number;
  lines: string[];
};

/*
  The largest type, up to `maxSize` px, at which `text` wrapped to `width` fits
  `height` in `lineHeight`-spaced lines — and the lines it wraps into. Below
  `minSize` it stops shrinking and lets the copy overflow; a block clips its own
  box, so that is the only way copy is lost, and `maxLength` keeps it from
  happening at any reasonable size.

  Wrapping only gets tighter as the type grows, so the fit is a bisection.
*/
export function fitText(
  text: string,
  box: { width: number; height: number },
  opts: TextStyle & { lineHeight: number; maxSize: number; minSize?: number },
): Fit {
  const minSize = Math.min(opts.minSize ?? 1, opts.maxSize);
  const wrapAt = (size: number) => wrapLines(text, box.width / size, opts);
  const fits = (size: number) => wrapAt(size).length * opts.lineHeight * size <= box.height;

  if (fits(opts.maxSize)) return { fontSize: opts.maxSize, lines: wrapAt(opts.maxSize) };
  let lo = minSize;
  let hi = opts.maxSize;
  if (!fits(lo)) return { fontSize: lo, lines: wrapAt(lo) };
  for (let i = 0; i < 24 && hi - lo > 0.25; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return { fontSize: lo, lines: wrapAt(lo) };
}
