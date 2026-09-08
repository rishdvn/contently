"use client";

import {
  Copy,
  Filter,
  MoreHorizontal,
  Pencil,
  Send,
  Sparkles,
  Trash2,
  Undo2,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Chip, ChipRow } from "@/components/ui/chip";
import {
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogIcon,
  Drawer,
} from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Menu, MenuDivider, MenuItem, MenuLabel } from "@/components/ui/menu";
import { SectionLabel } from "@/components/ui/surface";
import { Switch } from "@/components/ui/switch";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";

function Section({
  title,
  rule,
  children,
}: {
  title: string;
  rule: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 border-t border-line pt-8">
      <header className="flex flex-col gap-1">
        <h2 className="text-titles text-ink">{title}</h2>
        <p className="max-w-2xl text-default text-ink-secondary">{rule}</p>
      </header>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="w-24 shrink-0 text-cap text-ink-disabled">{label}</span>
      {children}
    </div>
  );
}

export function Overlays() {
  return (
    <ToastProvider>
      <Inner />
    </ToastProvider>
  );
}

type Which =
  | null
  | "sm"
  | "md"
  | "lg"
  | "full"
  | "confirm"
  | "brief"
  | "blocking"
  | "right"
  | "left"
  | "bottom"
  | "inspector";

function Inner() {
  const [open, setOpen] = useState<Which>(null);
  const [autoSchedule, setAutoSchedule] = useState(true);
  const [watermark, setWatermark] = useState(false);
  const toast = useToast();
  const close = () => setOpen(null);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-8 py-12">
      <header className="flex flex-col gap-3">
        <SectionLabel>Contently</SectionLabel>
        <h1 className="text-sections">Overlays</h1>
        <p className="max-w-2xl text-panels text-ink-secondary">
          Everything on this page is live — open it, dismiss it with Escape, click
          the scrim, tab through it.
        </p>
        <p className="max-w-2xl text-cap text-ink-disabled">
          Dialogs and drawers are native <code>&lt;dialog&gt;</code> elements
          opened with <code>showModal()</code>, so focus trapping, Escape, inert
          background content and top-layer painting come from the browser rather
          than from us.
        </p>
      </header>

      <Section
        title="Choosing a shape"
        rule="Three questions decide it. Must the user respond before continuing? Use a dialog. Is the work secondary to what is on the canvas, and does seeing the canvas help? Use a drawer. Is it a shortcut to an action on one object? Use a menu."
      >
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            ["Dialog", "A decision or a short focused task", "Blocks the page"],
            ["Drawer", "Inspect or adjust alongside the canvas", "Blocks the page"],
            ["Menu", "Act on one object", "Does not block"],
          ].map(([name, use, blocking]) => (
            <div key={name} className="flex flex-col gap-1 rounded-control bg-panel p-3.5">
              <span className="text-default text-ink">{name}</span>
              <span className="text-cap text-ink-secondary">{use}</span>
              <span className="text-cap text-ink-disabled">{blocking}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Dialog sizes"
        rule="Four widths, and the choice is about content rather than importance. A destructive confirm is small because it is one sentence and two buttons; a brief is medium because it is a form; full is for work that needs the room, and is the point at which you should ask whether it wants to be a page."
      >
        <Row label="sizes">
          <Button onClick={() => setOpen("sm")}>Small · 400</Button>
          <Button onClick={() => setOpen("md")}>Medium · 520</Button>
          <Button onClick={() => setOpen("lg")}>Large · 720</Button>
          <Button onClick={() => setOpen("full")}>Full</Button>
        </Row>
      </Section>

      <Section
        title="Drawers"
        rule="Slide from an edge and keep square corners against it, so they read as attached to the viewport rather than floating in it. Right is the default for inspectors; bottom is for pickers, and is the shape that survives contact with a narrow screen."
      >
        <Row label="sides">
          <Button onClick={() => setOpen("right")}>From right</Button>
          <Button onClick={() => setOpen("left")}>From left</Button>
          <Button onClick={() => setOpen("bottom")}>From bottom</Button>
        </Row>
      </Section>

      <Section
        title="Composed flows"
        rule="The parts are shared between both shapes, so a flow can move from a dialog to a drawer without rewriting its contents. These are the four patterns the product actually needs."
      >
        <div className="flex flex-col gap-3">
          <Row label="destructive">
            <Button variant="danger" onClick={() => setOpen("confirm")}>
              <Trash2 /> Delete batch
            </Button>
            <span className="text-cap text-ink-disabled">
              Small, critical icon, consequence spelled out, confirm on the right
            </span>
          </Row>
          <Row label="generative">
            <Button variant="spectrum" onClick={() => setOpen("brief")}>
              <Sparkles /> Brief the model
            </Button>
            <span className="text-cap text-ink-disabled">
              Medium, spectrum ring on both the trigger and the confirm
            </span>
          </Row>
          <Row label="inspector">
            <Button onClick={() => setOpen("inspector")}>
              <Users /> Persona inspector
            </Button>
            <span className="text-cap text-ink-disabled">
              Drawer, because the canvas stays relevant while you edit
            </span>
          </Row>
          <Row label="blocking">
            <Button onClick={() => setOpen("blocking")}>Unsaved changes</Button>
            <span className="text-cap text-ink-disabled">
              Escape and scrim clicks are disabled — the user must choose
            </span>
          </Row>
        </div>
      </Section>

      <Section
        title="Menus"
        rule="A menu is a shortcut, not a task, so it does not trap focus or make the page inert. It closes on Escape, on a click outside, and on choosing an item. Destructive items sit last, below a divider."
      >
        <Row label="overflow">
          <Menu
            align="start"
            trigger={(p) => (
              <IconButton aria-label="More actions" variant="secondary" {...p}>
                <MoreHorizontal />
              </IconButton>
            )}
          >
            <MenuLabel>Carousel</MenuLabel>
            <MenuItem icon={<Pencil />} shortcut="E">
              Edit slides
            </MenuItem>
            <MenuItem icon={<Copy />} shortcut="⌘D">
              Duplicate
            </MenuItem>
            <MenuItem icon={<Send />}>Schedule…</MenuItem>
            <MenuDivider />
            <MenuItem icon={<Trash2 />} destructive onClick={() => setOpen("confirm")}>
              Delete
            </MenuItem>
          </Menu>
          <span className="text-cap text-ink-disabled">
            The delete item opens the confirm dialog — menus hand off, they do not
            destroy
          </span>
        </Row>
      </Section>

      <Section
        title="Tooltips"
        rule="Tooltips name unlabelled controls and nothing more. They are unreachable by touch and by keyboard-only users, so anything essential has to live in the interface itself. CSS-only, so they cannot get stuck open."
      >
        <Row label="sides">
          <Tooltip label="Undo">
            <IconButton aria-label="Undo" variant="secondary">
              <Undo2 />
            </IconButton>
          </Tooltip>
          <Tooltip label="Filter by angle type" side="bottom">
            <IconButton aria-label="Filter" variant="secondary">
              <Filter />
            </IconButton>
          </Tooltip>
          <Tooltip label="Duplicate" side="right">
            <IconButton aria-label="Duplicate" variant="secondary">
              <Copy />
            </IconButton>
          </Tooltip>
        </Row>
      </Section>

      <Section
        title="Alerts"
        rule="An inline banner is for a condition attached to the surface it sits on. The fill is a near-black tinted with the tone rather than a saturated block, so a warning inside a dialog does not out-shout the dialog's own content."
      >
        <div className="flex flex-col gap-2">
          <Alert tone="info" title="Angles are hypotheses.">
            Retire the ones that stop performing rather than editing them — the
            history is what makes the coverage matrix useful.
          </Alert>
          <Alert tone="positive" title="8 carousels scheduled." />
          <Alert
            tone="caution"
            title="No new-mechanism angles for this persona."
            action={
              <Button size="sm" variant="ghost">
                Review
              </Button>
            }
          >
            Six of six tested angles are social proof.
          </Alert>
          <Alert tone="critical" title="Instagram token expired.">
            Scheduled posts will fail until the account is reconnected.
          </Alert>
        </div>
      </Section>

      <Section
        title="Toasts"
        rule="A toast reports something that already happened, so it never blocks and never asks a question. It inverts to light-on-dark because in an interface this dark a light slab is the only thing that reads as new without borrowing the gradient, which belongs to generation."
      >
        <Row label="trigger">
          <Button
            onClick={() =>
              toast({ title: "Carousel duplicated", description: "Vitamin C — Glow Seekers" })
            }
          >
            Simple
          </Button>
          <Button
            onClick={() =>
              toast({
                title: "Batch deleted",
                description: "8 carousels moved to trash",
                action: { label: "Undo", onClick: () => toast({ title: "Restored" }) },
              })
            }
          >
            With undo
          </Button>
          <Button
            variant="spectrum"
            onClick={() =>
              toast({
                title: "8 carousels ready",
                description: "Problem-aware · Your dermatologist wrecked your skin",
              })
            }
          >
            <Sparkles /> Generation complete
          </Button>
        </Row>
      </Section>

      <Section
        title="Switches"
        rule="A switch applies the moment it moves, with no confirming action. If the change needs saving, it should be a checkbox next to a submit button instead."
      >
        <div className="flex max-w-md flex-col gap-4">
          <Switch
            checked={autoSchedule}
            onCheckedChange={setAutoSchedule}
            label="Auto-schedule approved carousels"
            description="Posts at the best time for each platform."
          />
          <Switch
            checked={watermark}
            onCheckedChange={setWatermark}
            label="Watermark exports"
          />
          <Switch checked={false} onCheckedChange={() => {}} disabled label="Disabled" />
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}

      <Dialog open={open === "sm"} onClose={close} size="sm">
        <DialogHeader title="Small" description="400px. One sentence and two buttons." onClose={close} />
        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" onClick={close}>
            Confirm
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={open === "md"} onClose={close} size="md">
        <DialogHeader title="Medium" description="520px. The default, and the right size for a form." onClose={close} />
        <DialogBody>
          <div className="flex flex-col gap-4">
            <Field label="Name">
              <Input placeholder="Vitamin C — Glow Seekers" />
            </Field>
            <Field label="Notes">
              <Textarea rows={3} placeholder="Anything the model should know" />
            </Field>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" onClick={close}>
            Save
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={open === "lg"} onClose={close} size="lg">
        <DialogHeader title="Large" description="720px. For side-by-side content or a table." onClose={close} />
        <DialogBody>
          <div className="grid grid-cols-2 gap-3">
            {["Professional", "Stay-home mum", "Bride", "Student"].map((p) => (
              <div key={p} className="flex flex-col gap-1 rounded-control bg-card p-3.5">
                <span className="text-default text-ink">{p}</span>
                <span className="text-cap text-ink-secondary">3 angles · 12 hooks</span>
              </div>
            ))}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="primary" onClick={close}>
            Done
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={open === "full"} onClose={close} size="full">
        <DialogHeader
          title="Full"
          description="At this size, ask whether it wants to be a page instead."
          onClose={close}
        />
        <DialogBody>
          <div className="grid grid-cols-6 gap-3">
            {Array.from({ length: 18 }).map((_, i) => (
              <div key={i} className="aspect-[4/5] rounded-control bg-card" />
            ))}
          </div>
        </DialogBody>
      </Dialog>

      <Dialog open={open === "confirm"} onClose={close} size="sm">
        <DialogHeader
          icon={
            <DialogIcon tone="critical">
              <Trash2 />
            </DialogIcon>
          }
          title="Delete this batch?"
          description="8 carousels and their slides will be removed. Scheduled posts using them will be cancelled."
        />
        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              close();
              toast({
                title: "Batch deleted",
                description: "8 carousels moved to trash",
                action: { label: "Undo", onClick: () => toast({ title: "Restored" }) },
              });
            }}
          >
            Delete batch
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={open === "brief"} onClose={close} size="md">
        <DialogHeader
          icon={
            <DialogIcon tone="spectrum">
              <Sparkles />
            </DialogIcon>
          }
          title="Brief the model"
          description="One persona, one angle. The hooks are generated per awareness stage."
          onClose={close}
        />
        <DialogBody className="flex flex-col gap-4">
          <Field label="Persona">
            <Input defaultValue="Bride-to-be, 25–35, wedding in 6 months" />
          </Field>
          <Field
            label="Angle statement"
            hint="Conversational. What the person would think, not a tagline."
          >
            <Textarea rows={2} defaultValue="Your wedding photos last forever" />
          </Field>
          <div className="flex flex-col gap-2">
            <span className="text-cap text-ink-secondary">Awareness stages</span>
            <ChipRow>
              <Chip selected>Problem-aware</Chip>
              <Chip selected>Solution-aware</Chip>
              <Chip>Product-aware</Chip>
              <Chip>Most-aware</Chip>
            </ChipRow>
          </div>
          <Alert tone="info" title="This will use 8 generations.">
            Two hooks per selected stage, each as a four-slide carousel.
          </Alert>
        </DialogBody>
        <DialogFooter secondary={<Badge tone="spectrum">AI draft</Badge>}>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="spectrum"
            onClick={() => {
              close();
              toast({
                title: "8 carousels ready",
                description: "Problem-aware · Your wedding photos last forever",
              });
            }}
          >
            <Sparkles /> Generate
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={open === "blocking"} onClose={close} size="sm" dismissable={false}>
        <DialogHeader
          icon={<DialogIcon tone="caution">!</DialogIcon>}
          title="You have unsaved changes"
          description="Escape and scrim clicks are disabled here, because leaving without choosing would lose work."
        />
        <DialogFooter
          secondary={
            <Button variant="ghost" onClick={close}>
              Discard
            </Button>
          }
        >
          <Button variant="primary" onClick={close}>
            Save and close
          </Button>
        </DialogFooter>
      </Dialog>

      <Drawer open={open === "right"} onClose={close} side="right">
        <DialogHeader title="From the right" description="The default for inspectors." onClose={close} />
        <DialogBody />
      </Drawer>

      <Drawer open={open === "left"} onClose={close} side="left">
        <DialogHeader title="From the left" description="Navigation and hierarchy." onClose={close} />
        <DialogBody />
      </Drawer>

      <Drawer open={open === "bottom"} onClose={close} side="bottom">
        <DialogHeader title="From the bottom" description="Pickers, and the shape that survives a narrow screen." onClose={close} />
        <DialogBody>
          <div className="grid grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[4/5] rounded-control bg-card" />
            ))}
          </div>
        </DialogBody>
      </Drawer>

      <Drawer open={open === "inspector"} onClose={close} side="right">
        <DialogHeader
          icon={
            <DialogIcon>
              <Users />
            </DialogIcon>
          }
          title="Bride-to-be"
          description="25–35 · wedding in 6 months"
          onClose={close}
        />
        <DialogBody className="flex flex-col gap-4">
          <Field label="Deepest desire">
            <Textarea rows={2} defaultValue="To look like herself, only rested" />
          </Field>
          <Field label="Current workaround">
            <Input defaultValue="Drugstore sheet masks the night before" />
          </Field>
          <div className="flex flex-col gap-2">
            <span className="text-cap text-ink-secondary">Angle types covered</span>
            <ChipRow>
              <Chip selected>Social proof</Chip>
              <Chip selected>Before / after</Chip>
              <Chip>New mechanism</Chip>
            </ChipRow>
          </div>
          <Alert tone="caution" title="Three angle types untested." />
          <Switch
            checked={autoSchedule}
            onCheckedChange={setAutoSchedule}
            label="Include in weekly batch"
          />
        </DialogBody>
        <DialogFooter
          secondary={
            <Button variant="danger" size="sm">
              <Trash2 /> Delete
            </Button>
          }
        >
          <Button variant="primary" onClick={close}>
            Save
          </Button>
        </DialogFooter>
      </Drawer>
    </div>
  );
}
