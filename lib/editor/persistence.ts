"use client";

import { useMutation, useQuery } from "convex/react";
import type { OptimisticLocalStore } from "convex/browser";
import type { FunctionReturnType } from "convex/server";
import { useCallback, useMemo, useSyncExternalStore } from "react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useActiveOrg } from "@/lib/auth/useActiveOrg";

import type { AspectId, Project, ProjectKind } from "./types";

/*
  Where projects live: Convex, scoped to the organisation Clerk says is active.

  Everything here is a hook, because reads are live queries and writes need the
  authenticated client. The rule the rest of the app relies on is that this is
  the only module that knows a datastore exists — the hub and the studio ask for
  projects and get documents.

  localStorage survives only as the source of the one-time import at the bottom
  of this file. Nothing writes to it any more.
*/

export type ProjectSummary = {
  id: string;
  name: string;
  kind: ProjectKind;
  aspect: AspectId;
  slides: number;
  updatedAt: number;
};

/*
  A row plus the document itself. The hub's cards and its enlarged preview
  render the real document — that is what makes hover playback work — so the
  list carries documents rather than posters.
*/
export type ProjectRecord = ProjectSummary & {
  document: Project;
  /* True for the placeholder a duplicate shows until the server answers. */
  pending: boolean;
};

type ProjectRow = FunctionReturnType<typeof api.projects.list>[number];

/* Ids the server has not minted yet. Long enough not to collide with a real
   Convex id, and recognisable so the card can stay inert until it is replaced. */
const PENDING = "pending:";

function toRecord(row: ProjectRow): ProjectRecord {
  const document = row.document as Project;
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as ProjectKind,
    aspect: row.aspect as AspectId,
    slides: document.slides?.length ?? 0,
    updatedAt: row.updatedAt,
    document,
    pending: row.id.startsWith(PENDING),
  };
}

function noOrg(): never {
  /* The hub and the studio both gate on `useActiveOrg`, so reaching a write
     without one is a bug rather than something a user can do. */
  throw new Error("No active organisation: projects are owned by an organisation");
}

/*
  The org's projects, newest edit first, or `null` while the answer is still on
  its way. An empty array means the org really has none — the hub tells the two
  apart to decide between its skeleton and its empty state.
*/
export function useProjectIndex(): ProjectRecord[] | null {
  const { orgId, isLoaded } = useActiveOrg();
  const rows = useQuery(api.projects.list, orgId ? { orgId } : "skip");
  return useMemo(() => {
    if (!isLoaded) return null;
    /* On a personal account there is no org to scope to; the hub asks the user
       to pick one instead of showing an empty library. */
    if (!orgId) return [];
    return rows ? rows.map(toRecord) : null;
  }, [rows, orgId, isLoaded]);
}

export type ProjectLoad = { status: "loading" } | { status: "missing" } | { status: "ready"; project: Project };

/*
  One project by its id, for `/editor/<id>`. `missing` covers every way an id
  can fail to resolve — deleted, malformed, or owned by an organisation other
  than the active one — because the studio does the same thing in all of them.
  Pass `null` to skip the query.
*/
export function useProject(id: string | null): ProjectLoad {
  const { orgId, isLoaded } = useActiveOrg();
  const row = useQuery(api.projects.get, id && orgId ? { orgId, id } : "skip");

  return useMemo(() => {
    if (!isLoaded || id === null) return { status: "loading" };
    if (!orgId) return { status: "missing" };
    if (row === undefined) return { status: "loading" };
    if (row === null) return { status: "missing" };
    return { status: "ready", project: row.document as Project };
  }, [row, id, orgId, isLoaded]);
}

/*
  Blob and data URLs are dropped before a document is written: an object URL
  dies with the tab, and a data URL would push the document past Convex's size
  limit in a couple of images. The block keeps its geometry and shows a
  placeholder. T-013 replaces both with media ids that survive the round trip.
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

/*
  The studio's autosave. Deliberately its own hook with a stable identity: it is
  called from a zustand subscription, and a function that changed every render
  would tear that subscription down and rebuild it just as often.
*/
export function useSaveProject(): (p: Project) => Promise<void> {
  const { orgId } = useActiveOrg();
  const save = useMutation(api.projects.save);
  return useCallback(
    async (p: Project) => {
      if (!orgId) noOrg();
      await save({ orgId, id: p.id as Id<"projects">, document: stripVolatile(p) });
    },
    [save, orgId],
  );
}

/*
  Creating a project. Stable for the same reason `useSaveProject` is: the studio
  calls it from an effect when it is asked to open `/editor/new`.
*/
export function useCreateProject(): (document: Project) => Promise<string> {
  const { orgId } = useActiveOrg();
  const create = useMutation(api.projects.create);
  return useCallback(
    async (document: Project) => {
      if (!orgId) noOrg();
      return await create({ orgId, document: stripVolatile(document) });
    },
    [create, orgId],
  );
}

/* Rewrite the hub's list in place while a mutation is in flight. */
function patchList(store: OptimisticLocalStore, orgId: string, fn: (rows: ProjectRow[]) => ProjectRow[]) {
  const rows = store.getQuery(api.projects.list, { orgId });
  if (!rows) return;
  store.setQuery(api.projects.list, { orgId }, fn(rows).sort((a, b) => b.updatedAt - a.updatedAt));
}

