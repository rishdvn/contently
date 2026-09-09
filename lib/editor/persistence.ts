"use client";

import { useMemo, useSyncExternalStore } from "react";

import type { Project, ProjectKind } from "./types";

const INDEX_KEY = "contently.projects";
const key = (id: string) => `contently.project.${id}`;

export type ProjectSummary = {
  id: string;
  name: string;
  kind: ProjectKind;
  aspect: string;
  slides: number;
  updatedAt: number;
};

function readIndex(): ProjectSummary[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(INDEX_KEY) ?? "[]");
  } catch {
    return [];
  }
}

const listeners = new Set<() => void>();

function writeIndex(list: ProjectSummary[]) {
  window.localStorage.setItem(INDEX_KEY, JSON.stringify(list));
  listeners.forEach((l) => l());
}

/*
  Live view of the project index for the hub. The snapshot is the raw JSON
  string so it is stable between writes; parsing happens in the memo.
*/
export function useProjectIndex(): ProjectSummary[] | null {
  const raw = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      window.addEventListener("storage", cb);
      return () => {
        listeners.delete(cb);
        window.removeEventListener("storage", cb);
      };
    },
    () => window.localStorage.getItem(INDEX_KEY) ?? "[]",
    () => null,
  );
  return useMemo(() => {
    if (raw === null) return null;
    try {
      return (JSON.parse(raw) as ProjectSummary[]).sort((a, b) => b.updatedAt - a.updatedAt);
    } catch {
      return [];
    }
  }, [raw]);
}

export function listProjects(): ProjectSummary[] {
  return readIndex().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadProject(id: string): Project | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(id));
    return raw ? (JSON.parse(raw) as Project) : null;
  } catch {
    return null;
  }
}

/*
  Blob and data URLs from uploads are dropped before saving: object URLs die
  with the tab, and data URLs would blow through the storage quota in a few
  images. The block keeps its geometry and shows a placeholder on reload.
*/
function stripVolatile(p: Project): Project {
  const scrub = (src: string) => (src.startsWith("blob:") || src.startsWith("data:") ? "" : src);
  return {
    ...p,
    slides: p.slides.map((s) => ({
      ...s,
      background: s.background.type === "image" ? { ...s.background, src: scrub(s.background.src) } : s.background,
      blocks: s.blocks.map((b) => ("src" in b ? { ...b, src: scrub(b.src) } : b)),
    })),
  };
}

export function saveProject(p: Project) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(p.id), JSON.stringify(stripVolatile(p)));
    const summary: ProjectSummary = {
      id: p.id,
      name: p.name,
      kind: p.kind,
      aspect: p.aspect,
      slides: p.slides.length,
      updatedAt: p.updatedAt,
    };
    const rest = readIndex().filter((x) => x.id !== p.id);
    writeIndex([summary, ...rest]);
  } catch {
    /* Quota exceeded — the in-memory document is still intact. */
  }
}

export function deleteProject(id: string) {
  window.localStorage.removeItem(key(id));
  writeIndex(readIndex().filter((x) => x.id !== id));
}

export function renameProject(id: string, name: string) {
  const p = loadProject(id);
  if (!p) return;
  saveProject({ ...p, name, updatedAt: Date.now() });
}

export function duplicateProject(id: string, newId: string): Project | null {
  const p = loadProject(id);
  if (!p) return null;
  const copy = { ...p, id: newId, name: `${p.name} copy`, updatedAt: Date.now() };
  saveProject(copy);
  return copy;
}
