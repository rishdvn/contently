"use client";

import { Clapperboard, GalleryHorizontalEnd, Image as ImageIcon, MoreHorizontal, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, use, useState, type ReactNode } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogHeader } from "@/components/ui/dialog";
import { Menu, MenuItem } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import { useActiveOrg } from "@/lib/auth/useActiveOrg";
import { cn } from "@/lib/cn";
import { project as makeProject } from "@/lib/editor/factory";
import { googleFontsHref } from "@/lib/editor/fonts";
import { useProjectActions, useProjectDocument, useProjectIndex, type ProjectRecord } from "@/lib/editor/persistence";
import type { ProjectKind } from "@/lib/editor/types";

import { HubNav } from "./HubNav";
import { ImportLocalProjects } from "./ImportLocalProjects";
import { CardCaption, LibraryGrid, usePreviewRoute, type LibraryAdapter } from "./LibraryGrid";
import { PreviewModal } from "./PreviewModal";
import { LiveArt, relativeTime } from "./ProjectPreview";

/*
  The workspace: sidebar, page header with the single filled Create action,
  and a grid of what the organisation has made.
*/
export function Hub() {
  const router = useRouter();
  const toast = useToast();
  const { orgId, isLoaded } = useActiveOrg();
  const projects = useProjectIndex();
  const { createProject, deleteProject, duplicateProject, renameProject } = useProjectActions();
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const preview = usePreviewRoute();
  /* Signed in with no organisation selected: nothing owns a project, so the
     grid would be empty for a reason the user cannot see. */
  const orgless = isLoaded && !orgId;

  /*
    Create in Convex first, then navigate: the studio opens on a real id, so a
    reload or a shared link resolves instead of dead-ending.
  */
  const create = async (kind: ProjectKind) => {
    if (busy || orgless) return;
    setBusy(true);
    try {
      router.push(`/editor/${await createProject(makeProject(kind))}`);
    } catch (error) {
      console.error(error);
      setBusy(false);
      setCreating(false);
      toast({ title: "Couldn't create that project", description: "Check your connection and try again." });
    }
  };

  /* The list carries posters, not documents: the preview fetches the one it plays. */
  const previewDoc = useProjectDocument(preview.id);

  return (
    <div className="flex min-h-dvh bg-canvas text-ink">
      <link rel="stylesheet" href={googleFontsHref()} crossOrigin="anonymous" />
      <HubNav />

      <main className="min-w-0 flex-1 px-8 py-6">
        <header className="flex items-center justify-between gap-4">
          <span className="text-panels text-ink">Projects</span>
          <Button variant="primary" size="lg" disabled={orgless || busy} onClick={() => setCreating(true)}>
            <Plus /> Create
          </Button>
        </header>

        {orgless ? <OrglessNotice /> : <ImportLocalProjects />}

        <section className="mt-10">
          <h2 className="text-sections text-ink">Start something</h2>
          <div className="mt-5 grid grid-cols-3 gap-5">
            <StartCard kind="image" icon={<ImageIcon />} title="Image" body="One frame. Posts, ads, thumbnails." onClick={() => create("image")} />
            <StartCard kind="carousel" icon={<GalleryHorizontalEnd />} title="Carousel" body="A run of slides on one canvas." onClick={() => create("carousel")} />
            <StartCard kind="video" icon={<Clapperboard />} title="Video" body="Scenes on a timeline with motion." onClick={() => create("video")} />
          </div>
        </section>

        <section className="mt-12">
          <div className="flex items-baseline gap-3">
            <h2 className="text-sections text-ink">Recent</h2>
            <p className="text-default text-ink-secondary">{projects?.length ? `${projects.length} project${projects.length > 1 ? "s" : ""}` : "Everything you make lands here"}</p>
          </div>
          {projects === null ? null : projects.length ? (
            <ProjectCardActions
              value={{
                preview: (p) => preview.open(p.id),
                open: (p) => router.push(`/editor/${p.id}`),
                remove: (p) => void deleteProject(p.id),
                duplicate: (p) => void duplicateProject(p.id),
                rename: (p, name) => void renameProject(p.id, name),
              }}
            >
              <LibraryGrid className="mt-5" items={projects} adapter={PROJECTS} onPreview={(p) => preview.open(p.id)} />
            </ProjectCardActions>
          ) : (
            <div className="mt-5 flex h-40 items-center justify-center rounded-card bg-panel text-default text-ink-secondary">
              {orgless ? "Choose an organisation to see its projects." : "No projects yet — pick a format above."}
            </div>
          )}
        </section>
      </main>

      <Dialog open={creating} onClose={() => setCreating(false)} size="md">
        <DialogHeader title="Create" description="Pick a format. You can change the aspect ratio in the editor." onClose={() => setCreating(false)} />
        <DialogBody className="grid grid-cols-3 gap-3">
          <StartCard compact kind="image" icon={<ImageIcon />} title="Image" body="4:5" onClick={() => create("image")} />
          <StartCard compact kind="carousel" icon={<GalleryHorizontalEnd />} title="Carousel" body="3 slides · 4:5" onClick={() => create("carousel")} />
          <StartCard compact kind="video" icon={<Clapperboard />} title="Video" body="9:16 · 7s" onClick={() => create("video")} />
        </DialogBody>
      </Dialog>

      {previewDoc ? (
        <PreviewModal
          key={previewDoc.id}
          project={previewDoc}
          others={(projects ?? [])
            .filter((p) => p.id !== previewDoc.id && !p.pending)
            .map((p) => ({ id: p.id, name: p.name, width: p.width, height: p.height, art: <ProjectArt item={p} playing={false} /> }))}
          relative={relativeTime(previewDoc.updatedAt)}
          onClose={preview.close}
          onSwitch={preview.replace}
          onOpen={(id) => router.push(`/editor/${id}`)}
        />
      ) : null}
    </div>
  );
}

