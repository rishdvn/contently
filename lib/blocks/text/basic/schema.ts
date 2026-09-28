import { input } from "../../inputs";
import { defineBlock } from "../../spec";

export const inputs = {
  text: input.text({ label: "Text", maxLength: 160, multiline: true, default: "Made for mornings" }),
  preset: input.select({
    label: "Style",
    options: [
      { value: "heading", label: "Heading" },
      { value: "subheading", label: "Subheading" },
      { value: "body", label: "Body" },
    ],
  }),
  color: input.color({ label: "Colour", default: "#ffffff" }),
  align: input.select({
    label: "Align",
    default: "center",
    options: [
      { value: "left", label: "Left" },
      { value: "center", label: "Centre" },
      { value: "right", label: "Right" },
    ],
  }),
  entrance: input.select({
    label: "Entrance",
    options: [
      { value: "rise", label: "Rise" },
      { value: "fade", label: "Fade" },
      { value: "none", label: "None" },
    ],
  }),
};

/*
  Basic — a heading, subheading or paragraph of body copy. The style sets the
  weight, spacing and the largest size the type grows to; the box sets the
  rest: copy wraps to its width and shrinks to fit its height. In a video the
  lines rise (or fade) in over the first fifth and hold; as a still they are
  simply there. Listed in the Text panel under Basics.

  `text` is a heading by role whatever the style: roles are per field, and a
  freshly added block is a heading. A subheading or body copy is the same field
  with a different look, and a template that needs one says so on the block.
*/
export const basic = defineBlock({
  id: "basic",
  name: "Basic text",
  category: "Text",
  tags: ["basics", "heading", "title", "subheading", "subtitle", "body", "paragraph", "copy", "text"],
  inputs,
  defaults: {
    text: "Made for mornings",
    preset: "heading",
    color: "#ffffff",
    align: "center",
    entrance: "rise",
  },
  roles: { text: "heading" },
  defaultDuration: 3,
  aspectHint: "landscape",
});
