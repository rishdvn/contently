import { input } from "../inputs";
import { defineBlock } from "../spec";

export const inputs = {
  logos: input.list({ label: "Logos", itemLabel: "Logo", min: 2, max: 8, item: input.image({ label: "Logo" }) }),
  speed: input.number({ label: "Speed", min: 0.5, max: 3, step: 0.25, unit: "×", default: 1 }),
  direction: input.select({
    label: "Direction",
    options: [
      { value: "left", label: "Left" },
      { value: "right", label: "Right" },
    ],
  }),
  gap: input.number({ label: "Spacing", min: 0, max: 200, step: 10, unit: "%", default: 80 }),
  /* Logos come in every colour; a strip usually wants them in one. */
  tone: input.select({
    label: "Colour",
    options: [
      { value: "white", label: "White" },
      { value: "black", label: "Black" },
      { value: "grayscale", label: "Grayscale" },
      { value: "original", label: "Original" },
    ],
  }),
};

/*
  Logo strip — a "trusted by" row. In a video the logos scroll past as a
  seamless marquee; as a still they sit evenly spaced across the block.
*/
const logo = (name: string) => ({ src: `/blocks/logo-strip/${name}.svg` });

export const logoStrip = defineBlock({
  id: "logo-strip",
  name: "Logo strip",
  category: "Logos",
  tags: ["logos", "brands", "partners", "clients", "trusted by", "as seen in", "marquee", "ticker", "press"],
  inputs,
  defaults: {
    logos: ["northwind", "lumen", "kite", "oakline", "veloce", "hearth"].map(logo),
    speed: 1,
    direction: "left",
    gap: 80,
    tone: "white",
  },
  /* A list of images: the role names what each item is. */
  roles: { logos: "logo" },
  defaultDuration: 6,
  aspectHint: "landscape",
  preview: "",
});
