import { imageBlock, shapeBlock, textBlock } from "./factory";
import type { Block, Gradient, ShapeKind, Slide, TextBlock } from "./types";

/* ------------------------------------------------------------------------ */
/* Text                                                                     */
/* ------------------------------------------------------------------------ */

export type TextPreset = {
  id: string;
  label: string;
  category: string;
  /* How the preview card should render; the block itself uses `block`. */
  preview: { text: string; bg?: string };
  block: Partial<TextBlock>;
};

export const TEXT_CATEGORIES = [
  "Instagram",
  "Basics",
  "Emphasis",
  "Callouts",
  "Lists",
  "Counters",
  "Buttons",
  "Star Ratings",
  "Reviews",
  "Promos",
  "Titles",
  "CTAs",
  "TikTok Hooks",
  "Features",
] as const;

const W = 880;

export const TEXT_PRESETS: TextPreset[] = [
  /* Instagram — the five native story text styles. */
  {
    id: "ig-classic",
    label: "Classic",
    category: "Instagram",
    preview: { text: "Classic" },
    block: {
      text: "Classic",
      fontFamily: "Inter",
      fontWeight: 600,
      fontSize: 72,
      color: "#ffffff",
      shadow: { color: "rgba(0,0,0,0.45)", x: 0, y: 2, blur: 8 },
    },
  },
  {
    id: "ig-modern",
    label: "Modern",
    category: "Instagram",
    preview: { text: "MODERN" },
    block: {
      text: "MODERN",
      fontFamily: "Montserrat",
      fontWeight: 700,
      fontSize: 64,
      letterSpacing: 8,
      textTransform: "uppercase",
      color: "#ffffff",
    },
  },
  {
    id: "ig-neon",
    label: "Neon",
    category: "Instagram",
    preview: { text: "Neon", bg: "#0a0a12" },
    block: {
      text: "Neon",
      fontFamily: "Pacifico",
      fontWeight: 400,
      fontSize: 84,
      color: "#ffffff",
      glow: { color: "#ff4fd8", blur: 24 },
    },
  },
  {
    id: "ig-typewriter",
    label: "Typewriter",
    category: "Instagram",
    preview: { text: "typewriter" },
    block: {
      text: "typewriter",
      fontFamily: "Space Mono",
      fontWeight: 400,
      fontSize: 56,
      color: "#0a0909",
      highlight: { color: "#ffffff", padding: 14, radius: 4 },
    },
  },
  {
    id: "ig-strong",
    label: "Strong",
    category: "Instagram",
    preview: { text: "STRONG" },
    block: {
      text: "STRONG",
      fontFamily: "Anton",
      fontWeight: 400,
      fontSize: 84,
      textTransform: "uppercase",
      color: "#0a0909",
      highlight: { color: "#ffd84d", padding: 16, radius: 8 },
    },
  },
  {
    id: "ig-highlight",
    label: "Highlight",
    category: "Instagram",
    preview: { text: "highlight" },
    block: {
      text: "highlight",
      fontFamily: "Poppins",
      fontWeight: 600,
      fontSize: 64,
      color: "#ffffff",
      highlight: { color: "#0a0909", padding: 18, radius: 14 },
    },
  },
  {
    id: "ig-outline",
    label: "Outline",
    category: "Instagram",
    preview: { text: "OUTLINE" },
    block: {
      text: "OUTLINE",
      fontFamily: "Bebas Neue",
      fontSize: 110,
      color: "transparent",
      stroke: { color: "#ffffff", width: 3 },
      letterSpacing: 4,
    },
  },
  /* Basics */
  {
    id: "heading",
    label: "Heading",
    category: "Basics",
    preview: { text: "Heading" },
    block: { text: "Your heading here", fontFamily: "Inter", fontWeight: 700, fontSize: 96, lineHeight: 1.05, textAlign: "left" },
  },
  {
    id: "subheading",
    label: "Subheading",
    category: "Basics",
    preview: { text: "Subheading" },
    block: { text: "A supporting line for the heading", fontFamily: "Inter", fontWeight: 500, fontSize: 48, textAlign: "left", color: "#d4d4d8" },
  },
  {
    id: "body",
    label: "Body",
    category: "Basics",
    preview: { text: "Body text" },
    block: {
      text: "Body copy goes here. Keep it short, keep it scannable, and lead with the benefit.",
      fontFamily: "Inter",
      fontWeight: 400,
      fontSize: 36,
      lineHeight: 1.4,
      textAlign: "left",
      color: "#e4e4e7",
    },
  },
  {
    id: "caption",
    label: "Caption",
    category: "Basics",
    preview: { text: "CAPTION" },
    block: { text: "CAPTION", fontFamily: "Inter", fontWeight: 600, fontSize: 26, letterSpacing: 4, textTransform: "uppercase", color: "#a1a1aa" },
  },
  /* Emphasis */
  {
    id: "gradient",
    label: "Gradient",
    category: "Emphasis",
    preview: { text: "Gradient" },
    block: {
      text: "Gradient",
      fontFamily: "Syne",
      fontWeight: 800,
      fontSize: 96,
      color: "#ffffff",
      gradient: { angle: 45, stops: ["#6ee86e", "#ffd84d", "#ff9a3c"] },
    },
  },
  {
    id: "chrome",
    label: "3D Chrome",
    category: "Emphasis",
    preview: { text: "CHROME" },
    block: {
      text: "CHROME",
      fontFamily: "Archivo Black",
      fontSize: 96,
      color: "#ffffff",
      gradient: { angle: 180, stops: ["#ffffff", "#9ca3af", "#ffffff", "#4b5563"] },
      shadow: { color: "rgba(0,0,0,0.6)", x: 0, y: 6, blur: 0 },
    },
  },
  {
    id: "gold",
    label: "3D Gold",
    category: "Emphasis",
    preview: { text: "GOLD" },
    block: {
      text: "GOLD",
      fontFamily: "Playfair Display",
      fontWeight: 900,
      fontSize: 100,
      color: "#ffd84d",
      gradient: { angle: 180, stops: ["#fff3b0", "#f6d84d", "#b8860b"] },
      shadow: { color: "rgba(120,80,0,0.7)", x: 0, y: 5, blur: 0 },
    },
  },
  {
    id: "pop",
    label: "Pop shadow",
    category: "Emphasis",
    preview: { text: "POP" },
    block: {
      text: "POP",
      fontFamily: "Anton",
      fontSize: 110,
      color: "#ffd84d",
      shadow: { color: "#ff4fd8", x: 8, y: 8, blur: 0 },
      stroke: { color: "#0a0909", width: 3 },
    },
  },
  {
    id: "serif-italic",
    label: "Editorial",
    category: "Emphasis",
    preview: { text: "editorial" },
    block: { text: "subject to change", fontFamily: "Fraunces", fontWeight: 400, italic: true, fontSize: 84, color: "#ffffff" },
  },
  /* Callouts */
  {
    id: "pill",
    label: "Pill label",
    category: "Callouts",
    preview: { text: "NEW" },
    block: {
      text: "NEW",
      fontFamily: "Inter",
      fontWeight: 700,
      fontSize: 28,
      letterSpacing: 3,
      textTransform: "uppercase",
      color: "#0a0909",
      highlight: { color: "#6ee86e", padding: 14, radius: 999 },
      w: 220,
    },
  },
  {
    id: "tag",
    label: "Tag",
    category: "Callouts",
    preview: { text: "#trending" },
    block: { text: "#trending", fontFamily: "Inter", fontWeight: 600, fontSize: 36, color: "#ffffff", highlight: { color: "rgba(255,255,255,0.18)", padding: 14, radius: 12 }, w: 320 },
  },
  {
    id: "handle",
    label: "Handle",
    category: "Callouts",
    preview: { text: "@yourbrand" },
    block: { text: "@yourbrand", fontFamily: "Inter", fontWeight: 500, fontSize: 32, color: "#ffffff", w: 320 },
  },
  {
    id: "swipe",
    label: "Swipe",
    category: "Callouts",
    preview: { text: "Swipe →" },
    block: { text: "Swipe  →", fontFamily: "Inter", fontWeight: 600, fontSize: 32, letterSpacing: 2, color: "#ffffff", w: 300 },
  },
  /* Lists */
  {
    id: "bullets",
    label: "Bullet list",
    category: "Lists",
    preview: { text: "• One\n• Two" },
    block: {
      text: "•  First point\n•  Second point\n•  Third point",
      fontFamily: "Inter",
      fontWeight: 500,
      fontSize: 40,
      lineHeight: 1.6,
      textAlign: "left",
      h: 220,
    },
  },
  {
    id: "numbered",
    label: "Numbered",
    category: "Lists",
    preview: { text: "1. One\n2. Two" },
    block: {
      text: "1.  Plan\n2.  Post\n3.  Grow",
      fontFamily: "Space Grotesk",
      fontWeight: 600,
      fontSize: 44,
      lineHeight: 1.6,
      textAlign: "left",
      h: 230,
    },
  },
  {
    id: "checks",
    label: "Checklist",
    category: "Lists",
    preview: { text: "✓ Done" },
    block: { text: "✓  Free shipping\n✓  30-day returns\n✓  Vegan formula", fontFamily: "Inter", fontWeight: 500, fontSize: 40, lineHeight: 1.6, textAlign: "left", h: 220 },
  },
  /* Counters */
  {
    id: "big-number",
    label: "Big number",
    category: "Counters",
    preview: { text: "01" },
    block: { text: "01", fontFamily: "Bebas Neue", fontSize: 220, color: "#ffffff", w: 300, h: 240 },
  },
  {
    id: "stat",
    label: "Stat",
    category: "Counters",
    preview: { text: "98%" },
    block: { text: "98%", fontFamily: "Syne", fontWeight: 800, fontSize: 160, color: "#ffd84d", w: 420, h: 200 },
  },
  {
    id: "slide-count",
    label: "Slide count",
    category: "Counters",
    preview: { text: "1 / 5" },
    block: { text: "1 / 5", fontFamily: "Space Mono", fontSize: 30, color: "#a1a1aa", w: 200 },
  },
  /* Buttons */
  {
    id: "btn-primary",
    label: "Button",
    category: "Buttons",
    preview: { text: "Shop now" },
    block: { text: "Shop now", fontFamily: "Inter", fontWeight: 600, fontSize: 36, color: "#0a0909", highlight: { color: "#ffffff", padding: 26, radius: 999 }, w: 360 },
  },
  {
    id: "btn-outline",
    label: "Outline button",
    category: "Buttons",
    preview: { text: "Learn more" },
    block: { text: "Learn more", fontFamily: "Inter", fontWeight: 600, fontSize: 36, color: "#ffffff", highlight: { color: "rgba(255,255,255,0.12)", padding: 26, radius: 999 }, w: 380 },
  },
  {
    id: "btn-accent",
    label: "Accent button",
    category: "Buttons",
    preview: { text: "Get 20% off" },
    block: { text: "Get 20% off", fontFamily: "Poppins", fontWeight: 700, fontSize: 36, color: "#0a0909", highlight: { color: "#6ee86e", padding: 26, radius: 20 }, w: 400 },
  },
  /* Star ratings */
  {
    id: "stars-5",
    label: "Five stars",
    category: "Star Ratings",
    preview: { text: "★★★★★" },
    block: { text: "★★★★★", fontFamily: "Inter", fontSize: 64, letterSpacing: 6, color: "#ffd84d", w: 460 },
  },
  {
    id: "stars-label",
    label: "Rated",
    category: "Star Ratings",
    preview: { text: "★★★★★ 4.9" },
    block: { text: "★★★★★  4.9 / 5", fontFamily: "Inter", fontWeight: 600, fontSize: 40, color: "#ffffff", w: 560 },
  },
  /* Reviews */
  {
    id: "review",
    label: "Review",
    category: "Reviews",
    preview: { text: "“Loved it”" },
    block: {
      text: "“Genuinely the best thing I’ve bought this year.”\n— Priya, verified buyer",
      fontFamily: "Lora",
      fontWeight: 400,
      italic: true,
      fontSize: 44,
      lineHeight: 1.4,
      textAlign: "left",
      h: 260,
    },
  },
  {
    id: "quote",
    label: "Quote card",
    category: "Reviews",
    preview: { text: "“Quote”" },
    block: {
      text: "“Simple. Honest. Works.”",
      fontFamily: "DM Serif Display",
      fontSize: 84,
      lineHeight: 1.1,
      color: "#0a0909",
      highlight: { color: "#f6c8dd", padding: 32, radius: 24 },
      h: 320,
    },
  },
  /* Promos */
  {
    id: "sale",
    label: "Sale",
    category: "Promos",
    preview: { text: "SALE" },
    block: { text: "SALE", fontFamily: "Anton", fontSize: 200, color: "#ffd84d", w: 700, h: 230 },
  },
  {
    id: "percent-off",
    label: "Percent off",
    category: "Promos",
    preview: { text: "30% OFF" },
    block: { text: "30% OFF", fontFamily: "Archivo Black", fontSize: 120, color: "#ffffff", highlight: { color: "#ff9a3c", padding: 20, radius: 16 }, h: 180 },
  },
  {
    id: "limited",
    label: "Limited time",
    category: "Promos",
    preview: { text: "LIMITED" },
    block: { text: "LIMITED TIME ONLY", fontFamily: "Bebas Neue", fontSize: 72, letterSpacing: 6, color: "#ffffff", h: 100 },
  },
  /* Titles */
  {
    id: "title-serif",
    label: "Serif title",
    category: "Titles",
    preview: { text: "Contents" },
    block: { text: "Contents in this bottle", fontFamily: "Playfair Display", fontWeight: 500, fontSize: 92, lineHeight: 1.1, textAlign: "left", color: "#ffffff", h: 220 },
  },
  {
    id: "title-bold",
    label: "Bold title",
    category: "Titles",
    preview: { text: "BOLD" },
    block: { text: "BOLD TITLE", fontFamily: "Bebas Neue", fontSize: 150, lineHeight: 0.95, color: "#ffffff", h: 160 },
  },
  {
    id: "title-mixed",
    label: "Mixed",
    category: "Titles",
    preview: { text: "Hello, there" },
    block: { text: "Hello, there.", fontFamily: "Fraunces", fontWeight: 600, fontSize: 96, color: "#ffffff", h: 130 },
  },
  /* CTAs */
  {
    id: "cta-link",
    label: "Link in bio",
    category: "CTAs",
    preview: { text: "Link in bio" },
    block: { text: "Link in bio ↗", fontFamily: "Inter", fontWeight: 700, fontSize: 40, color: "#0a0909", highlight: { color: "#ffffff", padding: 22, radius: 999 }, w: 380 },
  },
  {
    id: "cta-save",
    label: "Save this",
    category: "CTAs",
    preview: { text: "Save for later" },
    block: { text: "Save this for later", fontFamily: "Poppins", fontWeight: 600, fontSize: 40, color: "#ffffff", w: 560 },
  },
  {
    id: "cta-follow",
    label: "Follow",
    category: "CTAs",
    preview: { text: "Follow →" },
    block: { text: "Follow for more  →", fontFamily: "Inter", fontWeight: 600, fontSize: 36, color: "#ffffff", highlight: { color: "rgba(0,0,0,0.5)", padding: 20, radius: 999 }, w: 460 },
  },
  /* TikTok Hooks */
  {
    id: "hook-1",
    label: "Nobody tells you",
    category: "TikTok Hooks",
    preview: { text: "Nobody tells you this" },
    block: { text: "Nobody tells you this about skincare", fontFamily: "Inter", fontWeight: 700, fontSize: 60, lineHeight: 1.2, color: "#ffffff", highlight: { color: "#0a0909", padding: 16, radius: 10 }, h: 190 },
  },
  {
    id: "hook-2",
    label: "POV",
    category: "TikTok Hooks",
    preview: { text: "POV:" },
    block: { text: "POV: you finally found the one", fontFamily: "Poppins", fontWeight: 600, fontSize: 56, color: "#0a0909", highlight: { color: "#ffffff", padding: 16, radius: 10 }, h: 160 },
  },
  {
    id: "hook-3",
    label: "Wait for it",
    category: "TikTok Hooks",
    preview: { text: "wait for it…" },
    block: { text: "wait for it…", fontFamily: "Inter", fontWeight: 500, fontSize: 56, color: "#ffffff", shadow: { color: "rgba(0,0,0,0.6)", x: 0, y: 2, blur: 10 } },
  },
  {
    id: "hook-4",
    label: "Stop scrolling",
    category: "TikTok Hooks",
    preview: { text: "STOP SCROLLING" },
    block: { text: "STOP SCROLLING", fontFamily: "Anton", fontSize: 96, color: "#ffd84d", stroke: { color: "#0a0909", width: 3 }, h: 120 },
  },
  /* Features */
  {
    id: "feature",
    label: "Feature",
    category: "Features",
    preview: { text: "0.1% Retinol" },
    block: { text: "0.1%\nTretinoin", fontFamily: "Inter", fontWeight: 700, fontSize: 48, lineHeight: 1.2, color: "#ffffff", w: 300, h: 130 },
  },
  {
    id: "feature-row",
    label: "Feature row",
    category: "Features",
    preview: { text: "Vegan · Clean" },
    block: { text: "Vegan  ·  Cruelty-free  ·  Recyclable", fontFamily: "Inter", fontWeight: 500, fontSize: 32, letterSpacing: 1, color: "#d4d4d8", h: 60 },
  },
  {
    id: "in-stock",
    label: "Back in stock",
    category: "Features",
    preview: { text: "BACK IN STOCK" },
    block: { text: "BACK IN STOCK", fontFamily: "Montserrat", fontWeight: 800, fontSize: 40, letterSpacing: 6, color: "#0a0909", highlight: { color: "#6ee86e", padding: 18, radius: 6 }, h: 80 },
  },
];

