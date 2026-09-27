import { input } from "../inputs";
import { registerBlock } from "../registry";

import { Thread } from "./Thread";

/*
  iMessage thread — the reference block for the platform. In a video the
  messages arrive one by one, the other side typing first; as a still (image,
  carousel, thumbnail) the whole conversation shows.
*/
export const inputs = {
  contactName: input.text({ label: "Contact name", maxLength: 40, default: "Contact" }),
  avatar: input.image({ label: "Contact photo" }),
  messages: input.list({
    label: "Messages",
    itemLabel: "Message",
    min: 1,
    max: 8,
    item: input.object({
      fields: {
        side: input.select({
          label: "From",
          options: [
            { value: "received", label: "Them" },
            { value: "sent", label: "You" },
          ],
        }),
        text: input.text({ label: "Text", maxLength: 200, multiline: true, default: "New message" }),
      },
    }),
  }),
  theme: input.select({
    label: "Theme",
    options: [
      { value: "light", label: "Light" },
      { value: "dark", label: "Dark" },
    ],
  }),
  showTyping: input.boolean({ label: "Typing indicator", default: true }),
};

registerBlock({
  id: "imessage",
  name: "iMessage",
  category: "Digital",
  tags: ["chat", "message", "text", "conversation", "sms", "dm", "phone", "apple"],
  inputs,
  defaults: {
    contactName: "Sam",
    avatar: { src: "" },
    messages: [
      { side: "received", text: "did you see the new drop??" },
      { side: "sent", text: "no what happened" },
      { side: "received", text: "everything is 30% off until sunday" },
      { side: "sent", text: "omw" },
    ],
    theme: "light",
    showTyping: true,
  },
  defaultDuration: 6,
  aspectHint: "portrait",
  render: (props, ctx) => <Thread props={props} ctx={ctx} />,
});
