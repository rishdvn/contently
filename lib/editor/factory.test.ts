/*
  Naming new scenes: `npm test`. A new scene is numbered one past the highest
  number in use, so deleting or inserting never repeats a name or puts them
  out of order, and nothing already there is renamed.
*/
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { nextSceneName, project, slide } from "./factory";
import { useEditor } from "./store";

const names = () => useEditor.getState().project.slides.map((s) => s.name);

describe("new scene names", () => {
  it("says Scene in a video and Slide otherwise", () => {
    assert.equal(nextSceneName(project("video")), "Scene 2");
    assert.equal(nextSceneName(project("carousel")), "Slide 4");
    assert.equal(nextSceneName(project("image")), "Slide 2");
  });

  it("goes one past the highest number, whatever the order or gaps", () => {
    const slides = ["Scene 3", "Intro", "Scene 1", "Glow — Scene 7", "slide 5"].map((name) => slide({ name }));
    assert.equal(nextSceneName({ kind: "video", slides }), "Scene 6");
    assert.equal(nextSceneName({ kind: "video", slides: [slide({ name: "Intro" })] }), "Scene 1");
  });

  describe("in the store", () => {
    beforeEach(() => useEditor.getState().load(project("video")));

    it("doesn't reuse a deleted scene's name", () => {
      const s = useEditor.getState();
      s.addSlide();
      s.addSlide();
      assert.deepEqual(names(), ["Scene 1", "Scene 2", "Scene 3"]);
      s.removeSlide(useEditor.getState().project.slides[1].id);
      s.addSlide();
      assert.deepEqual(names(), ["Scene 1", "Scene 3", "Scene 4"]);
    });

    it("takes the next unused number when inserted after an earlier scene", () => {
      const s = useEditor.getState();
      s.addSlide();
      s.addSlide();
      s.addSlide(useEditor.getState().project.slides[0].id);
      assert.deepEqual(names(), ["Scene 1", "Scene 4", "Scene 2", "Scene 3"]);
    });

    it("leaves renamed scenes alone", () => {
      const s = useEditor.getState();
      s.updateSlide(useEditor.getState().project.slides[0].id, { name: "Hook" });
      s.addSlide();
      assert.deepEqual(names(), ["Hook", "Scene 1"]);
    });
  });
});
