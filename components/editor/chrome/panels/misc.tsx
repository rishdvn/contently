"use client";

import { useConvex, useMutation, useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { AudioLines, ChevronDown, CircleAlert, LoaderCircle, Music, Pause, Play, Trash2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Chip, ChipRow } from "@/components/ui/chip";
import { MenuItem } from "@/components/ui/menu";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { MediaItem } from "@/convex/media";
import { useActiveOrg } from "@/lib/auth/useActiveOrg";
import { cn } from "@/lib/cn";
import { previewPosition, seekPreview, stopPreview, togglePreview, usePreview } from "@/lib/editor/audio";
import { rememberWith, useImportLocalRecent, useRecentTracks, useRememberTrack, type RecentTrack } from "@/lib/editor/recentAudio";
import { imageBlock, uid, videoBlock } from "@/lib/editor/factory";
import { primeMedia } from "@/lib/editor/media";
import { STOCK_PHOTOS, STOCK_VIDEOS, type StockItem } from "@/lib/editor/presets";
import { useEditor, useSelectedBlocks } from "@/lib/editor/store";
import { mediaKindOf, probeFile, uploadToStorage } from "@/lib/editor/upload";
import { formatTime, sceneOffsets, totalDuration } from "@/lib/editor/geometry";

import { Empty } from "./library";
import { PanelBody, PanelHeader, PanelPrimary, PanelSearch, PanelTabs } from "../LeftPanel";

/* ---------------------------------------------------------------- Stock --- */

export function StockPanel() {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"photos" | "videos">("photos");
  const addBlock = useEditor((s) => s.addBlock);
  const width = useEditor((s) => s.project.width);
  const height = useEditor((s) => s.project.height);

  const items = (tab === "photos" ? STOCK_PHOTOS : STOCK_VIDEOS).filter((i) => i.label.toLowerCase().includes(q.toLowerCase()));

  const add = (item: StockItem) => {
    const w = Math.round(width * 0.7);
    const h = Math.round(w * (item.kind === "video" ? 9 / 16 : 1.25));
    const geo = { x: (width - w) / 2, y: (height - h) / 2, w, h };
    addBlock(item.kind === "video" ? videoBlock({ src: item.src, ...geo }) : imageBlock({ src: item.src, ...geo }));
  };

  return (
    <>
      <PanelHeader>
        <PanelSearch value={q} onChange={setQ} placeholder="Search stock" />
      </PanelHeader>
      <PanelTabs value={tab} onChange={setTab} options={[{ value: "photos", label: "Photos" }, { value: "videos", label: "Videos" }]} />
      <PanelBody>
        <div className="grid grid-cols-2 gap-2">
          {items.map((i) => (
            <button key={i.id} type="button" className="group relative overflow-hidden rounded-[10px] bg-card" style={{ aspectRatio: i.kind === "video" ? "16 / 10" : "3 / 4" }} onClick={() => add(i)} title={i.label}>
              {/* eslint-disable-next-line @next/next/no-img-element -- remote stock thumbnails */}
              <img src={i.thumb} alt={i.label} loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
              {i.duration ? <span className="absolute right-1.5 bottom-1.5 rounded-[4px] bg-black/70 px-1.5 py-0.5 text-[10px] text-white">{formatTime(i.duration)}</span> : null}
            </button>
          ))}
        </div>
      </PanelBody>
    </>
  );
}

/* ---------------------------------------------------------------- Audio --- */

/*
  The audio library: Music and Sound effects, each filtered by its own facets
  and searchable. Clicking a row adds it to the timeline; its artwork previews
  it. With no search and no filter the tab browses the way Butter's does:
  recently used tracks, then a short section per mood (for sound effects, per
  category) whose "See more" applies that filter. The catalog is the Convex
  index of Soundstripe plus the seeded CC0 set (`convex/audio/*`); playback,
  preview and the lane alike, goes through `lib/editor/audio.ts`.
*/

type AudioKind = "music" | "sfx";
type Facet = "mood" | "genre" | "category";
type AudioFilters = Record<Facet, string[]>;
type AudioSearch = Omit<FunctionArgs<typeof api.audio.library.search>, "page" | "pageSize">;

const FACETS: Record<AudioKind, { facet: Facet; label: string }[]> = {
  music: [
    { facet: "mood", label: "Mood" },
    { facet: "genre", label: "Genre" },
  ],
  sfx: [{ facet: "category", label: "Category" }],
};

const NO_FILTERS: AudioFilters = { mood: [], genre: [], category: [] };
const AUDIO_PAGE_SIZE = 30;
/* Rows per browse section, as in Butter. */
const SECTION_SIZE = 3;
const SEARCH_DEBOUNCE_MS = 200;
/* Genres run to sixty-odd values, many carried by a single track. Past this many
   chips a one-track value is noise; search still finds it. */
const LONG_FACET = 24;
/* The audio lane's shortest pill. */
const MIN_AUDIO = 0.5;

export function AudioPanel() {
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    return (
      <>
        <PanelHeader title="Audio" />
        <PanelBody>
          <Empty>The audio library needs a Convex deployment. Set NEXT_PUBLIC_CONVEX_URL.</Empty>
        </PanelBody>
      </>
    );
  }
  return <AudioLibrary />;
}

