import { input } from "../../inputs";
import { defineBlock } from "../../spec";

export const inputs = {
  rating: input.number({ label: "Rating", min: 0, max: 5, step: 0.5, unit: "★", default: 5 }),
  count: input.text({ label: "Caption", maxLength: 32, placeholder: "Leave empty to hide" }),
  color: input.color({ label: "Stars", default: "#ffc83d" }),
  textColor: input.color({ label: "Text", default: "#ffffff" }),
};

/*
  Star rating — five stars filled to a rating, with an optional caption
  ("2,300+ five-star reviews") under them. In a video the stars fill left to
  right and the caption follows; as a still they are filled to the rating.
  Listed in the Text panel under Star Ratings.

  The caption is social proof, a reason to believe: `benefit`, as the
  Product card's badge is. The rating is a number, not copy.
*/
export const starRating = defineBlock({
  id: "star-rating",
  name: "Star rating",
  category: "Text",
  tags: ["star ratings", "stars", "rating", "five star", "5 star", "score", "social proof", "trust"],
  inputs,
  defaults: {
    rating: 5,
    count: "2,300+ five-star reviews",
    color: "#ffc83d",
    textColor: "#ffffff",
  },
  roles: { count: "benefit" },
  defaultDuration: 3,
  aspectHint: "landscape",
  preview: "",
});
