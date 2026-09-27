import { input } from "../inputs";
import { defineBlock } from "../spec";

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

/*
  Product card — a shop tile: photo, name, rating, price (with the old price
  struck through) and a button. In a video the photo settles in and the rest
  follows in a stagger; as a still the card is simply there.
*/
export const productCard = defineBlock({
  id: "product-card",
  name: "Product card",
  category: "Products",
  tags: ["product", "shop", "price", "sale", "ecommerce", "store", "buy", "card", "rating"],
  inputs,
  defaults: {
    image: { src: "/blocks/product-card/serum.svg" },
    name: "Daily Glow Vitamin C Serum",
    price: "$38",
    compareAtPrice: "$48",
    badge: "New",
    rating: 4.5,
    cta: "Shop now",
    theme: "light",
    accent: "#111111",
  },
  roles: { image: "image:product" },
  defaultDuration: 4,
  aspectHint: "portrait",
  preview: "",
});
