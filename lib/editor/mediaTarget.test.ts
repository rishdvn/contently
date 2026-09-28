/*
  A scene background as a media slot: `npm test`. Replace targets it, the next
  image picked fills it rather than becoming a block, and one undo reverts it.
*/
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { project, shapeBlock } from "./factory";
import { activeMediaTarget, flushHistory, undo, useEditor } from "./store";
import { NEUTRAL_ADJUSTMENTS, type Background } from "./types";

const slide = () => useEditor.getState().project.slides[0];
/* The first scene's background, which must be an image. */
const image = () => {
  const bg = slide().background;
  assert.equal(bg.type, "image");
  return bg as Extract<Background, { type: "image" }>;
};
const photo = (id: string) => ({ id, url: `https://example.com/${id}.jpg`, kind: "image" as const });

describe("scene background as a media target", () => {
  beforeEach(() => {
    const p = project("video");
    p.slides[0].background = { type: "image", mediaId: "old", src: "https://example.com/old.jpg", focalX: 20, focalY: 80, adjustments: { ...NEUTRAL_ADJUSTMENTS, brightness: 120 } };
    useEditor.getState().load(p);
    flushHistory();
    useEditor.temporal.getState().clear();
  });

  it("puts the picked image in the background, keeping its framing, as one undo step", () => {
    const s = useEditor.getState();
    s.pickMedia({ slideId: slide().id, kind: "image", label: "Background" });
    assert.ok(activeMediaTarget(useEditor.getState()));
    assert.equal(useEditor.getState().fillMediaTarget(photo("new")), true);
    assert.equal(image().mediaId, "new");
    assert.equal(image().focalX, 20);
    assert.equal(image().adjustments.brightness, 120);
    assert.equal(slide().blocks.length, 0);
    assert.equal(useEditor.getState().mediaTarget, null);
    undo();
    assert.equal(image().mediaId, "old");
  });

  it("turns a colour background into an image one", () => {
    useEditor.getState().setBackground(slide().id, { type: "color", color: "#111111" });
    useEditor.getState().pickMedia({ slideId: slide().id, kind: "image" });
    assert.equal(useEditor.getState().fillMediaTarget(photo("new")), true);
    assert.equal(image().focalX, 50);
  });

  it("won't take a video", () => {
    useEditor.getState().pickMedia({ slideId: slide().id, kind: "image" });
    assert.equal(useEditor.getState().fillMediaTarget({ id: "clip", url: "https://example.com/clip.mp4", kind: "video" }), false);
    assert.equal(image().mediaId, "old");
  });

  it("lapses once a block is selected or another scene is active", () => {
    const s = useEditor.getState();
    s.pickMedia({ slideId: slide().id, kind: "image" });
    const b = shapeBlock("rect", { x: 0, y: 0, w: 10, h: 10 });
    s.addBlock(b);
    assert.equal(activeMediaTarget(useEditor.getState()), null);
    s.clearSelection();
    assert.ok(activeMediaTarget(useEditor.getState()));
    s.addSlide();
    assert.equal(activeMediaTarget(useEditor.getState()), null);
  });
});
