/*
  The fonts a text block can use. All are Google Fonts loaded from one
  stylesheet in the studio layout, so a preset can reference any of them
  without a per-font import.
*/
export type FontDef = { family: string; weights: number[]; category: "sans" | "serif" | "display" | "script" | "mono" };

export const FONTS: FontDef[] = [
  { family: "Inter", weights: [400, 500, 600, 700, 800, 900], category: "sans" },
  { family: "Poppins", weights: [400, 500, 600, 700, 800], category: "sans" },
  { family: "Montserrat", weights: [400, 500, 600, 700, 800, 900], category: "sans" },
  { family: "Space Grotesk", weights: [400, 500, 600, 700], category: "sans" },
  { family: "Syne", weights: [400, 500, 600, 700, 800], category: "sans" },
  { family: "Playfair Display", weights: [400, 500, 600, 700, 800, 900], category: "serif" },
  { family: "DM Serif Display", weights: [400], category: "serif" },
  { family: "Lora", weights: [400, 500, 600, 700], category: "serif" },
  { family: "Fraunces", weights: [400, 500, 600, 700, 800, 900], category: "serif" },
  { family: "Bebas Neue", weights: [400], category: "display" },
  { family: "Anton", weights: [400], category: "display" },
  { family: "Oswald", weights: [400, 500, 600, 700], category: "display" },
  { family: "Archivo Black", weights: [400], category: "display" },
  { family: "Caveat", weights: [400, 500, 600, 700], category: "script" },
  { family: "Pacifico", weights: [400], category: "script" },
  { family: "Space Mono", weights: [400, 700], category: "mono" },
];

export const WEIGHT_LABELS: Record<number, string> = {
  300: "Light",
  400: "Regular",
  500: "Medium",
  600: "Semibold",
  700: "Bold",
  800: "Extra bold",
  900: "Black",
};

export function googleFontsHref() {
  const families = FONTS.map((f) => {
    const upright = f.weights.map((w) => `0,${w}`);
    const italic = f.weights.map((w) => `1,${w}`);
    return `family=${f.family.replace(/ /g, "+")}:ital,wght@${[...upright, ...italic].join(";")}`;
  });
  return `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap`;
}

export function fontDef(family: string) {
  return FONTS.find((f) => f.family === family) ?? FONTS[0];
}

/* Nearest available weight, so switching family never leaves an unsupported weight. */
export function nearestWeight(family: string, weight: number) {
  const ws = fontDef(family).weights;
  return ws.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), ws[0]);
}
