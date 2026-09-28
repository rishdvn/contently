import { input } from "../../inputs";
import { defineBlock } from "../../spec";

export const inputs = {
  title: input.text({ label: "Title", maxLength: 60, multiline: true, default: "Title" }),
  subtitle: input.text({ label: "Subtitle", maxLength: 80, placeholder: "Leave empty to hide" }),
  align: input.select({
    label: "Align",
    options: [
      { value: "center", label: "Centre" },
      { value: "left", label: "Left" },
    ],
  }),
  color: input.color({ label: "Colour", default: "#ffffff" }),
};

/*
  Title card — a big condensed title with a line under it, the opener of a
  product video. The title is set in Anton capitals as large as the box
  allows. In a video each line of the title wipes in, left to right, and the
  subtitle fades up after it; as a still it is settled. Listed in the Text
  panel under Titles.
*/
export const titleCard = defineBlock({
  id: "title-card",
  name: "Title card",
  category: "Text",
  tags: ["titles", "title", "headline", "heading", "opener", "intro", "hero", "product name"],
  inputs,
  defaults: {
    title: "The everything pants",
    subtitle: "The most versatile pair you'll own",
    align: "center",
    color: "#ffffff",
  },
  roles: { title: "heading", subtitle: "subheading" },
  defaultDuration: 4,
  aspectHint: "landscape",
  preview: "",
});
