import { registerBlock } from "../registry";

import { inputs } from "./schema";
import { Search } from "./Search";

export { inputs };

/*
  Search bar — a query typed into a search box, autocomplete suggestions
  dropping in beneath it, and a pointer picking one. As a still, the
  finished state: query typed, suggestions open, the chosen row hovered.
*/
registerBlock({
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
  render: (props, ctx) => <Search props={props} ctx={ctx} />,
  preview: "",
});
