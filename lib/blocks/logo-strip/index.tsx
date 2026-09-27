import { registerBlock } from "../registry";

import { inputs } from "./schema";
import { Strip } from "./Strip";

export { inputs };

/*
  Logo strip — a "trusted by" row. In a video the logos scroll past as a
  seamless marquee; as a still they sit evenly spaced across the block.
*/
const logo = (name: string) => ({ src: `/blocks/logo-strip/${name}.svg` });

registerBlock({
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
  defaultDuration: 6,
  aspectHint: "landscape",
  render: (props, ctx) => <Strip props={props} ctx={ctx} />,
  preview: "",
});
