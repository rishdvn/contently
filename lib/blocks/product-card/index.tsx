import { registerBlock } from "../registry";

import { Card } from "./Card";
import { inputs } from "./schema";

export { inputs };

/*
  Product card — a shop tile: photo, name, rating, price (with the old price
  struck through) and a button. In a video the photo settles in and the rest
  follows in a stagger; as a still the card is simply there.
*/
registerBlock({
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
  defaultDuration: 4,
  aspectHint: "portrait",
  render: (props, ctx) => <Card props={props} ctx={ctx} />,
  preview: "",
});
