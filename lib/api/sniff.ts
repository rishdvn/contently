/*
  What a file is, from its first bytes: kind, pixel size, and for video the
  duration. The API imports media from a URL or from a raw upload, and a
  `media` row needs width and height — the Media page lays its grid out by
  aspect — but a Convex function cannot decode an image or a video. Headers are
  enough for every format the studio plays: PNG, JPEG, GIF, WebP, and MP4/MOV.

  Pure functions over bytes, so they are unit-tested (`sniff.test.ts`).
*/

export type Sniffed = {
  kind: "image" | "video";
  mime: string;
  width: number;
  height: number;
  duration?: number;
  /* Video: the video track's sample-entry code, `avc1` for H.264, `hvc1` or
     `hev1` for HEVC, `av01`, `vp09`… Absent when the header does not say. */
  codec?: string;
};

const u16be = (b: Uint8Array, i: number) => (b[i]! << 8) | b[i + 1]!;
const u16le = (b: Uint8Array, i: number) => b[i]! | (b[i + 1]! << 8);
const u24le = (b: Uint8Array, i: number) => b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16);
const u32be = (b: Uint8Array, i: number) => ((b[i]! << 24) >>> 0) + ((b[i + 1]! << 16) | (b[i + 2]! << 8) | b[i + 3]!);
const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));

function png(b: Uint8Array): Sniffed | null {
  if (b.length < 24 || u32be(b, 0) !== 0x89504e47 || ascii(b, 12, 4) !== "IHDR") return null;
  return { kind: "image", mime: "image/png", width: u32be(b, 16), height: u32be(b, 20) };
}

function gif(b: Uint8Array): Sniffed | null {
  if (b.length < 10 || ascii(b, 0, 3) !== "GIF") return null;
  return { kind: "image", mime: "image/gif", width: u16le(b, 6), height: u16le(b, 8) };
}

/* The frame header of the first start-of-frame marker; the markers before it
   (EXIF, ICC profiles) are skipped by their lengths. */
function jpeg(b: Uint8Array): Sniffed | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1]!;
    if (marker === 0xff) {
      i++;
      continue;
    }
    const length = u16be(b, i + 2);
    const sof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (sof) return { kind: "image", mime: "image/jpeg", width: u16be(b, i + 7), height: u16be(b, i + 5) };
    i += 2 + length;
  }
  return null;
}

function webp(b: Uint8Array): Sniffed | null {
  if (b.length < 30 || ascii(b, 0, 4) !== "RIFF" || ascii(b, 8, 4) !== "WEBP") return null;
  const chunk = ascii(b, 12, 4);
  const size = (width: number, height: number): Sniffed => ({ kind: "image", mime: "image/webp", width, height });
  if (chunk === "VP8X") return size(u24le(b, 24) + 1, u24le(b, 27) + 1);
  if (chunk === "VP8 ") return size(u16le(b, 26) & 0x3fff, u16le(b, 28) & 0x3fff);
  if (chunk === "VP8L") {
    const bits = b[21]! | (b[22]! << 8) | (b[23]! << 16) | (b[24]! << 24);
    return size((bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1);
  }
  return null;
}

/*
  ISO base media (MP4, MOV): the movie header's duration, the size of the
  first track that has one — the video track, since audio tracks declare 0×0 —
  and the video track's codec, from the first entry of its sample description
  (`stsd`) in the track whose handler is `vide`. `moov` may sit at either end
  of the file; the whole file is here either way.
*/
function mp4(b: Uint8Array): Sniffed | null {
  if (b.length < 12 || ascii(b, 4, 4) !== "ftyp") return null;
  const brand = ascii(b, 8, 4);
  let duration: number | undefined;
  let width = 0;
  let height = 0;
  let codec: string | undefined;
  /* The track being walked: its handler (`vide`, `soun`, …) and its first sample entry. */
  let track: { handler?: string; format?: string } = {};

  const walk = (start: number, end: number) => {
    let i = start;
    while (i + 8 <= end) {
      let size = u32be(b, i);
      const type = ascii(b, i + 4, 4);
      let header = 8;
      if (size === 1) {
        /* 64-bit size; files here are well under 4 GB, so the high word is 0. */
        size = u32be(b, i + 12);
        header = 16;
      } else if (size === 0) size = end - i;
      if (size < header || i + size > end) return;
      const body = i + header;
      if (type === "trak") {
        track = {};
        walk(body, i + size);
        if (!codec && track.handler === "vide" && track.format) codec = track.format;
      } else if (type === "moov" || type === "mdia" || type === "minf" || type === "stbl") walk(body, i + size);
      else if (type === "hdlr" && body + 12 <= end) track.handler = ascii(b, body + 8, 4);
      else if (type === "stsd" && body + 16 <= end && u32be(b, body + 4) > 0) track.format ??= ascii(b, body + 12, 4);
      else if (type === "mvhd") {
        const v1 = b[body] === 1;
        const timescale = u32be(b, body + (v1 ? 20 : 12));
        const units = v1 ? u32be(b, body + 24) * 2 ** 32 + u32be(b, body + 28) : u32be(b, body + 16);
        if (timescale) duration = units / timescale;
      } else if (type === "tkhd" && !width) {
        /* Width and height are the last two fields, 16.16 fixed point. */
        const w = u32be(b, i + size - 8) / 65536;
        const h = u32be(b, i + size - 4) / 65536;
        if (w && h) {
          width = Math.round(w);
          height = Math.round(h);
        }
      }
      i += size;
    }
  };
  walk(0, b.length);
  if (!width || !height) return null;
  return { kind: "video", mime: brand.startsWith("qt") ? "video/quicktime" : "video/mp4", width, height, ...(duration !== undefined ? { duration } : {}), ...(codec ? { codec } : {}) };
}

export function sniff(bytes: Uint8Array): Sniffed | null {
  return png(bytes) ?? jpeg(bytes) ?? gif(bytes) ?? webp(bytes) ?? mp4(bytes);
}
