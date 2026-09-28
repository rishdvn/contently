import { input } from "../../inputs";
import { defineBlock } from "../../spec";

export const inputs = {
  text: input.text({ label: "Text", maxLength: 80, default: "Free shipping on every order" }),
  separator: input.text({ label: "Separator", maxLength: 3, default: "•" }),
  speed: input.number({ label: "Speed", min: 25, max: 400, step: 25, unit: "%", default: 100 }),
  direction: input.select({
    label: "Direction",
    options: [
      { value: "left", label: "Left" },
      { value: "right", label: "Right" },
    ],
  }),
  color: input.color({ label: "Text colour", default: "#111111" }),
  banner: input.boolean({ label: "Banner", default: true }),
  bannerColor: input.color({ label: "Banner colour", default: "#ff5a1f" }),
};

/*
  Marquee — a line of text, repeated with a separator, scrolling across a band
  without a seam. The type is sized to the band's height; the band is the box,
  added across the artboard's full width. Speed is in type sizes per second
  (100% ≈ three), not a share of the block's time, so a longer block scrolls
  further rather than slower. As a still, one pass is laid out from the left
  edge. Listed in the Text panel under Marquees.
*/
export const marquee = defineBlock({
  id: "marquee",
  name: "Marquee",
  category: "Text",
  tags: ["marquees", "ticker", "scrolling", "scroll", "banner", "news", "crawl", "loop"],
  inputs,
  defaults: {
    text: "Free shipping on every order",
    separator: "•",
    speed: 100,
    direction: "left",
    color: "#111111",
    banner: true,
    bannerColor: "#ff5a1f",
  },
  /* A marquee carries an offer or a claim ("Free shipping", "Back in stock"). */
  roles: { text: "benefit" },
  defaultDuration: 5,
  aspectHint: "strip",
});
