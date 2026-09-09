"use client";

import { Calendar, FileText, KanbanSquare, Library, MessageSquare, Plus, Search, Sparkles, Users } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/badge";
import { CoachMark } from "@/components/ui/coach-mark";
import { CommandPalette } from "@/components/ui/command-palette";
import { useToast } from "@/components/ui/toast";

import { Row, Section } from "../_doc";

export function PaletteAndCoach() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<number | null>(1);
  const toast = useToast();
  const pick = (label: string) => toast({ title: label });

  return (
    <>
      <Section
        id="command"
        title="Command palette"
        rule="⌘K. One field, grouped results, arrow keys, Enter. Built on Dialog so the page is inert beneath it, pinned near the top so it reads as a command line. Filtering is a substring match — the caller decides what is a command."
      >
        <Row label="open">
          <Button onClick={() => setOpen(true)}>
            <Search /> Command palette <Kbd className="ml-1">⌘K</Kbd>
          </Button>
        </Row>
        <CommandPalette
          open={open}
          onClose={() => setOpen(false)}
          commands={[
            { id: "new-chat", group: "Create", label: "New chat", icon: <MessageSquare />, shortcut: "N", onSelect: () => pick("New chat") },
            { id: "new-brief", group: "Create", label: "New brief from template", icon: <FileText />, onSelect: () => pick("New brief") },
            { id: "new-persona", group: "Create", label: "Draft a persona", icon: <Users />, hint: "Uses the model", onSelect: () => pick("Draft a persona") },
            { id: "gen", group: "Create", label: "Generate carousel batch", icon: <Sparkles />, onSelect: () => pick("Generate") },
            { id: "go-board", group: "Go to", label: "Board", icon: <KanbanSquare />, shortcut: "G B", onSelect: () => pick("Board") },
            { id: "go-cal", group: "Go to", label: "Calendar", icon: <Calendar />, shortcut: "G C", onSelect: () => pick("Calendar") },
            { id: "go-lib", group: "Go to", label: "Library", icon: <Library />, shortcut: "G L", onSelect: () => pick("Library") },
            { id: "add-persona", group: "Personas", label: "The Burned Professional", icon: <Users />, hint: "Open", onSelect: () => pick("Persona") },
            { id: "add-persona-2", group: "Personas", label: "The Bride", icon: <Users />, hint: "Open", onSelect: () => pick("Persona") },
            { id: "invite", group: "Workspace", label: "Invite a teammate", icon: <Plus />, onSelect: () => pick("Invite") },
          ]}
        />
      </Section>

      <Section
        id="coach"
        title="Coach mark"
        rule="A pointed note anchored to one control, shown once, in a short sequence. The inverse surface is what makes it guidance rather than UI — it is the only light-on-dark panel in the system. Two actions at most and a step counter."
      >
        <div className="flex flex-wrap items-start gap-8">
          <div className="relative pt-14">
            <Button variant="spectrum">
              <Sparkles /> Generate
            </Button>
            {step === 1 ? (
              <CoachMark
                title="Spend model time here"
                step={1}
                total={3}
                side="bottom"
                onNext={() => setStep(2)}
                onDismiss={() => setStep(null)}
                className="absolute top-[calc(100%+10px)] left-0"
              >
                The gradient ring marks the one action on a page that asks the model to work on your behalf.
              </CoachMark>
            ) : null}
          </div>
          <div className="relative pt-14">
            <Button>
              <KanbanSquare /> Board
            </Button>
            {step === 2 ? (
              <CoachMark title="Briefs land here" step={2} total={3} onNext={() => setStep(3)} onDismiss={() => setStep(null)} className="absolute top-[calc(100%+10px)] left-0">
                Everything the model drafts appears as a card you can move, edit or discard.
              </CoachMark>
            ) : null}
          </div>
          <div className="relative pt-14">
            <Button>
              <Calendar /> Schedule
            </Button>
            {step === 3 ? (
              <CoachMark title="Then pick a day" step={3} total={3} onNext={() => setStep(null)} onDismiss={() => setStep(null)} className="absolute top-[calc(100%+10px)] left-0">
                Drag a finished carousel onto the calendar. Posting is the last thing, not the first.
              </CoachMark>
            ) : null}
          </div>
        </div>
        {step === null ? (
          <Button variant="ghost" size="sm" className="self-start" onClick={() => setStep(1)}>
            Restart tour
          </Button>
        ) : null}
        <div className="h-40" />
      </Section>
    </>
  );
}
