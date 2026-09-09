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
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogHeader } from "@/components/ui/dialog";
import { Menu, MenuItem } from "@/components/ui/menu";
import { NavItem, Sidebar, SidebarGroup } from "@/components/ui/nav";
import { cn } from "@/lib/cn";
import { uid } from "@/lib/editor/factory";
import { deleteProject, duplicateProject, renameProject, useProjectIndex, type ProjectSummary } from "@/lib/editor/persistence";
import type { ProjectKind } from "@/lib/editor/types";

/*
  The workspace: sidebar, page header with the single filled Create action,
  and a grid of what the user has made. Projects are local to this browser.
*/
export function Hub() {
  const router = useRouter();
  const projects = useProjectIndex();
  const [creating, setCreating] = useState(false);

  const create = (kind: ProjectKind) => {
    const id = uid();
    router.push(`/editor/${id}?kind=${kind}`);
  };

  return (
    <div className="flex min-h-dvh bg-canvas text-ink">
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
            <div className="mt-5 grid grid-cols-4 gap-5">
              {projects.map((p) => (
                <ProjectCard
                  key={p.id}
                  p={p}
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
    </div>
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

const KIND_LABEL: Record<ProjectKind, string> = { image: "Image", carousel: "Carousel", video: "Video" };

function ProjectCard({
  p,
  onOpen,
  onDelete,
  onDuplicate,
  onRename,
}: {
  p: ProjectSummary;
  onOpen: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(p.name);
  const commit = () => {
    setEditing(false);
    const name = draft.trim();
    if (name && name !== p.name) onRename(name);
    else setDraft(p.name);
  };
  return (
    <div className="group relative flex flex-col gap-2.5">
      <button type="button" onClick={onOpen} className="relative aspect-[4/5] overflow-hidden rounded-card outline-none focus-visible:ring-2 focus-visible:ring-ink/25" style={{ backgroundImage: KIND_ART[p.kind] }} aria-label={`Open ${p.name}`}>
        <div className="absolute inset-0 bg-black/30" />
        <span className="absolute top-3 left-3 rounded-full bg-black/60 px-2 py-0.5 text-cap text-white">
          {KIND_LABEL[p.kind]} · {p.aspect}
        </span>
        {p.kind !== "image" ? <span className="absolute right-3 bottom-3 rounded-full bg-black/60 px-2 py-0.5 text-cap text-white">{p.slides} {p.kind === "video" ? "scenes" : "slides"}</span> : null}
      </button>
      <div className="flex items-center gap-2 px-1">
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              aria-label="Project name"
              className="-mx-1.5 h-6 w-[calc(100%+12px)] rounded-[6px] bg-card px-1.5 text-default text-ink outline-none"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") {
                  setDraft(p.name);
                  setEditing(false);
                }
              }}
            />
          ) : (
            <div className="truncate text-default text-ink" onDoubleClick={() => setEditing(true)}>
              {p.name}
            </div>
          )}
          <div className="truncate text-cap text-ink-secondary">{relative(p.updatedAt)}</div>
        </div>
        <Menu
          align="end"
          trigger={(props) => (
            <button type="button" aria-label="Project options" className="flex size-8 items-center justify-center rounded-[8px] text-ink-secondary opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--state-hover)] hover:text-ink focus-visible:opacity-100 aria-expanded:opacity-100" {...props}>
              <MoreHorizontal className="size-4" />
            </button>
          )}
        >
          <MenuItem onClick={onOpen}>Open</MenuItem>
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
