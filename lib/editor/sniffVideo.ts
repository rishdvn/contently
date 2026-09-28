/*
  Which codec a video was recorded in, read from its MP4/MOV container rather
  than decoded: the four-character code of the first video track's sample
  description (`moov/trak/mdia/minf/stbl/stsd`). An iPhone records HEVC
  (`hvc1`) by default, and Chrome decodes HEVC only with hardware support, so
  the uploader's Mac plays a clip that a teammate's Linux machine, and the
  render worker, show black. Knowing at upload is what lets us say so, and what
  queues the clip for the worker to re-encode.

  It also reads the track's size as a browser paints it (the track header's
  width and height, turned by its matrix when the phone was held upright): a
  browser without the decoder loads the metadata but reports a 0×0 picture.

  Names follow ffprobe ("h264", "hevc"), as `media.codec` does. Anything that
  is not an MP4 or MOV (WebM, say) answers undefined, as does a file this
  cannot parse: an unknown codec is left for the worker to probe.

  `sniffVideo` reads slices of the file, never the whole thing: box headers
  until `moov`, then `moov` itself, which is kilobytes even for a long 4K clip.
  `readMovie` is the pure half, over the bytes of `moov`, and is unit-tested
  (`sniffVideo.test.ts`).
*/

export type SniffedVideo = { codec?: string; width?: number; height?: number };

const CODECS: Record<string, string> = {
  avc1: "h264",
  avc3: "h264",
  hvc1: "hevc",
  hev1: "hevc",
  /* Dolby Vision, which newer iPhones record: HEVC underneath. */
  dvh1: "hevc",
  dvhe: "hevc",
  av01: "av1",
  vp09: "vp9",
  vp08: "vp8",
  mp4v: "mpeg4",
};

/* `moov` past this is not a phone recording; don't read it into memory. */
const MAX_MOOV_BYTES = 64 * 1024 * 1024;

const u32 = (b: Uint8Array, i: number) => ((b[i]! << 24) >>> 0) + ((b[i + 1]! << 16) | (b[i + 2]! << 8) | b[i + 3]!);
const fourcc = (b: Uint8Array, i: number) => String.fromCharCode(b[i]!, b[i + 1]!, b[i + 2]!, b[i + 3]!);

type Box = { type: string; body: number; end: number };

/* The boxes directly inside [start, end). */
function children(b: Uint8Array, start: number, end: number): Box[] {
  const boxes: Box[] = [];
  let i = start;
  while (i + 8 <= end) {
    let size = u32(b, i);
    let header = 8;
    if (size === 1) {
      /* 64-bit size. Nothing inside `moov` comes near 4 GB, so the high word is 0. */
      size = u32(b, i + 12);
      header = 16;
    } else if (size === 0) size = end - i;
    if (size < header || i + size > end) break;
    boxes.push({ type: fourcc(b, i + 4), body: i + header, end: i + size });
    i += size;
  }
  return boxes;
}

const child = (b: Uint8Array, box: Box | undefined, type: string) => (box ? children(b, box.body, box.end).find((c) => c.type === type) : undefined);

/* A track header's width and height (16.16, the last two fields), swapped
   when its matrix turns the picture a quarter: a = d = 0. The matrix is the
   nine fields before them. */
function trackSize(b: Uint8Array, tkhd: Box | undefined) {
  if (!tkhd || tkhd.end - tkhd.body < 84) return {};
  const width = Math.round(u32(b, tkhd.end - 8) / 65536);
  const height = Math.round(u32(b, tkhd.end - 4) / 65536);
  if (!width || !height) return {};
  const matrix = tkhd.end - 8 - 36;
  const quarter = u32(b, matrix) === 0 && u32(b, matrix + 16) === 0;
  return quarter ? { width: height, height: width } : { width, height };
}

/* `moov` is the whole buffer, header included. */
export function readMovie(moov: Uint8Array): SniffedVideo | undefined {
  const [movie] = children(moov, 0, moov.length);
  if (movie?.type !== "moov") return undefined;
  for (const trak of children(moov, movie.body, movie.end).filter((box) => box.type === "trak")) {
    const mdia = child(moov, trak, "mdia");
    /* The handler type sits after the version/flags and a pre-defined (MP4) or
       component type (QuickTime) field; the two layouts agree on the offset. */
    const hdlr = child(moov, mdia, "hdlr");
    if (!hdlr || fourcc(moov, hdlr.body + 8) !== "vide") continue;
    const size = trackSize(moov, child(moov, trak, "tkhd"));
    const stsd = child(moov, child(moov, child(moov, mdia, "minf"), "stbl"), "stsd");
    /* Version/flags, the entry count, then the first entry's size and type. */
    if (!stsd || stsd.body + 16 > stsd.end) return size;
    const code = fourcc(moov, stsd.body + 12);
    return { codec: CODECS[code] ?? code.trim().toLowerCase(), ...size };
  }
  return undefined;
}

async function bytes(file: Blob, start: number, end: number) {
  return new Uint8Array(await file.slice(start, end).arrayBuffer());
}

export async function sniffVideo(file: Blob): Promise<SniffedVideo | undefined> {
  let offset = 0;
  /* A handful of top-level boxes (ftyp, wide, mdat, moov, free…); a file with
     hundreds is not something this understands. */
  for (let step = 0; step < 64 && offset + 8 <= file.size; step++) {
    const head = await bytes(file, offset, offset + 16);
    let size = u32(head, 0);
    if (size === 1) size = u32(head, 8) * 2 ** 32 + u32(head, 12);
    else if (size === 0) size = file.size - offset;
    if (size < 8) return undefined;
    const type = fourcc(head, 4);
    if (step === 0 && type !== "ftyp") return undefined;
    if (type === "moov") return size > MAX_MOOV_BYTES ? undefined : readMovie(await bytes(file, offset, offset + size));
    offset += size;
  }
  return undefined;
}
