import { input } from "../../inputs";
import { defineBlock } from "../../spec";

export const inputs = {
  headline: input.text({ label: "Headline", maxLength: 30, placeholder: "Leave empty to hide" }),
  amount: input.text({ label: "Offer", maxLength: 12, default: "20% OFF" }),
  fineprint: input.text({ label: "Fine print", maxLength: 60, placeholder: "Leave empty to hide" }),
  fill: input.color({ label: "Fill", default: "#e8412c" }),
  textColor: input.color({ label: "Text", default: "#ffffff" }),
};

/*
  Promo — an offer at a glance: a small headline, the amount set huge
  ("40% OFF", "$19"), and a line of fine print, on a filled panel. In a video
  the panel pops, the amount scales in and the rest fades after it; as a
  still it is settled. Listed in the Text panel under Promos.

  A fill of "none" (transparent) drops the panel, for type straight on the
  scene.
*/
export const promo = defineBlock({
  id: "promo",
  name: "Promo",
  category: "Text",
  tags: ["promos", "sale", "discount", "offer", "percent off", "price", "deal", "coupon", "code", "limited time"],
  inputs,
  defaults: {
    headline: "Spring sale",
    amount: "40% OFF",
    fineprint: "Use code SPRING40 at checkout · Ends Sunday",
    fill: "#e8412c",
    textColor: "#ffffff",
  },
  roles: { headline: "heading", amount: "price", fineprint: "body" },
  defaultDuration: 4,
  aspectHint: "landscape",
  preview: "",
});
