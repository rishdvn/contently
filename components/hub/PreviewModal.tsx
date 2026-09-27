"use client";

import { Check, ChevronLeft, ChevronRight, Download, Info, Maximize, Pause, Play, Share, Volume2, VolumeX, X } from "lucide-react";
import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { fontDef } from "@/lib/editor/fonts";
import { ASPECTS, type Project } from "@/lib/editor/types";

import { formatClock, projectMeta, ProjectStage, useProjectClock } from "./ProjectPreview";

const SIDEBAR_W = 264;
const GUTTER = 8;

/* A finished file a viewer can take away, from the render worker's output. */
export type PreviewDownload = { label: string; url: string };

/*
  The enlarged preview. The page stays underneath, dimmed and blurred; the
  project plays large in the space left of a floating sidebar of panels —
  actions, title, facts, and the rest of the library to move on to.

  The share viewer at `/p/<id>` is the same surface with nothing underneath:
  it leaves out what it has no use for (closing, the library, the studio for
  someone outside the org) and adds the downloads.
*/
export function PreviewModal({
  project,
  others = [],
  onClose,
  onOpen,
  onSwitch,
  relative,
  shareUrl,
  downloads = [],
}: {
  project: Project;
  others?: Project[];
  onClose?: () => void;
  onOpen?: (id: string) => void;
  onSwitch?: (id: string) => void;
  relative: string;
  /* What the share button copies, absolute or from the origin. Defaults to the
     studio link, for the hub. */
  shareUrl?: string;
  downloads?: PreviewDownload[];
}) {
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const clock = useProjectClock(project, playing, { resetOnStop: false });
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
      if (project.kind === "carousel" && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        clock.goTo(clock.index + (e.key === "ArrowRight" ? 1 : -1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [project.kind, clock]);

  return (
    <PreviewShell
      label={`${project.name} preview`}
      onClose={onClose}
      stage={(area) => {
        /* Fit the document inside the area with breathing room, never upscaling past its export size. */
        const pad = 24;
        const stageW = Math.max(0, Math.min(area.w - pad * 2, ((area.h - pad * 2) * project.width) / project.height, project.width));
        return stageW > 0 ? (
          <Stage
            ref={stageRef}
            project={project}
            clock={clock}
            width={stageW}
            playing={playing}
            muted={muted}
            onTogglePlay={() => setPlaying((p) => !p)}
            onToggleMute={() => setMuted((m) => !m)}
            onFullscreen={() => stageRef.current?.requestFullscreen?.().catch(() => {})}
          />
        ) : null;
      }}
    >
      <div className="flex shrink-0 gap-2">
        <ShareButton url={shareUrl} id={project.id} />
        {onClose ? <PreviewCloseButton onClose={onClose} /> : null}
      </div>

      <PreviewPanel>
        <div className="text-cap text-ink-secondary">{KIND_LABEL[project.kind]}</div>
        <div className="mt-1 truncate text-[20px] leading-7 font-medium text-ink">{project.name}</div>
      </PreviewPanel>

      {downloads.map((d) => (
        <a
          key={d.url}
          href={d.url}
          download
          target="_blank"
          rel="noreferrer"
          className="flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-[10px] bg-white text-default text-canvas transition-colors hover:bg-[#e8e8e8] focus-visible:ring-2 focus-visible:ring-spectrum-amber focus-visible:outline-none"
        >
          <Download className="size-4" />
          {d.label}
        </a>
      ))}

      {onOpen ? <PreviewOutlineButton onClick={() => onOpen(project.id)}>Open in editor</PreviewOutlineButton> : null}

      <PreviewPanel>
        <div className="text-ui text-ink">Info</div>
        <PreviewFact label="Size" value={`${project.width} × ${project.height}`} />
        <PreviewFact label="Type" value={KIND_LABEL[project.kind]} />
        <PreviewFact label={project.kind === "video" ? "Length" : project.kind === "carousel" ? "Slides" : "Format"} value={project.kind === "image" ? ASPECTS[project.aspect].label : projectMeta(project)} />
        <PreviewFact label="Edited" value={relative} />

        <div className="mt-4 text-cap text-ink-secondary">Contents</div>
        <ul className="mt-1.5 flex flex-col gap-1.5">
          {contents(project).map((c) => (
            <li key={c} className="flex items-center gap-1.5 text-ui text-ink">
              {c}
              <Info className="size-3.5 text-ink-secondary" />
            </li>
          ))}
        </ul>

        <PreviewTags label="Tags" tags={tags(project)} />
      </PreviewPanel>

      {others.length && onSwitch ? (
        <PreviewPanel>
          <div className="text-ui text-ink">More projects</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {others.map((o) => (
              <MiniCard key={o.id} project={o} onClick={() => onSwitch(o.id)} />
            ))}
          </div>
        </PreviewPanel>
      ) : null}
    </PreviewShell>
  );
}

/*
  The enlarged preview's frame, whatever it shows: the page dimmed and blurred
  underneath, the item as large as fits left of a floating column of panels.
  Escape and a click on the backdrop close it; the page behind stops scrolling
  while it is open. `stage` is given the space it has to fill.
*/
export function PreviewShell({
  label,
  onClose,
  stage,
  children,
}: {
  label: string;
  onClose?: () => void;
  stage: (area: { w: number; h: number }) => ReactNode;
  /* The sidebar's panels, top to bottom. */
  children: ReactNode;
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previous;
    };
  }, []);

  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const measure = () => setArea({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      className="fixed inset-0 animate-scrim-in bg-black/80 text-ink backdrop-blur-[6px]"
      style={{ zIndex: "var(--z-modal)" }}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={(e) => {
        if (e.target === e.currentTarget || e.target === areaRef.current) onClose?.();
      }}
    >
      <div ref={areaRef} className="absolute inset-y-0 left-0 flex items-center justify-center" style={{ right: SIDEBAR_W + GUTTER * 2 }}>
        {area.w > 0 ? stage(area) : null}
      </div>

      <aside
        className="absolute flex flex-col gap-2 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ top: GUTTER, right: GUTTER, bottom: GUTTER, width: SIDEBAR_W }}
      >
        {children}
      </aside>
    </div>
  );
}

const KIND_LABEL: Record<Project["kind"], string> = { image: "Image", carousel: "Carousel", video: "Video" };

export function PreviewPanel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("shrink-0 rounded-[10px] bg-card p-3.5", className)}>{children}</section>;
}

