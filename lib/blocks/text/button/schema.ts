import { input } from "../../inputs";
import { defineBlock } from "../../spec";

export const inputs = {
  label: input.text({ label: "Label", maxLength: 24, default: "Shop now" }),
  style: input.select({
    label: "Style",
    options: [
      { value: "filled", label: "Filled" },
      { value: "outline", label: "Outline" },
      { value: "glass", label: "Glass" },
    ],
  }),
  fill: input.color({ label: "Fill", default: "#ffffff" }),
  textColor: input.color({ label: "Text colour", default: "#111111" }),
  icon: input.select({
    label: "Icon",
    default: "arrow",
    options: [
      { value: "none", label: "None" },
      { value: "arrow", label: "Arrow" },
      { value: "cart", label: "Cart" },
      { value: "link", label: "Link" },
    ],
  }),
};

/*
  Button — a call to action: a pill with a label and an optional icon. The pill
  keeps its own proportions and is as large as the box allows, centred in it,
  so a longer label makes a longer pill rather than smaller type. In a video it
  fades up, then is pressed once at about 70%; as a still it is at rest.
  Listed in the Text panel under Buttons.
*/
export const button = defineBlock({
  id: "button",
  name: "Button",
  category: "Text",
  tags: ["buttons", "cta", "call to action", "shop now", "buy", "link", "learn more"],
  inputs,
  defaults: {
    label: "Shop now",
    style: "filled",
    fill: "#ffffff",
    textColor: "#111111",
    icon: "arrow",
  },
  roles: { label: "cta" },
  defaultDuration: 3,
  aspectHint: "landscape",
});
