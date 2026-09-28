"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Chip, ChipRow } from "@/components/ui/chip";
import { Dialog, DialogBody, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { settle } from "@/components/render/settle";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useActiveOrg } from "@/lib/auth/useActiveOrg";
import { slideToBlob } from "@/lib/editor/export";
import { useSaveProject } from "@/lib/editor/persistence";
import { POSTER_WIDTH, posterTime } from "@/lib/editor/posterTime";
import { useEditor } from "@/lib/editor/store";
import { ASPECTS, type AspectId, type Project } from "@/lib/editor/types";

/*
  Save as template, from the studio's project menu (`TopBar.tsx`), for an
  organisation's admins. The project becomes a template private to the
  organisation (`templates.createFromProject`); saving a project that already
  has one refreshes that template instead of making a second. An admin of the
  publisher organisation also gets a Publish box (`templates.publish`).

  Posters are drawn here, by the studio's own exporter, as the last step
  (`savePosters`): a scene at a time, at the moment the poster script would
  pick (`posterTime`), 540 px wide. The studio already has every font, photo
  and block of the project painted, so this takes a second or two and needs
  nothing else running. `docs/templates.md` → "Building one" says more.
*/

type Busy = "saving" | { posters: number; of: number } | null;

const KIND_LABEL: Record<string, string> = { video: "Video", carousel: "Carousel", image: "Image" };

const normalise = (word: string) => word.trim().toLowerCase().replace(/\s+/g, " ");
const words = (text: string) => [...new Set(text.split(",").map(normalise).filter(Boolean))];

export function SaveTemplateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} size="md">
      {/* Mounted only while open, so every open starts from the saved template. */}
      {open ? <SaveTemplateBody onClose={onClose} /> : null}
    </Dialog>
  );
}

function SaveTemplateBody({ onClose }: { onClose: () => void }) {
  const { orgId } = useActiveOrg();
  const project = useEditor((s) => s.project);
  const info = useQuery(api.templates.forProject, orgId ? { orgId, projectId: project.id } : "skip");
  /* Until the query answers there is nothing to prefill from, so the form waits. */
  if (!info) return <DialogHeader title="Save as template" description="Loading…" onClose={onClose} />;
  return <SaveTemplateForm info={info} project={project} onClose={onClose} />;
}

type Info = NonNullable<FunctionReturnType<typeof api.templates.forProject>>;

