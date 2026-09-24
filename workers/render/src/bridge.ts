/*
  The contract with the render page: `window.contently`, published by
  `components/render/RenderStage.tsx` in the app. This declaration is a mirror
  of the one there — the worker ships without the app, so the two cannot share
  a file. Change one and change the other.
*/

export type RenderStatus = "loading" | "ready" | "error";

export type RenderProject = {
  id: string;
  name: string;
  kind: string;
  width: number;
  height: number;
  slides: { id: string; name: string; duration: number }[];
};

export type RenderBridge = {
  status: RenderStatus;
  error: string | null;
  project: RenderProject | null;
  progress: number;
  png(scene: number, scale?: number): Promise<number>;
  mp4(options?: { fps?: number; quality?: "medium" | "high" | "best" }): Promise<number>;
  read(offset: number, length: number): string;
  clear(): void;
};

declare global {
  interface Window {
    contently?: RenderBridge;
  }
}
