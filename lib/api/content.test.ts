/*
  Content replacement and the API's document view: `npm test`.
*/
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getSpec } from "../blocks/catalog";
import type { Block, BlockBase, Project } from "../editor/types";

import { applyReplacements, parseReplacements, type Media, type Replacement } from "./content";
import { sniff } from "./sniff";
import { blockView, durationOf, roleCounts, sceneViews } from "./view";

const base: Omit<BlockBase, "id"> = { x: 0, y: 0, w: 800, h: 200, rotation: 0, opacity: 1, locked: false, hidden: false, flipX: false, flipY: false, start: 0, end: 3, animation: "none", effects: [] };
const text = (id: string, value: string, role?: Block["role"]): Block => ({
  ...base,
  id,
  type: "text",
  text: value,
  ...(role ? { role } : {}),
  fontFamily: "Inter",
  fontWeight: 700,
  italic: false,
  underline: false,
  fontSize: 64,
  lineHeight: 1.25,
  letterSpacing: 0,
  textAlign: "left",
  textTransform: "none",
  color: "#fff",
});
const image = (id: string, role?: Block["role"]): Block => ({ ...base, id, type: "image", src: "https://old/photo.jpg", mediaId: "old", fit: "cover", focalX: 50, focalY: 50, radius: 0, adjustments: {} as never, ...(role ? { role } : {}) });
const component = (id: string, componentId: string, props: Record<string, unknown>, role?: Block["role"]): Block => ({ ...base, id, type: "component", componentId, props, ...(role ? { role } : {}) });
const shape: Block = { ...base, id: "deco", type: "shape", shape: "rect", fill: "#000", radius: 0 };

const doc = (): Pick<Project, "slides" | "width" | "height" | "kind"> => ({
  kind: "video",
  width: 1080,
  height: 1920,
  slides: [
    { id: "s1", name: "Hook", duration: 3, background: { type: "color", color: "#000" }, blocks: [text("hook", "Tired of dull skin?", "hook"), image("bg", "image:background"), shape] },
    {
      id: "s2",
      name: "Demo",
      duration: 5,
      background: { type: "color", color: "#000" },
      blocks: [text("b1", "Glows in a week", "benefit"), text("b2", "Vegan formula", "benefit"), component("card", "product-card", getSpec("product-card")!.defaults), component("strip", "logo-strip", getSpec("logo-strip")!.defaults, "brand")],
    },
    { id: "s3", name: "CTA", duration: 4, background: { type: "color", color: "#000" }, blocks: [text("cta", "Shop now", "cta"), text("brandname", "Glowco", "brand")] },
  ],
});

const photo: Media = { id: "m1", kind: "image", url: "https://files/new.jpg" };
const clip: Media = { id: "m2", kind: "video", url: "https://files/new.mp4" };
const lookup = (r: Replacement) => (r.mediaId === "m1" || r.mediaUrl === "https://example.com/p.jpg" ? photo : r.mediaId === "m2" ? clip : undefined);

const apply = (replacements: Replacement[]) => {
  const parsed = parseReplacements({ replacements });
  assert.deepEqual(parsed.problems, []);
  return applyReplacements(doc(), parsed.replacements, lookup);
};
const blockIn = (d: Pick<Project, "slides">, id: string) => d.slides.flatMap((s) => s.blocks).find((b) => b.id === id)!;

describe("parseReplacements", () => {
  it("accepts the documented shapes", () => {
    const { problems } = parseReplacements({
      replacements: [
        { role: "heading", text: "Hi" },
        { blockId: "card", field: "messages[2].text", text: "x" },
        { role: "benefit", sceneIndex: 1, index: 0, text: "y" },
        { role: "image:product", mediaUrl: "https://example.com/p.jpg" },
        { blockId: "card", props: { price: "$9" } },
      ],
    });
    assert.deepEqual(problems, []);
  });

  it("says what is wrong and where", () => {
    const { problems } = parseReplacements({
      replacements: [
        { text: "no target" },
        { blockId: "a", role: "heading", text: "both" },
        { role: "headline", text: "unknown role" },
        { role: "heading" },
        { role: "heading", text: "x", mediaId: "m1" },
        { blockID: "typo", text: "x" },
        { role: "heading", field: "image", text: "x" },
        { blockId: "a", index: 1, text: "x" },
        { blockId: "a", mediaUrl: "ftp://nope" },
        { blockId: "a", field: "messages[].text", text: "x" },
        "junk",
      ],
    });
    const at = problems.map((p) => p.at);
    for (const where of ["replacements[0]", "replacements[1]", "replacements[2].role", "replacements[3]", "replacements[4]", "replacements[5].blockID", "replacements[6].field", "replacements[7].index", "replacements[8].mediaUrl", "replacements[9].field", "replacements[10]"]) {
      assert.ok(at.includes(where), `expected a problem at ${where}; got ${JSON.stringify(problems)}`);
    }
  });

  it("rejects a body that is not a list of replacements", () => {
    assert.equal(parseReplacements({}).problems[0]!.at, "replacements");
    assert.equal(parseReplacements({ replacements: [] }).problems[0]!.message, "At least one replacement");
  });
});

