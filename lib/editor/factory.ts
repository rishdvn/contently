import { nanoid } from "nanoid";

import {
  ASPECTS,
  NEUTRAL_ADJUSTMENTS,
  type AspectId,
  type Block,
  type BlockBase,
  type ImageBlock,
  type Project,
  type ProjectKind,
  type ShapeBlock,
  type ShapeKind,
  type Slide,
  type TextBlock,
  type VideoBlock,
} from "./types";

export const uid = () => nanoid(10);

const DEFAULT_VIDEO_DURATION = 7;

export function baseBlock(partial: Partial<BlockBase> & Pick<BlockBase, "x" | "y" | "w" | "h">): BlockBase {
  return {
    id: uid(),
    rotation: 0,
    opacity: 100,
    locked: false,
    hidden: false,
    flipX: false,
    flipY: false,
    start: 0,
    end: DEFAULT_VIDEO_DURATION,
    animation: "none",
    effects: [],
    ...partial,
  };
}

export function textBlock(partial: Partial<TextBlock> & Pick<BlockBase, "x" | "y" | "w">): TextBlock {
  return {
    ...baseBlock({ h: 120, ...partial }),
    type: "text",
    text: "Add your text",
    fontFamily: "Inter",
    fontWeight: 600,
    italic: false,
    underline: false,
    fontSize: 64,
    lineHeight: 1.15,
    letterSpacing: 0,
    textAlign: "center",
    textTransform: "none",
    color: "#ffffff",
    ...partial,
  };
}

export function imageBlock(partial: Partial<ImageBlock> & Pick<ImageBlock, "src" | "x" | "y" | "w" | "h">): ImageBlock {
  return {
    ...baseBlock(partial),
    type: "image",
    fit: "cover",
    focalX: 50,
    focalY: 50,
    radius: 0,
    adjustments: { ...NEUTRAL_ADJUSTMENTS },
    ...partial,
  };
}

export function videoBlock(partial: Partial<VideoBlock> & Pick<VideoBlock, "src" | "x" | "y" | "w" | "h">): VideoBlock {
  return {
    ...baseBlock(partial),
    type: "video",
    fit: "cover",
    focalX: 50,
    focalY: 50,
    radius: 0,
    adjustments: { ...NEUTRAL_ADJUSTMENTS },
    muted: true,
    loop: true,
    trimStart: 0,
    volume: 100,
    ...partial,
  };
}

export function shapeBlock(shape: ShapeKind, partial: Partial<ShapeBlock> & Pick<BlockBase, "x" | "y" | "w" | "h">): ShapeBlock {
  const thin = shape === "line" || shape === "arrow";
  return {
    ...baseBlock(partial),
    type: "shape",
    shape,
    fill: thin ? "transparent" : "#f5f5f5",
    stroke: thin ? { color: "#f5f5f5", width: 8 } : undefined,
    radius: shape === "rect" ? 24 : 0,
    ...partial,
  };
}

export function slide(partial: Partial<Slide> = {}): Slide {
  return {
    id: uid(),
    name: "Slide",
    background: { type: "color", color: "#111111" },
    blocks: [],
    duration: DEFAULT_VIDEO_DURATION,
    ...partial,
  };
}

export const DEFAULT_ASPECT: Record<ProjectKind, AspectId> = {
  image: "4:5",
  carousel: "4:5",
  video: "9:16",
};

export function project(kind: ProjectKind, name?: string): Project {
  const aspect = DEFAULT_ASPECT[kind];
  const { w, h } = ASPECTS[aspect];
  const now = Date.now();
  const slides =
    kind === "carousel"
      ? [slide({ name: "Slide 1" }), slide({ name: "Slide 2" }), slide({ name: "Slide 3" })]
      : [slide({ name: kind === "video" ? "Scene 1" : "Slide 1" })];
  return {
    id: uid(),
    name: name ?? { image: "New image", carousel: "New carousel", video: "New video" }[kind],
    kind,
    aspect,
    width: w,
    height: h,
    slides,
    audio: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function cloneBlock(b: Block, offset = 40): Block {
  return { ...structuredClone(b), id: uid(), x: b.x + offset, y: b.y + offset };
}