function AudioLibrary() {
  const [tab, setTab] = useState<AudioKind>("music");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [filters, setFilters] = useState<AudioFilters>(NO_FILTERS);
  const [open, setOpen] = useState<Facet | null>(null);
  /* "See more" on Recently used: the whole list in place of the sections. */
  const [allRecent, setAllRecent] = useState(false);
  const kind = useEditor((s) => s.project.kind);
  useImportLocalRecent();

  const moods = useQuery(api.audio.library.moods, tab === "music" ? {} : "skip");
  const genres = useQuery(api.audio.library.genres, tab === "music" ? {} : "skip");
  const categories = useQuery(api.audio.library.sfxCategories, tab === "sfx" ? {} : "skip");
  const values = { mood: moods, genre: genres, category: categories };

  /* Closing the flyout ends the preview: a song playing on from a panel that is
     no longer there has no control left to stop it with. */
  useEffect(() => stopPreview, []);

  const search = (value: string) => {
    setQ(value);
    setAllRecent(false);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => setTerm(value.trim()), SEARCH_DEBOUNCE_MS);
  };

  const args: AudioSearch =
    tab === "music"
      ? { kind: tab, q: term || undefined, moods: filters.mood, genres: filters.genre }
      : { kind: tab, q: term || undefined, categories: filters.category };
  const filtered = FACETS[tab].some(({ facet }) => filters[facet].length > 0);
  const browsing = !term && !filtered;
  const sectionFacet: Facet = tab === "music" ? "mood" : "category";

  return (
    <>
      <PanelHeader>
        <PanelSearch value={q} onChange={search} placeholder={tab === "music" ? "Search music" : "Search sound effects"} />
        {/* The catalog is Soundstripe's, credited where Butter credits it. */}
        <a href="https://www.soundstripe.com/" target="_blank" rel="noreferrer" aria-label="Music by Soundstripe" className="shrink-0 opacity-80 transition-opacity hover:opacity-100">
          {/* eslint-disable-next-line @next/next/no-img-element -- a static wordmark, no optimisation to gain */}
          <img src="/thirdparty/soundstripe-logo.svg" alt="Soundstripe" width={72} height={11} className="h-[11px] w-[72px]" />
        </a>
      </PanelHeader>
      <PanelTabs
        value={tab}
        onChange={(next) => {
          setTab(next);
          setOpen(null);
          setAllRecent(false);
        }}
        options={[
          { value: "music", label: "Music" },
          { value: "sfx", label: "Sound effects" },
        ]}
      />
      <div className="flex items-center gap-2 px-3 pb-2">
        {FACETS[tab].map(({ facet, label }) => (
          <FilterButton key={facet} label={label} picked={filters[facet]} open={open === facet} onClick={() => setOpen(open === facet ? null : facet)} />
        ))}
        {filtered ? (
          <button type="button" className="ml-auto text-cap text-ink-secondary hover:text-ink" onClick={() => setFilters(NO_FILTERS)}>
            Clear
          </button>
        ) : null}
      </div>
      {open ? (
        <FacetChips
          values={values[open]}
          picked={filters[open]}
          onToggle={(value) => {
            setFilters((f) => ({ ...f, [open]: f[open].includes(value) ? f[open].filter((v) => v !== value) : [...f[open], value] }));
            setAllRecent(false);
          }}
        />
      ) : null}
      {kind !== "video" ? <p className="px-3 pb-2 text-cap text-ink-disabled">Audio plays in video projects. You can still preview tracks here.</p> : null}
      {/* Keyed by the view, so "See more" opens its list at the top rather than
          wherever the sections had been scrolled to. */}
      <PanelBody key={browsing ? (allRecent ? "recent" : "browse") : "list"}>
        {browsing ? (
          <AudioBrowse
            key={tab}
            kind={tab}
            values={values[sectionFacet]}
            canAdd={kind === "video"}
            allRecent={allRecent}
            onAllRecent={setAllRecent}
            onSeeMore={(value) => {
              setFilters({ ...NO_FILTERS, [sectionFacet]: [value] });
              setOpen(null);
            }}
          />
        ) : (
          /* Keyed by the search, so a new query starts again from its first page. */
          <AudioResults key={JSON.stringify(args)} args={args} searched={Boolean(term) || filtered} canAdd={kind === "video"} />
        )}
      </PanelBody>
    </>
  );
}