export function PreviewFact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="mt-3">
      <div className="text-cap text-ink-secondary">{label}</div>
      <div className="mt-0.5 text-ui text-ink">{value}</div>
    </div>
  );
}

export function PreviewTags({ label, tags }: { label: string; tags: string[] }) {
  return (
    <>
      <div className="mt-4 text-cap text-ink-secondary">{label}</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span key={t} className="rounded-[8px] bg-raised px-2.5 py-1 text-ui text-ink">
            {t}
          </span>
        ))}
      </div>
    </>
  );
}

export function PreviewCloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      aria-label="Close preview"
      onClick={onClose}
      className="flex h-9 flex-1 items-center justify-center rounded-[10px] bg-white text-canvas transition-colors hover:bg-[#e8e8e8]"
    >
      <X className="size-4" />
    </button>
  );
}

/* The sidebar's secondary action, outlined ("Open in editor"). */
export function PreviewOutlineButton({ className, ...props }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-[10px] border border-white/75 bg-transparent text-default text-ink transition-colors hover:bg-white hover:text-canvas focus-visible:ring-2 focus-visible:ring-spectrum-amber focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&>svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}

/* What is in the document, in the reference's "5 Graphics · 1 Logo · 1 Video" shape. */
function contents(p: Project) {
  const counts: Record<string, number> = {};
  p.slides.forEach((s) => s.blocks.forEach((b) => (counts[b.type] = (counts[b.type] ?? 0) + 1)));
  const label: Record<string, [string, string]> = {
    text: ["Text block", "Text blocks"],
    image: ["Image", "Images"],
    video: ["Video clip", "Video clips"],
    shape: ["Shape", "Shapes"],
    component: ["Block", "Blocks"],
  };
  const out = (["text", "image", "video", "shape", "component"] as const).filter((t) => counts[t]).map((t) => `${counts[t]} ${label[t][counts[t] === 1 ? 0 : 1]}`);
  return out.length ? out : ["Empty document"];
}

function tags(p: Project) {
  const fonts = new Set<string>();
  p.slides.forEach((s) => s.blocks.forEach((b) => b.type === "text" && fonts.add(fontDef(b.fontFamily).family)));
  const motion = p.kind === "video" && p.slides.some((s) => s.blocks.some((b) => b.animation !== "none"));
  return [KIND_LABEL[p.kind], ASPECTS[p.aspect].label.split(" · ")[0], ...(motion ? ["Animated"] : []), ...Array.from(fonts).slice(0, 4)];
}

function ShareButton({ id, url }: { id: string; url?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copy link"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(new URL(url ?? `/editor/${id}`, window.location.origin).href);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {
          /* Clipboard blocked — nothing to recover. */
        }
      }}
      className="flex h-9 flex-1 items-center justify-center rounded-[10px] bg-card text-ink transition-colors hover:bg-raised"
    >
      {done ? <Check className="size-4 text-positive" /> : <Share className="size-4" />}
    </button>
  );
}

