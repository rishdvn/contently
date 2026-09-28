/*
  The carousel ZIP writer: `npm test`. Reads the archive back by its central
  directory, the way an unzip tool does, rather than trusting the writer.
*/
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { crc32, zipStore } from "./zip";

const bytes = (s: string) => new TextEncoder().encode(s);

function readZip(zip: Uint8Array) {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const end = zip.length - 22;
  assert.equal(view.getUint32(end, true), 0x06054b50, "end of central directory");
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const files: { name: string; data: Uint8Array; crc: number }[] = [];
  for (let i = 0; i < count; i++) {
    assert.equal(view.getUint32(at, true), 0x02014b50, "central directory record");
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const offset = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(zip.subarray(at + 46, at + 46 + nameLength));
    assert.equal(view.getUint32(offset, true), 0x04034b50, "local header");
    const start = offset + 30 + view.getUint16(offset + 26, true);
    files.push({ name, crc, data: zip.subarray(start, start + size) });
    at += 46 + nameLength;
  }
  return files;
}

describe("zip", () => {
  it("computes the standard CRC-32", () => {
    assert.equal(crc32(bytes("123456789")), 0xcbf43926);
    assert.equal(crc32(new Uint8Array()), 0);
  });

  it("stores entries in the order given, byte for byte", () => {
    const entries = ["01.png", "02.png", "03.png", "10.png"].map((name, i) => ({ name, data: bytes(`slide ${i + 1}`.repeat(i + 1)) }));
    const files = readZip(zipStore(entries));
    assert.deepEqual(
      files.map((f) => f.name),
      ["01.png", "02.png", "03.png", "10.png"],
    );
    files.forEach((file, i) => {
      assert.deepEqual(file.data, entries[i].data);
      assert.equal(file.crc, crc32(entries[i].data));
    });
  });

  it("writes an empty archive", () => {
    assert.deepEqual(readZip(zipStore([])), []);
  });
});