/* A facet's toggle. It names the one value picked, or counts several, so the
   filter reads at a glance with the chips folded away. */
function FilterButton({ label, picked, open, onClick }: { label: string; picked: string[]; open: boolean; onClick: () => void }) {
  return (
    <Chip selected={picked.length > 0} aria-expanded={open} onClick={onClick} className="h-7 max-w-[180px] gap-1 px-3 text-cap">
      <span className="truncate">{picked.length === 0 ? label : picked.length === 1 ? picked[0] : `${label} · ${picked.length}`}</span>
      <ChevronDown className={cn("size-3 shrink-0 transition-transform", open && "rotate-180")} />
    </Chip>
  );
}

/* Within a facet the chips are an OR, across facets an AND — `search` does the
   combining; this only collects them. */
function FacetChips({ values, picked, onToggle }: { values: { value: string; count: number }[] | undefined; picked: string[]; onToggle: (value: string) => void }) {
  if (!values) return <div className="px-3 pb-3 text-cap text-ink-disabled">Loading…</div>;
  const shown = values.filter((v) => values.length <= LONG_FACET || v.count > 1 || picked.includes(v.value));
  if (!shown.length) return <div className="px-3 pb-3 text-cap text-ink-disabled">No filters for this library yet.</div>;
  return (
    <ChipRow wrap className="max-h-[160px] overflow-y-auto px-3 pb-3 [scrollbar-width:thin]">
      {shown.map(({ value }) => (
        <Chip key={value} selected={picked.includes(value)} onClick={() => onToggle(value)} className="h-7 px-3 text-cap">
          {value}
        </Chip>
      ))}
    </ChipRow>
  );
}

/* Pages of results, one query each, appended as the list scrolls. */
function AudioResults({ args, searched, canAdd }: { args: AudioSearch; searched: boolean; canAdd: boolean }) {
  const [pages, setPages] = useState(1);
  return (
    <div role="list" aria-label="Audio tracks" className="flex flex-col gap-0.5">
      {Array.from({ length: pages }, (_, page) => (
        <AudioResultPage
          key={page}
          args={args}
          page={page}
          searched={searched}
          canAdd={canAdd}
          onMore={page === pages - 1 ? () => setPages(page + 2) : undefined}
        />
      ))}
    </div>
  );
}

function AudioResultPage({ args, page, searched, canAdd, onMore }: { args: AudioSearch; page: number; searched: boolean; canAdd: boolean; onMore?: () => void }) {
  const result = useQuery(api.audio.library.search, { ...args, page, pageSize: AUDIO_PAGE_SIZE });
  if (!result) return page === 0 ? <div className="py-10 text-center text-cap text-ink-secondary">Loading…</div> : null;
  if (page === 0 && !result.items.length) {
    return <div className="py-10 text-center text-cap text-ink-secondary">{searched ? "No tracks match." : "Nothing in this library yet."}</div>;
  }
  return (
    <>
      {result.items.map((track) => (
        <AudioRow key={track.id} track={track} canAdd={canAdd} />
      ))}
      {onMore && result.hasMore ? <LoadMore onVisible={onMore} /> : null}
    </>
  );
}

