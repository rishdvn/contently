import { registerBlock } from "../../registry";

import { Counter } from "./Counter";
import { inputs } from "./schema";

export { inputs };

/*
  Counter — a number that counts up (or down) to its value. In a video it
  eases out over the first 80% of the block and holds; as a still it shows
  the final value. Listed in the Text panel under Counters.
*/
registerBlock({
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
  render: (props, ctx) => <Counter props={props} ctx={ctx} />,
  preview: "",
});