describe("applyReplacements", () => {
  it("replaces text by role and by block id", () => {
    const out = apply([
      { role: "hook", text: "Still dull?" },
      { blockId: "cta", text: "Get yours" },
    ]);
    assert.deepEqual(out.problems, []);
    assert.equal((blockIn(out.document, "hook") as { text: string }).text, "Still dull?");
    assert.equal((blockIn(out.document, "cta") as { text: string }).text, "Get yours");
    assert.deepEqual(
      out.changed.map((c) => [c.blockId, c.before, c.after]),
      [
        ["hook", "Tired of dull skin?", "Still dull?"],
        ["cta", "Shop now", "Get yours"],
      ],
    );
  });

  it("fills image:product inside the Product card", () => {
    const out = apply([{ role: "image:product", mediaUrl: "https://example.com/p.jpg" }]);
    assert.deepEqual(out.problems, []);
    assert.deepEqual(out.changed[0], { replacement: 0, scene: 1, blockId: "card", field: "image", before: { src: "/blocks/product-card/serum.svg" }, after: { mediaId: "m1", src: "https://files/new.jpg" } });
    assert.deepEqual((blockIn(out.document, "card") as { props: Record<string, unknown> }).props.image, { mediaId: "m1", src: "https://files/new.jpg" });
  });

  it("writes one field of a catalog block by blockId + field", () => {
    const out = apply([{ blockId: "card", field: "price", text: "$29" }]);
    assert.deepEqual(out.problems, []);
    assert.equal((blockIn(out.document, "card") as { props: Record<string, unknown> }).props.price, "$29");
  });

  it("replaces every match of a role, or the one asked for", () => {
    /* Two benefit texts, plus the Product card's badge field. */
    const all = apply([{ role: "benefit", text: "Same" }]);
    assert.equal(all.changed.length, 3);
    const one = apply([{ role: "benefit", index: 1, text: "Second" }]);
    assert.deepEqual(one.changed.map((c) => c.blockId), ["b2"]);
    assert.equal((blockIn(one.document, "b1") as { text: string }).text, "Glows in a week");
  });

  it("merges and validates catalog block props", () => {
    const ok = apply([{ blockId: "card", props: { name: "Night Serum", rating: 5 } }]);
    assert.deepEqual(ok.problems, []);
    const props = (blockIn(ok.document, "card") as { props: Record<string, unknown> }).props;
    assert.equal(props.name, "Night Serum");
    assert.equal(props.price, "$38");

    const bad = apply([{ blockId: "card", props: { rating: 9 } }]);
    assert.match(bad.problems[0]!.message, /rating: At most 5/);
    const unknown = apply([{ blockId: "card", props: { colour: "#fff" } }]);
    assert.match(unknown.problems[0]!.message, /no input "colour"/);
  });

  it("enforces a field's own limits", () => {
    const out = apply([{ blockId: "card", field: "price", text: "$" + "9".repeat(40) }]);
    assert.match(out.problems[0]!.message, /price: At most 16 characters/);
  });

  it("refuses the wrong kind of value for a block named by id", () => {
    assert.match(apply([{ blockId: "hook", mediaId: "m1" }]).problems[0]!.message, /is text; send text/);
    assert.match(apply([{ blockId: "bg", text: "x" }]).problems[0]!.message, /is an image; send mediaId/);
    assert.match(apply([{ blockId: "bg", mediaId: "m2" }]).problems[0]!.message, /takes an image, and that media is a video/);
    assert.match(apply([{ blockId: "card", text: "x" }]).problems[0]!.message, /send props, or address a field/);
    assert.match(apply([{ blockId: "deco", text: "x" }]).problems[0]!.message, /shape/);
    assert.match(apply([{ blockId: "card", field: "nope", text: "x" }]).problems[0]!.message, /no field "nope"; its content fields are image/);
  });

  it("skips role matches that cannot take the value but replaces the rest", () => {
    const out = apply([{ role: "brand", text: "Lumen" }]);
    assert.deepEqual(out.problems, []);
    assert.deepEqual(out.changed.map((c) => c.blockId), ["brandname"]);
    assert.deepEqual(out.skipped.map((s) => s.blockId), ["strip"]);
  });

  it("reports what did not match without failing the batch", () => {
    const out = apply([
      { role: "quote", text: "x" },
      { blockId: "nope", text: "x" },
      { role: "hook", sceneIndex: 2, text: "x" },
      { role: "cta", text: "Buy" },
    ]);
    assert.deepEqual(out.problems, []);
    assert.deepEqual(out.unmatched.map((u) => u.replacement), [0, 1, 2]);
    /* The CTA text and the Product card's button. */
    assert.equal(out.changed.length, 2);
  });

  it("fails on media it cannot find", () => {
    assert.match(apply([{ blockId: "bg", mediaId: "missing" }]).problems[0]!.message, /No such media/);
  });

  it("warns when text outgrows its slot", () => {
    const out = apply([{ role: "cta", text: "Order yours today before they sell out" }]);
    assert.equal(out.warnings.length, 1);
    assert.equal(out.changed.length, 1);
  });

  it("leaves the input document alone", () => {
    const before = doc();
    const snapshot = JSON.stringify(before);
    applyReplacements(before, parseReplacements({ replacements: [{ role: "hook", text: "x" }] }).replacements, lookup);
    assert.equal(JSON.stringify(before), snapshot);
  });
});