function LoadMore({ onVisible }: { onVisible: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    /* Rooted on the panel's scroller, as the browse sections are: against the
       window the margin is clipped away and the next page waits until the
       end of the list is actually on screen. */
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onVisible();
      },
      { root: scrollParent(el), rootMargin: "240px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onVisible]);
  return <div ref={ref} className="py-3 text-center text-cap text-ink-disabled">Loading more…</div>;
}

/*
  The tab with nothing searched or filtered, laid out as Butter's is: what was
  used lately, then three tracks for each mood (or category), each section's
  "See more" handing over to the ordinary filtered list.
*/
function AudioBrowse({
  kind,
  values,
  canAdd,
  allRecent,
  onAllRecent,
  onSeeMore,
}: {
  kind: AudioKind;
  values: { value: string; count: number }[] | undefined;
  canAdd: boolean;
  allRecent: boolean;
  onAllRecent: (all: boolean) => void;
  onSeeMore: (value: string) => void;
}) {
  const recent = useRecentTracks(kind);

  if (allRecent) {
    return (
      <AudioSection title="Recently used" action="Back" onAction={() => onAllRecent(false)}>
        {recent.map((track) => (
          <AudioRow key={track.id} track={track} canAdd={canAdd} />
        ))}
      </AudioSection>
    );
  }

  /* Butter lists moods A–Z; categories keep the facet's own order, most
     populated first, which is also how Butter leads with Transitions. */
  const shown = values?.filter((v) => values.length <= LONG_FACET || v.count > 1) ?? [];
  const sections = kind === "music" ? [...shown].sort((a, b) => a.value.localeCompare(b.value)) : shown;

  return (
    <>
      {recent.length ? (
        <AudioSection title="Recently used" action={recent.length > SECTION_SIZE ? "See more" : undefined} onAction={() => onAllRecent(true)}>
          {recent.slice(0, SECTION_SIZE).map((track) => (
            <AudioRow key={track.id} track={track} canAdd={canAdd} />
          ))}
        </AudioSection>
      ) : null}
      {!values ? (
        <div className="py-10 text-center text-cap text-ink-secondary">Loading…</div>
      ) : sections.length ? (
        sections.map(({ value }) => (
          <FacetSection key={value} kind={kind} value={value} canAdd={canAdd} onSeeMore={() => onSeeMore(value)} />
        ))
      ) : (
        /* A library with no facets yet still has tracks to list. */
        <AudioResults args={{ kind }} searched={false} canAdd={canAdd} />
      )}
    </>
  );
}

/* One browse section's heading and rows. */
function AudioSection({
  title,
  action,
  onAction,
  sectionRef,
  children,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  sectionRef?: React.Ref<HTMLElement>;
  children: React.ReactNode;
}) {
  return (
    <section ref={sectionRef} aria-label={title} className="flex flex-col pt-3 first:pt-1">
      <div className="flex h-6 items-center justify-between gap-2">
        <h3 className="truncate text-ui text-ink">{title}</h3>
        {action ? (
          <button type="button" className="shrink-0 text-ui text-ink-secondary transition-colors hover:text-ink" onClick={onAction}>
            {action}
          </button>
        ) : null}
      </div>
      <div role="list" aria-label={title} className="flex flex-col gap-0.5">
        {children}
      </div>
    </section>
  );
}

/* Three rows of a row height each, with the 2px gaps between them: what a
   section holds its place with until its tracks arrive. */
const SECTION_PLACEHOLDER = "h-[184px]";

/*
  A mood's (or category's) three tracks. A filtered search reads the whole tab,
  so a section only asks once it scrolls near the panel's viewport, rather than
  every section at once on open.
*/
function FacetSection({ kind, value, canAdd, onSeeMore }: { kind: AudioKind; value: string; canAdd: boolean; onSeeMore: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const [near, setNear] = useState(false);
  const args: AudioSearch = kind === "music" ? { kind, moods: [value] } : { kind, categories: [value] };
  const result = useQuery(api.audio.library.search, near ? { ...args, page: 0, pageSize: SECTION_SIZE } : "skip");

  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    /* Rooted on the panel's scroller: a margin on the default (window) root
       would not reach past the scroller's clipping. */
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setNear(true);
      },
      { root: scrollParent(el), rootMargin: "240px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [near]);

  if (result && !result.items.length) return null;
  return (
    <AudioSection title={value} action="See more" onAction={onSeeMore} sectionRef={ref}>
      {result ? result.items.map((track) => <AudioRow key={track.id} track={track} canAdd={canAdd} />) : <div className={SECTION_PLACEHOLDER} />}
    </AudioSection>
  );
}

function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(node).overflowY)) return node;
  }
  return null;
}

