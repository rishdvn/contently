"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  AskFilter,
  BulkBar,
  DocTable,
  FilterChips,
  FilterMenus,
  NewDocumentDialog,
  PeekSheet,
  QuickFilters,
  useMentionables,
  type GroupBy,
} from "@/components/patterns/documents";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { brandTypes, docTypes } from "@/lib/documents/registry";
import { matchesFilters, quickCounts, sameFilter } from "@/lib/documents/selectors";
import { useStore } from "@/lib/documents/store";
import type { DocStatus, DocType, Filter, QuickFilter, SavedFilter, Subtype } from "@/lib/documents/types";

/*
  Stage 0. The Documents tab: everything that is not a Brand document, as a
  table the founder scans for what needs her. Filters are chips; the agent
  can write them from a sentence; a view is a saved set of chips.
*/
export function DocumentsView() {
  const store = useStore();
  const router = useRouter();
  const toast = useToast();
  const mentionables = useMentionables();

  const [filters, setFilters] = useState<Filter[]>([]);
  const [groupBy, setGroupBy] = useState<GroupBy>("type");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [peek, setPeek] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveLabel, setSaveLabel] = useState("");

  const work = useMemo(() => store.docs.filter((d) => !brandTypes.includes(d.type) && d.status !== "archived"), [store.docs]);
  const counts = useMemo(() => quickCounts(work, store.relations, store.now), [work, store.relations, store.now]);
  const rows = useMemo(
    () => work.filter((d) => matchesFilters(d, filters, store.relations, store.now)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [work, filters, store.relations, store.now],
  );

  const quickActive = filters.filter((f) => f.kind === "quick").map((f) => f.value as QuickFilter);
  const toggleQuick = (q: QuickFilter) => {
    const f: Filter = { kind: "quick", value: q };
    setFilters((fs) => (fs.some((x) => sameFilter(x, f)) ? fs.filter((x) => !sameFilter(x, f)) : [...fs, f]));
  };
  const addFilters = (fs: Filter[]) => setFilters((cur) => [...cur, ...fs.filter((f) => !cur.some((c) => sameFilter(c, f)))]);

  const selectedDocs = rows.filter((d) => selected.has(d.id));
  const sharedStatuses = selectedDocs.length
    ? selectedDocs.map((d) => docTypes[d.type].statuses.filter((s) => s !== "generating")).reduce((a, b) => a.filter((s) => b.includes(s)))
    : ([] as DocStatus[]);

  const openInChat = (ids: string[]) => {
    const id = store.createThread({ docIds: ids, title: ids.length === 1 ? `About ${store.doc(ids[0])?.title.split(" — ")[0]}` : `${ids.length} documents` });
    router.push(`/chat/${id}`);
  };

  const startWithAgent = (type: DocType, subtype: Subtype | null, prompt: string) => {
    const id = store.createThread({ title: prompt.slice(0, 60) });
    store.sendMessage(id, prompt, [], { type, subtype });
    setCreating(false);
    router.push(`/chat/${id}`);
  };
  const startBlank = (type: DocType, subtype: Subtype | null) => {
    const id = store.createBlank(type, subtype);
    setCreating(false);
    router.push(`/documents/${id}`);
  };

  const applySaved = (s: SavedFilter) => setFilters(s.filters);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-8 py-8">
        <header className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-sections text-ink">Documents</h1>
            <p className="text-default text-ink-secondary">
              {work.length} working documents · research, personas, strategies and briefs. Brand documents live in{" "}
              <button type="button" onClick={() => router.push("/brand")} className="text-ink underline underline-offset-2">
                Brand
              </button>
              .
            </p>
          </div>
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus /> New
          </Button>
        </header>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <QuickFilters counts={counts} active={quickActive} onToggle={toggleQuick} />
            <FilterMenus
              filters={filters}
              onAdd={(f) => addFilters([f])}
              groupBy={groupBy}
              onGroupBy={setGroupBy}
              savedFilters={store.savedFilters}
              onApplySaved={applySaved}
              onSaveCurrent={() => {
                setSaveLabel("");
                setSaveOpen(true);
              }}
              onDeleteSaved={store.deleteFilter}
            />
          </div>
          <AskFilter docs={store.docs} onFilters={addFilters} />
          <FilterChips filters={filters} docs={store.docs} onRemove={(f) => setFilters((fs) => fs.filter((x) => !sameFilter(x, f)))} onClear={() => setFilters([])} />
        </div>

        <DocTable
          docs={rows}
          allDocs={store.docs}
          relations={store.relations}
          now={store.now}
          groupBy={groupBy}
          selected={selected}
          onSelectedChange={setSelected}
          actions={{
            onOpen: (id) => router.push(`/documents/${id}`),
            onPeek: setPeek,
            onChat: (id) => openInChat([id]),
            onDuplicate: (id) => {
              const n = store.duplicate(id);
              toast({ title: "Duplicated", action: { label: "Open", onClick: () => router.push(`/documents/${n}`) } });
            },
            onVerify: (id) => store.verify([id], 90),
            onFlag: (id) => store.flagOutdated([id]),
            onRefresh: (id) => {
              store.requestRefresh([id]);
              toast({ title: "Refresh queued", description: "A proposed diff will arrive in Updates." });
            },
            onArchive: (id) => {
              store.archive([id]);
              toast({ title: "Archived", action: { label: "Undo", onClick: () => store.restore([id]) } });
            },
          }}
        />

        <p className="text-tiny text-ink-disabled">
          {rows.length} of {work.length} shown · click a row to open, hover for peek. Select rows for bulk actions.
        </p>
      </div>

      <BulkBar
        count={selected.size}
        statuses={sharedStatuses}
        livingCount={selectedDocs.filter((d) => docTypes[d.type].living).length}
        onStatus={(s) => {
          store.setStatus([...selected], s);
          setSelected(new Set());
        }}
        onOwner={(o) => {
          store.setOwner([...selected], o);
          setSelected(new Set());
        }}
        onVerify={() => {
          store.verify([...selected], 90);
          setSelected(new Set());
        }}
        onFlag={() => {
          store.flagOutdated([...selected]);
          setSelected(new Set());
        }}
        onArchive={() => {
          const ids = [...selected];
          store.archive(ids);
          setSelected(new Set());
          toast({ title: `Archived ${ids.length}`, action: { label: "Undo", onClick: () => store.restore(ids) } });
        }}
        onChat={() => openInChat([...selected])}
        onClear={() => setSelected(new Set())}
      />

      <PeekSheet
        doc={peek ? (store.doc(peek) ?? null) : null}
        now={store.now}
        mentionables={mentionables}
        citations={store.citations}
        onClose={() => setPeek(null)}
        onOpen={(id) => {
          setPeek(null);
          router.push(`/documents/${id}`);
        }}
        onChat={(id) => {
          setPeek(null);
          openInChat([id]);
        }}
        onOpenDoc={(id, anchor) => {
          setPeek(null);
          router.push(`/documents/${id}${anchor ? `#${anchor}` : ""}`);
        }}
      />

      <NewDocumentDialog open={creating} onClose={() => setCreating(false)} docs={store.docs} onAgent={startWithAgent} onBlank={startBlank} />

      <Dialog open={saveOpen} onClose={() => setSaveOpen(false)} size="sm">
        <DialogHeader title="Save view" description="The current filters, as a named view in the Views menu." onClose={() => setSaveOpen(false)} />
        <DialogBody>
          <Input autoFocus value={saveLabel} onChange={(e) => setSaveLabel(e.target.value)} placeholder="P1 briefs not yet used" aria-label="View name" />
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setSaveOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!saveLabel.trim()}
            onClick={() => {
              store.saveFilter(saveLabel.trim(), filters);
              setSaveOpen(false);
              toast({ title: "View saved", description: saveLabel.trim() });
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
