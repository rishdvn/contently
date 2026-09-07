import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/*
  tailwind-merge only knows Tailwind's stock scale keys. Our theme replaces the
  type ramp and radius ramp with custom keys, so they have to be declared here
  or `text-md` and `rounded-panel` won't deduplicate against their siblings.
*/
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["micro", "md"] }],
      rounded: [{ rounded: ["chip", "control", "card", "panel"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