export function textFromPreset(preset: TextPreset, artboardW: number, artboardH: number): TextBlock {
  const w = preset.block.w ?? W;
  const h = preset.block.h ?? 120;
  return textBlock({
    ...preset.block,
    presetId: preset.id,
    x: (artboardW - w) / 2,
    y: (artboardH - h) / 2,
    w,
    h,
  });
}

/* ------------------------------------------------------------------------ */
/* Shapes                                                                    */
/* ------------------------------------------------------------------------ */

export const SHAPES: { kind: ShapeKind; label: string }[] = [
  { kind: "rect", label: "Rectangle" },
  { kind: "ellipse", label: "Ellipse" },
  { kind: "triangle", label: "Triangle" },
  { kind: "star", label: "Star" },
  { kind: "diamond", label: "Diamond" },
  { kind: "hexagon", label: "Hexagon" },
  { kind: "line", label: "Line" },
  { kind: "arrow", label: "Arrow" },
];

export function shapeFor(kind: ShapeKind, artboardW: number, artboardH: number) {
  const thin = kind === "line" || kind === "arrow";
  const w = thin ? 500 : 400;
  const h = thin ? 40 : 400;
  return shapeBlock(kind, { x: (artboardW - w) / 2, y: (artboardH - h) / 2, w, h });
}

