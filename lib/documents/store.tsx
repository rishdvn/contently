"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { answer, patchFor, planSkill, type Answer, type Patch, type SkillPlan } from "./agent";
import { appendSection, bodyToMarkdown, markdownToBody, replaceSection } from "./markdown";
import { brandTypes, docTypes } from "./registry";
import { buildSeed, BRAND_ID } from "./seed";
import type {
  Activity,
  Author,
  Body,
  Citation,
  DocStatus,
  DocType,
  Document,
  Filter,
  Freshness,
  Message,
  PropertyValue,
  Relation,
  RelationType,
  SavedFilter,
  Subtype,
  Thread,
  Version,
} from "./types";

/*
  The document layer's state, held on the client and mirrored to localStorage.
  This stands in for the `documents / document_relations / document_versions /
  chat_threads` tables until there is a backend; every action is shaped like
  the tool the agent will eventually call (`create_document`, `update_document`
  with section-level operations, `propose_diff`).
*/

const STORAGE_KEY = "contently.documents.v3";

type State = {
  docs: Document[];
  relations: Relation[];
  versions: Version[];
  activity: Activity[];
  threads: Thread[];
  citations: Record<string, Citation>;
  savedFilters: SavedFilter[];
};

type Store = State & {
  hydrated: boolean;
  now: Date;
  doc: (id: string) => Document | undefined;
  thread: (id: string) => Thread | undefined;

  /* documents */
  createBlank: (type: DocType, subtype: Subtype | null) => string;
  updateBody: (id: string, body: Body) => void;
  commitEdit: (id: string, summary?: string) => void;
  setTitle: (id: string, title: string) => void;
  setStatus: (ids: string[], status: DocStatus) => void;
  setOwner: (ids: string[], owner: string) => void;
  setProperty: (id: string, key: string, value: PropertyValue | null) => void;
  setChannels: (id: string, channels: Document["channels"]) => void;
  verify: (ids: string[], days: number | null) => void;
  flagOutdated: (ids: string[], note?: string) => void;
  requestRefresh: (ids: string[]) => void;
  clearFreshness: (ids: string[]) => void;
  addRelation: (from: string, type: RelationType, to: string, anchor?: string | null) => void;
  removeRelation: (from: string, type: RelationType, to: string) => void;
  archive: (ids: string[]) => void;
  restore: (ids: string[]) => void;
  duplicate: (id: string) => string;
  restoreVersion: (docId: string, versionId: string) => void;
  applyPatch: (docId: string, patch: Patch, opts?: { runId?: string | null; threadId?: string | null }) => void;
  resolveDiffSection: (docId: string, anchor: string, accept: boolean) => void;
  resolveDiffAll: (docId: string, accept: boolean) => void;
  markPatchSeen: (docId: string) => void;

  /* chat */
  createThread: (opts?: { title?: string; docIds?: string[]; scopedDocId?: string | null }) => string;
  sendMessage: (threadId: string, text: string, context: string[], skill?: { type: DocType; subtype: Subtype | null } | null) => void;
  resolveReview: (threadId: string, messageId: string, result: { chosen?: number; fields?: { label: string; items: string[] }[] }) => void;
  attachToThread: (threadId: string, docIds: string[]) => void;
  detachFromThread: (threadId: string, docId: string) => void;
  ask: (docId: string, question: string) => Answer;

  /* filters */
  saveFilter: (label: string, filters: Filter[]) => void;
  deleteFilter: (id: string) => void;

  resetDemo: () => void;
};

const Ctx = createContext<Store | null>(null);

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
const iso = () => new Date().toISOString();

const withBody = (d: Document, body: Body, extra?: Partial<Document>): Document => ({
  ...d,
  body,
  bodyMd: bodyToMarkdown(body),
  updatedAt: iso(),
  ...extra,
});

const patchThread = (s: State, threadId: string, fn: (t: Thread) => Thread): State => ({
  ...s,
  threads: s.threads.map((t) => (t.id === threadId ? fn({ ...t, updatedAt: iso() }) : t)),
});

const patchMessage = (s: State, threadId: string, messageId: string, fn: (m: Message) => Message): State =>
  patchThread(s, threadId, (t) => ({ ...t, messages: t.messages.map((m) => (m.id === messageId ? fn(m) : m)) }));

function persist(state: State) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* Storage full or unavailable: the session still works, it just won't survive a reload. */
  }
}

