"use client";

import { ChevronDown, History, Link2, ListTree, Plus, RotateCcw, ShieldCheck, ShieldOff, SlidersHorizontal, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Menu, MenuDivider, MenuItem, MenuLabel } from "@/components/ui/menu";
import { Popover } from "@/components/ui/popover";
import { SearchInput } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { outline } from "@/lib/documents/markdown";
import { brandTypes, channelLabels, docTypes, relationLabels, statusLabels, subtypeLabel } from "@/lib/documents/registry";
import { effectiveFreshness, incoming, outgoing, relativeTime, shortDate } from "@/lib/documents/selectors";
import { useStore } from "@/lib/documents/store";
import type { Channel, Document, PropertyValue, RelationType } from "@/lib/documents/types";

import { FreshnessPill, OwnerMark, StatusPill, TypeDot } from "./atoms";

/*
  Stage 3's right rail. Four collapsible groups, top to bottom in the order
  the founder needs them: where am I in this doc, what is it, what does it
  touch, what happened to it. Everything here is editable in place — there is
  no separate "properties" page — because the rail is where the object's
  metadata lives while the body stays clean.
*/

function Group({ icon, title, count, defaultOpen = true, children }: { icon: React.ReactNode; title: string; count?: number; defaultOpen?: boolean; children: React.ReactNode }) {
  return (
    <details open={defaultOpen} className="group/rg">
      <summary className="flex cursor-pointer list-none items-center gap-2 py-2 text-cap text-ink-secondary select-none hover:text-ink [&::-webkit-details-marker]:hidden">
        <span className="[&>svg]:size-3.5">{icon}</span>
        <span className="flex-1">{title}</span>
        {count !== undefined ? <span className="text-tiny text-ink-disabled">{count}</span> : null}
        <ChevronDown className="size-3.5 transition-transform group-open/rg:-rotate-180" />
      </summary>
      <div className="pb-4">{children}</div>
    </details>
  );
}

export function DocRail({ doc, onJump, className }: { doc: Document; onJump?: (anchor: string) => void; className?: string }) {
  const store = useStore();
  const heads = outline(doc.body);
  const versions = store.versions.filter((v) => v.docId === doc.id).sort((a, b) => b.version - a.version);
  const activity = store.activity.filter((a) => a.docId === doc.id).slice(0, 12);

  return (
    <aside className={cn("flex w-[280px] shrink-0 flex-col divide-y divide-line text-default", className)}>
      <Group icon={<ListTree />} title="Contents" count={heads.filter((h) => h.level === 2).length}>
        <nav className="flex flex-col">
          {heads.map((h) => (
            <button
              key={h.id + h.text}
              type="button"
              onClick={() => onJump?.(h.id)}
              className={cn("truncate rounded-[6px] px-2 py-1 text-left text-cap text-ink-secondary hover:bg-[var(--state-hover)] hover:text-ink", h.level === 3 && "pl-5 text-ink-disabled")}
            >
              {h.text}
            </button>
          ))}
          {doc.missingSections?.length ? (
            <div className="mt-1 px-2 text-tiny text-ink-disabled">
              Template sections not yet written: {doc.missingSections.join(", ")}
            </div>
          ) : null}
        </nav>
      </Group>

      <Group icon={<SlidersHorizontal />} title="Properties">
        <Properties doc={doc} />
      </Group>

      <Group icon={<Link2 />} title="Relations" count={outgoing(store.relations, doc.id).length + incoming(store.relations, doc.id).length}>
        <Relations doc={doc} />
      </Group>

      <Group icon={<History />} title="Versions" count={versions.length} defaultOpen={false}>
        <ol className="flex flex-col gap-1">
          {versions.map((v) => (
            <li key={v.id} className="group/ver flex items-start gap-2 rounded-[6px] px-2 py-1.5 hover:bg-[var(--state-hover)]">
              <span className="mt-px w-6 shrink-0 font-mono text-tiny text-ink-disabled">v{v.version}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-cap text-ink">{v.summary}</span>
                <span className="text-tiny text-ink-disabled">
                  {v.author === "agent" ? "Agent" : "You"} · {relativeTime(v.createdAt, store.now)}
                </span>
              </span>
              {v.version !== doc.version ? (
                <button
                  type="button"
                  aria-label={`Restore v${v.version}`}
                  title="Restore this version"
                  onClick={() => store.restoreVersion(doc.id, v.id)}
                  className="mt-px flex size-5 items-center justify-center rounded text-ink-disabled opacity-0 hover:text-ink group-hover/ver:opacity-100"
                >
                  <RotateCcw className="size-3" />
                </button>
              ) : null}
            </li>
          ))}
        </ol>
      </Group>

      <Group icon={<History />} title="Activity" count={activity.length} defaultOpen={false}>
        <ol className="flex flex-col gap-1.5 px-2">
          {activity.map((a) => (
            <li key={a.id} className="flex flex-col">
              <span className="text-cap leading-4 text-ink-secondary">{a.text}</span>
              <span className="text-tiny text-ink-disabled">
                {a.author === "agent" ? "Agent" : "You"} · {relativeTime(a.at, store.now)}
                {a.threadId ? (
                  <>
                    {" · "}
                    <Link href={`/chat/${a.threadId}`} className="underline underline-offset-2 hover:text-ink">
                      thread
                    </Link>
                  </>
                ) : null}
              </span>
            </li>
          ))}
          {!activity.length ? <li className="text-tiny text-ink-disabled">Nothing yet.</li> : null}
        </ol>
      </Group>
    </aside>
  );
}

