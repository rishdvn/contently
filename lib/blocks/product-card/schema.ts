import { input } from "../inputs";

/*
  Product card inputs. Optional parts of the card (was-price, badge, rating,
  button) have no "optional" primitive to lean on, so each one hides when left
  empty — blank text, or a rating of 0.
*/
export const inputs = {
  image: input.image({ label: "Product photo" }),
  name: input.text({ label: "Name", maxLength: 60, default: "Product name" }),
  price: input.text({ label: "Price", maxLength: 16, default: "$0" }),
  compareAtPrice: input.text({ label: "Was", maxLength: 16, placeholder: "Leave empty to hide" }),
  badge: input.text({ label: "Badge", maxLength: 20, placeholder: "Leave empty to hide" }),
  rating: input.number({ label: "Rating", min: 0, max: 5, step: 0.5, unit: "★", default: 0 }),
  cta: input.text({ label: "Button", maxLength: 20, placeholder: "Leave empty to hide" }),
  theme: input.select({
    label: "Theme",
    options: [
      { value: "light", label: "Light" },
      { value: "dark", label: "Dark" },
    ],
  }),
  accent: input.color({ label: "Accent", default: "#111111" }),
};
