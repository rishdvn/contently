"use client";

import {
  Blocks,
  Bookmark,
  Clapperboard,
  Compass,
  Folder,
  GalleryHorizontalEnd,
  Image as ImageIcon,
  LayoutTemplate,
  MoreHorizontal,
  Palette,
  Plus,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogHeader } from "@/components/ui/dialog";
import { Menu, MenuItem } from "@/components/ui/menu";
import { NavItem, Sidebar, SidebarGroup } from "@/components/ui/nav";
import { cn } from "@/lib/cn";
import { uid } from "@/lib/editor/factory";
import { googleFontsHref } from "@/lib/editor/fonts";
import { deleteProject, duplicateProject, loadProject, renameProject, useProjectIndex, type ProjectSummary } from "@/lib/editor/persistence";
import type { Project, ProjectKind } from "@/lib/editor/types";

import { PreviewModal } from "./PreviewModal";
import { projectMeta, ProjectStage, useProjectClock } from "./ProjectPreview";

/*
  The workspace: sidebar, page header with the single filled Create action,
  and a grid of what the user has made. Projects are local to this browser.
*/
export function Hub() {
  const router = useRouter();
  const projects = useProjectIndex();
  const [creating, setCreating] = useState(false);
  const preview = usePreviewRoute();

  const create = (kind: ProjectKind) => {
    const id = uid();
    router.push(`/editor/${id}?kind=${kind}`);
  };

  /* Full documents for the previews. Re-read when the index changes, since that is when storage changed. */
  const docs = useMemo(() => {
    const map = new Map<string, Project>();
    projects?.forEach((p) => {
      const doc = loadProject(p.id);
      if (doc) map.set(p.id, doc);
    });
    return map;
  }, [projects]);
  const previewDoc = preview.id ? docs.get(preview.id) : undefined;

  return (
    <div className="flex min-h-dvh bg-canvas text-ink">
      <link rel="stylesheet" href={googleFontsHref()} crossOrigin="anonymous" />
      <Sidebar className="sticky top-0 h-dvh">
        <div className="px-2.5 pt-1 pb-2 text-titles text-ink italic">Contently</div>
        <SidebarGroup label="Home">
          <NavItem icon={<Compass />}>Explore</NavItem>
          <NavItem icon={<LayoutTemplate />}>Templates</NavItem>
          <NavItem icon={<Blocks />}>Blocks</NavItem>
          <NavItem icon={<Plus />} onClick={() => setCreating(true)}>
            Create
          </NavItem>
        </SidebarGroup>
        <SidebarGroup label="Workspace">
          <NavItem icon={<Folder />} active>
            Projects
          </NavItem>
          <NavItem icon={<Bookmark />}>Favorites</NavItem>
          <NavItem icon={<Palette />}>Brandkit</NavItem>
          <NavItem icon={<Users />}>Team</NavItem>
        </SidebarGroup>
        <div className="mt-auto flex items-center gap-2.5 px-2.5 py-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-spectrum-green text-[13px] font-semibold text-canvas">P</span>
          <div className="min-w-0">
            <div className="truncate text-ui text-ink">Personal</div>
            <div className="truncate text-cap text-ink-secondary">Local workspace</div>
          </div>
        </div>
      </Sidebar>

      <main className="min-w-0 flex-1 px-8 py-6">
        <header className="flex items-center justify-between gap-4">
          <span className="text-panels text-ink">Projects</span>
          <Button variant="primary" size="lg" onClick={() => setCreating(true)}>
            <Plus /> Create
          </Button>
        </header>

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
            <div className="mt-5 columns-4 gap-4 xl:columns-5">
              {projects.map((p) => (
                <ProjectCard
                  key={p.id}
                  p={p}
                  doc={docs.get(p.id)}
                  onPreview={() => preview.open(p.id)}
                  onOpen={() => router.push(`/editor/${p.id}`)}
                  onDelete={() => deleteProject(p.id)}
                  onDuplicate={() => duplicateProject(p.id, uid())}
                  onRename={(name) => renameProject(p.id, name)}
                />
              ))}
            </div>
          ) : (
            <div className="mt-5 flex h-40 items-center justify-center rounded-card bg-panel text-default text-ink-secondary">No projects yet — pick a format above.</div>
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
          others={Array.from(docs.values()).filter((d) => d.id !== previewDoc.id)}
          relative={relative(previewDoc.updatedAt)}
          onClose={preview.close}
          onSwitch={preview.replace}
          onOpen={(id) => router.push(`/editor/${id}`)}
        />
      ) : null}
    </div>
  );
}

