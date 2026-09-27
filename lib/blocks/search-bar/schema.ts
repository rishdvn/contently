import { input } from "../inputs";

export const inputs = {
  query: input.text({ label: "Search", maxLength: 40, default: "how to" }),
  placeholder: input.text({ label: "Placeholder", maxLength: 30, default: "Search" }),
  suggestions: input.list({ label: "Suggestions", itemLabel: "Suggestion", min: 1, max: 5, item: input.text({ maxLength: 50, default: "New suggestion" }) }),
  highlight: input.number({ label: "Highlighted row", min: 0, max: 5, step: 1, default: 1 }),
  theme: input.select({
    label: "Theme",
    options: [
      { value: "light", label: "Light" },
      { value: "dark", label: "Dark" },
    ],
  }),
  accent: input.color({ label: "Highlight colour", default: "#d7f5dc" }),
};
