#!/usr/bin/env node
/*
  The three mock templates: the fixtures the scene picker, the Templates page,
  the public API and the MCP are verified against. One per kind, built to
  exercise every code path rather than to be the real library.

      npm run mock-templates -- --org org_… --user user_…              # build or refresh them, unpublished
      npm run mock-templates -- --org org_… --user user_… --publish    # and publish them

  `--org` is the publisher organisation (`TEMPLATE_PUBLISHER_ORG`, docs/templates.md
  → "Who can publish"), `--user` an admin of it. Each template is made as a
  project in that organisation first, exactly as a person would author it
  (docs/templates.md → "Building one"), so it can be opened in the studio and
  edited by hand; this script is only a repeatable way of drawing it.

  Re-runnable. A project or template with the same name in that organisation
  is overwritten in place, keeping its id, so the fixtures' ids are stable
  across runs. Then render the posters: `npm run template-posters`.

  Acts as `--user` through `npx convex run --identity`, which only dev
  deployments accept. Media is stock (`source: "stock"`), which resolves for
  every organisation without uploads.
*/

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { componentBlock, imageBlock, project, shapeBlock, slide, textBlock, videoBlock } from "../lib/editor/factory";
import type { Block, Project, TextBlock } from "../lib/editor/types";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const option = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};
const orgId = option("org");
const userId = option("user");
const publish = argv.includes("--publish");
if (!orgId || !userId) {
  console.error("usage: npm run mock-templates -- --org org_… --user user_… [--publish]");
  process.exit(1);
}

function run<T>(fn: string, args: Record<string, unknown>): T {
  const result = spawnSync("npx", ["convex", "run", fn, JSON.stringify(args), "--identity", JSON.stringify({ subject: userId })], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`npx convex run ${fn} failed:\n${result.stderr || result.stdout}`);
  const output = result.stdout.trim();
  return (output ? JSON.parse(output) : null) as T;
}

/* ── Stock media ─────────────────────────────────────────────────────────
   `media` ids of stock rows. `src` is left empty: the studio resolves the id,
   and a template read resolves it for everyone. */
const STOCK = {
  /* Textures: a plant's shadow on a warm wall. Low detail where text sits. */
  wall: "jd79509vsckvhwc05k3scn70kd8f7s9z",
  /* Cafe: a latte on its saucer in window light. */
  latte: "jd721819weh4846ykpx63epp458f6bef",
  /* Cafe: coffee beans, close up. */
  beans: "jd74bax859kre5ptqtr3per6bx8f63b3",
  /* Cafe: friends sharing coffee and cake at a table. */
  friends: "jd79ndap0xj4e6jz02364fbcan8f7pjf",
  /* Cafe video (H.264, 1080 × 1920, 4.4 s): latte art on a tray. */
  pour: "jd7dz0jte28g2z49cbfgx8tet58f7xrr",
};
const media = (id: string) => ({ mediaId: id, src: "" });

/* ── Palette and type ─────────────────────────────────────────────────── */
const CREAM = "#f4ede3";
const ESPRESSO = "#2a1d15";
const COCOA = "#5a4334";
const CLAY = "#c8643b";
const BUTTER = "#ffd84d";
const SERIF = "Fraunces";

const heading = (text: string, at: Pick<TextBlock, "x" | "y" | "w" | "h">, extra: Partial<TextBlock> = {}) =>
  textBlock({ name: "Heading", role: "heading", text, fontFamily: SERIF, fontWeight: 700, fontSize: 80, lineHeight: 1.1, color: ESPRESSO, textAlign: "left", ...at, ...extra });
const body = (text: string, at: Pick<TextBlock, "x" | "y" | "w" | "h">, extra: Partial<TextBlock> = {}) =>
  textBlock({ name: "Body", role: "body", text, fontWeight: 500, fontSize: 34, lineHeight: 1.35, color: COCOA, textAlign: "left", ...at, ...extra });
/* A pill button: the text's own highlight is the pill, so it grows with the words. */
const cta = (text: string, at: Pick<TextBlock, "x" | "y" | "w" | "h">, extra: Partial<TextBlock> = {}) =>
  textBlock({ name: "Call to action", role: "cta", text, fontWeight: 700, fontSize: 40, lineHeight: 1.2, color: CREAM, highlight: { color: ESPRESSO, padding: 26, radius: 999 }, ...at, ...extra });

/* The brand block every carousel slide repeats. */
const logoStrip = (y: number) =>
  componentBlock(
    "logo-strip",
    { logos: ["northwind", "lumen", "kite", "oakline", "veloce", "hearth"].map((n) => ({ src: `/blocks/logo-strip/${n}.svg` })), speed: 1, direction: "left", gap: 80, tone: "black" },
    { name: "Logo strip", role: "brand", x: 80, y, w: 920, h: 110 },
  );

