import type { ProjectKind } from "@/lib/editor/types";

/* Each format's colour, as the hub's Start cards and the signed-out landing paint it. */
export const KIND_ART: Record<ProjectKind, string> = {
  image: "linear-gradient(160deg,#efe3cf,#c9a877)",
  carousel: "linear-gradient(160deg,#4cc9f0,#2a7fb8)",
  video: "linear-gradient(160deg,#6ee86e,#2f9e4f)",
};
