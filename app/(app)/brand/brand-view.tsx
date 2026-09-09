"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { BrandCard, NewDocumentDialog } from "@/components/patterns/documents";
import { useToast } from "@/components/ui/toast";
import { brandTypes } from "@/lib/documents/registry";
import { useStore } from "@/lib/documents/store";
import type { DocType, Subtype } from "@/lib/documents/types";

/*
  The Brand tab. Three living documents, always in the same order, each a
  card that says whether it can still be trusted. Every chat pins these
  three; this is where the founder keeps them true.
*/
export function BrandView() {
  const store = useStore();
  const router = useRouter();
  const toast = useToast();
  const [creating, setCreating] = useState<DocType | null>(null);

  const startWithAgent = (type: DocType, subtype: Subtype | null, prompt: string) => {
    const id = store.createThread({ title: prompt.slice(0, 60) });
    store.sendMessage(id, prompt, [], { type, subtype });
    setCreating(null);
    router.push(`/chat/${id}`);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-8 py-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-sections text-ink">Brand</h1>
          <p className="max-w-2xl text-default text-ink-secondary">
            The always-on context. Every chat reads these three before it writes anything; a skill never overwrites them, it proposes a diff you accept.
          </p>
        </header>

        <div className="grid gap-4 lg:grid-cols-3">
          {brandTypes.map((t) => (
            <BrandCard
              key={t}
              type={t}
              doc={store.docs.find((d) => d.type === t && d.status !== "archived")}
              now={store.now}
              onOpen={(id) => router.push(`/documents/${id}`)}
              onCreate={(type) => setCreating(type)}
              onRefresh={(id) => {
                store.requestRefresh([id]);
                toast({ title: "Refresh queued", description: "The skill re-reads the sources and proposes a diff in a few seconds." });
              }}
              onVerify={(id) => {
                store.verify([id], 90);
                toast({ title: "Verified for 90 days" });
              }}
            />
          ))}
        </div>

        <section className="grid gap-4 rounded-card bg-panel p-6 text-default text-ink-secondary lg:grid-cols-3">
          <div>
            <p className="pb-1 text-cap text-ink-disabled">Freshness</p>
            <p>Verified with a date; expires on its own. Flag anything that reads wrong and the skill queues a refresh.</p>
          </div>
          <div>
            <p className="pb-1 text-cap text-ink-disabled">Proposed changes</p>
            <p>A refresh lands as a per-section diff at the top of the document. Accept or reject each one; nothing changes until you do.</p>
          </div>
          <div>
            <p className="pb-1 text-cap text-ink-disabled">Where it is used</p>
            <p>Every persona, strategy and brief cites these through relations, so a change here shows up as “source changed” on the documents built from it.</p>
          </div>
        </section>
      </div>

      <NewDocumentDialog open={Boolean(creating)} initialType={creating} onClose={() => setCreating(null)} docs={store.docs} onAgent={startWithAgent} onBlank={(type, subtype) => router.push(`/documents/${store.createBlank(type, subtype)}`)} />
    </div>
  );
}
