import { input } from "../inputs";
import { defineBlock } from "../spec";

/*
  The screen is two inputs because a media input holds one kind: a video,
  when there is one, plays over the image, so an image can stay behind as the
  still a template falls back to.
*/
export const inputs = {
  screen: input.image({ label: "Screen image" }),
  screenVideo: input.video({ label: "Screen video" }),
  model: input.select({
    label: "Model",
    options: [
      { value: "iphone", label: "iPhone" },
      { value: "android", label: "Android" },
    ],
  }),
  color: input.select({
    label: "Colour",
    options: [
      { value: "black", label: "Black" },
      { value: "white", label: "White" },
      { value: "titanium", label: "Natural titanium" },
    ],
  }),
  /* Real screenshots often carry their own status bar, and the clock and icons
     have to contrast with whatever the screen shows, so this picks the ink or
     hides it rather than switching it on and off. */
  statusBar: input.select({
    label: "Status bar",
    options: [
      { value: "dark", label: "Dark" },
      { value: "light", label: "Light" },
      { value: "hidden", label: "Hidden" },
    ],
  }),
  entrance: input.select({
    label: "Entrance",
    options: [
      { value: "none", label: "None" },
      { value: "tilt", label: "Tilt in" },
    ],
  }),
};

/*
  Phone frame — a phone holding the user's screenshot or screen recording. It
  stands still unless the entrance is set to tilt in; a screen video plays in
  step with the timeline. As a still, the phone upright with its screen.
*/
export const phoneFrame = defineBlock({
  id: "phone-frame",
  name: "Phone frame",
  category: "Frames",
  tags: ["phone", "iphone", "android", "mockup", "device", "mobile", "smartphone", "screen", "screenshot", "app", "recording"],
  inputs,
  defaults: {
    screen: { src: "/blocks/phone-frame/shop.svg" },
    screenVideo: { src: "" },
    model: "iphone",
    color: "black",
    statusBar: "dark",
    entrance: "none",
  },
  /* The screen shows the thing being sold, an app or a shop page. A video
     input can only take the one video role in the vocabulary; here it fills
     the screen as a background video fills a frame. */
  roles: { screen: "image:product", screenVideo: "video:background" },
  defaultDuration: 5,
  aspectHint: "portrait",
  preview: "",
});