/* ------------------------------------------------------------------------ */
/* Stock                                                                     */
/* ------------------------------------------------------------------------ */

export type StockItem = { id: string; kind: "photo" | "video"; src: string; thumb: string; label: string; duration?: number };

const photo = (seed: string, label: string): StockItem => ({
  id: `photo-${seed}`,
  kind: "photo",
  src: `https://picsum.photos/seed/${seed}/1080/1350`,
  thumb: `https://picsum.photos/seed/${seed}/300/380`,
  label,
});

export const STOCK_PHOTOS: StockItem[] = [
  photo("skincare", "Skincare flat lay"),
  photo("studio", "Studio product"),
  photo("coast", "Coastline"),
  photo("forest", "Forest light"),
  photo("desk", "Desk setup"),
  photo("coffee", "Coffee"),
  photo("city", "City night"),
  photo("texture", "Texture"),
  photo("bloom", "Bloom"),
  photo("mountain", "Mountains"),
  photo("fabric", "Fabric"),
  photo("minimal", "Minimal"),
];

// Pexels CDN serves `Access-Control-Allow-Origin: *`, which the WebCodecs
// exporter needs in order to paint <video> frames onto a canvas.
const pexels = (id: number, fps: number, size: string, label: string, duration: number, thumb = `free-video-${id}.jpg`): StockItem => ({
  id: `v-${id}`,
  kind: "video",
  src: `https://videos.pexels.com/video-files/${id}/${id}-sd_${size}_${fps}fps.mp4`,
  thumb: `https://images.pexels.com/videos/${id}/${thumb}?auto=compress&cs=tinysrgb&w=400`,
  label,
  duration,
});

