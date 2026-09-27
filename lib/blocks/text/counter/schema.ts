import { input } from "../../inputs";

export const inputs = {
  from: input.number({ label: "From", min: -1e9, max: 1e9, default: 0 }),
  to: input.number({ label: "To", min: -1e9, max: 1e9, default: 100 }),
  prefix: input.text({ label: "Prefix", maxLength: 6 }),
  suffix: input.text({ label: "Suffix", maxLength: 6 }),
  decimals: input.number({ label: "Decimals", min: 0, max: 2, step: 1, default: 0 }),
  separator: input.boolean({ label: "Thousands separator", default: true }),
  color: input.color({ label: "Colour", default: "#ffffff" }),
};