/*
  One track, as Butter lays it out: clicking the row adds it to the timeline,
  clicking the artwork previews it. Outside a video project there is no
  timeline to add to, so the row previews instead. Hover is tracked from
  pointer events as well as `:hover`, because the VNC desktop reports no hover
  capability.
*/
function AudioRow({ track, canAdd }: { track: RecentTrack; canAdd: boolean }) {
  const convex = useConvex();
  const preview = usePreview();
  const addAudio = useEditor((s) => s.addAudio);
  const remember = useRememberTrack();
  const [hover, setHover] = useState(false);
  /* Nothing else on screen changes when a track lands on a collapsed or
     scrolled-away timeline, so the row says so itself for a moment. */
  const [added, setAdded] = useState(false);
  const addedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const status = preview.trackId === track.id ? preview.status : "idle";
  const live = status === "playing" || status === "paused" || status === "loading";
  const shown = hover || status !== "idle";
  /* A Soundstripe row without a URL can still be re-signed; anything else
     without one has no file behind it. */
  const playable = Boolean(track.previewUrl) || track.provider === "soundstripe";
  const facets = track.kind === "music" ? [...track.mood, ...track.genre] : track.categories;
  const subtitle = track.artist ?? facets.slice(0, 2).join(" · ");

  /* Starting a preview (not pausing one) counts as using the track. */
  const toggle = () => {
    if (!playable) return;
    if (status !== "playing" && status !== "loading") rememberWith(remember, track);
    togglePreview(convex, track);
  };

  /* At the playhead, for the whole track or as much of it as the project has
     room for. A playhead parked at the very end leaves no room, so the track
     starts from the top instead. (Butter always starts at 0; the ticket asks
     for the playhead.) */
  const add = () => {
    const { project, activeSlideId, time } = useEditor.getState();
    const total = totalDuration(project);
    const index = project.slides.findIndex((s) => s.id === activeSlideId);
    const playhead = Math.round(((sceneOffsets(project)[index] ?? 0) + time) * 100) / 100;
    const start = total - playhead >= MIN_AUDIO ? playhead : 0;
    const room = total - start;
    addAudio({
      id: uid(),
      title: track.title,
      trackId: track.id,
      src: track.previewUrl ?? undefined,
      start,
      duration: Math.max(MIN_AUDIO, Math.min(track.duration ?? room, room)),
      sourceDuration: track.duration,
      volume: 80,
    });
    rememberWith(remember, track);
    setAdded(true);
    clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setAdded(false), 1200);
  };

  return (
    <div
      role="listitem"
      className={cn("group relative flex items-center gap-3 rounded-[10px] px-2 py-2 hover:bg-card", (status !== "idle" || hover) && "bg-card")}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      <button
        type="button"
        aria-label={`${status === "playing" ? "Pause" : "Play"} ${track.title}`}
        aria-pressed={status === "playing"}
        disabled={!playable}
        className="relative z-10 size-11 shrink-0 overflow-hidden rounded-[8px] bg-raised disabled:cursor-not-allowed"
        onClick={toggle}
      >
        {track.artworkUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote album artwork, sized by the row
          <img src={track.artworkUrl} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center text-ink-secondary">
            {track.kind === "music" ? <Music className="size-4" /> : <AudioLines className="size-4" />}
          </span>
        )}
        {playable ? (
          <span className={cn("absolute inset-0 flex items-center justify-center transition-opacity", shown ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
            <span className="flex size-7 items-center justify-center rounded-full bg-white/90 text-black shadow-sm">
              {status === "loading" ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : status === "playing" ? (
                <Pause className="size-3.5 fill-current" />
              ) : status === "error" ? (
                <CircleAlert className="size-3.5" />
              ) : (
                <Play className="ml-0.5 size-3.5 fill-current" />
              )}
            </span>
          </span>
        ) : null}
      </button>
      {/* The whole row is this button's target (its ::before covers the row);
          the artwork and the scrubber sit above it. */}
      <button
        type="button"
        aria-label={canAdd ? `Add ${track.title} to timeline` : `${status === "playing" ? "Pause" : "Play"} ${track.title}`}
        title={canAdd ? "Add to timeline" : undefined}
        className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none before:absolute before:inset-0 before:rounded-[10px] before:content-[''] focus-visible:before:ring-1 focus-visible:before:ring-line-strong"
        onClick={canAdd ? add : toggle}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-ui text-ink">{track.title}</span>
          <span className={cn("block truncate text-cap", status === "error" ? "text-critical" : "text-ink-secondary")}>
            {status === "error" ? "Couldn't play this track" : !playable ? "No audio file" : subtitle}
          </span>
        </span>
        {added ? (
          <span className="w-10 shrink-0 text-right text-cap text-ink">Added</span>
        ) : (
          <PreviewClock key={live ? "live" : "idle"} live={live} duration={track.duration} />
        )}
      </button>
      {live ? <PreviewScrubber /> : null}
    </div>
  );
}