/*
  Signed in on a personal account. Projects are owned by an organisation, so
  there is nothing to show and nothing to create until one is picked — in the
  switcher at the bottom of the nav, which is why this points at it rather than
  repeating the control.
*/
function OrglessNotice() {
  return (
    <Alert className="mt-6" tone="caution" title="No organisation selected">
      Projects belong to an organisation. Pick one — or create one — with the switcher at the bottom of the sidebar.
    </Alert>
  );
}

const KIND_ART: Record<ProjectKind, string> = {
  image: "linear-gradient(160deg,#efe3cf,#c9a877)",
  carousel: "linear-gradient(160deg,#4cc9f0,#2a7fb8)",
  video: "linear-gradient(160deg,#6ee86e,#2f9e4f)",
};

function StartCard({ kind, icon, title, body, onClick, compact }: { kind: ProjectKind; icon: ReactNode; title: string; body: string; onClick: () => void; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex flex-col justify-end overflow-hidden text-left outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ink/25 active:scale-[0.99]",
        compact ? "aspect-[4/5] rounded-[16px]" : "aspect-[16/10] rounded-card",
      )}
      style={{ backgroundImage: KIND_ART[kind] }}
    >
      <div className="absolute inset-0 bg-[var(--gradient-scrim)] opacity-80" />
      <div className={cn("relative flex flex-col gap-1", compact ? "p-3" : "p-5")}>
        <span className="flex size-9 items-center justify-center rounded-[10px] bg-black/50 text-white [&>svg]:size-4">{icon}</span>
        <span className={cn("mt-2 text-white", compact ? "text-default" : "text-titles")}>{title}</span>
        <span className="text-cap text-white/70">{body}</span>
      </div>
    </button>
  );
}

/*
  One tile in the library, in the reference's shape: the artwork is the card.
  At rest it shows the poster frame with the name over a scrim. Hovering plays
  it — a video runs through its scenes, a carousel swipes through its slides,
  a still stays put — and reveals the facts badge, the actions button, and a
  progress line along the bottom edge. Clicking opens the enlarged preview.
*/
const PROJECTS: LibraryAdapter<ProjectRecord> = {
  key: (p) => p.id,
  label: (p) => p.name,
  aspect: (p) => p.width / p.height,
  Art: ProjectArt,
  Overlay: ProjectOverlay,
  /* A duplicate shows its copy before the server has minted an id for it;
     until it does, the card has nothing to open. */
  pending: (p) => p.pending,
};

