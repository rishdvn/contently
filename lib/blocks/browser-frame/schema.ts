import { input } from "../inputs";
import { defineBlock } from "../spec";

/*
  The page is two inputs because a media input holds one kind: a video, when
  there is one, plays over the image, which stays as the still a template
  falls back to.
*/
export const inputs = {
  url: input.text({ label: "Address", maxLength: 60, default: "glow.shop/summer", placeholder: "yourbrand.com" }),
  content: input.image({ label: "Page image" }),
  contentVideo: input.video({ label: "Page video" }),
  theme: input.select({
    label: "Theme",
    options: [
      { value: "light", label: "Light" },
      { value: "dark", label: "Dark" },
    ],
  }),
  showTabs: input.boolean({ label: "Tab bar", default: true }),
};

/*
  Browser frame — a desktop browser window showing the user's page, as a
  screenshot or a screen recording. It stands still; a page video plays in
  step with the timeline.
*/
export const browserFrame = defineBlock({
  id: "browser-frame",
  name: "Browser frame",
  category: "Frames",
  tags: ["browser", "website", "web", "site", "safari", "chrome", "window", "url", "landing page", "desktop", "mockup", "screenshot", "recording"],
  inputs,
  defaults: {
    url: "glow.shop/summer",
    content: { src: "/blocks/browser-frame/landing.svg" },
    contentVideo: { src: "" },
    theme: "light",
    showTabs: true,
  },
  /* The address is the brand's web address, written as the brand writes it.
     The page shows the thing being sold; the video input takes the one video
     role there is, filling the page as a background clip fills a frame. */
  roles: { url: "brand", content: "image:product", contentVideo: "video:background" },
  defaultDuration: 5,
  aspectHint: "landscape",
  preview: "",
});
