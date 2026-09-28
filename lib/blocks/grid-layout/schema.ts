import { input } from "../inputs";
import { defineBlock } from "../spec";

export const inputs = {
  images: input.list({ label: "Photos", itemLabel: "Photo", min: 2, max: 4, item: input.image({ label: "Photo" }) }),
  layout: input.select({
    label: "Layout",
    options: [
      { value: "grid", label: "Grid" },
      { value: "row", label: "Row" },
      { value: "column", label: "Column" },
      { value: "feature", label: "One large" },
    ],
  }),
  gap: input.number({ label: "Spacing", min: 0, max: 10, step: 0.5, unit: "%", default: 2 }),
  radius: input.number({ label: "Corners", min: 0, max: 10, step: 0.5, unit: "%", default: 3 }),
};

/*
  Grid layout — two to four photos arranged in one of four ways. Every photo
  in the list is always shown: the layout says how they are arranged, not how
  many there are. In a video the tiles scale and fade in one after another;
  as a still they are simply there.
*/
const photo = (name: string) => ({ src: `/blocks/grid-layout/${name}.svg` });

export const gridLayout = defineBlock({
  id: "grid-layout",
  name: "Grid layout",
  category: "Layouts",
  tags: ["layout", "grid", "collage", "gallery", "photos", "mosaic", "moodboard", "tiles", "2x2"],
  inputs,
  defaults: {
    images: ["coast", "dunes", "leaves", "citrus"].map(photo),
    layout: "grid",
    gap: 2,
    radius: 3,
  },
  /* A list of images: the role names each photo. Lifestyle rather than product: a grid is a mood, not a cut-out. */
  roles: { images: "image:lifestyle" },
  defaultDuration: 4,
  aspectHint: "square",
  preview: "",
});
