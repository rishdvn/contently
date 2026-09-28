/*
  The word-by-word entrance's timing against the numbers measured in Butter:
  `npm test`.
*/
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { splitWords, wordProgress, wordStagger, wordsDuration } from "./wordReveal";

const near = (a: number, b: number, eps = 0.005) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

describe("word reveal", () => {
  it("splits on whitespace and keeps it, punctuation staying with its word", () => {
    const parts = splitWords("Still drinking\nlast month's  coffee?");
    assert.deepEqual(
      parts.filter((p) => p.word).map((p) => p.text),
      ["Still", "drinking", "last", "month's", "coffee?"],
    );
    assert.equal(parts.map((p) => p.text).join(""), "Still drinking\nlast month's  coffee?");
  });

  it("matches Butter's stagger and total length", () => {
    assert.equal(wordStagger(1), 0);
    near(wordStagger(2), 0.268);
    near(wordStagger(5), 0.117);
    near(wordsDuration(1), 0.75);
    near(wordsDuration(5), 1.22, 0.02);
    near(wordsDuration(10), 1.317, 0.01);
  });

  it("reveals words in reading order and lands them all", () => {
    const n = 5;
    const at = (t: number) => Array.from({ length: n }, (_, i) => wordProgress(i, n, t));
    assert.deepEqual(at(0), [0, 0, 0, 0, 0]);
    const mid = at(0.3);
    for (let i = 1; i < n; i++) assert.ok(mid[i] <= mid[i - 1], `word ${i} ahead of word ${i - 1}`);
    assert.ok(mid[0] > 0.5 && mid[n - 1] === 0);
    assert.deepEqual(at(wordsDuration(n)), [1, 1, 1, 1, 1]);
  });
});