function SaveTemplateForm({ info, project, onClose }: { info: Info; project: Project; onClose: () => void }) {
  const { orgId } = useActiveOrg();
  const toast = useToast();
  const saveProject = useSaveProject();
  const createFromProject = useMutation(api.templates.createFromProject);
  const publish = useMutation(api.templates.publish);
  const savePosters = useAction(api.templatePosters.savePosters);

  /* Read once: the form is prefilled from the template as it was when the dialog opened. */
  const [existing] = useState(info.template);
  const [name, setName] = useState(existing?.name ?? project.name);
  const [categories, setCategories] = useState<string[]>(existing?.categories ?? []);
  const [draftCategory, setDraftCategory] = useState("");
  const [tags, setTags] = useState((existing?.tags ?? []).join(", "));
  const [published, setPublished] = useState(existing?.published ?? false);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);

  const offered = [...new Set([...categories, ...info.categories])];
  const toggle = (c: string) => setCategories((list) => (list.includes(c) ? list.filter((x) => x !== c) : [...list, c]));
  const addCategory = () => {
    const c = normalise(draftCategory);
    if (c && !categories.includes(c)) setCategories([...categories, c]);
    setDraftCategory("");
  };

  const save = async (asNew: boolean) => {
    if (!orgId || busy) return;
    setError(null);
    setBusy("saving");
    let id: string;
    try {
      /* The template copies the stored document, so what is on screen is stored first. */
      await saveProject(useEditor.getState().project);
      id = await createFromProject({
        orgId,
        projectId: project.id,
        ...(existing && !asNew ? { templateId: existing.id } : {}),
        name: name.trim() || project.name,
        categories,
        tags: words(tags),
      });
      if (info.canPublish && published !== ((!asNew && existing?.published) || false)) await publish({ orgId, id, published });
    } catch (e) {
      console.error(e);
      setBusy(null);
      setError(errorText(e) ?? "The template couldn't be saved. Check your connection and try again.");
      return;
    }

    try {
      const posters = await drawPosters(useEditor.getState().project, (n, of) => setBusy({ posters: n, of }));
      await savePosters({ orgId, id: id as Id<"templates">, posters });
      toast({ title: existing && !asNew ? `Updated “${name.trim() || project.name}”` : `Saved “${name.trim() || project.name}” as a template`, description: "It's in Templates and in the Templates flyout." });
    } catch (e) {
      console.error(e);
      toast({ title: "Template saved without posters", description: "Its cards draw it live until posters are made. Save again to retry." });
    }
    setBusy(null);
    onClose();
  };

  const kind = `${KIND_LABEL[project.kind] ?? project.kind} · ${ASPECTS[project.aspect as AspectId]?.label ?? project.aspect}`;
  const label = busy === "saving" ? "Saving…" : busy ? `Drawing posters ${busy.posters} of ${busy.of}…` : existing ? "Update template" : "Save template";

  return (
    <>
      <DialogHeader
        title={existing ? "Update template" : "Save as template"}
        description={
          existing
            ? `“${existing.name}” was made from this project. Updating it replaces its design with this project as it is now.`
            : "A copy of this project, private to your organisation, in Templates and in the studio's Templates flyout."
        }
        onClose={onClose}
      />
      <DialogBody className="flex flex-col gap-4">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder={project.name} />
        </Field>
        <Field label="Kind" hint="From the project: a template is the same kind and size as what it was made from.">
          <span className="text-default text-ink">{kind}</span>
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-cap text-ink-secondary">Categories</span>
          {offered.length ? (
            <ChipRow wrap>
              {offered.map((c) => (
                <Chip key={c} selected={categories.includes(c)} onClick={() => toggle(c)} className="h-7 px-3 text-cap capitalize">
                  {c}
                  {categories.includes(c) ? <X className="size-3" /> : null}
                </Chip>
              ))}
            </ChipRow>
          ) : null}
          <Input
            value={draftCategory}
            onChange={(e) => setDraftCategory(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCategory();
              }
            }}
            onBlur={addCategory}
            placeholder="Add a category, then Enter"
            aria-label="New category"
          />
          <span className="text-cap text-ink-disabled">The chips on the Templates page. Reuse one where it fits.</span>
        </div>
        <Field label="Tags" hint="Extra search words, separated by commas.">
          <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="launch, skincare" />
        </Field>
        {info.canPublish ? (
          <label className="flex items-start gap-2.5">
            <Checkbox checked={published} onCheckedChange={setPublished} aria-label="Publish to every organisation" />
            <span className="flex flex-col gap-0.5">
              <span className="text-default text-ink">Publish to every organisation</span>
              <span className="text-cap text-ink-secondary">Off, only your organisation sees it.</span>
            </span>
          </label>
        ) : null}
        {error ? <p className="text-cap text-critical">{error}</p> : null}
      </DialogBody>
      <DialogFooter
        secondary={
          existing ? (
            <Button variant="ghost" disabled={!!busy} onClick={() => save(true)}>
              Save as new template
            </Button>
          ) : null
        }
      >
        <Button variant="ghost" disabled={!!busy} onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" disabled={!!busy} onClick={() => save(false)}>
          {label}
        </Button>
      </DialogFooter>
    </>
  );
}

/*
  One poster per scene, in order, drawn from the canvas by the exporter the
  Export dialog uses. A video shows one scene at a time, so each is brought
  up at its poster moment; carousels and images have every slide on the canvas
  already. The playhead, the active scene and the selection are put back after.
*/
async function drawPosters(project: Project, onProgress: (n: number, of: number) => void): Promise<ArrayBuffer[]> {
  const before = useEditor.getState();
  const restore = { activeSlideId: before.activeSlideId, time: before.time, selection: before.selection };
  useEditor.setState({ playing: false, selection: [], editingTextId: null });
  const scale = POSTER_WIDTH / project.width;
  const posters: ArrayBuffer[] = [];
  try {
    for (const [i, scene] of project.slides.entries()) {
      onProgress(i + 1, project.slides.length);
      if (project.kind === "video") useEditor.setState({ activeSlideId: scene.id, time: posterTime(scene) });
      await settle();
      const blob = await slideToBlob(project, scene.id, "jpeg", scale);
      posters.push(await blob.arrayBuffer());
    }
  } finally {
    useEditor.setState(restore);
  }
  return posters;
}

/* A denial's own words (`ConvexError` data), which say what to do about it. */
function errorText(error: unknown): string | null {
  const data = (error as { data?: { message?: unknown } } | null)?.data;
  return data && typeof data.message === "string" ? data.message : null;
}
