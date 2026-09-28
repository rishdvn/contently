import { input } from "../inputs";
import { defineBlock } from "../spec";

export const inputs = {
  image: input.image({ label: "Photo" }),
  heading: input.text({ label: "Heading", maxLength: 60, default: "Heading" }),
  body: input.text({ label: "Body", maxLength: 160, multiline: true }),
  side: input.select({
    label: "Photo side",
    options: [
      { value: "left", label: "Left" },
      { value: "right", label: "Right" },
    ],
  }),
  theme: input.select({
    label: "Theme",
    options: [
      { value: "light", label: "Light" },
      { value: "dark", label: "Dark" },
    ],
  }),
};

/*
  Split layout — a photo on one half, a heading and a paragraph on the other.
  In a video the photo slides in from its edge and the copy from the opposite
  one; as a still both halves are simply there.
*/
export const splitLayout = defineBlock({
  id: "split-layout",
  name: "Split layout",
  category: "Layouts",
  tags: ["layout", "split", "half", "image and text", "photo", "feature", "editorial", "two column", "side by side"],
  inputs,
  defaults: {
    image: { src: "/blocks/split-layout/morning.svg" },
    heading: "Made for slow mornings",
    body: "Soft linen, warm light and a cup that stays hot. Our home collection is made for the hours you keep for yourself.",
    side: "left",
    theme: "light",
  },
  /* A lifestyle shot rather than a product cut-out: the photo sets the scene the copy talks about. */
  roles: { image: "image:lifestyle", heading: "heading", body: "body" },
  defaultDuration: 4,
  aspectHint: "square",
  preview: "",
});