/*
  At rest, the poster the studio took of the first scene. Hovering fetches the
  document and plays it over the poster. A project with no poster yet — one
  that has not been edited since posters existed, or a fresh duplicate — is
  drawn from its document, as every card was before.
*/
function ProjectArt({ item, playing }: { item: ProjectRecord; playing: boolean }) {
  const live = (playing && item.kind !== "image") || !item.posterUrl;
  const doc = useProjectDocument(live ? item.id : null);
  return (
    <div className="relative w-full overflow-hidden bg-[#1d1d1d]" style={{ aspectRatio: `${item.width} / ${item.height}` }}>
      {item.posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a Convex storage URL, already at card size
        <img src={item.posterUrl} alt="" draggable={false} className="absolute inset-0 size-full object-cover" />
      ) : null}
      {live && doc ? (
        <div className="absolute inset-0">
          <LiveArt project={doc} playing={playing && doc.kind !== "image"} />
        </div>
      ) : null}
    </div>
  );
}

/* "3 scenes · 14s" for a video, "5 slides" for a carousel, the aspect for a still: `projectMeta` from the row alone. */
function cardMeta(p: ProjectRecord) {
  if (p.kind === "video") return `${p.slides} scene${p.slides === 1 ? "" : "s"} · ${Math.round(p.duration)}s`;
  if (p.kind === "carousel") return `${p.slides} slide${p.slides === 1 ? "" : "s"}`;
  return p.aspect;
}

type ProjectCardCallbacks = {
  preview: (p: ProjectRecord) => void;
  open: (p: ProjectRecord) => void;
  remove: (p: ProjectRecord) => void;
  duplicate: (p: ProjectRecord) => void;
  rename: (p: ProjectRecord, name: string) => void;
};

/* The overlay's actions come from the page by context, so the adapter can be a
   constant and a card's rename field survives the page re-rendering. */
const ProjectCardContext = createContext<ProjectCardCallbacks | null>(null);
const ProjectCardActions = ProjectCardContext.Provider;

function ProjectOverlay({ item: p, hover }: { item: ProjectRecord; hover: boolean }) {
  const actions = use(ProjectCardContext);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(p.name);
  const commit = () => {
    setEditing(false);
    const name = draft.trim();
    if (name && name !== p.name) actions?.rename(p, name);
    else setDraft(p.name);
  };

  return (
    <>
      <CardCaption name={p.name} badge={hover ? cardMeta(p) : undefined}>
        {editing ? (
          <input
            autoFocus
            aria-label="Project name"
            className="pointer-events-auto h-6 min-w-0 flex-1 rounded-[6px] bg-black/70 px-1.5 text-ui text-white outline-none ring-1 ring-white/40"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setDraft(p.name);
                setEditing(false);
              }
            }}
          />
        ) : undefined}
      </CardCaption>

      <div
        className={cn(
          "absolute top-2 right-2 transition-opacity duration-150 has-[[aria-expanded=true]]:opacity-100 focus-within:opacity-100",
          hover && !p.pending ? "opacity-100" : "opacity-0",
          p.pending && "pointer-events-none",
        )}
      >
        <Menu
          align="end"
          trigger={(props) => (
            <button type="button" aria-label="Project options" className="flex size-7 items-center justify-center rounded-[7px] bg-black/60 text-white transition-colors hover:bg-black/80" {...props}>
              <MoreHorizontal className="size-4" />
            </button>
          )}
        >
          <MenuItem onClick={() => actions?.preview(p)}>Preview</MenuItem>
          <MenuItem onClick={() => actions?.open(p)}>Open in editor</MenuItem>
          <MenuItem
            onClick={() => {
              setDraft(p.name);
              setEditing(true);
            }}
          >
            Rename
          </MenuItem>
          <MenuItem onClick={() => actions?.duplicate(p)}>Duplicate</MenuItem>
          <MenuItem destructive onClick={() => actions?.remove(p)}>
            Delete
          </MenuItem>
        </Menu>
      </div>
    </>
  );
}
