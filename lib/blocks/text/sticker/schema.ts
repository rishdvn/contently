import { input } from "../../inputs";
import { defineBlock } from "../../spec";

export const inputs = {
  text: input.text({ label: "Text", maxLength: 20, default: "New" }),
  shape: input.select({
    label: "Shape",
    options: [
      { value: "starburst", label: "Starburst" },
      { value: "circle", label: "Circle" },
      { value: "blob", label: "Scallop" },
      { value: "ribbon", label: "Ribbon" },
    ],
  }),
  tilt: input.number({ label: "Tilt", min: -30, max: 30, step: 1, unit: "°", default: -8 }),
  fill: input.color({ label: "Fill", default: "#ffe066" }),
  textColor: input.color({ label: "Text colour", default: "#111111" }),
  outline: input.boolean({ label: "Outline", default: true }),
};

/*
  Sticker — a word or two on a shaped badge ("Best seller", "50% off"): a
  starburst, a circle, a scalloped blob or a ribbon, tilted, with a cartoon
  outline and a hard shadow. In a video it pops in with a wobble and settles
  at its tilt; as a still it is settled. Listed in the Text panel under
  Stickers.

  The text is a reason to buy, like the Product card's badge: `benefit`.
*/
export const sticker = defineBlock({
  id: "sticker",
  name: "Sticker",
  category: "Text",
  tags: ["stickers", "badge", "starburst", "burst", "sale", "new", "best seller", "label", "seal", "callout"],
  inputs,
  defaults: {
    text: "Best seller",
    shape: "starburst",
    tilt: -8,
    fill: "#ffe066",
    textColor: "#111111",
    outline: true,
  },
  roles: { text: "benefit" },
  defaultDuration: 3,
  aspectHint: "square",
  preview: "",
});
