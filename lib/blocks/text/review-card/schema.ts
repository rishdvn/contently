import { input } from "../../inputs";
import { defineBlock } from "../../spec";

export const inputs = {
  quote: input.text({ label: "Quote", maxLength: 200, multiline: true, default: "Love it" }),
  author: input.text({ label: "Name", maxLength: 40, default: "Customer" }),
  rating: input.number({ label: "Rating", min: 0, max: 5, step: 0.5, unit: "★", default: 5 }),
  avatar: input.image({ label: "Photo" }),
  theme: input.select({
    label: "Theme",
    options: [
      { value: "light", label: "Light" },
      { value: "dark", label: "Dark" },
    ],
  }),
};

/*
  Review card — a customer's words on a card: stars, the quote, and who said
  it. In a video the card fades up and the stars fill left to right; as a still
  it is settled. Listed in the Text panel under Reviews.

  `avatar` has no role: it is a person's photo, and no image role in the
  vocabulary means that (`image:lifestyle` is the product in use). A rating is
  a number, not copy.
*/
export const reviewCard = defineBlock({
  id: "review-card",
  name: "Review card",
  category: "Text",
  tags: ["reviews", "review", "testimonial", "quote", "customer", "rating", "stars", "social proof", "feedback"],
  inputs,
  defaults: {
    quote: "Easily my favourite face SPF for lazy days. Goes on in seconds, works under makeup and never feels greasy.",
    author: "Marie L.",
    rating: 5,
    avatar: { src: "" },
    theme: "light",
  },
  roles: { quote: "quote", author: "author" },
  defaultDuration: 5,
  aspectHint: "square",
  preview: "",
});
