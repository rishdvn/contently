/*
  Estimated text layout for text blocks: `npm test`.
*/
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { fitText, measure, wrapLines } from "./measure";

const bold = { weight: 700 } as const;

describe("measure", () => {
  it("adds up advances and letter spacing", () => {
    assert.ok(measure("WWW", bold) > measure("iii", bold) * 2);
    assert.equal(measure("", bold), 0);
    assert.ok(Math.abs(measure("ab", { weight: 700, letterSpacing: 0.1 }) - measure("ab", bold) - 0.2) < 1e-9);
  });

  it("is heavier in heavier weights", () => {
    assert.ok(measure("Glow all day", { weight: 900 }) > measure("Glow all day", { weight: 400 }));
  });

  it("gives accented letters their base letter's width, and emoji a wide one", () => {
    assert.equal(measure("é", bold), measure("e", bold));
    assert.ok(measure("✨", bold) >= 1);
    assert.equal(measure("️", bold), 0);
  });
});

describe("wrapLines", () => {
  it("breaks at spaces without exceeding the width", () => {
    const lines = wrapLines("the quick brown fox jumps over the lazy dog", 6, bold);
    assert.ok(lines.length > 1);
    for (const line of lines) assert.ok(measure(line, bold) <= 6, line);
    assert.equal(lines.join(" "), "the quick brown fox jumps over the lazy dog");
  });

  it("keeps the author's line breaks, empty lines included", () => {
    assert.deepEqual(wrapLines("One\n\nTwo", 100, bold), ["One", "", "Two"]);
  });

  it("splits a word wider than the line", () => {
    const lines = wrapLines("Supercalifragilistic", 3, bold);
    assert.ok(lines.length > 1);
    assert.equal(lines.join(""), "Supercalifragilistic");
    for (const line of lines) assert.ok(measure(line, bold) <= 3, line);
  });
});

describe("fitText", () => {
  const opts = { weight: 700, lineHeight: 1.2, maxSize: 120 } as const;

  it("uses the largest size when the copy fits", () => {
    assert.deepEqual(fitText("Hi", { width: 1000, height: 400 }, opts), { fontSize: 120, lines: ["Hi"] });
  });

  it("shrinks long copy until its lines fit the box", () => {
    const text = "Everything you need for glowing skin, in one ten minute routine you can do every single morning.";
    const box = { width: 600, height: 300 };
    const fit = fitText(text, box, opts);
    assert.ok(fit.fontSize < 120);
    assert.ok(fit.lines.length * opts.lineHeight * fit.fontSize <= box.height);
    for (const line of fit.lines) assert.ok(measure(line, opts) * fit.fontSize <= box.width, line);
    /* …and not by much more than it has to. */
    const bigger = fitText(text, box, { ...opts, maxSize: fit.fontSize + 2, minSize: fit.fontSize + 2 });
    assert.ok(bigger.lines.length * opts.lineHeight * bigger.fontSize > box.height);
  });

  it("stops at the minimum size", () => {
    assert.equal(fitText("a b c d e f g h i j k l m n o p", { width: 10, height: 10 }, { ...opts, minSize: 8 }).fontSize, 8);
  });
});
