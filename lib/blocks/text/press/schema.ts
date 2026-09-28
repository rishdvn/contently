import { input } from "../../inputs";
import { defineBlock } from "../../spec";

export const inputs = {
  label: input.text({ label: "Label", maxLength: 24, placeholder: "Leave empty to hide" }),
  logos: input.list({
    label: "Logos",
    itemLabel: "Logo",
    min: 1,
    max: 6,
    item: input.object({
      fields: {
        kind: input.select({
          label: "Type",
          options: [
            { value: "image", label: "Image" },
            { value: "text", label: "Text" },
          ],
        }),
        image: input.image({ label: "Logo" }),
        text: input.text({ label: "Name", maxLength: 20, placeholder: "Publication" }),
      },
    }),
  }),
  color: input.color({ label: "Colour", default: "#ffffff" }),
  tint: input.boolean({ label: "Recolour logos", default: true }),
};

/*
  Press — "As seen in" and the publications' logos. Each logo is an image
  (a wordmark from Uploads or Stock) or, when there is no file to hand, the
  publication's name set as a serif wordmark. In a video the label fades in
  and the logos follow one by one; as a still they are all shown. Listed in
  the Text panel under Press.

  The sample wordmarks are made up (`public/blocks/press/`): real mastheads
  are someone else's trademarks.
*/
const logo = (name: string) => ({ kind: "image" as const, image: { src: `/blocks/press/${name}.svg` }, text: "" });

export const press = defineBlock({
  id: "press",
  name: "Press",
  category: "Text",
  tags: ["press", "as seen in", "featured in", "media", "publications", "magazine", "logos", "social proof"],
  inputs,
  defaults: {
    label: "As seen in",
    logos: [logo("meridian"), logo("daily-edit"), logo("gloss"), { kind: "text", image: { src: "" }, text: "Field Notes" }],
    color: "#ffffff",
    tint: true,
  },
  /* A publication's name written as its wordmark is a name as its owner writes it: `brand`. */
  roles: { label: "subheading", "logos[].image": "logo", "logos[].text": "brand" },
  defaultDuration: 4,
  aspectHint: "landscape",
  preview: "",
});