function doc(kind: Project["kind"], name: string, slides: Project["slides"]): Project {
  return { ...project(kind, name), slides };
}

/* ── Image: "Product spotlight" (4:5) ─────────────────────────────────── */
function productSpotlight(): Project {
  return doc("image", "Product spotlight", [
    slide({
      name: "Slide 1",
      background: { type: "color", color: CREAM },
      blocks: [
        imageBlock({ name: "Background", role: "image:background", ...media(STOCK.wall), x: 0, y: 0, w: 1080, h: 1350 }),
        /* Keeps the body and the product off the busy part of the background. */
        shapeBlock("rect", { name: "Panel", x: 60, y: 350, w: 960, h: 830, radius: 48, fill: "rgba(255, 255, 255, 0.72)" }),
        /* The highlight-style text: each line gets its own marker stroke. */
        heading("Your new\nmorning ritual", { x: 80, y: 90, w: 920, h: 230 }, { fontSize: 88, highlight: { color: BUTTER, padding: 14, radius: 8 } }),
        body("Single-origin beans, roasted on Monday and at your door by Friday. Brewed however you like it.", { x: 110, y: 395, w: 860, h: 140 }),
        imageBlock({ name: "Product photo", role: "image:product", ...media(STOCK.latte), x: 100, y: 600, w: 440, h: 540, radius: 32, focalY: 60 }),
        componentBlock(
          "product-card",
          {
            image: media(STOCK.beans),
            name: "House Blend, 250 g",
            price: "$18",
            compareAtPrice: "$22",
            badge: "Roasted Monday",
            rating: 4.5,
            cta: "Add to bag",
            theme: "light",
            accent: ESPRESSO,
          },
          { name: "Product card", x: 580, y: 620, w: 400, h: 500 },
        ),
        cta("Order yours", { x: 290, y: 1220, w: 500, h: 60 }, { textAlign: "center" }),
      ],
    }),
  ]);
}

/* ── Carousel: "3 reasons" (3 slides, 4:5) ────────────────────────────── */
function threeReasons(): Project {
  const reasons = ["Roasted every Monday, never more than a week old", "Bought direct from three farms we visit every year", "Free delivery, and pause or skip whenever you like"];
  const row = (n: number, text: string, y: number): Block[] => [
    shapeBlock("ellipse", { name: `Number ${n} dot`, x: 80, y, w: 110, h: 110, fill: CLAY }),
    textBlock({ name: `Number ${n}`, text: String(n), x: 80, y: y + 22, w: 110, h: 66, fontFamily: SERIF, fontWeight: 700, fontSize: 56, lineHeight: 1.15, color: CREAM }),
    textBlock({ name: `Reason ${n}`, role: "benefit", text, x: 230, y: y - 4, w: 770, h: 120, fontWeight: 600, fontSize: 42, lineHeight: 1.25, color: ESPRESSO, textAlign: "left" }),
  ];
  return doc("carousel", "3 reasons", [
    slide({
      name: "Cover",
      background: { type: "color", color: CREAM },
      blocks: [
        imageBlock({ name: "Lifestyle photo", role: "image:lifestyle", ...media(STOCK.friends), x: 0, y: 0, w: 1080, h: 800, focalY: 45 }),
        heading("3 reasons our regulars never switch", { x: 80, y: 860, w: 920, h: 200 }, { fontSize: 76 }),
        textBlock({ name: "Swipe", text: "Swipe →", x: 780, y: 1085, w: 220, h: 40, fontWeight: 600, fontSize: 30, color: CLAY, textAlign: "right" }),
        logoStrip(1180),
      ],
    }),
    slide({
      name: "Reasons",
      background: { type: "color", color: CREAM },
      blocks: [heading("Why it's worth the switch", { x: 80, y: 100, w: 920, h: 190 }, { fontSize: 72 }), ...row(1, reasons[0], 380), ...row(2, reasons[1], 600), ...row(3, reasons[2], 820), logoStrip(1180)],
    }),
    slide({
      name: "Offer",
      background: { type: "color", color: CREAM },
      blocks: [
        shapeBlock("ellipse", { name: "Sun", x: 150, y: 150, w: 780, h: 780, fill: BUTTER, opacity: 80 }),
        heading("Your first bag\nis on us", { x: 80, y: 330, w: 920, h: 220 }, { fontSize: 92, textAlign: "center" }),
        body("Pay only for shipping. Cancel any time.", { x: 190, y: 590, w: 700, h: 100 }, { textAlign: "center", fontSize: 36 }),
        cta("Claim yours", { x: 290, y: 750, w: 500, h: 60 }, { textAlign: "center" }),
        logoStrip(1180),
      ],
    }),
  ]);
}

