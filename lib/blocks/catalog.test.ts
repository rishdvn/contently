/*
  The block catalog as the server sees it: `npm test`. Data only, so it runs in
  plain Node with no browser and no Convex.
*/
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { findRole, rolesIn, slotsOf } from "../editor/roles";
import type { Block, BlockBase, Project } from "../editor/types";

import { getSpec, listSpecs } from "./catalog";
import { expandPath, fieldSlots, formatPath, inputAt, parsePath } from "./fields";
import { validateProps } from "./inputs";

const here = dirname(fileURLToPath(import.meta.url));

const base: Omit<BlockBase, "id"> = { x: 0, y: 0, w: 100, h: 100, rotation: 0, opacity: 1, locked: false, hidden: false, flipX: false, flipY: false, start: 0, end: 4, animation: "none", effects: [] };

const component = (id: string, componentId: string, props: Record<string, unknown>, role?: Block["role"]): Block => ({ ...base, id, type: "component", componentId, props, ...(role ? { role } : {}) });

const heading: Block = {
  ...base,
  id: "title",
  type: "text",
  role: "heading",
  text: "Glow all day",
  fontFamily: "Inter",
  fontWeight: 700,
  italic: false,
  underline: false,
  fontSize: 64,
  lineHeight: 1.1,
  letterSpacing: 0,
  textAlign: "left",
  textTransform: "none",
  color: "#fff",
};

/* A two-scene template: a heading and a product card, then a chat. */
const template: Pick<Project, "slides"> = {
  slides: [
    { id: "s1", name: "Product", duration: 4, background: { type: "color", color: "#000" }, blocks: [heading, component("card", "product-card", getSpec("product-card")!.defaults)] },
    { id: "s2", name: "Chat", duration: 6, background: { type: "color", color: "#000" }, blocks: [component("chat", "imessage", getSpec("imessage")!.defaults)] },
  ],
};

describe("catalog", () => {
  /* No exhaustive id list here: every new block would edit the same line. */
  it("lists every block once, each with its own folder", () => {
    const ids = listSpecs().map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ["counter", "imessage", "logo-strip", "product-card", "search-bar"]) assert.ok(ids.includes(id), id);
    for (const id of ids) {
      const folder = [join(here, id), join(here, "text", id)].find((dir) => existsSync(join(dir, "schema.ts")));
      assert.ok(folder, `${id}: no lib/blocks/${id}/schema.ts or lib/blocks/text/${id}/schema.ts`);
    }
  });

  for (const spec of listSpecs()) {
    it(`${spec.id}: defaults satisfy its inputs`, () => {
      assert.deepEqual(validateProps(spec.inputs, spec.defaults), []);
    });

    it(`${spec.id}: every role names a field that exists`, () => {
      for (const field of Object.keys(spec.roles ?? {})) {
        const path = parsePath(field);
        assert.ok(path && inputAt(spec.inputs, path), `${spec.id}: roles key "${field}" is not a field`);
      }
    });
  }
});

describe("roles inside catalog blocks", () => {
  it("resolves image:product in a template to the Product card's image field", () => {
    assert.deepEqual(findRole(template, "image:product"), [{ scene: 0, blockId: "card", field: "image" }]);

    const [slot] = fieldSlots("product-card", getSpec("product-card")!.defaults).filter((f) => f.role === "image:product");
    assert.equal(slot!.path, "image");
    assert.equal(slot!.kind, "image");
    assert.equal(slot!.media?.src, "/blocks/product-card/serum.svg");
    assert.equal(inputAt(getSpec("product-card")!.inputs, parsePath(slot!.path)!)?.kind, "image");
  });

  it("expands a list field to one path per item", () => {
    const targets = findRole(template, "body");
    assert.deepEqual(
      targets.map((t) => t.field),
      ["messages[0].text", "messages[1].text", "messages[2].text", "messages[3].text"],
    );
    assert.ok(targets.every((t) => t.scene === 1 && t.blockId === "chat"));
  });

  it("finds block roles and field roles alike, optionally in one scene", () => {
    assert.deepEqual(findRole(template, "heading"), [
      { scene: 0, blockId: "title" },
      { scene: 0, blockId: "card", field: "name" },
    ]);
    assert.deepEqual(findRole(template, "author", 0), []);
    assert.deepEqual(findRole(template, "author", 1), [{ scene: 1, blockId: "chat", field: "contactName" }]);
  });

  it("counts field roles in a template's roles and lists them on its slots", () => {
    assert.deepEqual(rolesIn(template), ["heading", "body", "benefit", "cta", "price", "author", "image:product"]);
    const card = slotsOf(template).find((s) => s.blockId === "card");
    assert.deepEqual(
      card?.fields?.map((f) => [f.path, f.role]),
      [
        ["image", "image:product"],
        ["name", "heading"],
        ["price", "price"],
        ["compareAtPrice", "price"],
        ["badge", "benefit"],
        ["cta", "cta"],
      ],
    );
  });

  it("ignores a block the catalog does not know", () => {
    assert.deepEqual(fieldSlots("not-a-block", {}), []);
  });
});

describe("field paths", () => {
  it("round-trips concrete and roles-key paths", () => {
    for (const path of ["image", "messages[2].text", "messages[].text", "logos[0]", "product.name"]) {
      assert.equal(formatPath(parsePath(path)!), path);
    }
  });

  it("rejects junk", () => {
    for (const path of ["", "a..b", "a[x]", "1abc", "a[0"]) assert.equal(parsePath(path), null, path);
  });

  it("finds the input behind a concrete path and nothing behind a wrong one", () => {
    const { inputs } = getSpec("imessage")!;
    assert.equal(inputAt(inputs, parsePath("messages[1].text")!)?.kind, "text");
    assert.equal(inputAt(inputs, parsePath("messages[1].side")!)?.kind, "select");
    assert.equal(inputAt(inputs, parsePath("messages[1].nope")!), undefined);
    assert.equal(inputAt(inputs, parsePath("contactName[0]")!), undefined);
  });

  it("expands a role on a list of media to each item", () => {
    const { inputs, defaults } = getSpec("logo-strip")!;
    assert.equal(expandPath(inputs, defaults, "logos").length, (defaults.logos as unknown[]).length);
    assert.deepEqual(expandPath(inputs, { logos: [] }, "logos"), []);
  });
});