export const STOCK_VIDEOS: StockItem[] = [
  pexels(3571264, 30, "640_360", "Aerial surf", 33),
  pexels(1409899, 25, "640_360", "Turquoise coast", 21),
  pexels(3209828, 25, "640_360", "VR headset", 14),
  pexels(857195, 25, "640_360", "Milky Way peak", 7),
  pexels(1093662, 30, "640_360", "Golden rocks", 8),
  pexels(2098989, 30, "640_360", "Waterfalls", 36),
  pexels(3130284, 30, "640_360", "Matrix code", 20),
  pexels(3015510, 24, "640_360", "Camper van", 19),
  pexels(5532771, 25, "506_960", "Cold cans", 9, "pexels-photo-5532771.jpeg"),
];

export const AUDIO_TRACKS = [
  { id: "a1", title: "Golden Hour", mood: ["Calm", "Warm"], duration: 128 },
  { id: "a2", title: "Sunday Drive", mood: ["Chill", "Lo-fi"], duration: 96 },
  { id: "a3", title: "Confetti", mood: ["Fun", "Upbeat"], duration: 74 },
  { id: "a4", title: "Bright Side", mood: ["Happy", "Pop"], duration: 112 },
  { id: "a5", title: "Slow Bloom", mood: ["Calm", "Ambient"], duration: 150 },
  { id: "a6", title: "Neon Nights", mood: ["Chill", "Synth"], duration: 88 },
];

