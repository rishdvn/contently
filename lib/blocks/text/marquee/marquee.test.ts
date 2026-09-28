/*
  The marquee's loop, frame by frame: `npm test`. Rendered to markup, so it
  checks what the canvas and the exporter are given, without a browser.
*/
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { RenderContext } from "../../registry";
import { measure } from "../measure";

import { Marquee } from "./Marquee";
import { marquee } from "./schema";

const box = { width: 1080, height: 270 };
const props = { ...marquee.defaults, speed: 400 };
const frame = (ctx: Partial<RenderContext>, p = props) =>
  renderToStaticMarkup(createElement(Marquee, { props: p, ctx: { mode: "video", progress: 0, time: 0, duration: 5, ...box, ...ctx } }));
const shift = (html: string) => Number(/translateX\((-?[\d.]+)%\)/.exec(html)?.[1] ?? 0);

/* Seconds for the track to travel one group, as the render computes it. */
const copyEm = measure(props.text, { weight: 700 }) + measure(props.separator, { weight: 700 }) + 1.2;
const copies = Math.ceil(box.width / (copyEm * box.height * 0.4)) + 1;
const period = (copies * copyEm) / (3 * (props.speed / 100));

describe("marquee", () => {
  it("lays the track out as two identical groups, each wider than the box", () => {
    const html = frame({});
    const groups = html.match(/<div style="display:flex;flex-shrink:0"><span.*?<\/div>/g) ?? [];
    assert.equal(groups.length, 2);
    assert.equal(groups[0], groups[1]);
    assert.ok(copies * copyEm * box.height * 0.4 > box.width);
  });

  it("shows one pass from the left edge as a still", () => {
    assert.equal(shift(frame({ mode: "static", time: 5, progress: 1 })), 0);
  });

  it("moves by a share of the track, and is back where it started after one period", () => {
    const quarter = shift(frame({ time: period / 4 }));
    assert.ok(Math.abs(quarter - -12.5) < 1e-6, String(quarter));
    assert.equal(shift(frame({ time: period })), shift(frame({ time: 0 })));
    assert.ok(Math.abs(shift(frame({ time: period * 1.5 })) - shift(frame({ time: period * 0.5 }))) < 1e-6);
  });

  it("runs the other way when asked", () => {
    const left = shift(frame({ time: period / 4 }));
    const right = shift(frame({ time: period / 4 }, { ...props, direction: "right" }));
    assert.ok(Math.abs(left - -12.5) < 1e-6 && Math.abs(right - -37.5) < 1e-6, `${left} ${right}`);
  });

  it("scrolls with the clock, not the block's length", () => {
    assert.equal(frame({ time: 1.2, duration: 5, progress: 0.24 }), frame({ time: 1.2, duration: 10, progress: 0.12 }));
  });
});
