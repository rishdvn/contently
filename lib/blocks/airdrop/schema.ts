import { input } from "../inputs";
import { defineBlock } from "../spec";

export const inputs = {
  title: input.text({ label: "Title", maxLength: 40, default: "AirDrop" }),
  subtitle: input.text({ label: "Message", maxLength: 80, multiline: true, default: "" }),
  image: input.image({ label: "Preview" }),
  declineLabel: input.text({ label: "Decline button", maxLength: 16, default: "Decline" }),
  acceptLabel: input.text({ label: "Accept button", maxLength: 16, default: "Accept" }),
  theme: input.select({
    label: "Theme",
    options: [
      { value: "light", label: "Light" },
      { value: "dark", label: "Dark" },
    ],
  }),
};

/*
  AirDrop — the sheet a phone shows when someone shares something with it:
  title, who is sharing what, a preview, and Decline / Accept. In a video the
  sheet rises, the buttons fade in and Accept is tapped near the end; as a
  still, the settled sheet.
*/
export const airdrop = defineBlock({
  id: "airdrop",
  name: "AirDrop",
  category: "Digital",
  tags: ["airdrop", "share", "iphone", "ios", "alert", "accept", "decline", "offer", "discount", "code", "gift", "drop"],
  inputs,
  defaults: {
    title: "AirDrop",
    subtitle: "“Glow” would like to share a 20% off code with you.",
    image: { src: "/blocks/airdrop/serum.svg" },
    declineLabel: "Decline",
    acceptLabel: "Accept",
    theme: "light",
  },
  /* The message is the line the post is about. The title is the sheet's own
     name ("AirDrop") in nearly every use, chrome rather than copy, and Decline
     is its foil, so neither has a role; Accept is the call to action. */
  roles: { subtitle: "heading", image: "image:product", acceptLabel: "cta" },
  defaultDuration: 5,
  aspectHint: "portrait",
  preview: "",
});
