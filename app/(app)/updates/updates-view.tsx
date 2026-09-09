"use client";

import { ArrowUpRight, Bell, GitCompareArrows, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { PendingDiffPanel, StatusPill, TypeDot, TypeIcon } from "@/components/patterns/documents";
import { AgentMark } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState, GeneratingBar } from "@/components/ui/feedback";
import { relativeTime } from "@/lib/documents/selectors";
import { useStore } from "@/lib/documents/store";

/*
  What the agent did and what it is waiting on. Pending diffs first, because
  they block; runs in flight second; then the activity feed, newest first,
  each line pointing at its document and its thread.
*/
export function UpdatesView() {
  const store = useStore();
  const router = useRouter();
  const pending = store.docs.filter((d) => d.pendingDiff && d.status !== "archived");
  const running = store.docs.filter((d) => d.status === "generating");
  const feed = store.activity.slice(0, 60);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[920px] flex-col gap-8 px-8 py-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-sections text-ink">Updates</h1>
          <p className="text-default text-ink-secondary">Proposed changes waiting for you, runs in flight, and everything the agent has touched.</p>
        </header>

        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-cap text-ink-secondary">
            <GitCompareArrows className="size-3.5" /> Waiting for review <span className="text-ink-disabled">· {pending.length}</span>
          </h2>
          {pending.length ? (
            pending.map((d) => (
              <div key={d.id} className="flex flex-col gap-2">
                <Link href={`/documents/${d.id}`} className="inline-flex items-center gap-2 text-default text-ink hover:underline">
                  <TypeDot type={d.type} /> {d.title} <ArrowUpRight className="size-3.5 text-ink-disabled" />
                </Link>
                <PendingDiffPanel doc={d} diff={d.pendingDiff!} now={store.now} onResolve={(a, ok) => store.resolveDiffSection(d.id, a, ok)} onResolveAll={(ok) => store.resolveDiffAll(d.id, ok)} />
              </div>
            ))
          ) : (
            <p className="rounded-control bg-panel px-4 py-3 text-cap text-ink-disabled">Nothing waiting. Refreshing a Brand document will land here as a diff.</p>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-cap text-ink-secondary">
            <Sparkles className="size-3.5" /> In flight <span className="text-ink-disabled">· {running.length}</span>
          </h2>
          {running.length ? (
            <ul className="flex flex-col gap-2">
              {running.map((d) => {
                const thread = store.threads.find((t) => t.docIds.includes(d.id));
                return (
                  <li key={d.id} className="overflow-hidden rounded-nav bg-panel">
                    <div className="flex items-center gap-3 px-4 py-3">
                      <TypeIcon type={d.type} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-default text-ink">{d.title}</span>
                      <StatusPill status={d.status} />
                      {thread ? (
                        <Button size="sm" variant="ghost" onClick={() => router.push(`/chat/${thread.id}`)}>
                          Watch <ArrowUpRight />
                        </Button>
                      ) : null}
                    </div>
                    <GeneratingBar className="rounded-none" />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-control bg-panel px-4 py-3 text-cap text-ink-disabled">No skill is running right now.</p>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-cap text-ink-secondary">
            <Bell className="size-3.5" /> Activity
          </h2>
          {feed.length ? (
            <ol className="flex flex-col divide-y divide-line rounded-nav bg-panel">
              {feed.map((a) => {
                const d = a.docId ? store.doc(a.docId) : undefined;
                return (
                  <li key={a.id} className="flex items-start gap-3 px-4 py-3">
                    {a.author === "agent" ? <AgentMark size="xs" className="mt-1" /> : <span className="mt-1 flex size-5 items-center justify-center rounded-full bg-raised text-[9px] text-ink-secondary">HM</span>}
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <p className="text-default leading-5 text-ink">{a.text}</p>
                      <p className="flex flex-wrap items-center gap-x-2 text-tiny text-ink-disabled">
                        <span>{relativeTime(a.at, store.now)}</span>
                        {d ? (
                          <Link href={`/documents/${d.id}`} className="inline-flex items-center gap-1 hover:text-ink">
                            <TypeDot type={d.type} /> {d.title.split(" — ")[0]}
                          </Link>
                        ) : null}
                        {a.threadId ? (
                          <Link href={`/chat/${a.threadId}`} className="hover:text-ink">
                            thread
                          </Link>
                        ) : null}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <EmptyState icon={<Bell />} title="Quiet so far" description="Activity from the agent and from you shows up here." />
          )}
        </section>
      </div>
    </div>
  );
}
