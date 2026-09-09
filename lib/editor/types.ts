/*
  The editor's document model.

  A Project is one of three kinds — image, carousel or video — and is made of
  Slides (artboards). Every Slide holds an ordered list of Blocks; order is
  z-order, last on top. All geometry is in artboard pixels, never screen
  pixels, so a document renders identically at any zoom and exports 1:1.
*/

export type ProjectKind = "image" | "carousel" | "video";

export type AspectId = "9:16" | "1:1" | "4:5" | "16:9" | "3:4";

export const ASPECTS: Record<AspectId, { w: number; h: number; label: string }> = {
  "9:16": { w: 1080, h: 1920, label: "Story · 9:16" },
  "4:5": { w: 1080, h: 1350, label: "Portrait · 4:5" },
  "1:1": { w: 1080, h: 1080, label: "Square · 1:1" },
  "3:4": { w: 1080, h: 1440, label: "Pin · 3:4" },
  "16:9": { w: 1920, h: 1080, label: "Landscape · 16:9" },
};

export type Shadow = {
  color: string;
  x: number;
  y: number;
  blur: number;
};

export type Adjustments = {
  brightness: number; // 100 = neutral
  contrast: number; // 100
  saturate: number; // 100
  blur: number; // px
  hue: number; // deg
  grayscale: number; // %
};

export const NEUTRAL_ADJUSTMENTS: Adjustments = {
  brightness: 100,
  contrast: 100,
  saturate: 100,
  blur: 0,
  hue: 0,
  grayscale: 0,
};

export type EffectKind = "tint" | "blur" | "grain" | "halftone";

export type Effect = {
  kind: EffectKind;
  /* 0–100 */
  amount: number;
  color?: string;
};

export type Animation = "none" | "pan" | "zoom" | "fade" | "rise";

export type BlockBase = {
  id: string;
  name?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  opacity: number;
  locked: boolean;
  hidden: boolean;
  flipX: boolean;
  flipY: boolean;
  /* Seconds, only meaningful for video projects. */
  start: number;
  end: number;
  animation: Animation;
  effects: Effect[];
  shadow?: Shadow;
};

export type Gradient = {
  angle: number;
  stops: string[];
};

export type TextBlock = BlockBase & {
  type: "text";
  text: string;
  fontFamily: string;
  fontWeight: number;
  italic: boolean;
  underline: boolean;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  textAlign: "left" | "center" | "right" | "justify";
  textTransform: "none" | "uppercase" | "lowercase" | "capitalize";
  color: string;
  gradient?: Gradient;
  /*
    The Instagram "text with background" look: a highlight drawn behind each
    line independently, with padding and rounded ends.
  */
  highlight?: { color: string; padding: number; radius: number };
  stroke?: { color: string; width: number };
  /* Text presets can add a glow; separate from shadow so both can be on. */
  glow?: { color: string; blur: number };
  presetId?: string;
};

export type ImageBlock = BlockBase & {
  type: "image";
  src: string;
  fit: "cover" | "contain";
  /* Focal point for cover fit, 0–100 each axis. */
  focalX: number;
  focalY: number;
  radius: number;
  border?: { width: number; color: string };
  adjustments: Adjustments;
  overlay?: { color: string; opacity: number };
};

export type VideoBlock = Omit<ImageBlock, "type"> & {
  type: "video";
  muted: boolean;
  loop: boolean;
  /* Seconds into the source at which playback begins. */
  trimStart: number;
  volume: number;
  /* Native duration once the metadata has loaded. */
  sourceDuration?: number;
};

export type ShapeKind =
  | "rect"
  | "ellipse"
  | "triangle"
  | "star"
  | "line"
  | "arrow"
  | "diamond"
  | "hexagon";

export type ShapeBlock = BlockBase & {
  type: "shape";
  shape: ShapeKind;
  fill: string;
  gradient?: Gradient;
  stroke?: { color: string; width: number };
  radius: number;
};

export type Block = TextBlock | ImageBlock | VideoBlock | ShapeBlock;
export type BlockType = Block["type"];

export type Background =
  | { type: "color"; color: string }
  | { type: "gradient"; gradient: Gradient }
  | { type: "image"; src: string; focalX: number; focalY: number; adjustments: Adjustments };

export type Slide = {
  id: string;
  name: string;
  background: Background;
  blocks: Block[];
  /* Seconds, video projects only. */
  duration: number;
};

export type AudioTrack = {
  id: string;
  title: string;
  start: number;
  duration: number;
  volume: number;
};

export type Project = {
  id: string;
  name: string;
  kind: ProjectKind;
  aspect: AspectId;
  width: number;
  height: number;
  slides: Slide[];
  audio: AudioTrack[];
  createdAt: number;
  updatedAt: number;
};

export type Viewport = {
  x: number;
  y: number;
  zoom: number;
};

export type Rect = { x: number; y: number; w: number; h: number };

export const SLIDE_GAP = 120;
