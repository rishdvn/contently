import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/*
  Design-system layering. A layer may import only from the layers beneath it:

    tokens (app/globals.css)  <-  primitives (components/ui)
                              <-  patterns   (components/patterns)
                              <-  surfaces   (app)

  Documented at /design/hierarchy. The rules below are what make it true.
*/
const noPatternsOrApp = {
  patterns: [
    {
      group: ["@/components/patterns", "@/components/patterns/*", "@/app", "@/app/*", "**/patterns/**", "**/app/**"],
      message: "components/ui is the primitive layer: it may import tokens and other primitives only.",
    },
  ],
};

const noApp = {
  patterns: [
    {
      group: ["@/app", "@/app/*", "**/app/**"],
      message: "components/patterns may import primitives and other patterns, never app.",
    },
  ],
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["components/ui/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": ["error", noPatternsOrApp] },
  },
  {
    files: ["components/patterns/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": ["error", noApp] },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