/*
  The open preview lives in the URL as ?preview=<id>, as the reference does,
  so it survives a refresh and Back closes it. Native history calls are used
  because the app router keeps them in sync without a navigation.
*/
const routeListeners = new Set<() => void>();
const notifyRoute = () => routeListeners.forEach((l) => l());
const readPreview = () => new URLSearchParams(window.location.search).get("preview");

function usePreviewRoute() {
  const pushed = useRef(false);
  const id = useSyncExternalStore(
    (cb) => {
      routeListeners.add(cb);
      const onPop = () => {
        pushed.current = false;
        cb();
      };
      window.addEventListener("popstate", onPop);
      return () => {
        routeListeners.delete(cb);
        window.removeEventListener("popstate", onPop);
      };
    },
    readPreview,
    () => null,
  );

  const open = useCallback((next: string) => {
    window.history.pushState(null, "", `?preview=${encodeURIComponent(next)}`);
    pushed.current = true;
    notifyRoute();
  }, []);
  const replace = useCallback((next: string) => {
    window.history.replaceState(null, "", `?preview=${encodeURIComponent(next)}`);
    notifyRoute();
  }, []);
  const close = useCallback(() => {
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else {
      window.history.replaceState(null, "", window.location.pathname);
      notifyRoute();
    }
  }, []);

  return { id, open, replace, close };
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
function ProjectCard({
  p,
  doc,
  onPreview,
  onOpen,
  onDelete,
  onDuplicate,
  onRename,
}: {
  p: ProjectSummary;
  doc?: Project;
  onPreview: () => void;
  onOpen: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(p.name);
  const [hover, setHover] = useState(false);
  const commit = () => {
    setEditing(false);
    const name = draft.trim();
    if (name && name !== p.name) onRename(name);
    else setDraft(p.name);
  };
  const animated = p.kind !== "image";

  return (
    <div
      className="group relative mb-4 break-inside-avoid rounded-[12px]"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        onClick={onPreview}
        aria-label={`Preview ${p.name}`}
        className="relative block w-full overflow-hidden rounded-[12px] bg-card text-left outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-inset"
      >
        {doc ? <LiveArt project={doc} playing={hover && animated} /> : <div className="aspect-[4/5] w-full" style={{ backgroundImage: KIND_ART[p.kind] }} />}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 scrim" />
      </button>

      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center gap-2">
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
        ) : (
          <span className="truncate text-ui font-medium text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.6)]">{p.name}</span>
        )}
        <span className="hidden shrink-0 rounded-[6px] bg-black/60 px-1.5 py-0.5 text-tiny whitespace-nowrap text-white group-hover:inline-block">{doc ? projectMeta(doc) : p.aspect}</span>
      </div>

      <div className="absolute top-2 right-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100 has-[[aria-expanded=true]]:opacity-100 focus-within:opacity-100">
        <Menu
          align="end"
          trigger={(props) => (
            <button type="button" aria-label="Project options" className="flex size-7 items-center justify-center rounded-[7px] bg-black/60 text-white transition-colors hover:bg-black/80" {...props}>
              <MoreHorizontal className="size-4" />
            </button>
          )}
        >
          <MenuItem onClick={onPreview}>Preview</MenuItem>
          <MenuItem onClick={onOpen}>Open in editor</MenuItem>
          <MenuItem
            onClick={() => {
              setDraft(p.name);
              setEditing(true);
            }}
          >
            Rename
          </MenuItem>
          <MenuItem onClick={onDuplicate}>Duplicate</MenuItem>
          <MenuItem destructive onClick={onDelete}>
            Delete
          </MenuItem>
        </Menu>
      </div>
    </div>
  );
}

/* The card's artwork plus the progress line that runs along its bottom edge while it plays. */
function LiveArt({ project, playing }: { project: Project; playing: boolean }) {
  const clock = useProjectClock(project, playing);
  const progress = clock.total > 0 ? clock.elapsed / clock.total : 0;
  return (
    <>
      <ProjectStage project={project} clock={clock} className="w-full" />
      {project.kind !== "image" ? (
        <div className={cn("pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[3px] bg-white/20 transition-opacity duration-150", playing ? "opacity-100" : "opacity-0")}>
          <div className="h-full bg-spectrum-amber" style={{ width: `${progress * 100}%` }} />
        </div>
      ) : null}
    </>
  );
}

function relative(ts: number) {
  const d = Date.now() - ts;
  const m = Math.round(d / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? "s" : ""} ago`;
  const days = Math.round(h / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}
