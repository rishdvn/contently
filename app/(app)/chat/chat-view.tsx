"use client";

import { Compass, FileText, MessageSquare, Search, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { DocComposer, DocView, ThreadView, TypeDot, type Skill } from "@/components/patterns/documents";
import { Chip, ChipRow } from "@/components/ui/chip";
import { cn } from "@/lib/cn";
import { brandTypes, docTypes } from "@/lib/documents/registry";
import { relativeTime } from "@/lib/documents/selectors";
import { useStore } from "@/lib/documents/store";

/*
  Stage 1 (no thread, or an empty one) and Stage 2 (a thread beside the
  document it is making). The split is the whole point of Stage 2: the founder
  watches the document fill in while the agent narrates, and the same
  composer that made it takes the follow-up that patches it.
*/

const starters: { label: string; text: string; skill: Skill }[] = [
  { label: "Scan a trend", text: 'Scan the "cozy hobby" trend on TikTok and Instagram', skill: { type: "research_snapshot", subtype: "trend_scan" } },
  { label: "Draft a persona", text: "Draft a persona for the gift-giver in a hurry, from the VoC mine and the category search", skill: { type: "persona", subtype: "exploratory" } },
  { label: "Plan a campaign", text: "Plan a Q4 gifting campaign, Nov 1 to Dec 20, six posts a week", skill: { type: "content_strategy", subtype: "campaign" } },
  { label: "Write a brief", text: "Write a carousel brief for P1 from the phone-replacement angle. Hooks first.", skill: { type: "brief", subtype: "carousel" } },
];

export function ChatView({ threadId }: { threadId?: string }) {
  const store = useStore();
  const router = useRouter();
  const thread = threadId ? store.thread(threadId) : undefined;

  const [value, setValue] = useState("");
  const [skill, setSkill] = useState<Skill | null>(null);
  const [pendingAttach, setPendingAttach] = useState<string[]>([]);
  const attached = useMemo(
    () => (thread ? thread.docIds.filter((id) => !brandTypes.includes(store.doc(id)?.type ?? "brand_core")) : pendingAttach),
    [thread, pendingAttach, store],
  );

  const generating = Boolean(thread?.messages.some((m) => m.role === "assistant" && m.streaming));

  /* The newest document the agent made in this thread. */
  const lastArtifact = useMemo(() => {
    if (!thread) return null;
    for (let i = thread.messages.length - 1; i >= 0; i--) {
      const m = thread.messages[i];
      if (m.role === "assistant" && m.artifacts?.length) return m.artifacts[m.artifacts.length - 1];
    }
    return null;
  }, [thread]);

  /* Stage 2 opens with a document beside the chat: the one it is scoped to, else the newest it made. */
  const [paneDoc, setPaneDoc] = useState<string | null>(thread?.scopedDocId ?? lastArtifact ?? null);
  /* And a document the agent makes mid-conversation opens itself. */
  const [seenArtifact, setSeenArtifact] = useState<string | null>(lastArtifact);
  if (lastArtifact !== seenArtifact) {
    setSeenArtifact(lastArtifact);
    if (lastArtifact) setPaneDoc(lastArtifact);
  }

  const send = (text = value, s = skill) => {
    if (!text.trim()) return;
    if (!thread) {
      const id = store.createThread({ docIds: pendingAttach, title: s ? undefined : text.slice(0, 60) });
      store.sendMessage(id, text, pendingAttach, s);
      router.push(`/chat/${id}`);
    } else {
      store.sendMessage(thread.id, text, attached, s);
    }
    setValue("");
    setSkill(null);
  };

  const setAttached = (ids: string[]) => {
    if (!thread) return setPendingAttach(ids);
    const removed = attached.filter((id) => !ids.includes(id));
    removed.forEach((id) => store.detachFromThread(thread.id, id));
    store.attachToThread(thread.id, ids);
  };

  const pane = paneDoc ? store.doc(paneDoc) : undefined;
  const stage1 = !thread || thread.messages.length === 0;

  if (threadId && store.hydrated && !thread) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-default text-ink-secondary">
        This chat no longer exists.{" "}
        <Link href="/chat" className="ml-1 text-ink underline underline-offset-2">
          Start a new one
        </Link>
      </div>
    );
  }

  if (stage1) {
    const recent = [...store.threads].filter((t) => t.messages.length).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col justify-center gap-8 px-8 py-12">
          <div className="flex flex-col gap-2">
            <h1 className="text-hero text-ink">What are we making?</h1>
            <p className="max-w-xl text-panels text-ink-secondary">
              Brand Core, Product Facts and the Visual System are already in the room. Ask for research, a persona, a strategy or a brief, and the document opens beside the chat as it is written.
            </p>
          </div>
          <DocComposer
            value={value}
            onChange={setValue}
            onSend={() => send()}
            generating={false}
            docs={store.docs}
            attached={attached}
            onAttachedChange={setAttached}
            skill={skill}
            onSkillChange={setSkill}
          />
          <ChipRow wrap>
            {starters.map((s) => {
              const Icon = { research_snapshot: Search, persona: User, content_strategy: Compass, brief: FileText }[s.skill.type as "research_snapshot" | "persona" | "content_strategy" | "brief"];
              return (
                <Chip key={s.label} onClick={() => send(s.text, s.skill)} className="h-8 text-cap">
                  <Icon className="size-3.5" style={{ color: `var(--color-type-${docTypes[s.skill.type].hue})` }} /> {s.label}
                </Chip>
              );
            })}
          </ChipRow>
          {recent.length ? (
            <div className="flex flex-col gap-2 border-t border-line pt-6">
              <p className="text-cap text-ink-disabled">Recent</p>
              <ul className="flex flex-col">
                {recent.map((t) => (
                  <li key={t.id}>
                    <Link href={`/chat/${t.id}`} className="flex items-center gap-3 rounded-nav px-2.5 py-2 hover:bg-[var(--state-hover)]">
                      <MessageSquare className="size-4 text-ink-disabled" />
                      <span className="min-w-0 flex-1 truncate text-default text-ink">{t.title}</span>
                      <span className="flex items-center gap-1">
                        {t.docIds
                          .filter((id) => !brandTypes.includes(store.doc(id)?.type ?? "brand_core"))
                          .slice(0, 4)
                          .map((id) => {
                            const d = store.doc(id);
                            return d ? <TypeDot key={id} type={d.type} /> : null;
                          })}
                      </span>
                      <span className="text-cap text-ink-disabled">{relativeTime(t.updatedAt, store.now)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1">
      <section className={cn("flex min-h-0 min-w-0 flex-col", pane ? "flex-[0_0_46%] border-r border-line" : "flex-1")} aria-label="Conversation">
        <header className="flex items-center gap-3 border-b border-line px-6 py-3">
          <h1 className="min-w-0 flex-1 truncate text-titles text-ink">{thread.title}</h1>
          <div className="flex items-center gap-1">
            {thread.docIds.slice(0, 8).map((id) => {
              const d = store.doc(id);
              if (!d) return null;
              return (
                <button
                  key={id}
                  type="button"
                  title={d.title}
                  onClick={() => setPaneDoc(id)}
                  className={cn("flex size-6 items-center justify-center rounded-[6px] hover:bg-[var(--state-hover)]", paneDoc === id && "bg-[var(--state-selected)]")}
                >
                  <TypeDot type={d.type} />
                </button>
              );
            })}
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <ThreadView
            thread={thread}
            docs={store.docs}
            activeDocId={paneDoc}
            onOpenDoc={(id) => setPaneDoc(id)}
            onSuggestion={(t) => send(t, null)}
            onResolveReview={(messageId, result) => store.resolveReview(thread.id, messageId, result)}
            className={cn(pane && "max-w-none")}
          />
        </div>
        <div className="px-6 pt-2 pb-5">
          <DocComposer
            value={value}
            onChange={setValue}
            onSend={() => send()}
            generating={generating}
            docs={store.docs}
            attached={attached}
            onAttachedChange={setAttached}
            skill={skill}
            onSkillChange={setSkill}
            scopedDoc={pane ?? (thread.scopedDocId ? store.doc(thread.scopedDocId) : null)}
          />
        </div>
      </section>
      {pane ? (
        <section className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label="Document">
          <DocView doc={pane} compact onClose={() => setPaneDoc(null)} onNavigate={(id) => setPaneDoc(id)} />
        </section>
      ) : null}
    </div>
  );
}
