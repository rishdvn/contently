import { MoreHorizontal, Plus, Search, Sparkles, Undo2 } from "lucide-react";

import { Kbd } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Chip, ChipRow, TextTab } from "@/components/ui/chip";
import { Field, Input, SearchInput, Textarea } from "@/components/ui/input";

import { Page, PageHeader, Row, Section } from "../_doc";
import { Pickers } from "./pickers";
import { Toggles } from "./toggles";

export const metadata = {
  title: "Controls · Contently design",
};

export default function ControlsPage() {
  return (
    <Page>
      <PageHeader
        title="Controls"
        lede="Things the user operates. Every control here is a single component with variants — there is no second button for dialogs, no special chip for the composer. A surface that needs a control imports it."
        note="Button · Input · Chip & tab · Switch & checkbox · Select · Segmented · Slider · Stepper · Radio · Date & time. The full Mobbin Control category."
      />

      <Section
        id="buttons"
        title="Button"
        rule="Exactly one primary per surface. White is for the safe, expected next step; the spectrum ring is for spending model time; everything else recedes. Corners are 10px and icon buttons are fully round."
      >
        <div className="flex flex-col gap-4">
          <Row label="primary">
            <Button variant="primary" size="sm">
              <Plus /> Create
            </Button>
            <Button variant="primary">
              <Plus /> Create
            </Button>
            <Button variant="primary" size="lg">
              <Plus /> Create
            </Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
          </Row>
          <Row label="spectrum">
            <Button variant="spectrum" size="sm">
              <Sparkles /> Generate
            </Button>
            <Button variant="spectrum">
              <Sparkles /> Generate
            </Button>
            <Button variant="spectrum" size="lg">
              <Sparkles /> Generate
            </Button>
          </Row>
          <Row label="secondary">
            <Button size="sm">Share</Button>
            <Button>Share</Button>
            <Button size="lg">Share</Button>
            <Button disabled>Disabled</Button>
          </Row>
          <Row label="ghost">
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
            <Button variant="ghost">Cancel</Button>
          </Row>
          <Row label="danger">
            <Button variant="danger" size="sm">
              Delete
            </Button>
            <Button variant="danger">Delete batch</Button>
          </Row>
          <Row label="icon">
            <IconButton aria-label="Undo">
              <Undo2 />
            </IconButton>
            <IconButton aria-label="More" variant="secondary">
              <MoreHorizontal />
            </IconButton>
            <IconButton aria-label="Create" variant="primary">
              <Plus />
            </IconButton>
          </Row>
        </div>
      </Section>

      <Section
        id="inputs"
        title="Input"
        rule="Fields are darker than the panel they sit in, so a form reads as a set of holes rather than a stack of boxes. Search is a pill; everything else takes the 10px control radius."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Search" hint="Matches angle statements and hooks.">
            <SearchInput placeholder="Search templates" leading={<Search />} />
          </Field>
          <Field label="Persona">
            <Input placeholder="Bride-to-be, 25–35" />
          </Field>
          <Field
            label="Angle statement"
            hint="Conversational. Write what the person would think, not a tagline."
            className="sm:col-span-2"
          >
            <Textarea rows={3} placeholder="Your dermatologist wrecked your skin" />
          </Field>
          <Field label="Disabled">
            <Input placeholder="Not editable" disabled />
          </Field>
        </div>
      </Section>

      <Section
        id="chips"
        title="Chip & tab"
        rule="Chips filter, tabs switch a view in place. Chips invert to a light fill when selected; tabs mark the current one with an underline and drop the rest to the disabled ink. Neither is a button — if it triggers an action it is a Button."
      >
        <div className="flex flex-col gap-4">
          <ChipRow>
            <Chip selected>All angles</Chip>
            <Chip>New mechanism</Chip>
            <Chip>Failed solution</Chip>
            <Chip>Us vs them</Chip>
            <Chip>Social proof</Chip>
            <Chip>Identity</Chip>
          </ChipRow>
          <div className="flex items-center gap-5">
            <TextTab active>Carousels</TextTab>
            <TextTab>Static</TextTab>
            <TextTab>Video</TextTab>
          </div>
          <Row label="keys">
            <span className="flex items-center gap-1 text-default text-ink-secondary">
              Generate <Kbd>⌘</Kbd> <Kbd>⏎</Kbd>
            </span>
          </Row>
        </div>
      </Section>

      <Section
        id="toggles"
        title="Switch & checkbox"
        rule="A switch takes effect immediately; a checkbox is a choice that is submitted or that filters a list. Both invert to ink when on, so state never depends on hue."
      >
        <Toggles />
      </Section>

      <Section
        id="pickers"
        title="Pickers"
        rule="Select for one of many (field in forms, inline in bars — the composer's mode and model pickers). Segmented for two to four views of the same data, all visible. Slider for a continuous value with the number always printed. Stepper for a small integer with a hard range. Radio when each option deserves a sentence. Date and time share the calendar's own month grid."
      >
        <Pickers />
      </Section>
    </Page>
  );
}
