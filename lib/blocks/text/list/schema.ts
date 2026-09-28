import { input } from "../../inputs";
import { defineBlock } from "../../spec";

export const inputs = {
  items: input.list({
    label: "Items",
    itemLabel: "Item",
    min: 1,
    max: 6,
    item: input.text({ label: "Item", maxLength: 60, default: "New item" }),
  }),
  marker: input.select({
    label: "Marker",
    default: "check",
    options: [
      { value: "bullet", label: "Bullet" },
      { value: "number", label: "Number" },
      { value: "check", label: "Check" },
    ],
  }),
  color: input.color({ label: "Text colour", default: "#ffffff" }),
  accent: input.color({ label: "Marker colour", default: "#a3d977" }),
};

/*
  List — up to six short lines, each behind a check, a bullet or its number.
  Items wrap to the box's width, and the type is the largest at which every
  item fits its height. In a video the items slide in one after another, top to
  bottom, across the first 70%; as a still they are all there. Listed in the
  Text panel under Lists.
*/
export const list = defineBlock({
  id: "list",
  name: "List",
  category: "Text",
  tags: ["lists", "checklist", "bullets", "numbered", "benefits", "features", "checks", "steps"],
  inputs,
  defaults: {
    items: ["Regulates digestion", "Reduces bloating", "Supports healthy weight"],
    marker: "check",
    color: "#ffffff",
    accent: "#a3d977",
  },
  /* A list of plain texts takes its role by the list's name; each item is a benefit. */
  roles: { items: "benefit" },
  defaultDuration: 4,
  aspectHint: "landscape",
});