/* ── Video: "Hook → demo → CTA" (3 scenes, 9:16, 3 s / 6 s / 4 s) ─────── */
function hookDemoCta(): Project {
  /* Everything sits inside the middle 1080 × 1350 (y 285–1635), so a 4:5 crop keeps it. */
  return doc("video", "Hook → demo → CTA", [
    slide({
      name: "Hook",
      duration: 3,
      background: { type: "color", color: ESPRESSO },
      blocks: [
        videoBlock({ name: "Background video", role: "video:background", ...media(STOCK.pour), x: 0, y: 0, w: 1080, h: 1920, start: 0, end: 3, muted: true, sourceDuration: 4.367, overlay: { color: "#000000", opacity: 30 } }),
        /* Word by word: the five words have all landed by about 1.2 s. */
        textBlock({
          name: "Hook",
          role: "hook",
          text: "Still drinking last month's coffee?",
          x: 80,
          y: 700,
          w: 920,
          h: 360,
          start: 0,
          end: 3,
          animation: "words",
          fontWeight: 800,
          fontSize: 104,
          lineHeight: 1.08,
          color: "#ffffff",
          shadow: { color: "rgba(0, 0, 0, 0.35)", x: 0, y: 4, blur: 24 },
        }),
      ],
    }),
    slide({
      name: "Demo",
      duration: 6,
      background: { type: "color", color: CREAM },
      blocks: [
        componentBlock(
          "search-bar",
          {
            query: "fresh coffee beans",
            placeholder: "Search",
            suggestions: ["fresh coffee beans delivered", "fresh coffee beans roasted this week", "fresh coffee beans near me"],
            highlight: 2,
            theme: "light",
            accent: "#ffe9a8",
          },
          { name: "Search bar", x: 90, y: 360, w: 900, h: 506, start: 0, end: 6 },
        ),
        componentBlock("counter", { from: 0, to: 12500, prefix: "", suffix: "+", decimals: 0, separator: true, color: ESPRESSO }, { name: "Counter", x: 190, y: 1030, w: 700, h: 240, start: 2, end: 6 }),
        body("bags delivered this year", { x: 140, y: 1290, w: 800, h: 60 }, { textAlign: "center", fontSize: 44, fontWeight: 600, start: 2, end: 6, animation: "fade" }),
      ],
    }),
    slide({
      name: "CTA",
      duration: 4,
      background: { type: "color", color: ESPRESSO },
      blocks: [
        heading("Roasted Monday.\nYours by Friday.", { x: 80, y: 640, w: 920, h: 340 }, { fontSize: 100, color: CREAM, textAlign: "center", start: 0, end: 4, animation: "rise" }),
        /* Lands at about 1.3 s and holds for the rest of the scene. */
        cta("Order yours", { x: 290, y: 1100, w: 500, h: 70 }, { textAlign: "center", fontSize: 48, color: ESPRESSO, highlight: { color: BUTTER, padding: 28, radius: 999 }, start: 0.8, end: 4, animation: "rise" }),
      ],
    }),
  ]);
}

/* ── Write them ───────────────────────────────────────────────────────── */

const FIXTURES: { build: () => Project; categories: string[]; tags: string[] }[] = [
  { build: productSpotlight, categories: ["product"], tags: ["coffee", "launch", "shop", "fixture"] },
  { build: threeReasons, categories: ["product"], tags: ["coffee", "benefits", "list", "fixture"] },
  { build: hookDemoCta, categories: ["product"], tags: ["coffee", "hook", "demo", "fixture"] },
];

type ProjectRow = { id: string; name: string };
type TemplateRow = { id: string; name: string; published: boolean };

const projects = run<ProjectRow[]>("projects:list", { orgId });
const templates = run<TemplateRow[]>("templates:list", { drafts: true });

for (const { build, categories, tags } of FIXTURES) {
  const document = build();
  const existing = projects.find((p) => p.name === document.name);
  let projectId: string;
  if (existing) {
    projectId = existing.id;
    run("projects:save", { orgId, id: projectId, document: { ...document, id: projectId } });
  } else {
    projectId = run<string>("projects:create", { orgId, document });
  }

  const template = templates.find((t) => t.name === document.name);
  const templateId = run<string>("templates:createFromProject", { orgId, projectId, categories, tags, ...(template ? { templateId: template.id } : {}) });
  if (publish) run("templates:publish", { orgId, id: templateId });
  console.log(`${document.name}: project ${projectId}, template ${templateId}${template ? " (updated)" : " (new)"}${publish ? ", published" : ""}`);
}
