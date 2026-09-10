"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogIcon } from "@/components/ui/dialog";
import { Thumbnail } from "@/components/ui/imagery";
import { Field, Input } from "@/components/ui/input";
import { RadioGroup } from "@/components/ui/radio";
import { Select } from "@/components/ui/select";
import { Stepper } from "@/components/ui/stepper";
import { cn } from "@/lib/cn";

/*
  Templates: the shortcut around the chat.

  A template is a brief with the blanks left in — a format, a slide structure
  and a hook shape. Picking one opens a short form (persona, angle, awareness,
  slide count) and hands the result to the model. The grid is the reference's
  templates browser rebuilt on our primitives, which is why it looks like the
  Parity page: that is the point.
*/

export type Template = {
  id: string;
  title: string;
  format: string;
  slides: number;
  hook: string;
  art: string;
  category: "Educational" | "Story" | "Proof" | "Contrast" | "Listicle";
  popular?: boolean;
};

export function TemplateCard({ template, onUse }: { template: Template; onUse: (t: Template) => void }) {
  return (
    <div className="group/tpl flex flex-col gap-2.5">
      <Thumbnail
        ratio="4:5"
        style={{ backgroundImage: template.art }}
        overlay={
          <div className="flex justify-end opacity-0 transition-opacity group-hover/tpl:opacity-100">
            <Button variant="primary" size="sm" onClick={() => onUse(template)}>
              Use template
            </Button>
          </div>
        }
      />
      <div className="flex items-start justify-between gap-2 px-0.5">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-default text-ink">{template.title}</span>
          <span className="truncate text-cap text-ink-secondary">
            {template.slides} slides · {template.hook}
          </span>
        </div>
        {template.popular ? <Badge dot={false}>Popular</Badge> : null}
      </div>
    </div>
  );
}

export function TemplateGrid({ templates, onUse, className }: { templates: Template[]; onUse: (t: Template) => void; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4", className)}>
      {templates.map((t) => (
        <TemplateCard key={t.id} template={t} onUse={onUse} />
      ))}
    </div>
  );
}

/** The form between a template and a brief. Everything here is a Controls primitive. */
export function BriefFromTemplateDialog({
  template,
  onClose,
  personas,
  angles,
}: {
  template: Template | null;
  onClose: () => void;
  personas: { value: string; label: string; detail?: string }[];
  angles: { value: string; label: string; detail?: string }[];
}) {
  const [persona, setPersona] = useState<string | null>(personas[0]?.value ?? null);
  const [angle, setAngle] = useState<string | null>(null);
  const [awareness, setAwareness] = useState<"problem" | "solution" | "product">("problem");
  const [slides, setSlides] = useState(template?.slides ?? 8);

  return (
    <Dialog open={template !== null} onClose={onClose} size="md">
      <DialogHeader
        icon={
          <DialogIcon tone="spectrum">
            <Sparkles />
          </DialogIcon>
        }
        title={template ? `Brief from “${template.title}”` : ""}
        description="Fill the blanks and the model writes the slide beats. You can edit everything on the board afterwards."
        onClose={onClose}
      />
      <DialogBody className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Persona">
            <Select value={persona} onChange={setPersona} options={personas} placeholder="Choose a persona" />
          </Field>
          <Field label="Angle" hint="Leave empty to let the model propose one.">
            <Select value={angle} onChange={setAngle} options={angles} placeholder="Model's choice" />
          </Field>
        </div>
        <Field label="Awareness stage">
          <RadioGroup
            value={awareness}
            onChange={setAwareness}
            options={[
              { value: "problem", label: "Problem-aware", description: "Agitate and empathise" },
              { value: "solution", label: "Solution-aware", description: "Differentiate the category" },
              { value: "product", label: "Product-aware", description: "Prove and handle objections" },
            ]}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Slides">
            <Stepper value={slides} onChange={setSlides} min={3} max={10} />
          </Field>
          <Field label="Working title">
            <Input placeholder={template?.hook ?? ""} />
          </Field>
        </div>
      </DialogBody>
      <DialogFooter secondary={<span className="text-cap text-ink-disabled">Uses about 40 seconds of model time</span>}>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="spectrum" onClick={onClose}>
          <Sparkles /> Write the brief
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