/* The track's length, or while it is previewing, how far in it is. Written per
   frame straight to the node; keyed by the caller so leaving preview puts the
   length back. */
function PreviewClock({ live, duration }: { live: boolean; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!live) return;
    let raf = 0;
    const tick = () => {
      const at = previewPosition();
      if (ref.current && at) ref.current.textContent = formatTime(at.time);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [live]);
  return (
    <span ref={ref} className={cn("w-10 shrink-0 text-right text-cap tabular-nums", live ? "text-ink" : "text-ink-disabled")}>
      {/* A sound effect under a second would otherwise read 00:00. */}
      {duration ? formatTime(Math.max(duration, 1)) : "--:--"}
    </span>
  );
}

/* The thin progress line along the foot of the previewing row; press or drag
   on it to seek. */
function PreviewScrubber() {
  const fill = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const at = previewPosition();
      if (fill.current) fill.current.style.width = `${at ? (at.time / at.duration) * 100 : 0}%`;
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);
  const seek = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    seekPreview((e.clientX - r.left) / r.width);
  };
  return (
    <div
      aria-label="Preview position"
      className="absolute right-2 bottom-0 left-[64px] z-10 flex h-2.5 cursor-pointer items-center"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        seek(e);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) seek(e);
      }}
    >
      <div className="h-[2px] w-full overflow-hidden rounded-full bg-line-strong">
        <div ref={fill} className="h-full w-0 bg-ink" />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Uploads --- */

/*
  The organisation's media library. Files go to Convex storage and a `media` row;
  the canvas references the row by id, so a project reopened next week still has
  its photos — which is what the object URLs this panel used to hand out could
  never do.

  Convex is configured everywhere the app really runs, but the provider
  deliberately renders without a client when it is not (see
  `ConvexClientProvider`), and a flyout is no place to throw.
*/
export function UploadsPanel() {
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    return (
      <>
        <PanelHeader title="Uploads" />
        <PanelBody>
          <Empty>Uploads need a Convex deployment. Set NEXT_PUBLIC_CONVEX_URL.</Empty>
        </PanelBody>
      </>
    );
  }
  return <UploadsLibrary />;
}

/* One file on its way up. Kept until it lands (the row then arrives in `list`)
   or fails, which is the only state worth staying on screen. */
type UploadJob = { id: string; name: string; progress: number; error?: string };

