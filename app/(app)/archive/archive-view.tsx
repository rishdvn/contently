"use client";

import { Archive } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DocTable } from "@/components/patterns/documents";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { useStore } from "@/lib/documents/store";

/* Archived documents. They still resolve as sources; they just stop showing up. */
export function ArchiveView() {
  const store = useStore();
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const archived = store.docs.filter((d) => d.status === "archived");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-8 py-8">
        <header className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-sections text-ink">Archive</h1>
            <p className="text-default text-ink-secondary">Out of the way, not gone. Anything that cited an archived document still resolves.</p>
          </div>
          {selected.size ? (
            <Button
              variant="secondary"
              onClick={() => {
                store.restore([...selected]);
                setSelected(new Set());
              }}
            >
              Restore {selected.size}
            </Button>
          ) : null}
        </header>
        {archived.length ? (
          <DocTable
            docs={archived}
            allDocs={store.docs}
            relations={store.relations}
            now={store.now}
            groupBy="type"
            selected={selected}
            onSelectedChange={setSelected}
            actions={{ onOpen: (id) => router.push(`/documents/${id}`) }}
          />
        ) : (
          <EmptyState icon={<Archive />} title="Nothing archived" description="Archive a document from its row menu or its page; it lands here." />
        )}
      </div>
    </div>
  );
}