/* ------------------------------------------------------------------------ */
/* Backgrounds                                                               */
/* ------------------------------------------------------------------------ */

export const BG_COLORS = ["#111111", "#0a0909", "#f5f5f5", "#e9e1d3", "#f6c8dd", "#ffd84d", "#6ee86e", "#4cc7f0", "#1e1b4b", "#7c2d12"];

export const BG_GRADIENTS: Gradient[] = [
  { angle: 160, stops: ["#efe3cf", "#c9a877"] },
  { angle: 160, stops: ["#6ee86e", "#2f9e4f"] },
  { angle: 45, stops: ["#6ee86e", "#ffd84d", "#ff9a3c"] },
  { angle: 160, stops: ["#4cc9f0", "#2a7fb8"] },
  { angle: 180, stops: ["#1e1b4b", "#0a0909"] },
  { angle: 135, stops: ["#f6c8dd", "#ff9a3c"] },
  { angle: 200, stops: ["#0f172a", "#334155"] },
  { angle: 135, stops: ["#fdf2f8", "#fce7f3"] },
];

/* ------------------------------------------------------------------------ */
/* Templates                                                                 */
/* ------------------------------------------------------------------------ */

export type Template = {
  id: string;
  label: string;
  category: string;
  /* Preview swatch used in the grid. */
  swatch: string;
  build: (w: number, h: number) => Pick<Slide, "background" | "blocks">;
};

