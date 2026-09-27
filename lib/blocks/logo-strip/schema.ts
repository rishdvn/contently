import { input } from "../inputs";

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