function UploadsLibrary() {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "videos" | "images">("all");
  const [over, setOver] = useState(false);
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [menu, setMenu] = useState<{ item: MediaItem; x: number; y: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const { orgId, isLoaded } = useActiveOrg();
  const items = useQuery(api.media.list, orgId ? { orgId } : "skip");
  const generateUploadUrl = useMutation(api.media.generateUploadUrl);
  const createMedia = useMutation(api.media.create);
  const removeMedia = useMutation(api.media.remove);

  const addBlock = useEditor((s) => s.addBlock);
  const updateBlock = useEditor((s) => s.updateBlock);
  const setComponentProp = useEditor((s) => s.setComponentProp);
  const setMediaTarget = useEditor((s) => s.setMediaTarget);
  const selected = useSelectedBlocks();
  const width = useEditor((s) => s.project.width);
  const height = useEditor((s) => s.project.height);
  /* An image/video input on the selected catalog block that asked for media. */
  const target = useEditor((s) => (s.mediaTarget && s.selection.length === 1 && s.selection[0] === s.mediaTarget.blockId ? s.mediaTarget : null));

  /*
    Uploads run one at a time. Two large clips racing each other make the
    progress bars meaningless and neither finishes sooner, and a file only
    becomes a `media` row once its bytes and its poster are both up.
  */
  const ingest = async (files: FileList | File[]) => {
    if (!orgId) return;
    for (const file of Array.from(files)) {
      if (!mediaKindOf(file)) continue;
      const jobId = uid();
      const progress = (fraction: number) => setJobs((j) => j.map((x) => (x.id === jobId ? { ...x, progress: fraction } : x)));
      setJobs((j) => [...j, { id: jobId, name: file.name, progress: 0 }]);
      try {
        const probe = await probeFile(file);
        const storageId = await uploadToStorage(await generateUploadUrl({ orgId }), file, progress);
        const posterStorageId = probe.poster
          ? await uploadToStorage(await generateUploadUrl({ orgId }), probe.poster)
          : undefined;
        const row = await createMedia({
          orgId,
          kind: probe.kind,
          /* Storage ids are opaque strings to the browser; Convex validates them. */
          storageId: storageId as Id<"_storage">,
          posterStorageId: posterStorageId as Id<"_storage"> | undefined,
          width: probe.width,
          height: probe.height,
          duration: probe.duration,
          name: file.name,
        });
        /* The row's URL is already in hand, so a block placed now paints at once
           instead of waiting for the resolver to ask the same question. */
        primeMedia([row]);
        setJobs((j) => j.filter((x) => x.id !== jobId));
      } catch (error) {
        setJobs((j) => j.map((x) => (x.id === jobId ? { ...x, error: error instanceof Error ? error.message : "Upload failed" } : x)));
      }
    }
  };

  /* Placing media replaces the selected media block if there is exactly one. */
  const place = (item: MediaItem) => {
    if (!item.url) return;
    primeMedia([item]);
    if (target && target.kind === item.kind) {
      setComponentProp(target.blockId, target.path, { mediaId: item.id, src: item.url });
      setMediaTarget(null);
      return;
    }
    const one = selected.length === 1 ? selected[0] : null;
    if (one && (one.type === "image" || one.type === "video") && one.type === item.kind) {
      return updateBlock(one.id, { mediaId: item.id, src: item.url });
    }
    /* Fit the media's own aspect inside 70% of the artboard, rather than
       stretching it into a square. */
    const ratio = item.width && item.height ? item.width / item.height : 1;
    let w = width * 0.7;
    let h = w / ratio;
    if (h > height * 0.7) {
      h = height * 0.7;
      w = h * ratio;
    }
    const geo = { x: Math.round((width - w) / 2), y: Math.round((height - h) / 2), w: Math.round(w), h: Math.round(h) };
    const common = { mediaId: item.id, src: item.url, ...geo };
    addBlock(item.kind === "video" ? videoBlock({ ...common, sourceDuration: item.duration }) : imageBlock(common));
  };

  const list = (items ?? []).filter(
    (m) => (tab === "all" || (tab === "videos" ? m.kind === "video" : m.kind === "image")) && m.name.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <>
      <PanelHeader>
        <PanelSearch value={q} onChange={setQ} placeholder="Search uploads" />
      </PanelHeader>
      <PanelPrimary onClick={() => input.current?.click()} disabled={!orgId}>
        <Upload /> Upload files
      </PanelPrimary>
      <input
        ref={input}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void ingest(e.target.files);
          /* Clear, so picking the same file twice in a row still fires. */
          e.target.value = "";
        }}
      />
      <PanelTabs value={tab} onChange={setTab} options={[{ value: "all", label: "All" }, { value: "videos", label: "Videos" }, { value: "images", label: "Images" }]} />
      <PanelBody>
        <div
          className={cn("flex flex-col gap-2 rounded-[12px] border border-dashed p-2 transition-colors", over ? "border-ink bg-card" : "border-line")}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            void ingest(e.dataTransfer.files);
          }}
        >
          {jobs.length ? (
            <div className="flex flex-col gap-1.5">
              {jobs.map((job) => (
                <UploadProgress key={job.id} job={job} onDismiss={() => setJobs((j) => j.filter((x) => x.id !== job.id))} />
              ))}
            </div>
          ) : null}
          {list.length ? (
            <div className="grid grid-cols-3 gap-1.5">
              {list.map((item) => (
                <MediaTile
                  key={item.id}
                  item={item}
                  onClick={() => place(item)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenu({ item, x: e.clientX, y: e.clientY });
                  }}
                />
              ))}
            </div>
          ) : items === undefined && orgId ? null : (
            <div className="py-10 text-center text-cap text-ink-secondary">
              {!isLoaded ? "Loading…" : !orgId ? "Pick an organisation to upload media to." : q ? "No uploads match." : "Drag and drop your files to upload"}
            </div>
          )}
        </div>
        {target ? (
          <p className="mt-2 text-[11px] text-ink-disabled">
            Click {target.kind === "image" ? "an image" : "a video"} to use it in the selected block.{" "}
            <button type="button" className="underline hover:text-ink" onClick={() => setMediaTarget(null)}>
              Cancel
            </button>
          </p>
        ) : selected.length === 1 && (selected[0].type === "image" || selected[0].type === "video") ? (
          <p className="mt-2 text-[11px] text-ink-disabled">Click an upload to replace the selected media.</p>
        ) : null}
      </PanelBody>
      {menu ? (
        <MediaMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          onRemove={() => {
            if (orgId) void removeMedia({ orgId, mediaId: menu.item.id as Id<"media"> });
            setMenu(null);
          }}
        />
      ) : null}
    </>
  );
}

