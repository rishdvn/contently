import { input } from "../../inputs";
import { defineBlock } from "../../spec";

export const inputs = {
  from: input.number({ label: "From", min: -1e9, max: 1e9, default: 0 }),
  to: input.number({ label: "To", min: -1e9, max: 1e9, default: 100 }),
  prefix: input.text({ label: "Prefix", maxLength: 6 }),
  suffix: input.text({ label: "Suffix", maxLength: 6 }),
  decimals: input.number({ label: "Decimals", min: 0, max: 2, step: 1, default: 0 }),
  separator: input.boolean({ label: "Thousands separator", default: true }),
  color: input.color({ label: "Colour", default: "#ffffff" }),
};

/*
  Counter — a number that counts up (or down) to its value. In a video it
  eases out over the first 80% of the block and holds; as a still it shows
  the final value. Listed in the Text panel under Counters.

  No `roles`: the number is not copy, and no role in the vocabulary fits it;
  prefix and suffix are units. A caption beside it is its own text block.
*/
export const counter = defineBlock({
  id: "counter",
  name: "Counter",
  category: "Text",
  tags: ["counters", "number", "count", "stat", "statistic", "percent", "customers", "reviews", "sold", "growth"],
  inputs,
  defaults: {
    from: 0,
    to: 12500,
    prefix: "",
    suffix: "+",
    decimals: 0,
    separator: true,
    color: "#ffffff",
  },
  defaultDuration: 3,
  aspectHint: "landscape",
  preview: "",
});
