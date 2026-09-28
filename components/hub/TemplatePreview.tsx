"use client";

import { useMutation, useQuery } from "convex/react";
import { LoaderCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { useToast } from "@/components/ui/toast";
import { api } from "@/convex/_generated/api";
import { useActiveOrg } from "@/lib/auth/useActiveOrg";
import { cn } from "@/lib/cn";
import { ROLE_LABEL } from "@/lib/editor/roles";
import { ASPECTS, type AspectId, type Project, type Slide } from "@/lib/editor/types";

import { DeleteTemplateDialog, useDeletableTemplates } from "./DeleteTemplateDialog";
import { LibraryGrid } from "./LibraryGrid";
import { PreviewCloseButton, PreviewFact, PreviewOutlineButton, PreviewPanel, PreviewShell, PreviewTags, ProjectPreviewStage, ShareButton, usePreviewPlayback } from "./PreviewModal";
import { ProjectStage, useProjectClock } from "./ProjectPreview";
import { TEMPLATE_KIND_LABEL, TEMPLATES, templateMeta, templateSize, useTemplateScope, type TemplateSummary } from "./TemplateCard";

/* Stands in for the document while it loads, so playback has something to hold. */
const LOADING: Project = { id: "", name: "", kind: "video", aspect: "9:16", width: 1080, height: 1920, slides: [], audio: [], createdAt: 0, updatedAt: 0 };

const MORE_LIKE_THIS = 6;

/*
  The Templates page's enlarged preview, after Butter's: the template playing
  large, and a sidebar with Create, what the template is, its scenes (click one
  to jump to it), its categories and tags, and more like it. `initial` is the
  card that was clicked, so the sidebar paints while the document is fetched;
  opened from a link it waits for it instead.
*/
export function TemplatePreview({
  id,
  initial,
  library,
  onClose,
  onSwitch,
}: {
  id: string;
  initial?: TemplateSummary;
  /* The rest of the library, for "More like this". */
  library: TemplateSummary[];
  onClose: () => void;
  onSwitch: (id: string) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const { orgId, isLoaded } = useActiveOrg();
  const scope = useTemplateScope();
  const full = useQuery(api.templates.get, scope ? { id, ...scope } : "skip");
  const createFrom = useMutation(api.templates.createProjectFrom);
  const [busy, setBusy] = useState(false);
  const deletable = useDeletableTemplates().has(id);
  const [deleting, setDeleting] = useState(false);

  const t: TemplateSummary | undefined = full ?? initial;
  const doc = full?.document as Project | undefined;
  const playback = usePreviewPlayback(doc ?? LOADING);
  const similar = useMemo(() => (t ? moreLikeThis(t, library) : []), [t, library]);

  if (full === null) {
    return (
      <PreviewShell label="Template preview" onClose={onClose} stage={() => <p className="text-default text-ink-secondary">This template isn&rsquo;t available.</p>}>
        <div className="flex shrink-0 gap-2">
          <PreviewCloseButton onClose={onClose} />
        </div>
      </PreviewShell>
    );
  }

  /* A copy in the active organisation, then straight into the studio. */
  const create = async () => {
    if (!orgId || busy) return;
    setBusy(true);
    try {
      router.push(`/editor/${await createFrom({ orgId, id })}`);
    } catch (error) {
      console.error(error);
      setBusy(false);
      toast({ title: "Couldn't create from that template", description: "Check your connection and try again." });
    }
  };

  const unit = t?.kind === "video" ? "Scenes" : "Slides";
  const orgless = isLoaded && !orgId;

  return (
    <PreviewShell
      label={`${t?.name ?? "Template"} preview`}
      onClose={onClose}
      stage={(area) =>
        doc ? <ProjectPreviewStage project={doc} area={area} playback={playback} /> : t?.poster ? <PosterStage t={t} area={area} /> : <LoaderCircle className="size-6 animate-spin text-ink-secondary" />
      }
    >
      <div className="flex shrink-0 gap-2">
        <ShareButton id={id} url={`/templates?preview=${id}`} />
        <PreviewCloseButton onClose={onClose} />
      </div>

      <PreviewPanel>
        <div className="text-cap text-ink-secondary">{t && !t.published ? "Template · Draft" : "Template"}</div>
        <div className="mt-1 text-[20px] leading-7 font-medium break-words text-ink">{t?.name ?? "…"}</div>
        {t && !t.published ? <p className="mt-1.5 text-cap text-ink-secondary">Unpublished: only your organisation sees it.</p> : null}
      </PreviewPanel>

      <button
        type="button"
        disabled={!orgId || !t || busy}
        onClick={create}
        className="flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-[10px] bg-white text-default text-canvas transition-colors hover:bg-[#e8e8e8] focus-visible:ring-2 focus-visible:ring-spectrum-amber focus-visible:outline-none disabled:opacity-60"
      >
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
        Create
      </button>
      {orgless ? <p className="-mt-1 shrink-0 px-1 text-cap text-ink-secondary">Choose an organisation in the sidebar to create from a template.</p> : null}

      {deletable && t ? (
        <PreviewOutlineButton onClick={() => setDeleting(true)}>
          <Trash2 /> Delete template
        </PreviewOutlineButton>
      ) : null}
      <DeleteTemplateDialog template={deleting && t ? t : null} onClose={() => setDeleting(false)} onDeleted={onClose} />

      {t ? (
        <PreviewPanel>
          <div className="text-ui text-ink">Info</div>
          <PreviewFact label="Size" value={`${templateSize(t).width} × ${templateSize(t).height}`} />
          <PreviewFact label="Type" value={TEMPLATE_KIND_LABEL[t.kind] ?? t.kind} />
          <PreviewFact label="Aspect" value={ASPECTS[t.aspect as AspectId]?.label ?? t.aspect} />
          {t.kind !== "image" ? <PreviewFact label={t.kind === "video" ? "Length" : "Slides"} value={templateMeta(t)} /> : null}
          {full?.slots.length ? <PreviewFact label="To fill in" value={<SlotSummary slots={full.slots} />} /> : null}
        </PreviewPanel>
      ) : null}

      {t && t.kind !== "image" && t.scenes.length ? (
        <PreviewPanel>
          <div className="text-ui text-ink">{unit}</div>
          <ol aria-label={unit} className="mt-2 flex flex-col gap-0.5">
            {t.scenes.map((scene, i) => {
              const active = !!doc && playback.clock.index === i;
              return (
                <li key={scene.id}>
                  <button
                    type="button"
                    aria-current={active ? "true" : undefined}
                    disabled={!doc}
                    onClick={() => {
                      playback.clock.goTo(i);
                      playback.setPlaying(true);
                    }}
                    className={cn(
                      "-mx-1.5 flex w-[calc(100%+12px)] items-center gap-2.5 rounded-[8px] px-1.5 py-1.5 text-left transition-colors",
                      active ? "bg-raised" : "hover:bg-raised/60",
                    )}
                  >
                    <ScenePoster t={t} doc={doc} slide={doc?.slides[i]} poster={t.scenePosters[i] ?? null} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-ui text-ink">{scene.name || `${unit.slice(0, -1)} ${i + 1}`}</span>
                      <span className="block text-tiny text-ink-secondary">{t.kind === "video" ? `${Math.round(scene.duration * 10) / 10}s` : `${i + 1} of ${t.scenes.length}`}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </PreviewPanel>
      ) : null}

      {t && (t.categories.length || t.tags.length) ? (
        <PreviewPanel className="[&>div:first-child]:mt-0">
          {t.categories.length ? <PreviewTags label="Categories" tags={t.categories.map(capitalise)} /> : null}
          {t.tags.length ? <PreviewTags label="Tags" tags={t.tags.map(capitalise)} /> : null}
        </PreviewPanel>
      ) : null}

      {similar.length ? (
        <PreviewPanel>
          <div className="text-ui text-ink">More like this</div>
          {/* A masonry of its own, so neighbours keep their shapes and play on hover as on the page. */}
          <LibraryGrid className="mt-3" items={similar} adapter={TEMPLATES} columns={{ base: 2, xl: 2 }} onPreview={(o) => onSwitch(o.id)} />
        </PreviewPanel>
      ) : null}
    </PreviewShell>
  );
}

/* The poster at the size the template will play at, until its document arrives. */
function PosterStage({ t, area }: { t: TemplateSummary; area: { w: number; h: number } }) {
  const { width, height } = templateSize(t);
  const pad = 24;
  const w = Math.max(0, Math.min(area.w - pad * 2, ((area.h - pad * 2) * width) / height, width));
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a Convex storage URL
    <img src={t.poster ?? undefined} alt="" className="shrink-0 rounded-[12px] bg-black shadow-overlay" style={{ width: w, aspectRatio: `${width} / ${height}` }} />
  );
}

/* A scene's rendered poster; a template without posters yet draws the scene at rest. */
function ScenePoster({ t, doc, slide, poster }: { t: TemplateSummary; doc?: Project; slide?: Slide; poster: string | null }) {
  const { width, height } = templateSize(t);
  return (
    <span className="relative block w-10 shrink-0 overflow-hidden rounded-[5px] bg-card" style={{ aspectRatio: `${width} / ${height}` }}>
      {poster ? (
        // eslint-disable-next-line @next/next/no-img-element -- a Convex storage URL at thumbnail size
        <img src={poster} alt="" draggable={false} className="absolute inset-0 size-full object-cover" />
      ) : doc && slide ? (
        <StillScene doc={doc} slide={slide} />
      ) : null}
    </span>
  );
}

function StillScene({ doc, slide }: { doc: Project; slide: Slide }) {
  const one = useMemo(() => ({ ...doc, kind: "image" as const, slides: [slide] }), [doc, slide]);
  const clock = useProjectClock(one, false);
  return <ProjectStage project={one} clock={clock} className="absolute inset-0" />;
}

/* "1 Hook · 2 Background images · 1 Call to action": what a user will replace, from the template's slots. */
function SlotSummary({ slots }: { slots: { role?: string; type: string }[] }) {
  const counts = new Map<string, number>();
  for (const slot of slots) {
    const label = slot.role ? (ROLE_LABEL[slot.role as keyof typeof ROLE_LABEL] ?? slot.role) : UNTAGGED[slot.type];
    if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return (
    <ul className="flex flex-col gap-0.5">
      {[...counts].map(([label, n]) => (
        <li key={label}>
          {n} {n === 1 ? label : plural(label)}
        </li>
      ))}
    </ul>
  );
}

const UNTAGGED: Record<string, string> = { image: "Image", video: "Video", component: "Block" };

const PLURAL: Record<string, string> = { Body: "Body texts", "Call to action": "Calls to action" };
const plural = (label: string) => PLURAL[label] ?? `${label}s`;

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/*
  The templates nearest this one: sharing categories counts most, then tags,
  then being the same family (video, or static). Only templates that share
  something are offered.
*/
function moreLikeThis(t: TemplateSummary, library: TemplateSummary[]) {
  const family = (k: string) => (k === "video" ? "video" : "static");
  return library
    .filter((o) => o.id !== t.id)
    .map((o) => {
      const categories = o.categories.filter((c) => t.categories.includes(c)).length;
      const tags = o.tags.filter((c) => t.tags.includes(c)).length;
      return { o, shared: categories + tags, score: categories * 3 + tags * 2 + (family(o.kind) === family(t.kind) ? 1 : 0) };
    })
    .filter((x) => x.shared > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MORE_LIKE_THIS)
    .map((x) => x.o);
}
