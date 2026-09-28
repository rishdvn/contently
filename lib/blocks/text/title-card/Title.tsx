import type { PropsOf } from "../../inputs";
import type { RenderContext } from "../../registry";

import type { inputs } from "./schema";

type Props = PropsOf<typeof inputs>;

/*
  The title is the largest Anton, up to half the box's height, whose wrapped
  lines fit the width and the height left for it (about three-quarters with a
  subtitle, all of it without). The subtitle is fitted to two lines the same
  way. Each line is drawn on its own row, so the browser breaks exactly where
  the estimate did, and every line can wipe in by itself.

  `render` is pure, so widths are estimated from per-character advances rather
  than measured: Anton's were measured in Chrome from the stylesheet the app
  loads, Inter's are its widest capitals. All are rounded up, so an estimated
  line is never shorter than the real one.
*/
const ANTON = `"Anton", "Oswald", Impact, sans-serif`;
const INTER = `"Inter", -apple-system, system-ui, sans-serif`;

/* Anton 400 capitals and figures, em. */
const ANTON_ADVANCE: Record<string, number> = {
  " ": 0.25, "!": 0.24, '"': 0.44, "#": 0.56, $: 0.48, "%": 1.07, "&": 0.54, "'": 0.23, "’": 0.25, "(": 0.31, ")": 0.31, "*": 0.47, "+": 0.37, ",": 0.25, "-": 0.33, ".": 0.24,
  "/": 0.42, ":": 0.26, ";": 0.26, "?": 0.51, "@": 0.88, "1": 0.35, E: 0.43, F: 0.41, I: 0.24, L: 0.41, M: 0.76, T: 0.41, W: 0.73, Y: 0.46, Z: 0.43, "€": 0.54, "£": 0.49,
  "–": 0.33, "—": 0.58, "“": 0.48, "”": 0.48, "·": 0.25,
};
const ANTON_OTHER = 0.51;
/* Inter 700 capitals with tracking, em. */
const CAPS_ADVANCE: Record<string, number> = { " ": 0.28, ",": 0.36, ".": 0.36, "'": 0.36, "’": 0.36, "!": 0.4, I: 0.34, M: 0.95, W: 1.05, "%": 1.03 };
const CAPS_OTHER = 0.79;
const TRACKING = 0.06;

type Measure = (s: string) => number;
const anton: Measure = (s) => [...s].reduce((w, c) => w + (ANTON_ADVANCE[c] ?? ANTON_OTHER), 0);
const caps: Measure = (s) => [...s].reduce((w, c) => w + (CAPS_ADVANCE[c] ?? CAPS_OTHER) + TRACKING, 0);

/* Greedy wrap at spaces, keeping the author's line breaks; a word wider than a line is split (and `broken` says so). */
function wrap(text: string, maxEm: number, measure: Measure) {
  const lines: string[] = [];
  let broken = false;
  const space = measure(" ");
  for (const paragraph of text.split("\n")) {
    let line = "";
    let width = 0;
    for (const word of paragraph.split(" ").filter(Boolean)) {
      const w = measure(word);
      if (line && width + space + w <= maxEm) {
        line += ` ${word}`;
        width += space + w;
        continue;
      }
      if (line) lines.push(line);
      line = "";
      width = 0;
      if (w <= maxEm) {
        line = word;
        width = w;
        continue;
      }
      broken = true;
      for (const ch of word) {
        const c = measure(ch);
        if (line && width + c > maxEm) {
          lines.push(line);
          line = "";
          width = 0;
        }
        line += ch;
        width += c;
      }
    }
    if (line) lines.push(line);
  }
  return { lines, broken };
}

/*
  The largest size up to `maxSize` at which the wrapped lines fit the box
  without splitting a word; wrapping only tightens as type grows, so bisect.
  Only a word too long for any line at 1 px is split.
*/
function fit(text: string, width: number, height: number, lineHeight: number, maxSize: number, measure: Measure, maxLines = Infinity) {
  const fits = (size: number) => {
    const { lines, broken } = wrap(text, width / size, measure);
    return !broken && lines.length <= maxLines && lines.length * size * lineHeight <= height ? lines : null;
  };
  let lo = 1;
  let hi = Math.max(1, maxSize);
  if (fits(hi)) return { size: hi, lines: fits(hi)! };
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return { size: lo, lines: fits(lo) ?? wrap(text, width / lo, measure).lines };
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const phase = (p: number, from: number, to: number) => clamp01((p - from) / (to - from));

/* Entrance windows as fractions of the block's time: each title line, then the subtitle. Settled by 50%. */
const lineWindow = (i: number, n: number) => {
  const step = Math.min(0.06, 0.18 / Math.max(1, n - 1));
  return [i * step, i * step + 0.2] as const;
};
const SUBTITLE = [0.3, 0.46] as const;

const TITLE_LINE = 1.02;
const SUB_LINE = 1.25;

export function Title({ props, ctx }: { props: Props; ctx: RenderContext }) {
  const W = ctx.width * 0.94;
  const H = ctx.height * 0.92;
  const title = props.title.trim().toUpperCase();
  const subtitle = props.subtitle.trim().toUpperCase();

  /* One line unless two make the subtitle markedly larger: a single stranded word reads worse than smaller type. */
  const subOne = subtitle ? fit(subtitle, W, H * 0.2, SUB_LINE, H * 0.09, caps, 1) : null;
  const subTwo = subtitle ? fit(subtitle, W, H * 0.2, SUB_LINE, H * 0.09, caps, 2) : null;
  const sub = subOne && subTwo && subOne.lines.length === 1 && subOne.size >= subTwo.size * 0.7 ? subOne : subTwo;
  const gap = sub ? sub.size * 0.9 : 0;
  const t = fit(title, W, H - (sub ? sub.lines.length * sub.size * SUB_LINE + gap : 0), TITLE_LINE, ctx.height * 0.5, anton);

  const p = ctx.progress;
  const left = props.align === "left";
  const s = easeOut(phase(p, SUBTITLE[0], SUBTITLE[1]));

  return (
    <div
      className="size-full overflow-hidden"
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: left ? "flex-start" : "center",
        textAlign: left ? "left" : "center",
        padding: `0 ${ctx.width * 0.03}px`,
        boxSizing: "border-box",
        gap,
        color: props.color,
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {title ? (
        <div style={{ fontFamily: ANTON, fontWeight: 400, fontSize: t.size, lineHeight: TITLE_LINE, whiteSpace: "pre" }}>
          {t.lines.map((line, i) => {
            const [a, b] = lineWindow(i, t.lines.length);
            const e = easeInOut(phase(p, a, b));
            return (
              <div key={i} style={e >= 1 ? undefined : { clipPath: `inset(-10% ${(1 - e) * 100}% -10% 0)`, transform: `translateX(${(1 - e) * -0.06 * t.size}px)` }}>
                {line}
              </div>
            );
          })}
        </div>
      ) : null}
      {sub ? (
        <div
          style={{
            fontFamily: INTER,
            fontWeight: 700,
            fontSize: sub.size,
            lineHeight: SUB_LINE,
            letterSpacing: `${TRACKING}em`,
            whiteSpace: "pre",
            ...(s >= 1 ? {} : { opacity: s, transform: `translateY(${(1 - s) * sub.size * 0.6}px)` }),
          }}
        >
          {sub.lines.join("\n")}
        </div>
      ) : null}
    </div>
  );
}