export type ProjectActions = {
  createProject: (document: Project) => Promise<string>;
  saveProject: (document: Project) => Promise<void>;
  renameProject: (id: string, name: string) => Promise<void>;
  duplicateProject: (id: string) => Promise<string>;
  deleteProject: (id: string) => Promise<void>;
  importLocalProjects: (documents: Project[]) => Promise<number>;
};

/*
  Everything the hub does to a project. Rename, duplicate and delete carry
  optimistic updates, so the grid reacts to the click rather than to the
  round trip; Convex rolls them back if the mutation fails.
*/
export function useProjectActions(): ProjectActions {
  const { orgId } = useActiveOrg();
  const saveProject = useSaveProject();
  const createProject = useCreateProject();

  const importLocal = useMutation(api.projects.importLocal);

  const rename = useMutation(api.projects.rename).withOptimisticUpdate((store, { orgId: org, id, name }) => {
    patchList(store, org, (rows) => {
      const updatedAt = Date.now();
      return rows.map((r) => (r.id === id ? { ...r, name, updatedAt, document: { ...r.document, name, updatedAt } } : r));
    });
  });

  const duplicate = useMutation(api.projects.duplicate).withOptimisticUpdate((store, { orgId: org, id }) => {
    patchList(store, org, (rows) => {
      const source = rows.find((r) => r.id === id);
      if (!source) return rows;
      const pendingId = `${PENDING}${id}` as Id<"projects">;
      const name = `${source.name} copy`;
      const updatedAt = Date.now();
      return [...rows, { ...source, id: pendingId, name, updatedAt, document: { ...source.document, id: pendingId, name, updatedAt } }];
    });
  });

  const remove = useMutation(api.projects.remove).withOptimisticUpdate((store, { orgId: org, id }) => {
    patchList(store, org, (rows) => rows.filter((r) => r.id !== id));
  });

  return {
    createProject,
    saveProject,
    renameProject: async (id, name) => {
      if (!orgId) noOrg();
      await rename({ orgId, id: id as Id<"projects">, name });
    },
    duplicateProject: async (id) => {
      if (!orgId) noOrg();
      return await duplicate({ orgId, id: id as Id<"projects"> });
    },
    deleteProject: async (id) => {
      if (!orgId) noOrg();
      await remove({ orgId, id: id as Id<"projects"> });
    },
    importLocalProjects: async (documents) => {
      if (!orgId) noOrg();
      const ids = await importLocal({ orgId, documents: documents.map(stripVolatile) });
      return ids.length;
    },
  };
}

/* ── The one-time import ──────────────────────────────────────────────────

  Everything below reads the localStorage the studio used before Convex. It is
  a migration path, not a store: nothing writes a project there any more, and
  once a browser's projects have been imported or the offer declined, the keys
  are gone and this code never fires again.
*/

const LEGACY_INDEX_KEY = "contently.projects";
const LEGACY_DECLINED_KEY = "contently.projects.import-declined";
const legacyKey = (id: string) => `contently.project.${id}`;

const legacyListeners = new Set<() => void>();
const notifyLegacy = () => legacyListeners.forEach((l) => l());

/* The snapshot is the stored index string itself, so it only changes when the
   storage does — `useSyncExternalStore` compares it by identity. */
function legacySnapshot() {
  if (window.localStorage.getItem(LEGACY_DECLINED_KEY)) return "";
  return window.localStorage.getItem(LEGACY_INDEX_KEY) ?? "";
}

function subscribeLegacy(cb: () => void) {
  legacyListeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    legacyListeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function readLegacy(raw: string): Project[] {
  if (!raw) return [];
  let index: { id: string }[];
  try {
    index = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(index)) return [];
  return index
    .map((entry) => {
      try {
        const stored = window.localStorage.getItem(legacyKey(entry?.id));
        const document = stored ? (JSON.parse(stored) as Project) : null;
        /* An index entry whose document is gone is nothing to import. */
        return document && Array.isArray(document.slides) ? document : null;
      } catch {
        return null;
      }
    })
    .filter((p): p is Project => p !== null);
}

/* The projects this browser made before Convex, or an empty array once there
   are none to offer. */
export function useLegacyProjects(): Project[] {
  const raw = useSyncExternalStore(subscribeLegacy, legacySnapshot, () => "");
  return useMemo(() => readLegacy(raw), [raw]);
}

/* Called after a successful import: the documents are in Convex, so the copies
   in this browser are the stale ones. */
export function clearLegacyProjects() {
  const raw = window.localStorage.getItem(LEGACY_INDEX_KEY) ?? "";
  try {
    (JSON.parse(raw || "[]") as { id: string }[]).forEach((entry) => window.localStorage.removeItem(legacyKey(entry?.id)));
  } catch {
    /* A corrupt index still loses its own key below. */
  }
  window.localStorage.removeItem(LEGACY_INDEX_KEY);
  window.localStorage.setItem(LEGACY_DECLINED_KEY, "1");
  notifyLegacy();
}

/* "Not now" keeps the documents — someone may want them on another org — and
   only stops the offer. */
export function declineLegacyProjects() {
  window.localStorage.setItem(LEGACY_DECLINED_KEY, "1");
  notifyLegacy();
}
