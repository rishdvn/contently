import { input } from "../inputs";
import { defineBlock } from "../spec";

export const inputs = {
  query: input.text({ label: "Search", maxLength: 40, default: "how to" }),
  placeholder: input.text({ label: "Placeholder", maxLength: 30, default: "Search" }),
  suggestions: input.list({ label: "Suggestions", itemLabel: "Suggestion", min: 1, max: 5, item: input.text({ label: "Text", maxLength: 50, default: "New suggestion" }) }),
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

/*
  Search bar — a query typed into a search box, autocomplete suggestions
  dropping in beneath it, and a pointer picking one. As a still, the
  finished state: query typed, suggestions open, the chosen row hovered.
*/
export const searchBar = defineBlock({
  id: "search-bar",
  name: "Search bar",
  category: "Digital",
  tags: ["search", "google", "query", "autocomplete", "suggestions", "browser", "type", "typing", "question"],
  inputs,
  defaults: {
    query: "how to",
    placeholder: "Search",
    suggestions: ["how to fall asleep faster", "how to get glowing skin", "how to stay hydrated"],
    highlight: 2,
    theme: "light",
    accent: "#d7f5dc",
  },
  defaultDuration: 5,
  aspectHint: "landscape",
  preview: "",
});
