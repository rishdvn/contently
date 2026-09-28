import { input } from "../inputs";
import { defineBlock } from "../spec";

export const inputs = {
  images: input.list({ label: "Images", itemLabel: "Image", min: 2, max: 6, item: input.image({ label: "Image" }) }),
  transition: input.select({
    label: "Transition",
    options: [
      { value: "slide", label: "Slide" },
      { value: "fade", label: "Fade" },
    ],
  }),
  intervalSeconds: input.number({ label: "Each image", min: 0.5, max: 5, step: 0.5, unit: "s", default: 1.5 }),
  showDots: input.boolean({ label: "Dots", default: true }),
  /* A share of the shorter side, so the look survives any resize: 50% is a circle on a square box. */
  radius: input.number({ label: "Corner radius", min: 0, max: 50, step: 1, unit: "%", default: 4 }),
};

/*
  Image carousel — photos that take turns, as a swipeable post does. In a
  video each image holds for `intervalSeconds` and hands over to the next
  with a slide or a cross-fade, looping for as long as the block lasts; as a
  still it shows the first image, with its dot lit.
*/
const image = (name: string) => ({ src: `/blocks/image-carousel/${name}.svg` });

export const imageCarousel = defineBlock({
  id: "image-carousel",
  name: "Image carousel",
  category: "Carousels",
  tags: ["carousel", "slideshow", "gallery", "photos", "images", "swipe", "slides", "dots", "lookbook"],
  inputs,
  defaults: {
    images: ["dunes", "citrus", "tide", "bloom"].map(image),
    transition: "slide",
    intervalSeconds: 1.5,
    showDots: true,
    radius: 4,
  },
  /* A list of images: the role names each item. The sample set is scenes and
     moods, which is what a carousel is mostly filled with; a shop's product
     shots would suit `image:product` as well, and the vocabulary has no
     "either" role. */
  roles: { images: "image:lifestyle" },
  defaultDuration: 6,
  aspectHint: "portrait",
  preview: "",
});