function load(): State | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as State;
    if (!Array.isArray(parsed.docs) || !Array.isArray(parsed.threads)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function seedState(): State {
  const s = buildSeed(new Date());
  return {
    docs: s.docs,
    relations: s.relations,
    versions: s.versions,
    activity: s.activity,
    threads: s.threads,
    citations: s.citations,
    savedFilters: s.savedFilters,
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(() => seedState());
  const [hydrated, setHydrated] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  /* Tracks user edits that have not yet been folded into a version. */
  const dirty = useRef<Set<string>>(new Set());

  /*
    Hydrate from storage after mount so the server and first client render
    agree. localStorage is the external system being synchronised here, which
    is the one case the set-state-in-effect rule is written to allow.
  */
  useEffect(() => {
    const stored = load();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from localStorage, see above
    if (stored) setState(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => persist(state), 250);
    return () => clearTimeout(t);
  }, [state, hydrated]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const later = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timers.current.push(t);
    return t;
  }, []);

  /* ----------------------------------------------------------- helpers --- */

  const log = useCallback(
    (s: State, a: Omit<Activity, "id" | "at">): State => ({
      ...s,
      activity: [{ ...a, id: uid("act"), at: iso() }, ...s.activity],
    }),
    [],
  );

  const patchDoc = useCallback((s: State, id: string, fn: (d: Document) => Document): State => {
    return { ...s, docs: s.docs.map((d) => (d.id === id ? fn(d) : d)) };
  }, []);

  const addVersion = useCallback((s: State, doc: Document, author: Author, summary: string, runId: string | null): State => {
    const version = doc.version;
    return {
      ...s,
      versions: [
        ...s.versions,
        { id: uid("ver"), docId: doc.id, version, body: doc.body, bodyMd: doc.bodyMd, properties: doc.properties, author, runId, summary, createdAt: iso() },
      ],
    };
  }, []);

  /* --------------------------------------------------------- documents --- */

  const createBlank = useCallback(
    (type: DocType, subtype: Subtype | null) => {
      const id = uid("doc");
      const meta = docTypes[type];
      const md = meta.sections.map((h) => `## ${h}\n\n`).join("\n");
      const body = markdownToBody(md);
      const now = iso();
      const doc: Document = {
        id,
        brandId: BRAND_ID,
        type,
        subtype,
        title: `Untitled ${meta.label.toLowerCase()}`,
        status: "draft",
        version: 1,
        properties: {},
        body,
        bodyMd: bodyToMarkdown(body),
        createdBy: "user",
        runId: null,
        channels: [],
        accounts: ["@terraclays"],
        tags: [],
        freshness: meta.living ? { kind: "unverified" } : null,
        owner: "Hanna Moore",
        createdAt: now,
        updatedAt: now,
        missingSections: [...meta.sections],
        pendingDiff: null,
        lastPatch: null,
        bodyRevision: 0,
      };
      setState((s) => {
        let n = { ...s, docs: [doc, ...s.docs] };
        n = addVersion(n, doc, "user", "Started blank from the template", null);
        n = log(n, { docId: id, kind: "created", author: "user", text: `Started a blank ${meta.label.toLowerCase()}` });
        return n;
      });
      return id;
    },
    [addVersion, log],
  );

  const updateBody = useCallback(
    (id: string, body: Body) => {
      dirty.current.add(id);
      setState((s) => patchDoc(s, id, (d) => withBody(d, body)));
    },
    [patchDoc],
  );

  const commitEdit = useCallback(
    (id: string, summary = "Edited in place") => {
      if (!dirty.current.has(id)) return;
      dirty.current.delete(id);
      setState((s) => {
        const d = s.docs.find((x) => x.id === id);
        if (!d) return s;
        const next = { ...d, version: d.version + 1, updatedAt: iso() };
        let n = patchDoc(s, id, () => next);
        n = addVersion(n, next, "user", summary, null);
        n = log(n, { docId: id, kind: "edited", author: "user", text: `${summary} — ${docTypes[d.type].label} ${d.title.split(" — ")[0]}` });
        return n;
      });
    },
    [addVersion, log, patchDoc],
  );

  const setTitle = useCallback((id: string, title: string) => setState((s) => patchDoc(s, id, (d) => ({ ...d, title, updatedAt: iso() }))), [patchDoc]);

  const setStatus = useCallback(
    (ids: string[], status: DocStatus) =>
      setState((s) => {
        let n = s;
        for (const id of ids) {
          const d = n.docs.find((x) => x.id === id);
          if (!d || d.status === status) continue;
          n = patchDoc(n, id, (x) => ({ ...x, status, updatedAt: iso() }));
          n = log(n, { docId: id, kind: "status", author: "user", text: `Moved ${d.title.split(" — ")[0]} to ${status.replace(/_/g, " ")}` });
        }
        return n;
      }),
    [log, patchDoc],
  );

  const setOwner = useCallback(
    (ids: string[], owner: string) => setState((s) => ids.reduce((n, id) => patchDoc(n, id, (d) => ({ ...d, owner })), s)),
    [patchDoc],
  );

  const setProperty = useCallback(
    (id: string, key: string, value: PropertyValue | null) =>
      setState((s) =>
        patchDoc(s, id, (d) => {
          const properties = { ...d.properties };
          if (value === null) delete properties[key];
          else properties[key] = value;
          return { ...d, properties, updatedAt: iso() };
        }),
      ),
    [patchDoc],
  );

  const setChannels = useCallback(
    (id: string, channels: Document["channels"]) => setState((s) => patchDoc(s, id, (d) => ({ ...d, channels, updatedAt: iso() }))),
    [patchDoc],
  );

  const setFreshnessMany = useCallback(
    (ids: string[], fn: (d: Document) => Freshness | null, kind: Activity["kind"], text: (d: Document) => string) =>
      setState((s) => {
        let n = s;
        for (const id of ids) {
          const d = n.docs.find((x) => x.id === id);
          if (!d || !docTypes[d.type].living) continue;
          n = patchDoc(n, id, (x) => ({ ...x, freshness: fn(x) }));
          n = log(n, { docId: id, kind, author: "user", text: text(d) });
        }
        return n;
      }),
    [log, patchDoc],
  );

  const verify = useCallback(
    (ids: string[], days: number | null) =>
      setFreshnessMany(
        ids,
        () => ({ kind: "verified", until: days === null ? null : new Date(Date.now() + days * 86_400_000).toISOString() }),
        "verified",
        (d) => `Verified ${d.title.split(" — ")[0]}${days === null ? " with no expiry" : ` for ${days} days`}`,
      ),
    [setFreshnessMany],
  );

  const flagOutdated = useCallback(
    (ids: string[], note?: string) =>
      setFreshnessMany(ids, () => ({ kind: "outdated", note, by: "user" }), "freshness", (d) => `Flagged ${d.title.split(" — ")[0]} as outdated${note ? `: ${note}` : ""}`),
    [setFreshnessMany],
  );

  const clearFreshness = useCallback(
    (ids: string[]) => setFreshnessMany(ids, () => ({ kind: "unverified" }), "freshness", (d) => `Cleared freshness on ${d.title.split(" — ")[0]}`),
    [setFreshnessMany],
  );

  const applyPatch = useCallback(
    (docId: string, patch: Patch, opts?: { runId?: string | null; threadId?: string | null }) =>
      setState((s) => {
        const d = s.docs.find((x) => x.id === docId);
        if (!d) return s;
        const body = replaceSection(d.body, patch.anchor, patch.md);
        const next = withBody(d, body, {
          version: d.version + 1,
          bodyRevision: d.bodyRevision + 1,
          lastPatch: { anchor: patch.anchor, at: iso() },
          missingSections: (d.missingSections ?? []).filter((m) => m.toLowerCase() !== patch.heading.toLowerCase()),
        });
        let n = patchDoc(s, docId, () => next);
        n = addVersion(n, next, "agent", patch.summary.replace(/^Updated [^:]+: /, ""), opts?.runId ?? null);
        n = log(n, { docId, kind: "patched", author: "agent", text: patch.summary, runId: opts?.runId ?? null, threadId: opts?.threadId ?? null });
        return n;
      }),
    [addVersion, log, patchDoc],
  );

  /** Refresh queues a skill re-run that lands as a pending diff a few seconds later. */
  const requestRefresh = useCallback(
    (ids: string[]) => {
      setFreshnessMany(ids, () => ({ kind: "refresh_requested", at: iso() }), "freshness", (d) => `Requested a refresh of ${d.title.split(" — ")[0]}`);
      for (const id of ids) {
        later(() => {
          setState((s) => {
            const d = s.docs.find((x) => x.id === id);
            if (!d || d.freshness?.kind !== "refresh_requested") return s;
            const heads = d.body.content.filter((n) => n.type === "heading" && Number(n.attrs?.level ?? 2) === 2).slice(0, 2);
            const runId = uid("run");
            const pending = {
              runId,
              proposedAt: iso(),
              summary: `Re-ran ${docTypes[d.type].skill} against the latest sources.`,
              sections: heads.map((h) => {
                const heading = (h.content ?? []).map((n) => n.text ?? "").join("");
                const anchor = String(h.attrs?.id);
                return {
                  anchor,
                  heading,
                  before: d.bodyMd.split(`## ${heading}`)[1]?.split("\n## ")[0]?.trim().split("\n")[0] ?? "",
                  after: `Refreshed from the latest snapshots: the ${heading.toLowerCase()} now cites @[doc_research_cozy] and drops the claim that no longer holds.`,
                };
              }),
            };
            let n = patchDoc(s, id, (x) => ({ ...x, pendingDiff: pending, freshness: { kind: "unverified" } }));
            n = log(n, { docId: id, kind: "patched", author: "agent", text: `Proposed ${pending.sections.length} changes to ${d.title.split(" — ")[0]} from a refresh`, runId });
            return n;
          });
        }, 6000);
      }
    },
    [later, log, patchDoc, setFreshnessMany],
  );

  const addRelation = useCallback(
    (from: string, type: RelationType, to: string, anchor: string | null = null) =>
      setState((s) => {
        if (from === to || s.relations.some((r) => r.from === from && r.to === to && r.type === type)) return s;
        const f = s.docs.find((d) => d.id === from);
        const t = s.docs.find((d) => d.id === to);
        let n: State = { ...s, relations: [...s.relations, { from, to, type, anchor, createdAt: iso() }] };
        if (f && t) n = log(n, { docId: from, kind: "relation", author: "user", text: `Linked ${f.title.split(" — ")[0]} → ${t.title.split(" — ")[0]} (${type.replace(/_/g, " ")})` });
        return n;
      }),
    [log],
  );

  const removeRelation = useCallback(
    (from: string, type: RelationType, to: string) =>
      setState((s) => ({ ...s, relations: s.relations.filter((r) => !(r.from === from && r.to === to && r.type === type)) })),
    [],
  );

  const archive = useCallback(
    (ids: string[]) =>
      setState((s) => {
        let n = s;
        for (const id of ids) {
          const d = n.docs.find((x) => x.id === id);
          if (!d || brandTypes.includes(d.type)) continue;
          n = patchDoc(n, id, (x) => ({ ...x, status: "archived", updatedAt: iso() }));
          n = log(n, { docId: id, kind: "archived", author: "user", text: `Archived ${d.title.split(" — ")[0]}` });
        }
        return n;
      }),
    [log, patchDoc],
  );

  const restore = useCallback(
    (ids: string[]) => setState((s) => ids.reduce((n, id) => patchDoc(n, id, (d) => ({ ...d, status: "draft", updatedAt: iso() })), s)),
    [patchDoc],
  );

  const duplicate = useCallback(
    (id: string) => {
      const newId = uid("doc");
      setState((s) => {
        const d = s.docs.find((x) => x.id === id);
        if (!d) return s;
        const copy: Document = {
          ...d,
          id: newId,
          title: `${d.title} (copy)`,
          status: d.type === "research_snapshot" ? "draft" : "draft",
          version: 1,
          createdBy: "user",
          runId: null,
          owner: "Hanna Moore",
          createdAt: iso(),
          updatedAt: iso(),
          pendingDiff: null,
          lastPatch: null,
          freshness: docTypes[d.type].living ? { kind: "unverified" } : null,
        };
        let n: State = { ...s, docs: [copy, ...s.docs] };
        n = { ...n, relations: [...n.relations, ...s.relations.filter((r) => r.from === id).map((r) => ({ ...r, from: newId, createdAt: iso() }))] };
        n = addVersion(n, copy, "user", `Duplicated from ${d.title}`, null);
        n = log(n, { docId: newId, kind: "created", author: "user", text: `Duplicated ${d.title.split(" — ")[0]}` });
        return n;
      });
      return newId;
    },
    [addVersion, log],
  );

  const restoreVersion = useCallback(
    (docId: string, versionId: string) =>
      setState((s) => {
        const v = s.versions.find((x) => x.id === versionId);
        const d = s.docs.find((x) => x.id === docId);
        if (!v || !d) return s;
        const next = withBody(d, v.body, { properties: v.properties, version: d.version + 1, bodyRevision: d.bodyRevision + 1 });
        let n = patchDoc(s, docId, () => next);
        n = addVersion(n, next, "user", `Restored v${v.version}`, null);
        n = log(n, { docId, kind: "edited", author: "user", text: `Restored ${d.title.split(" — ")[0]} to v${v.version}` });
        return n;
      }),
    [addVersion, log, patchDoc],
  );

  const resolveDiffSection = useCallback(
    (docId: string, anchor: string, accept: boolean) =>
      setState((s) => {
        const d = s.docs.find((x) => x.id === docId);
        if (!d?.pendingDiff) return s;
        const section = d.pendingDiff.sections.find((x) => x.anchor === anchor);
        if (!section) return s;
        const remaining = d.pendingDiff.sections.filter((x) => x.anchor !== anchor);
        let body = d.body;
        if (accept) {
          const current = d.bodyMd.split(`## ${section.heading}`)[1]?.split(/\n## /)[0] ?? "";
          const replaced = current.includes(section.before.split("\n")[0]) ? current.replace(section.before.split("\n")[0], section.after) : `${current.trim()}\n\n${section.after}`;
          body = replaceSection(d.body, anchor, replaced);
        }
        const next = withBody(d, body, {
          version: accept ? d.version + 1 : d.version,
          bodyRevision: accept ? d.bodyRevision + 1 : d.bodyRevision,
          lastPatch: accept ? { anchor, at: iso() } : d.lastPatch,
          pendingDiff: remaining.length ? { ...d.pendingDiff, sections: remaining } : null,
        });
        let n = patchDoc(s, docId, () => next);
        if (accept) {
          n = addVersion(n, next, "user", `Accepted proposed change to ${section.heading}`, d.pendingDiff.runId);
          n = log(n, { docId, kind: "patched", author: "user", text: `Accepted the agent's change to ${section.heading} in ${d.title.split(" — ")[0]}` });
        } else {
          n = log(n, { docId, kind: "patched", author: "user", text: `Rejected the agent's change to ${section.heading} in ${d.title.split(" — ")[0]}` });
        }
        return n;
      }),
    [addVersion, log, patchDoc],
  );

  const resolveDiffAll = useCallback(
    (docId: string, accept: boolean) => {
      const d = state.docs.find((x) => x.id === docId);
      d?.pendingDiff?.sections.forEach((sec) => resolveDiffSection(docId, sec.anchor, accept));
    },
    [resolveDiffSection, state.docs],
  );

  const markPatchSeen = useCallback((docId: string) => setState((s) => patchDoc(s, docId, (d) => ({ ...d, lastPatch: null }))), [patchDoc]);

  /* -------------------------------------------------------------- chat --- */

  const createThread = useCallback((opts?: { title?: string; docIds?: string[]; scopedDocId?: string | null }) => {
    const id = uid("thread");
    setState((s) => {
      const brand = s.docs.filter((d) => brandTypes.includes(d.type) && d.status !== "archived").map((d) => d.id);
      const docIds = Array.from(new Set([...brand, ...(opts?.docIds ?? [])]));
      const thread: Thread = {
        id,
        brandId: BRAND_ID,
        title: opts?.title ?? "New chat",
        docIds,
        scopedDocId: opts?.scopedDocId ?? null,
        messages: [],
        createdAt: iso(),
        updatedAt: iso(),
      };
      return { ...s, threads: [thread, ...s.threads] };
    });
    return id;
  }, []);

  const attachToThread = useCallback(
    (threadId: string, docIds: string[]) => setState((s) => patchThread(s, threadId, (t) => ({ ...t, docIds: Array.from(new Set([...t.docIds, ...docIds])) }))),
    [],
  );
  const detachFromThread = useCallback(
    (threadId: string, docId: string) => setState((s) => patchThread(s, threadId, (t) => ({ ...t, docIds: t.docIds.filter((d) => d !== docId) }))),
    [],
  );

  /** Streams a plan's sections into a doc, advancing the step chips, then finishes the run. */
  const writeDoc = useCallback(
    (threadId: string, messageId: string, plan: SkillPlan, type: DocType, runId: string, existingId?: string) => {
      const docId = existingId ?? uid("doc");
      const meta = docTypes[type];

      if (!existingId) {
        setState((s) => {
          const now = iso();
          const doc: Document = {
            id: docId,
            brandId: BRAND_ID,
            type,
            subtype: plan.subtype,
            title: plan.title,
            status: "generating",
            version: 0,
            properties: plan.properties,
            body: { type: "doc", content: [{ type: "paragraph" }] },
            bodyMd: "",
            createdBy: "agent",
            runId,
            channels: plan.channels,
            accounts: ["@terraclays"],
            tags: plan.tags,
            freshness: meta.living ? { kind: "unverified" } : null,
            owner: "Agent",
            skill: meta.skill,
            createdAt: now,
            updatedAt: now,
            missingSections: [],
            pendingDiff: null,
            lastPatch: null,
            bodyRevision: 0,
          };
          let n: State = { ...s, docs: [doc, ...s.docs] };
          n = { ...n, relations: [...n.relations, ...plan.relations.filter((r) => n.docs.some((d) => d.id === r.to)).map((r) => ({ from: docId, to: r.to, type: r.type, anchor: r.anchor ?? null, createdAt: now }))] };
          n = patchMessage(n, threadId, messageId, (m) => (m.role === "assistant" ? { ...m, artifacts: [...(m.artifacts ?? []), docId] } : m));
          n = patchThread(n, threadId, (t) => ({ ...t, docIds: Array.from(new Set([...t.docIds, docId])), title: t.messages.length <= 2 ? plan.title : t.title }));
          n = log(n, { docId, kind: "run_started", author: "agent", text: `Started ${meta.skill}: ${plan.title}`, runId, threadId });
          return n;
        });
      }

      const total = plan.sections.length;
      plan.sections.forEach((section, i) => {
        later(() => {
          setState((s) => {
            const d = s.docs.find((x) => x.id === docId);
            if (!d) return s;
            const base: Body = d.bodyMd.trim() ? d.body : { type: "doc", content: [] };
            const body = appendSection(base, section.heading, section.md);
            let n = patchDoc(s, docId, (x) => withBody(x, body, { bodyRevision: x.bodyRevision + 1, lastPatch: { anchor: section.heading.toLowerCase().replace(/[^a-z0-9]+/g, "-"), at: iso() } }));
            const stepIndex = Math.min(plan.steps.length - 1, Math.floor(((i + 1) / total) * plan.steps.length));
            n = patchMessage(n, threadId, messageId, (m) =>
              m.role === "assistant" && m.steps
                ? { ...m, steps: m.steps.map((st, si) => ({ ...st, state: si < stepIndex ? "done" : si === stepIndex ? "running" : "pending" })) }
                : m,
            );
            return n;
          });
        }, 900 * (i + 1));
      });

      later(() => {
        setState((s) => {
          const d = s.docs.find((x) => x.id === docId);
          if (!d) return s;
          const finalStatus: DocStatus = "draft";
          const next: Document = { ...d, status: finalStatus, version: 1, updatedAt: iso(), lastPatch: null };
          let n = patchDoc(s, docId, () => next);
          n = addVersion(n, next, "agent", `Drafted by ${meta.skill}`, runId);
          n = patchMessage(n, threadId, messageId, (m) =>
            m.role === "assistant"
              ? { ...m, streaming: false, text: [...m.text, plan.outro], suggestions: plan.suggestions, steps: m.steps?.map((st) => ({ ...st, state: "done" })), stepsSummary: `${plan.steps.length} steps · wrote ${total} sections` }
              : m,
          );
          n = log(n, { docId, kind: "run_finished", author: "agent", text: `Finished ${meta.skill}: ${plan.title} (${total} sections)`, runId, threadId });
          return n;
        });
      }, 900 * (total + 1));

      return docId;
    },
    [addVersion, later, log, patchDoc],
  );

  const startSkill = useCallback(
    (threadId: string, type: DocType, subtype: Subtype | null, prompt: string) => {
      const plan = planSkill(type, subtype, prompt, state.docs);
      const runId = uid("run");
      const messageId = uid("m");
      setState((s) =>
        patchThread(s, threadId, (t) => ({
          ...t,
          messages: [
            ...t.messages,
            {
              id: messageId,
              role: "assistant",
              at: iso(),
              streaming: true,
              runId,
              stepsSummary: plan.steps.join(" → "),
              steps: plan.steps.map((label, i) => ({ label, state: i === 0 ? "running" : "pending" })),
              text: [plan.intro],
              review: plan.review ? { title: plan.review.title, fields: plan.review.fields ?? [], choices: plan.review.choices, chosen: null, resolved: false } : undefined,
            },
          ],
        })),
      );
      if (plan.review) return; // wait for resolveReview
      later(() => writeDoc(threadId, messageId, plan, type, runId), 700);
    },
    [later, state.docs, writeDoc],
  );

  const resolveReview = useCallback(
    (threadId: string, messageId: string, result: { chosen?: number; fields?: { label: string; items: string[] }[] }) => {
      const thread = state.threads.find((t) => t.id === threadId);
      const msg = thread?.messages.find((m) => m.id === messageId);
      if (!thread || !msg || msg.role !== "assistant" || !msg.review) return;
      const userTurn = thread.messages.slice().reverse().find((m) => m.role === "user");
      const prompt = userTurn?.role === "user" ? userTurn.text : "";
      /* Infer the type from the message the review belongs to. */
      const type: DocType = msg.review.choices ? "brief" : "persona";
      const plan = planSkill(type, null, prompt, state.docs);
      if (result.chosen !== undefined && plan.review?.choices) {
        const hooks = plan.review.choices;
        const chosen = hooks[result.chosen] ?? hooks[0];
        plan.title = `B7 — ${chosen}`;
        plan.sections = plan.sections.map((sec) =>
          sec.heading === "Hook options"
            ? { ...sec, md: hooks.map((h, i) => `${i + 1}. ${i === result.chosen ? `**"${h}"** — chosen.` : `"${h}"`}`).join("\n") }
            : sec,
        );
      }
      if (result.fields) {
        const get = (label: string) => result.fields!.find((f) => f.label === label)?.items ?? [];
        const pains = get("Pains"),
          triggers = get("Buying triggers"),
          objections = get("Objections");
        plan.sections = plan.sections.map((sec) => {
          if (sec.heading === "Pains, desires and objections") {
            return {
              ...sec,
              md: [...pains.map((p) => `- **Pain:** ${p}. [[VOC-001]]`), `- **Desire:** a small finished thing to show for the evening. [[VOC-009]]`, ...objections.map((o) => `- **Objection:** "${o}." → answered from @[doc_product_facts#objections-and-approved-responses]. [[VOC-011]]`)].join("\n"),
            };
          }
          if (sec.heading === "Context and moments") {
            return { ...sec, md: [...triggers.map((t) => `- ${t}. [[VOC-005]]`), "- Awareness stage: solution-aware."].join("\n") };
          }
          return sec;
        });
      }
      setState((s) =>
        patchMessage(s, threadId, messageId, (m) =>
          m.role === "assistant" && m.review
            ? { ...m, review: { ...m.review, resolved: true, chosen: result.chosen ?? null, fields: result.fields ?? m.review.fields }, text: [...m.text, result.chosen !== undefined ? `Writing the brief around hook ${result.chosen + 1}.` : "Thanks — writing the full document from those lists."] }
            : m,
        ),
      );
      later(() => writeDoc(threadId, messageId, plan, type, msg.runId ?? uid("run")), 500);
    },
    [later, state.docs, state.threads, writeDoc],
  );

  const sendMessage = useCallback(
    (threadId: string, text: string, context: string[], skill?: { type: DocType; subtype: Subtype | null } | null) => {
      const userMsg: Message = { id: uid("m"), role: "user", text, context, at: iso() };
      const thread = state.threads.find((t) => t.id === threadId);
      setState((s) =>
        patchThread(s, threadId, (t) => ({
          ...t,
          docIds: Array.from(new Set([...t.docIds, ...context])),
          title: t.messages.length === 0 && !skill ? text.slice(0, 60) : t.title,
          messages: [...t.messages, userMsg],
        })),
      );

      if (skill) {
        later(() => startSkill(threadId, skill.type, skill.subtype, text), 400);
        return;
      }

      const lower = text.toLowerCase();
      /* A doc in scope plus an editing verb becomes a section patch. */
      const editing = /\b(rewrite|rework|revise|redo|rephrase|tighten|shorten|condense|cut|add|append|update|change|fix|expand|improve|polish|sharpen|strengthen|punchier|sharper|stronger|shorter|cite|evidence|check)\b/.test(lower);
      const scoped =
        thread?.scopedDocId ??
        context.find((id) => !brandTypes.includes(state.docs.find((d) => d.id === id)?.type ?? "brand_core")) ??
        thread?.docIds.filter((id) => !brandTypes.includes(state.docs.find((d) => d.id === id)?.type ?? "brand_core")).slice(-1)[0] ??
        null;

      const creating: DocType | null = /\bpersona\b/.test(lower) && /\b(draft|write|create|make|new)\b/.test(lower)
        ? "persona"
        : /\bbrief\b/.test(lower) && /\b(draft|write|create|make|brief me|new)\b/.test(lower)
          ? "brief"
          : /\b(scan|research|audit|mine|pull)\b/.test(lower)
            ? "research_snapshot"
            : /\bstrategy\b/.test(lower) && /\b(draft|write|create|plan|new)\b/.test(lower)
              ? "content_strategy"
              : null;

      if (creating && !(editing && scoped && !/\b(new|draft|write|create)\b/.test(lower))) {
        const sub: Subtype | null =
          creating === "research_snapshot"
            ? /trend/.test(lower) ? "trend_scan" : /competitor/.test(lower) ? "competitor_audit" : /categor/.test(lower) ? "category_search" : /comment|voc|review/.test(lower) ? "voc_mine" : /audit|own account/.test(lower) ? "account_audit" : "trend_scan"
            : creating === "brief"
              ? /static/.test(lower) ? "static" : "carousel"
              : null;
        later(() => startSkill(threadId, creating, sub, text), 400);
        return;
      }

      const replyId = uid("m");
      setState((s) =>
        patchThread(s, threadId, (t) => ({ ...t, messages: [...t.messages, { id: replyId, role: "assistant", at: iso(), text: [], streaming: true }] })),
      );

      later(() => {
        setState((s) => {
          const doc = scoped ? s.docs.find((d) => d.id === scoped) : undefined;
          if (doc && editing) {
            const patch = patchFor(doc, text);
            if (patch) {
              const body = replaceSection(doc.body, patch.anchor, patch.md);
              const next = withBody(doc, body, { version: doc.version + 1, bodyRevision: doc.bodyRevision + 1, lastPatch: { anchor: patch.anchor, at: iso() } });
              let n = patchDoc(s, doc.id, () => next);
              n = addVersion(n, next, "agent", patch.summary.replace(/^Updated [^:]+: /, ""), null);
              n = log(n, { docId: doc.id, kind: "patched", author: "agent", text: patch.summary, threadId });
              n = patchMessage(n, threadId, replyId, (m) =>
                m.role === "assistant"
                  ? { ...m, streaming: false, text: [`Done — ${patch.summary.split(": ")[1]}. The change is highlighted in the doc for a moment; this is v${next.version}.`], patches: [{ docId: doc.id, anchor: patch.anchor, text: patch.summary }], suggestions: ["Undo that", "Do the same for the next section", "Check it against Brand Core"] }
                  : m,
              );
              return n;
            }
          }
          const a = doc ? answer(doc, text, s.docs, s.relations, new Date()) : null;
          return patchMessage(s, threadId, replyId, (m) =>
            m.role === "assistant"
              ? {
                  ...m,
                  streaming: false,
                  text: a
                    ? a.text
                    : [
                        "I can draft a research snapshot, a persona, a strategy or a brief from here — say which, or pick a skill with the slash menu. Brand Core, Product Facts and the Visual System are attached by default; @-mention any other document to bring it in.",
                      ],
                  suggestions: a?.suggestions ?? ["Scan the \"cozy hobby\" trend", "Draft a persona for the gift-giver", "Write a brief for P1"],
                }
              : m,
          );
        });
      }, 900);
    },
    [addVersion, later, log, patchDoc, startSkill, state.docs, state.threads],
  );

  const ask = useCallback(
    (docId: string, question: string): Answer => {
      const doc = state.docs.find((d) => d.id === docId);
      if (!doc) return { text: ["That document no longer exists."] };
      return answer(doc, question, state.docs, state.relations, now);
    },
    [now, state.docs, state.relations],
  );

  /* ----------------------------------------------------------- filters --- */

  const saveFilter = useCallback((label: string, filters: Filter[]) => setState((s) => ({ ...s, savedFilters: [...s.savedFilters, { id: uid("sf"), label, filters }] })), []);
  const deleteFilter = useCallback((id: string) => setState((s) => ({ ...s, savedFilters: s.savedFilters.filter((f) => f.id !== id) })), []);

  const resetDemo = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    localStorage.removeItem(STORAGE_KEY);
    setState(seedState());
  }, []);

  /* Resume any run that was in flight when the page loaded (the seeded cozy-hobby scan, or a reload mid-run). */
  const resumed = useRef(false);
  useEffect(() => {
    if (!hydrated || resumed.current) return;
    resumed.current = true;
    for (const d of state.docs) {
      if (d.status !== "generating") continue;
      const thread = state.threads.find((t) => t.messages.some((m) => m.role === "assistant" && m.artifacts?.includes(d.id)));
      const msg = thread?.messages.find((m) => m.role === "assistant" && m.artifacts?.includes(d.id));
      if (!thread || !msg) continue;
      const plan = planSkill(d.type, d.subtype, `"${d.title.replace(/^.*?"([^"]+)".*$/, "$1")}"`, state.docs);
      const have = new Set(d.body.content.filter((n) => n.type === "heading").map((n) => (n.content ?? []).map((x) => x.text ?? "").join("").toLowerCase()));
      plan.sections = plan.sections.filter((s) => !have.has(s.heading.toLowerCase()));
      plan.title = d.title;
      later(() => writeDoc(thread.id, msg.id, plan, d.type, d.runId ?? uid("run"), d.id), 4000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const value = useMemo<Store>(
    () => ({
      ...state,
      hydrated,
      now,
      doc: (id) => state.docs.find((d) => d.id === id),
      thread: (id) => state.threads.find((t) => t.id === id),
      createBlank,
      updateBody,
      commitEdit,
      setTitle,
      setStatus,
      setOwner,
      setProperty,
      setChannels,
      verify,
      flagOutdated,
      requestRefresh,
      clearFreshness,
      addRelation,
      removeRelation,
      archive,
      restore,
      duplicate,
      restoreVersion,
      applyPatch,
      resolveDiffSection,
      resolveDiffAll,
      markPatchSeen,
      createThread,
      sendMessage,
      resolveReview,
      attachToThread,
      detachFromThread,
      ask,
      saveFilter,
      deleteFilter,
      resetDemo,
    }),
    [
      state, hydrated, now, createBlank, updateBody, commitEdit, setTitle, setStatus, setOwner, setProperty, setChannels, verify, flagOutdated, requestRefresh,
      clearFreshness, addRelation, removeRelation, archive, restore, duplicate, restoreVersion, applyPatch, resolveDiffSection, resolveDiffAll, markPatchSeen,
      createThread, sendMessage, resolveReview, attachToThread, detachFromThread, ask, saveFilter, deleteFilter, resetDemo,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}
