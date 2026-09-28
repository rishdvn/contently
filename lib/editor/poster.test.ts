/*
  Poster timing and keys: `npm test`.
*/
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { posterKey, posterTime } from "./poster";
import type { Block, BlockBase, Project, Slide } from "./types";

const base: Omit<BlockBase, "id"> = { x: 0, y: 0, w: 100, h: 100, rotation: 0, opacity: 1, locked: false, hidden: false, flipX: false, flipY: false, start: 0, end: 5, animation: "fade", effects: [] };
const shape = (id: string, start: number, end: number, extra: Partial<BlockBase> = {}): Block => ({ ...base, id, start, end, ...extra, type: "shape", shape: "rect", fill: "#fff" }) as Block;
const scene = (blocks: Block[], duration = 5): Slide => ({ id: "s1", name: "Scene 1", background: { type: "color", color: "#000" }, blocks, duration });
const project = (slides: Slide[], kind: Project["kind"] = "video") => ({ kind, width: 1080, height: 1920, slides });

describe("posterTime", () => {
  it("takes a settled moment, not time zero", () => {
    assert.equal(posterTime({ kind: "video" }, scene([shape("a", 0, 5)])), 5 - 1 / 30);
  });

  it("prefers the moment with the most blocks on screen", () => {
    /* b leaves at 2; the only moment with both on screen is just before that. */
    const t = posterTime({ kind: "video" }, scene([shape("a", 0, 5), shape("b", 0, 2)]));
    assert.equal(t, 2 - 1 / 30);
  });

  it("ignores hidden blocks", () => {
    const t = posterTime({ kind: "video" }, scene([shape("a", 0, 5), shape("b", 0, 2, { hidden: true })]));
    assert.equal(t, 5 - 1 / 30);
  });

  it("has no clock for stills and carousels", () => {
    assert.equal(posterTime({ kind: "carousel" }, scene([shape("a", 0, 5)])), 0);
    assert.equal(posterTime({ kind: "image" }, scene([shape("a", 0, 5)])), 0);
  });
});

describe("posterKey", () => {
  it("changes with the first scene and nothing else", () => {
    const one = project([scene([shape("a", 0, 5)]), scene([shape("b", 0, 5)])]);
    const secondEdited = project([one.slides[0], scene([shape("b", 1, 5)])]);
    const firstEdited = project([scene([shape("a", 1, 5)]), one.slides[1]]);
    assert.equal(posterKey(one), posterKey(secondEdited));
    assert.notEqual(posterKey(one), posterKey(firstEdited));
    assert.notEqual(posterKey(one), posterKey({ ...one, width: 1080, height: 1350 }));
  });

  it("does not depend on the order of keys, which Convex does not keep", () => {
    const one = project([scene([shape("a", 0, 5)])]);
    const reordered = JSON.parse(JSON.stringify(one), (_, v) =>
      v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).reverse()) : v,
    );
    assert.equal(posterKey(one), posterKey(reordered));
  });

  it("copes with an empty project", () => {
    assert.equal(typeof posterKey(project([])), "string");
  });
});