function UploadProgress({ job, onDismiss }: { job: UploadJob; onDismiss: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-[8px] bg-card px-2 py-1.5">
      <div className="min-w-0 flex-1">
        <div className="truncate text-cap text-ink">{job.name}</div>
        {job.error ? (
          <div className="truncate text-[11px] text-critical">{job.error}</div>
        ) : (
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-raised">
            <div className="h-full rounded-full bg-ink transition-[width] duration-150" style={{ width: `${Math.round(job.progress * 100)}%` }} />
          </div>
        )}
      </div>
      {job.error ? (
        <button type="button" aria-label={`Dismiss ${job.name}`} className="flex size-5 shrink-0 items-center justify-center rounded-full text-ink-secondary hover:text-ink" onClick={onDismiss}>
          <X className="size-3" />
        </button>
      ) : (
        <span className="shrink-0 text-[11px] text-ink-secondary">{Math.round(job.progress * 100)}%</span>
      )}
    </div>
  );
}

/*
  A tile in the grid. Videos play on hover, driven from pointer events rather
  than `:hover` because the VNC desktop the visuals are checked on reports no
  hover capability and the CSS variant never fires there.
*/
function MediaTile({ item, onClick, onContextMenu }: { item: MediaItem; onClick: () => void; onContextMenu: (e: React.MouseEvent) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  return (
    <button
      type="button"
      className="group relative aspect-square overflow-hidden rounded-[8px] bg-card"
      onClick={onClick}
      onContextMenu={onContextMenu}
      onPointerEnter={() => video.current?.play().catch(() => {})}
      onPointerLeave={() => {
        const v = video.current;
        if (!v) return;
        v.pause();
        v.currentTime = 0;
      }}
      title={item.name}
    >
      {!item.url ? (
        <span className="flex size-full items-center justify-center text-[10px] text-ink-disabled">Unavailable</span>
      ) : item.kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element -- Convex storage URL, sized by the grid
        <img src={item.url} alt={item.name} loading="lazy" className="size-full object-cover" />
      ) : (
        <video ref={video} src={item.url} poster={item.posterUrl ?? undefined} muted loop playsInline preload="metadata" className="size-full object-cover" />
      )}
      {item.duration ? <span className="absolute right-1 bottom-1 rounded-[4px] bg-black/70 px-1 py-0.5 text-[10px] text-white">{formatTime(item.duration)}</span> : null}
    </button>
  );
}

/*
  Right-click on a tile. Portaled to the body and placed in viewport
  coordinates: the panel clips its overflow, so a menu rendered inside it would
  be cut off at the edge.
*/
function MediaMenu({ x, y, onClose, onRemove }: { x: number; y: number; onClose: () => void; onRemove: () => void }) {
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest(".media-menu")) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  return createPortal(
    <div
      role="menu"
      className="media-menu fixed min-w-[180px] rounded-control bg-panel p-1.5 shadow-overlay animate-pop"
      style={{ left: Math.min(x, window.innerWidth - 200), top: Math.min(y, window.innerHeight - 80), zIndex: "var(--z-floating-bar)" }}
    >
      <MenuItem icon={<Trash2 />} destructive onClick={onRemove}>
        Remove from library
      </MenuItem>
    </div>,
    document.body,
  );
}

export { Empty };
