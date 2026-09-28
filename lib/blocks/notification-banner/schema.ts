import { input } from "../inputs";
import { defineBlock } from "../spec";

export const inputs = {
  appName: input.text({ label: "App name", maxLength: 20, default: "App" }),
  appIcon: input.image({ label: "App icon" }),
  title: input.text({ label: "Title", maxLength: 40, default: "New notification" }),
  body: input.text({ label: "Message", maxLength: 120, multiline: true, default: "" }),
  time: input.text({ label: "Time", maxLength: 10, default: "now" }),
  theme: input.select({
    label: "Theme",
    options: [
      { value: "light", label: "Light" },
      { value: "dark", label: "Dark" },
    ],
  }),
};

/*
  Notification banner — a phone's lock-screen notification: app icon, app
  name and time, a bold title and a message of up to three lines. In a video
  it drops in from the top and settles with a slight overshoot; as a still
  it is simply there.
*/
export const notificationBanner = defineBlock({
  id: "notification-banner",
  name: "Notification banner",
  category: "Digital",
  tags: ["notification", "push", "alert", "banner", "ios", "iphone", "lock screen", "app", "message", "order", "shipped"],
  inputs,
  defaults: {
    appName: "Glow",
    appIcon: { src: "/blocks/notification-banner/glow-icon.svg" },
    title: "Your order has shipped",
    body: "Vitamin C Serum and 1 more item arrive Thursday. Tap to track your parcel.",
    time: "now",
    theme: "light",
  },
  /* The app is the brand, and its icon is the brand's logo. The time is
     phone chrome ("now", "9:41"), not copy, so it has no role. */
  roles: { appName: "brand", appIcon: "logo", title: "heading", body: "body" },
  defaultDuration: 4,
  aspectHint: "landscape",
  preview: "",
});