/* A neighbour in the library: poster frame with its name over a scrim. */
function MiniCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const clock = useProjectClock(project, false);
  /* Tiles share one portrait frame; wider documents are cropped to cover it. */
  const tile = 4 / 5;
  const own = project.width / project.height;
  const width = own > tile ? `${(own / tile) * 100}%` : "100%";
  return (
    <button type="button" onClick={onClick} className="group relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-[8px] bg-card text-left outline-none focus-visible:ring-2 focus-visible:ring-ink/40" aria-label={`Preview ${project.name}`}>
      <ProjectStage project={project} clock={clock} className="shrink-0" style={{ width }} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 scrim" />
      <div className="pointer-events-none absolute inset-x-2 bottom-2 truncate text-cap font-medium text-white">{project.name}</div>
    </button>
  );
}

/* --------------------------------------------------------------- stage --- */

type StageProps = {
  project: Project;
  clock: ReturnType<typeof useProjectClock>;
  width: number;
  playing: boolean;
  muted: boolean;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onFullscreen: () => void;
};

const Stage = forwardRef<HTMLDivElement, StageProps>(function Stage({ project, clock, width, playing, muted, onTogglePlay, onToggleMute, onFullscreen }, ref) {
  const progress = clock.total > 0 ? clock.elapsed / clock.total : 0;
  const barRef = useRef<HTMLDivElement>(null);
  const isVideo = project.kind === "video";
  const isCarousel = project.kind === "carousel";
  const dots = useMemo(() => project.slides.map((s) => s.id), [project.slides]);
  /* Tracked in JS rather than :hover so the controls also show for pointers that report no hover capability. */
  const [hover, setHover] = useState(false);
  const reveal = hover ? "opacity-100" : "opacity-0";

  return (
    <div
      ref={ref}
      className="relative shrink-0 overflow-hidden rounded-[12px] bg-black shadow-overlay"
      style={{ width }}
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <ProjectStage project={project} clock={clock} muted={muted} className="w-full" />

      {isVideo ? (
        <div className={cn("absolute inset-x-0 bottom-0 flex flex-col transition-opacity duration-150", reveal)}>
          <div className="flex items-center gap-1 bg-gradient-to-t from-black/70 to-transparent px-2 pt-6 pb-2 text-white">
            <button type="button" aria-label={playing ? "Pause" : "Play"} onClick={onTogglePlay} className="flex size-7 items-center justify-center rounded-[6px] hover:bg-white/15">
              {playing ? <Pause className="size-3.5 fill-current" /> : <Play className="size-3.5 translate-x-px fill-current" />}
            </button>
            <span className="text-cap tabular-nums">
              {formatClock(clock.elapsed)} / {formatClock(clock.total)}
            </span>
            <span className="flex-1" />
            <button type="button" aria-label={muted ? "Unmute" : "Mute"} onClick={onToggleMute} className="flex size-7 items-center justify-center rounded-[6px] hover:bg-white/15">
              {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
            </button>
            <button type="button" aria-label="Fullscreen" onClick={onFullscreen} className="flex size-7 items-center justify-center rounded-[6px] hover:bg-white/15">
              <Maximize className="size-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      {isVideo ? (
        <div
          ref={barRef}
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          tabIndex={0}
          className="absolute inset-x-0 bottom-0 h-[3px] cursor-pointer bg-white/25"
          onClick={(e) => {
            const r = barRef.current?.getBoundingClientRect();
            if (r) clock.seek(((e.clientX - r.left) / r.width) * clock.total);
          }}
        >
          <div className="h-full bg-white" style={{ width: `${progress * 100}%` }} />
        </div>
      ) : null}

      {isCarousel && dots.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="Previous slide"
            onClick={() => clock.goTo(clock.index - 1)}
            className={cn("absolute top-1/2 left-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white transition-opacity hover:bg-black/75", reveal)}
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next slide"
            onClick={() => clock.goTo(clock.index + 1)}
            className={cn("absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white transition-opacity hover:bg-black/75", reveal)}
          >
            <ChevronRight className="size-4" />
          </button>
          <div className="absolute inset-x-0 bottom-2.5 flex justify-center gap-1.5">
            {dots.map((id, i) => (
              <button
                key={id}
                type="button"
                aria-label={`Slide ${i + 1}`}
                onClick={() => clock.goTo(i)}
                className={cn("size-1.5 rounded-full transition-colors", i === clock.index ? "bg-white" : "bg-white/40 hover:bg-white/70")}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
});