/* ----------------------------------------------------------- properties --- */

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-8 items-start gap-2 px-2 py-1">
      <span className="w-[88px] shrink-0 pt-1 text-cap text-ink-disabled">{label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">{children}</div>
    </div>
  );
}

function fmtProp(p: PropertyValue) {
  switch (p.kind) {
    case "text":
    case "select":
    case "url":
      return p.value;
    case "multi":
      return p.value.join(", ");
    case "date":
      return shortDate(p.value);
    case "range":
      return `${shortDate(p.start)} – ${shortDate(p.end)}`;
    case "number":
      return String(p.value);
  }
}

export function Properties({ doc }: { doc: Document }) {
  const store = useStore();
  const meta = docTypes[doc.type];
  const fresh = effectiveFreshness(doc, store.now);
  const channels = Object.keys(channelLabels) as Channel[];

  return (
    <div className="flex flex-col">
      <PropRow label="Type">
        <span className="inline-flex items-center gap-1.5 text-cap text-ink">
          <TypeDot type={doc.type} /> {meta.label}
          {doc.subtype ? <span className="text-ink-secondary">· {subtypeLabel(doc.type, doc.subtype)}</span> : null}
        </span>
      </PropRow>
      <PropRow label="Status">
        <Menu
          trigger={(props) => (
            <button type="button" {...props} className="rounded-control outline-none focus-visible:ring-2 focus-visible:ring-ink/25" disabled={doc.status === "generating"}>
              <StatusPill status={doc.status} />
            </button>
          )}
        >
          {meta.statuses
            .filter((s) => s !== "generating")
            .map((s) => (
              <MenuItem key={s} onClick={() => store.setStatus([doc.id], s)}>
                {statusLabels[s]}
              </MenuItem>
            ))}
        </Menu>
      </PropRow>
      <PropRow label="Owner">
        <Menu
          trigger={(props) => (
            <button type="button" {...props} className="rounded-control outline-none">
              <OwnerMark doc={doc} size="xs" withName />
            </button>
          )}
        >
          {["Hanna Moore", "Sam Ortiz", "Agent"].map((o) => (
            <MenuItem key={o} onClick={() => store.setOwner([doc.id], o)}>
              {o}
            </MenuItem>
          ))}
        </Menu>
      </PropRow>
      {meta.living ? (
        <PropRow label="Freshness">
          <Menu
            trigger={(props) => (
              <button type="button" {...props} className="rounded-control outline-none">
                {fresh ? <FreshnessPill doc={doc} now={store.now} /> : <Badge>Unverified</Badge>}
              </button>
            )}
          >
            <MenuLabel>Mark</MenuLabel>
            <MenuItem icon={<ShieldCheck />} onClick={() => store.verify([doc.id], 90)}>
              Verified for 90 days
            </MenuItem>
            <MenuItem icon={<ShieldCheck />} onClick={() => store.verify([doc.id], 30)}>
              Verified for 30 days
            </MenuItem>
            <MenuItem icon={<ShieldCheck />} onClick={() => store.verify([doc.id], null)}>
              Verified, no expiry
            </MenuItem>
            <MenuDivider />
            <MenuItem icon={<TriangleAlert />} onClick={() => store.flagOutdated([doc.id])}>
              Flag as outdated
            </MenuItem>
            <MenuItem icon={<ShieldOff />} onClick={() => store.clearFreshness([doc.id])}>
              Clear
            </MenuItem>
          </Menu>
          {fresh?.kind === "outdated" && fresh.note ? <span className="w-full pt-1 text-tiny text-ink-disabled">{fresh.note}</span> : null}
        </PropRow>
      ) : null}
      <PropRow label="Channels">
        {doc.channels.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => store.setChannels(doc.id, doc.channels.filter((x) => x !== c))}
            className="group/ch inline-flex items-center gap-1 rounded-control bg-raised px-2 py-0.5 text-tiny text-ink-secondary hover:text-ink"
            title="Remove"
          >
            {channelLabels[c]}
            <X className="size-2.5 opacity-0 group-hover/ch:opacity-100" />
          </button>
        ))}
        <Menu
          trigger={(props) => (
            <button type="button" aria-label="Add channel" {...props} className="flex size-5 items-center justify-center rounded text-ink-disabled hover:bg-[var(--state-hover)] hover:text-ink">
              <Plus className="size-3" />
            </button>
          )}
        >
          {channels
            .filter((c) => !doc.channels.includes(c))
            .map((c) => (
              <MenuItem key={c} onClick={() => store.setChannels(doc.id, [...doc.channels, c])}>
                {channelLabels[c]}
              </MenuItem>
            ))}
        </Menu>
      </PropRow>
      <PropRow label="Accounts">
        <span className="text-cap text-ink-secondary">{doc.accounts.join(", ")}</span>
      </PropRow>
      {doc.tags.length ? (
        <PropRow label="Tags">
          {doc.tags.map((t) => (
            <span key={t} className="rounded-control bg-raised px-2 py-0.5 text-tiny text-ink-secondary">
              {t}
            </span>
          ))}
        </PropRow>
      ) : null}
      {Object.entries(doc.properties).map(([k, v]) => (
        <PropRow key={k} label={k.replace(/_/g, " ")}>
          <span className="text-cap text-ink">{fmtProp(v)}</span>
        </PropRow>
      ))}
      <PropRow label="Version">
        <span className="font-mono text-cap text-ink-secondary">v{doc.version}</span>
        <span className="text-tiny text-ink-disabled">· updated {relativeTime(doc.updatedAt, store.now)}</span>
      </PropRow>
      {doc.runId ? (
        <PropRow label="Run">
          <span className="truncate font-mono text-tiny text-ink-disabled">{doc.runId}</span>
        </PropRow>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------ relations --- */

export function Relations({ doc }: { doc: Document }) {
  const store = useStore();
  const out = outgoing(store.relations, doc.id);
  const inc = incoming(store.relations, doc.id);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<RelationType>("informed_by");

  const candidates = useMemo(() => {
    const q = query.toLowerCase();
    return store.docs.filter((d) => d.id !== doc.id && d.status !== "archived" && (!q || d.title.toLowerCase().includes(q))).slice(0, 8);
  }, [store.docs, doc.id, query]);

  const groups = useMemo(() => {
    const g = new Map<string, { label: string; items: { id: string; anchor?: string | null; removable?: { type: RelationType } }[] }>();
    for (const r of out) {
      const key = `out:${r.type}`;
      if (!g.has(key)) g.set(key, { label: relationLabels[r.type].forward, items: [] });
      g.get(key)!.items.push({ id: r.to, anchor: r.anchor, removable: { type: r.type } });
    }
    for (const r of inc) {
      const key = `in:${r.type}`;
      if (!g.has(key)) g.set(key, { label: relationLabels[r.type].reverse, items: [] });
      g.get(key)!.items.push({ id: r.from, anchor: r.anchor });
    }
    return Array.from(g.values());
  }, [out, inc]);

  return (
    <div className="flex flex-col gap-2 px-2">
      {groups.map((g) => (
        <div key={g.label} className="flex flex-col gap-1">
          <span className="text-tiny text-ink-disabled">{g.label}</span>
          <ul className="flex flex-col">
            {g.items.map((it) => {
              const d = store.docs.find((x) => x.id === it.id);
              if (!d) return null;
              return (
                <li key={`${g.label}:${it.id}:${it.anchor ?? ""}`} className="group/rel flex items-center gap-1.5">
                  <Link
                    href={`/documents/${d.id}${it.anchor ? `#${it.anchor}` : ""}`}
                    className="flex min-w-0 flex-1 items-center gap-1.5 rounded-[6px] px-1.5 py-1 text-cap text-ink hover:bg-[var(--state-hover)]"
                  >
                    <TypeDot type={d.type} />
                    <span className="truncate">{d.title.split(" — ")[0]}</span>
                    {it.anchor ? <span className="truncate font-mono text-tiny text-ink-disabled">#{it.anchor}</span> : null}
                  </Link>
                  {it.removable ? (
                    <button
                      type="button"
                      aria-label="Remove relation"
                      onClick={() => store.removeRelation(doc.id, it.removable!.type, it.id)}
                      className="flex size-5 items-center justify-center rounded text-ink-disabled opacity-0 hover:text-ink group-hover/rel:opacity-100"
                    >
                      <X className="size-3" />
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {!groups.length ? <p className="text-tiny text-ink-disabled">No relations yet.</p> : null}
      <Popover
        trigger={(props) => (
          <Button variant="ghost" size="sm" className="-ml-1 self-start text-ink-secondary" {...props}>
            <Plus /> Add relation
          </Button>
        )}
      >
        {(close) => (
          <div className="flex w-[300px] flex-col gap-2 p-2">
            <Menu
              trigger={(props) => (
                <Button variant="secondary" size="sm" className="justify-between" {...props}>
                  {relationLabels[type].forward} <ChevronDown className="size-3" />
                </Button>
              )}
            >
              {(Object.keys(relationLabels) as RelationType[]).map((t) => (
                <MenuItem key={t} onClick={() => setType(t)}>
                  {relationLabels[t].forward}
                </MenuItem>
              ))}
            </Menu>
            <SearchInput autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a document" className="h-8.5 text-ui" />
            <ul className="max-h-56 overflow-y-auto">
              {candidates.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => {
                      store.addRelation(doc.id, type, d.id);
                      close();
                    }}
                    className="flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-left text-cap text-ink hover:bg-[var(--state-hover)]"
                  >
                    <TypeDot type={d.type} />
                    <span className="truncate">{d.title}</span>
                    {brandTypes.includes(d.type) ? <span className="ml-auto text-tiny text-ink-disabled">Brand</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Popover>
    </div>
  );
}
