import { input } from "../../inputs";
import { defineBlock } from "../../spec";

export const inputs = {
  text: input.text({ label: "Hook", maxLength: 120, multiline: true, default: "POV: you finally found a serum that works" }),
  style: input.select({
    label: "Style",
    options: [
      { value: "highlight", label: "Highlight" },
      { value: "outline", label: "Outline" },
      { value: "box", label: "Box" },
    ],
  }),
  position: input.select({
    label: "Position",
    options: [
      { value: "top", label: "Top" },
      { value: "center", label: "Centre" },
      { value: "bottom", label: "Bottom" },
    ],
  }),
  fill: input.color({ label: "Fill", default: "#ffffff" }),
  textColor: input.color({ label: "Text colour", default: "#000000" }),
};

/*
  TikTok hook — the caption that opens a UGC video: big, high-contrast, and
  revealed word by word. Added over the whole frame (`aspectHint: "frame"`) so
  it can keep out of the app's UI: the caption is set inside the frame's safe
  zone (clear of the bottom fifth, where the caption and sounds sit, and the
  right-hand column of buttons) and `position` places it at the top, middle or
  bottom of that zone. Listed in the Text panel under TikTok Hooks.

  In a video the words arrive across the first 70% and the caption holds; as a
  still the whole caption shows.
*/
export const tiktokHook = defineBlock({
  id: "tiktok-hook",
  name: "TikTok hook",
  category: "Text",
  tags: ["tiktok hooks", "tiktok", "hook", "caption", "reels", "ugc", "pov", "subtitle", "safe zone"],
  inputs,
  defaults: {
    text: "POV: you finally found a serum that works",
    style: "highlight",
    position: "top",
    fill: "#ffffff",
    textColor: "#000000",
  },
  roles: { text: "hook" },
  defaultDuration: 3,
  aspectHint: "frame",
});
