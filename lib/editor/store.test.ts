/*
  Undo steps in the editor store: `npm test`. Discrete actions are one step
  each however quickly they follow one another; continuous edits inside the
  history's debounce are still one.
*/
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { project as makeProject, shapeBlock } from "./factory";
import { undo, useEditor } from "./store";

/* Each key press or click is its own task; the step closes when one ends. */
const nextEvent = () => new Promise((r) => setTimeout(r, 0));

const count = () => useEditor.getState().project.slides[0].blocks.length;
const rect = () => shapeBlock("rect", { x: 0, y: 0, w: 100, h: 100 });

describe("undo history", () => {
  beforeEach(() => {
    useEditor.getState().load(makeProject("video"));
    useEditor.temporal.getState().clear();
  });

  it("undoes quick adds one at a time", async () => {
    for (let i = 0; i < 3; i++) {
      useEditor.getState().addBlock(rect());
      await nextEvent();
    }
    assert.equal(count(), 3);
    undo();
    assert.equal(count(), 2);
    undo();
    undo();
    assert.equal(count(), 0);
  });

  it("keeps a burst of edits to one block as one step", async () => {
    const b = rect();
    useEditor.getState().addBlock(b);
    await nextEvent();
    for (let x = 1; x <= 10; x++) {
      useEditor.getState().updateBlock(b.id, { x });
      await nextEvent();
    }
    undo();
    assert.equal(useEditor.getState().project.slides[0].blocks[0].x, 0);
    assert.equal(count(), 1);
  });

  it("separates an add from the edit just before it", async () => {
    const b = rect();
    useEditor.getState().addBlock(b);
    await nextEvent();
    useEditor.getState().updateBlock(b.id, { opacity: 50 });
    await nextEvent();
    useEditor.getState().duplicateBlocks([b.id]);
    await nextEvent();
    undo();
    assert.equal(count(), 1);
    assert.equal(useEditor.getState().project.slides[0].blocks[0].opacity, 50);
    undo();
    assert.equal(useEditor.getState().project.slides[0].blocks[0].opacity, 100);
  });

  it("keeps several calls made by one action as one step", async () => {
    const [a, b, c] = [rect(), rect(), rect()];
    useEditor.getState().addBlocks([a, b, c]);
    await nextEvent();
    /* Bring a selection to the front: one reorder per block, one gesture. */
    [a.id, b.id].forEach((id) => useEditor.getState().reorder(id, "front"));
    await nextEvent();
    const ids = () => useEditor.getState().project.slides[0].blocks.map((x) => x.id);
    assert.deepEqual(ids(), [c.id, a.id, b.id]);
    undo();
    assert.deepEqual(ids(), [a.id, b.id, c.id]);
  });
});