describe("view", () => {
  it("lists content blocks per scene with roles, constraints and component schema", () => {
    const scenes = sceneViews(doc(), ["p0", "p1", "p2"]);
    assert.deepEqual(scenes.map((s) => [s.index, s.name, s.duration, s.poster, s.blocks.length]), [
      [0, "Hook", 3, "p0", 2],
      [1, "Demo", 5, "p1", 4],
      [2, "CTA", 4, "p2", 2],
    ]);
    const hook = scenes[0]!.blocks[0] as ReturnType<typeof blockView> & { textConstraints: { maxChars: number; lines: number } };
    assert.equal(hook.role, "hook");
    assert.deepEqual(hook.textConstraints, { maxChars: Math.ceil("Tired of dull skin?".length * 1.3), lines: 2 });
    const card = scenes[1]!.blocks[2] as { component: { id: string; schema: object; fields: { path: string; role: string }[] } };
    assert.equal(card.component.id, "product-card");
    assert.deepEqual(Object.keys(card.component.schema).slice(0, 3), ["image", "name", "price"]);
    assert.deepEqual(card.component.fields.map((f) => [f.path, f.role]), [
      ["image", "image:product"],
      ["name", "heading"],
      ["price", "price"],
      ["compareAtPrice", "price"],
      ["badge", "benefit"],
      ["cta", "cta"],
    ]);
  });

  it("summarises roles and duration", () => {
    /* Field roles count too: the Product card's name, prices, badge and button, and each of the Logo strip's six logos. */
    assert.deepEqual(roleCounts(doc()), { heading: 1, benefit: 3, cta: 2, price: 2, brand: 2, hook: 1, logo: 6, "image:product": 1, "image:background": 1 });
    assert.equal(durationOf(doc()), 12);
    assert.equal(durationOf({ ...doc(), kind: "image" }), null);
  });
});

describe("sniff", () => {
  const bytes = (...parts: (number[] | string)[]) => new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));
  const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];

  it("reads PNG, GIF and JPEG sizes", () => {
    assert.deepEqual(sniff(bytes([0x89], "PNG\r\n\x1a\n", be32(13), "IHDR", be32(1080), be32(1350))), { kind: "image", mime: "image/png", width: 1080, height: 1350 });
    assert.deepEqual(sniff(bytes("GIF89a", [0x40, 0x01, 0xf0, 0x00])), { kind: "image", mime: "image/gif", width: 320, height: 240 });
    const jpeg = bytes([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0, 0, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x05, 0x46, 0x04, 0x38, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    assert.deepEqual(sniff(jpeg), { kind: "image", mime: "image/jpeg", width: 1080, height: 1350 });
  });

  it("reads an MP4's size and duration", () => {
    const mvhd = [...be32(108), ..."mvhd".split("").map((c) => c.charCodeAt(0)), 0, 0, 0, 0, ...be32(0), ...be32(0), ...be32(1000), ...be32(6500), ...new Array(80).fill(0)];
    const tkhdBody = [0, 0, 0, 0, ...new Array(72).fill(0), ...be32(1080 * 65536), ...be32(1920 * 65536)];
    const tkhd = [...be32(8 + tkhdBody.length), ..."tkhd".split("").map((c) => c.charCodeAt(0)), ...tkhdBody];
    const trak = [...be32(8 + tkhd.length), ..."trak".split("").map((c) => c.charCodeAt(0)), ...tkhd];
    const moov = [...be32(8 + mvhd.length + trak.length), ..."moov".split("").map((c) => c.charCodeAt(0)), ...mvhd, ...trak];
    const file = bytes(be32(16), "ftypisom", be32(0), moov);
    assert.deepEqual(sniff(file), { kind: "video", mime: "video/mp4", width: 1080, height: 1920, duration: 6.5 });
  });

  it("says nothing about bytes it does not recognise", () => {
    assert.equal(sniff(bytes("hello world, not an image")), null);
  });
});
