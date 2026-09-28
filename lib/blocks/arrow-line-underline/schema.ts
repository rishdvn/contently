import { input } from "../inputs";
import { defineBlock } from "../spec";

export const inputs = {
  style: input.select({
    label: "Shape",
    options: [
      { value: "straight", label: "Straight" },
      { value: "curved", label: "Curved" },
      { value: "scribble", label: "Scribble" },
      { value: "underline", label: "Underline" },
    ],
  }),
  head: input.select({
    label: "Head",
    options: [
      { value: "none", label: "None" },
      { value: "arrow", label: "Arrow" },
      { value: "dot", label: "Dot" },
    ],
  }),
  bothEnds: input.boolean({ label: "Head on both ends", default: false }),
  stroke: input.select({
    label: "Stroke",
    options: [
      { value: "solid", label: "Solid" },
      { value: "dashed", label: "Dash" },
      { value: "dotted", label: "Dots" },
    ],
  }),
  weight: input.number({ label: "Weight", min: 2, max: 24, step: 1, unit: "px", default: 8 }),
  color: input.color({ label: "Colour", default: "#ffffff" }),
};

/*
  Arrow / line — a drawn stroke to point at or underline something: straight,
  curved, a looping scribble or a marker underline, with an arrowhead or a dot
  at its end (or both ends). In a video it draws itself on from start to end
  and the head lands as the stroke arrives; as a still it is fully drawn.

  No `roles`: a line carries no content. Every input is styling.
*/
export const arrowLineUnderline = defineBlock({
  id: "arrow-line-underline",
  name: "Arrow / line",
  category: "Lines",
  tags: ["arrow", "line", "underline", "curve", "scribble", "pointer", "annotate", "doodle", "stroke", "divider"],
  inputs,
  defaults: {
    style: "curved",
    head: "arrow",
    bothEnds: false,
    stroke: "solid",
    weight: 8,
    color: "#ffffff",
  },
  defaultDuration: 3,
  aspectHint: "landscape",
  preview: "",
});
