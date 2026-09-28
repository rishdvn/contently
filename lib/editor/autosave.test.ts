/*
  The autosave engine: `npm test`.
*/
import assert from "node:assert/strict";
import { beforeEach, afterEach, describe, it, mock } from "node:test";

import { Autosaver, type SaveStatus } from "./autosave";

/* Lets settled promises run their callbacks; setImmediate is not mocked. */
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

type Call = { doc: string; resolve: () => void; reject: (e: unknown) => void };

function harness(opts: { backoff?: number[] } = {}) {
  const calls: Call[] = [];
  const saver = new Autosaver<string>({
    write: (doc) => new Promise<void>((resolve, reject) => calls.push({ doc, resolve, reject })),
    backoff: opts.backoff,
  });
  const seen: SaveStatus["state"][] = [];
  saver.subscribe((s) => seen.push(s.state));
  return { saver, calls, seen };
}

describe("Autosaver", () => {
  beforeEach(() => mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1_000_000 }));
  afterEach(() => mock.timers.reset());

  it("writes once, a beat after the last change", async () => {
    const { saver, calls } = harness();
    saver.change("a");
    mock.timers.tick(300);
    saver.change("ab");
    mock.timers.tick(300);
    assert.equal(calls.length, 0);
    assert.equal(saver.status.state, "saving");
    mock.timers.tick(200);
    assert.deepEqual(calls.map((c) => c.doc), ["ab"]);
    calls[0].resolve();
    await settle();
    assert.deepEqual(saver.status, { state: "saved", at: 1_000_800 });
    assert.equal(saver.dirty, false);
  });

  it("keeps one write in flight and sends only the latest after it", async () => {
    const { saver, calls } = harness();
    saver.change("a");
    mock.timers.tick(500);
    saver.change("b");
    mock.timers.tick(500);
    saver.change("c");
    mock.timers.tick(500);
    assert.deepEqual(calls.map((c) => c.doc), ["a"]);
    calls[0].resolve();
    await settle();
    assert.deepEqual(calls.map((c) => c.doc), ["a", "c"]);
    assert.equal(saver.status.state, "saving");
    calls[1].resolve();
    await settle();
    assert.equal(saver.status.state, "saved");
  });

  it("retries a failed write with backoff, and the manual retry skips the wait", async () => {
    const { saver, calls } = harness({ backoff: [1000, 4000] });
    saver.change("a");
    mock.timers.tick(500);
    calls[0].reject(new Error("boom"));
    await settle();
    assert.deepEqual(saver.status, { state: "failed", offline: false, retryAt: 1_000_500 + 1000 });
    assert.equal(saver.dirty, true);

    /* Edits while failing wait for the backoff rather than writing at once. */
    saver.change("ab");
    mock.timers.tick(999);
    assert.equal(calls.length, 1);
    mock.timers.tick(1);
    assert.deepEqual(calls.map((c) => c.doc), ["a", "ab"]);
    calls[1].reject(new Error("boom"));
    await settle();
    assert.equal(saver.status.state === "failed" && saver.status.retryAt, 1_001_500 + 4000);

    saver.retry();
    assert.equal(calls.length, 3);
    calls[2].resolve();
    await settle();
    assert.equal(saver.status.state, "saved");
    assert.equal(saver.lastError, null);
  });

  it("reports offline while changes are unsaved, and retries on reconnect", async () => {
    const { saver, calls } = harness({ backoff: [60_000] });
    saver.setOnline(false);
    assert.equal(saver.status.state, "idle");
    saver.change("a");
    assert.deepEqual(saver.status, { state: "failed", offline: true, retryAt: null });
    mock.timers.tick(500);
    calls[0].reject(new Error("offline"));
    await settle();
    saver.setOnline(true);
    assert.equal(calls.length, 2);
    calls[1].resolve();
    await settle();
    assert.equal(saver.status.state, "saved");
  });

  it("calls a write that never answers not saved", async () => {
    const { saver } = harness();
    saver.change("a");
    mock.timers.tick(500);
    assert.equal(saver.status.state, "saving");
    mock.timers.tick(10_000);
    assert.equal(saver.status.state, "failed");
  });

  it("flush writes now and resolves once clean", async () => {
    const { saver, calls } = harness();
    saver.change("a");
    const flushed = saver.flush();
    assert.deepEqual(calls.map((c) => c.doc), ["a"]);
    calls[0].resolve();
    assert.equal(await flushed, true);
    assert.equal(await saver.flush(), true);
  });

  it("close sends what is pending and stops retrying", async () => {
    const { saver, calls } = harness();
    saver.change("a");
    saver.close();
    assert.deepEqual(calls.map((c) => c.doc), ["a"]);
    calls[0].reject(new Error("boom"));
    await settle();
    mock.timers.tick(60_000);
    assert.equal(calls.length, 1);
  });
});
