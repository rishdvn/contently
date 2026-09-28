import { input } from "../../inputs";
import { defineBlock } from "../../spec";

export const inputs = {
  text: input.text({ label: "Text", maxLength: 30, default: "New formula" }),
  fill: input.color({ label: "Fill", default: "#ffffff" }),
  textColor: input.color({ label: "Text colour", default: "#1c1a5e" }),
  shape: input.select({
    label: "Shape",
    options: [
      { value: "pill", label: "Pill" },
      { value: "rounded", label: "Rounded" },
      { value: "tag", label: "Tag" },
    ],
  }),
};

/*
  Callout — a short label on a pill, a rounded rectangle or a luggage tag, for
  pointing something out ("New formula", "Gut health"). The shape keeps its own
  proportions and is as large as the box allows, centred in it. In a video it
  pops in with a little overshoot over the first fifth and holds; as a still it
  is settled. Listed in the Text panel under Callouts.
*/
export const callout = defineBlock({
  id: "callout",
  name: "Callout",
  category: "Text",
  tags: ["callouts", "label", "tag", "pill", "badge", "sticker", "chip"],
  inputs,
  defaults: {
    text: "New formula",
    fill: "#ffffff",
    textColor: "#1c1a5e",
    shape: "pill",
  },
  /* What a callout points out is a selling point: "New formula", "Vegan". */
  roles: { text: "benefit" },
  defaultDuration: 3,
  aspectHint: "landscape",
});