const T = (p: Partial<TextBlock> & Pick<TextBlock, "x" | "y" | "w" | "h">) => textBlock(p);

export const TEMPLATE_CATEGORIES = ["Product Showcase", "Sale", "Customer Reviews", "Feature Callouts", "Before and After", "Comparisons", "Press"];

export const TEMPLATES: Template[] = [
  {
    id: "hook-cta",
    label: "Hook + CTA",
    category: "Product Showcase",
    swatch: "linear-gradient(160deg,#111,#2a2a2a)",
    build: (w, h) => ({
      background: { type: "color", color: "#111111" },
      blocks: [
        T({ x: 80, y: 120, w: w - 160, h: 80, text: "AGENCY", fontFamily: "Inter", fontWeight: 600, fontSize: 30, letterSpacing: 8, textAlign: "left", color: "#a1a1aa" }),
        T({ x: 80, y: 230, w: w - 160, h: 420, text: "Contents in this bottle subject to change based on your skin’s needs", fontFamily: "Playfair Display", fontWeight: 500, fontSize: 84, lineHeight: 1.12, textAlign: "left" }),
        T({ x: 80, y: h - 260, w: 360, h: 90, text: "Shop now", fontFamily: "Inter", fontWeight: 600, fontSize: 36, color: "#0a0909", highlight: { color: "#ffffff", padding: 26, radius: 999 } }),
      ] as Block[],
    }),
  },
  {
    id: "sale",
    label: "Sale",
    category: "Sale",
    swatch: "linear-gradient(160deg,#ffd84d,#ff9a3c)",
    build: (w, h) => ({
      background: { type: "gradient", gradient: { angle: 160, stops: ["#ffd84d", "#ff9a3c"] } },
      blocks: [
        T({ x: 60, y: h / 2 - 380, w: w - 120, h: 700, text: "SALE\nSALE\nSALE", fontFamily: "Anton", fontSize: 220, lineHeight: 0.95, color: "#0a0909" }),
        T({ x: 60, y: h - 300, w: w - 120, h: 100, text: "UP TO 40% OFF · THIS WEEKEND ONLY", fontFamily: "Inter", fontWeight: 700, fontSize: 34, letterSpacing: 4, color: "#0a0909" }),
      ] as Block[],
    }),
  },
  {
    id: "review",
    label: "Customer review",
    category: "Customer Reviews",
    swatch: "linear-gradient(160deg,#f6c8dd,#e9e1d3)",
    build: (w, h) => ({
      background: { type: "color", color: "#f6c8dd" },
      blocks: [
        T({ x: 100, y: 200, w: w - 200, h: 90, text: "★★★★★", fontFamily: "Inter", fontSize: 64, letterSpacing: 6, color: "#0a0909", textAlign: "left" }),
        T({ x: 100, y: 330, w: w - 200, h: 500, text: "“Genuinely the best thing I’ve bought this year. My skin has never looked calmer.”", fontFamily: "DM Serif Display", fontSize: 80, lineHeight: 1.15, textAlign: "left", color: "#0a0909" }),
        T({ x: 100, y: h - 300, w: w - 200, h: 60, text: "— Priya, verified buyer", fontFamily: "Inter", fontWeight: 500, fontSize: 34, textAlign: "left", color: "#0a0909" }),
      ] as Block[],
    }),
  },
  {
    id: "features",
    label: "Feature callouts",
    category: "Feature Callouts",
    swatch: "linear-gradient(160deg,#e9e1d3,#c9a877)",
    build: (w, h) => ({
      background: { type: "color", color: "#e9e1d3" },
      blocks: [
        T({ x: 80, y: 140, w: w - 160, h: 200, text: "What’s inside", fontFamily: "Fraunces", fontWeight: 600, fontSize: 96, textAlign: "left", color: "#0a0909" }),
        ...[0, 1, 2].map((i) =>
          T({
            x: 80 + i * ((w - 160) / 3),
            y: h / 2 - 60,
            w: (w - 160) / 3 - 20,
            h: 180,
            text: ["0.1%\nTretinoin", "5%\nAzelaic acid", "5%\nTranexamic"][i],
            fontFamily: "Inter",
            fontWeight: 700,
            fontSize: 44,
            lineHeight: 1.2,
            color: "#0a0909",
          }),
        ),
        T({ x: 80, y: h - 220, w: w - 160, h: 60, text: "Vegan  ·  Cruelty-free  ·  Recyclable", fontFamily: "Inter", fontWeight: 500, fontSize: 30, color: "#57534e" }),
      ] as Block[],
    }),
  },
  {
    id: "before-after",
    label: "Before / After",
    category: "Before and After",
    swatch: "linear-gradient(90deg,#333 50%,#eee 50%)",
    build: (w, h) => ({
      background: { type: "color", color: "#0a0909" },
      blocks: [
        imageBlock({ src: "https://picsum.photos/seed/before/800/1200", x: 60, y: 200, w: w / 2 - 80, h: h - 500, radius: 32 }),
        imageBlock({ src: "https://picsum.photos/seed/after/800/1200", x: w / 2 + 20, y: 200, w: w / 2 - 80, h: h - 500, radius: 32 }),
        T({ x: 60, y: 90, w: w / 2 - 80, h: 70, text: "BEFORE", fontFamily: "Inter", fontWeight: 700, fontSize: 32, letterSpacing: 6, color: "#a1a1aa" }),
        T({ x: w / 2 + 20, y: 90, w: w / 2 - 80, h: 70, text: "AFTER", fontFamily: "Inter", fontWeight: 700, fontSize: 32, letterSpacing: 6, color: "#6ee86e" }),
        T({ x: 60, y: h - 240, w: w - 120, h: 100, text: "8 weeks. Zero filters.", fontFamily: "Inter", fontWeight: 700, fontSize: 60 }),
      ] as Block[],
    }),
  },
  {
    id: "comparison",
    label: "Comparison",
    category: "Comparisons",
    swatch: "linear-gradient(160deg,#1e1b4b,#0a0909)",
    build: (w, h) => ({
      background: { type: "gradient", gradient: { angle: 180, stops: ["#1e1b4b", "#0a0909"] } },
      blocks: [
        T({ x: 80, y: 140, w: w - 160, h: 200, text: "Them vs. us", fontFamily: "Syne", fontWeight: 800, fontSize: 100, textAlign: "left" }),
        T({ x: 80, y: 420, w: w - 160, h: 340, text: "✕  Fragrance\n✕  Parabens\n✕  Filler", fontFamily: "Inter", fontWeight: 500, fontSize: 44, lineHeight: 1.7, textAlign: "left", color: "#a1a1aa" }),
        T({ x: 80, y: h - 640, w: w - 160, h: 340, text: "✓  0.1% Tretinoin\n✓  Fragrance-free\n✓  Dermatologist-led", fontFamily: "Inter", fontWeight: 600, fontSize: 44, lineHeight: 1.7, textAlign: "left", color: "#6ee86e" }),
      ] as Block[],
    }),
  },
  {
    id: "press",
    label: "Press quote",
    category: "Press",
    swatch: "linear-gradient(160deg,#f5f5f5,#d4d4d8)",
    build: (w, h) => ({
      background: { type: "color", color: "#f5f5f5" },
      blocks: [
        T({ x: 100, y: 200, w: w - 200, h: 70, text: "AS SEEN IN", fontFamily: "Inter", fontWeight: 600, fontSize: 28, letterSpacing: 8, color: "#71717a" }),
        T({ x: 100, y: h / 2 - 220, w: w - 200, h: 440, text: "“The serum that finally made retinol make sense.”", fontFamily: "Playfair Display", fontWeight: 500, italic: true, fontSize: 84, lineHeight: 1.15, color: "#0a0909" }),
        T({ x: 100, y: h - 300, w: w - 200, h: 70, text: "VOGUE  ·  ALLURE  ·  ELLE", fontFamily: "Bebas Neue", fontSize: 48, letterSpacing: 8, color: "#0a0909" }),
      ] as Block[],
    }),
  },
  {
    id: "listicle",
    label: "Listicle",
    category: "Feature Callouts",
    swatch: "linear-gradient(160deg,#6ee86e,#2f9e4f)",
    build: (w, h) => ({
      background: { type: "gradient", gradient: { angle: 160, stops: ["#6ee86e", "#2f9e4f"] } },
      blocks: [
        T({ x: 80, y: 120, w: 260, h: 240, text: "01", fontFamily: "Bebas Neue", fontSize: 240, textAlign: "left", color: "#0a0909" }),
        T({ x: 80, y: 400, w: w - 160, h: 300, text: "Start with a hook people can’t scroll past", fontFamily: "Inter", fontWeight: 800, fontSize: 76, lineHeight: 1.1, textAlign: "left", color: "#0a0909" }),
        T({ x: 80, y: h - 200, w: 300, h: 70, text: "Swipe  →", fontFamily: "Inter", fontWeight: 600, fontSize: 34, letterSpacing: 2, textAlign: "left", color: "#0a0909" }),
      ] as Block[],
    }),
  },
];
