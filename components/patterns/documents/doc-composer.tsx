"use client";

import { Fingerprint, Files, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Composer, ContextAttachment, ContextPill } from "@/components/patterns/chat";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { brandTypes, docTypes, subtypeLabel, workTypes } from "@/lib/documents/registry";
import type { DocType, Document, Subtype } from "@/lib/documents/types";

import { TypeDot, TypeIcon } from "./atoms";

/*
  The chat composer with the document layer wired in. Two things are added to
  the generic Composer: a skill picker, because "make me a persona" is a
  different act from "what do you think", and context pills that show what
  the agent will read — Brand is always pinned, other documents are attached
  by @-mention or from the picker.
*/

export type Skill = { type: DocType; subtype: Subtype | null };

export function DocComposer({
  value,
  onChange,
  onSend,
  generating,
  docs,
  attached,
  onAttachedChange,
  skill,
  onSkillChange,
  scopedDoc,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  generating: boolean;
  docs: Document[];
  /** Non-brand doc ids attached to the thread. */
  attached: string[];
  onAttachedChange: (ids: string[]) => void;
  skill: Skill | null;
  onSkillChange: (s: Skill | null) => void;
  scopedDoc?: Document | null;
  placeholder?: string;
  className?: string;
}) {
  const brand = docs.filter((d) => brandTypes.includes(d.type) && d.status !== "archived");
  const work = docs.filter((d) => !brandTypes.includes(d.type) && d.status !== "archived");

  /* "@query" at the end of the draft opens a mention list. */
  const mention = /(?:^|\s)@([^\s@]*)$/.exec(value);
  const mentionMatches = useMemo(() => {
    if (!mention) return [];
    const q = mention[1].toLowerCase();
    return work.filter((d) => !q || d.title.toLowerCase().includes(q)).slice(0, 6);
  }, [mention, work]);

  const pickMention = (d: Document) => {
    onChange(value.replace(/@([^\s@]*)$/, `@${d.title.split(" — ")[0]} `));
    if (!attached.includes(d.id)) onAttachedChange([...attached, d.id]);
  };

  const slash = /^\/(\w*)$/.exec(value);
  const skillMatches = useMemo(() => {
    if (!slash) return [];
    const q = slash[1].toLowerCase();
    return workTypes.filter((t) => !q || docTypes[t].label.toLowerCase().includes(q) || docTypes[t].skill.includes(q));
  }, [slash]);

  const [skillOpen, setSkillOpen] = useState(false);

  return (
    <div className={cn("relative flex flex-col gap-2", className)}>
      {skill ? (
        <div className="flex items-center gap-2 px-1">
          <span className="inline-flex h-7 items-center gap-1.5 rounded-control pr-1 pl-2.5 text-cap text-ink spectrum-edge">
            <Sparkles className="size-3" />
            {docTypes[skill.type].skill}
            {skill.subtype ? <span className="text-ink-secondary">· {subtypeLabel(skill.type, skill.subtype)}</span> : null}
            <button type="button" aria-label="Clear skill" onClick={() => onSkillChange(null)} className="ml-0.5 flex size-5 items-center justify-center rounded hover:bg-[var(--state-hover)]">
              <X className="size-3" />
            </button>
          </span>
          <span className="text-tiny text-ink-disabled">Describe what you want; the skill writes the document.</span>
        </div>
      ) : null}

      <Composer
        value={value}
        onChange={onChange}
        onSend={onSend}
        generating={generating}
        placeholder={
          placeholder ??
          (scopedDoc
            ? `Ask about ${scopedDoc.title.split(" — ")[0]}, or tell me what to change…`
            : skill
              ? `What should the ${docTypes[skill.type].label.toLowerCase()} be about?`
              : "Ask for a research scan, a persona, a strategy or a brief — / for skills, @ to mention a document")
        }
        tools={
          <Popover
            side="top"
            open={skillOpen}
            onOpenChange={setSkillOpen}
            trigger={(props) => (
              <Button variant="ghost" size="sm" className="text-ink-secondary" {...props}>
                <Sparkles /> Skills
              </Button>
            )}
          >
            {(close) => (
              <SkillPanel
                onPick={(s) => {
                  onSkillChange(s);
                  close();
                }}
              />
            )}
          </Popover>
        }
        context={
          <>
            <Tooltip label={`Pinned: ${brand.map((d) => docTypes[d.type].label).join(", ")}`}>
              <ContextPill icon={<Fingerprint />} label="Brand" count={brand.length} />
            </Tooltip>
            <ContextAttachment
              source={{
                kind: "persona",
                label: "Documents",
                icon: Files,
                items: work.map((d) => ({ id: d.id, label: d.title, detail: docTypes[d.type].label })),
                selected: attached,
              }}
              onChange={onAttachedChange}
            />
            {attached.slice(0, 4).map((id) => {
              const d = docs.find((x) => x.id === id);
              if (!d) return null;
              return (
                <span key={id} className="inline-flex h-7 items-center gap-1.5 rounded-full bg-raised pr-1 pl-2.5 text-cap text-ink-secondary">
                  <TypeDot type={d.type} />
                  <span className="max-w-[160px] truncate">{d.title.split(" — ")[0]}</span>
                  <button type="button" aria-label={`Detach ${d.title}`} onClick={() => onAttachedChange(attached.filter((x) => x !== id))} className="flex size-5 items-center justify-center rounded-full hover:bg-line-strong hover:text-ink">
                    <X className="size-3" />
                  </button>
                </span>
              );
            })}
            {attached.length > 4 ? <span className="text-tiny text-ink-disabled">+{attached.length - 4} more</span> : null}
          </>
        }
      />

      {mention && mentionMatches.length ? (
        <div role="listbox" className="absolute bottom-full left-0 mb-2 w-[360px] rounded-control bg-panel p-1.5 shadow-overlay animate-pop" style={{ zIndex: "var(--z-floating-bar)" }}>
          <div className="px-2.5 pt-1 pb-1.5 text-cap text-ink-disabled">Mention a document</div>
          {mentionMatches.map((d) => (
            <button key={d.id} type="button" role="option" aria-selected={false} onMouseDown={(e) => e.preventDefault()} onClick={() => pickMention(d)} className="flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-1.5 text-left text-default text-ink hover:bg-[var(--state-hover)]">
              <TypeIcon type={d.type} size="sm" />
              <span className="min-w-0 flex-1 truncate">{d.title}</span>
              <span className="text-tiny text-ink-disabled">{docTypes[d.type].label}</span>
            </button>
          ))}
        </div>
      ) : null}

      {slash && skillMatches.length ? (
        <div role="listbox" className="absolute bottom-full left-0 mb-2 w-[360px] rounded-control bg-panel p-1.5 shadow-overlay animate-pop" style={{ zIndex: "var(--z-floating-bar)" }}>
          <div className="px-2.5 pt-1 pb-1.5 text-cap text-ink-disabled">Skills</div>
          {skillMatches.map((t) => (
            <button
              key={t}
              type="button"
              role="option"
              aria-selected={false}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSkillChange({ type: t, subtype: null });
                onChange("");
              }}
              className="flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-1.5 text-left text-default text-ink hover:bg-[var(--state-hover)]"
            >
              <TypeIcon type={t} size="sm" />
              <span className="min-w-0 flex-1 truncate">{docTypes[t].skill}</span>
              <span className="max-w-[50%] truncate text-tiny text-ink-disabled">{docTypes[t].intent}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SkillPanel({ onPick }: { onPick: (s: Skill) => void }) {
  const [type, setType] = useState<DocType>("research_snapshot");
  const meta = docTypes[type];
  return (
    <div className="flex w-[520px]">
      <ul className="w-[180px] shrink-0 border-r border-line p-1.5">
        {workTypes.map((t) => (
          <li key={t}>
            <button
              type="button"
              onMouseEnter={() => setType(t)}
              onFocus={() => setType(t)}
              onClick={() => setType(t)}
              className={cn("flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-default", type === t ? "bg-[var(--state-selected)] text-ink" : "text-ink-secondary hover:text-ink")}
            >
              <TypeIcon type={t} size="sm" />
              <span className="flex-1 truncate">{docTypes[t].skill}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-3.5">
        <div>
          <p className="text-default text-ink">{meta.label}</p>
          <p className="text-cap leading-4 text-ink-secondary">{meta.intent}</p>
        </div>
        <div className="flex flex-col gap-1">
          <button type="button" onClick={() => onPick({ type, subtype: null })} className="flex w-full items-center justify-between rounded-[8px] px-2.5 py-1.5 text-left text-cap text-ink hover:bg-[var(--state-hover)]">
            Any kind <span className="text-tiny text-ink-disabled">let the agent decide</span>
          </button>
          {meta.subtypes.map((s) => (
            <button key={s.value} type="button" onClick={() => onPick({ type, subtype: s.value })} className="flex w-full items-center justify-between gap-3 rounded-[8px] px-2.5 py-1.5 text-left text-cap text-ink hover:bg-[var(--state-hover)]">
              {s.label} <span className="truncate text-tiny text-ink-disabled">{s.description}</span>
            </button>
          ))}
        </div>
        <p className="border-t border-line pt-2 text-tiny leading-4 text-ink-disabled">Reads: {meta.needs}</p>
      </div>
    </div>
  );
}
