"use client";

import { useQueries, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Search, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Chip, ChipRow, TextTab } from "@/components/ui/chip";
import { SearchInput } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import type { MediaItem } from "@/convex/media";
import { STOCK_CATEGORIES } from "@/convex/stock/provider";
import { useActiveOrg } from "@/lib/auth/useActiveOrg";
import { cn } from "@/lib/cn";
import { useMediaUpload, type UploadJob } from "@/lib/editor/useMediaUpload";

import { HubNav } from "./HubNav";
import { LibraryGrid, LoadMore, usePreviewRoute } from "./LibraryGrid";
import { MEDIA } from "./MediaCard";
import { MediaPreview } from "./MediaPreview";

/*
  `/media`: the organisation's uploads ("Your media") and the stock library we
  provide ("Our media"), each a masonry of cards that play on hover and open
  the enlarged preview. Files dropped anywhere on the page upload to Your media.
*/

type Tab = "yours" | "ours";
type Kind = "all" | "image" | "video";

const KINDS: { value: Kind; label: string }[] = [
  { value: "all", label: "All" },
  { value: "image", label: "Photos" },
  { value: "video", label: "Videos" },
];

const SEARCH_DEBOUNCE_MS = 200;
const STOCK_PAGE_SIZE = 40;

export function MediaLibrary() {
  const [tab, setTab] = useState<Tab>("yours");
  const [kind, setKind] = useState<Kind>("all");
  const [category, setCategory] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  const input = useRef<HTMLInputElement>(null);
  const preview = usePreviewRoute();
  const upload = useMediaUpload();
  const { orgId, isLoaded } = useActiveOrg();
  const orgless = isLoaded && !orgId;
  /* The card a preview was opened from, so it paints before its details arrive. */
  const [opened, setOpened] = useState<MediaItem | null>(null);

  const search = (value: string) => {
    setQ(value);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => setTerm(value.trim()), SEARCH_DEBOUNCE_MS);
  };

  const ingest = (files: FileList | File[]) => {
    if (!upload.canUpload) return;
    setTab("yours");
    void upload.ingest(files);
  };
  const dragging = usePageDrop(ingest, upload.canUpload);

  const open = (item: MediaItem) => {
    setOpened(item);
    preview.open(item.id);
  };

  return (
    <div className="flex min-h-dvh bg-canvas text-ink">
      <HubNav />

      <main className="min-w-0 flex-1 px-8 py-6">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-panels text-ink">Media</h1>
          <Button variant="primary" size="lg" disabled={!upload.canUpload} onClick={() => input.current?.click()}>
            <Upload /> Upload
          </Button>
          <input
            ref={input}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            aria-label="Upload files"
            onChange={(e) => {
              if (e.target.files) ingest(e.target.files);
              /* Clear, so picking the same file twice in a row still fires. */
              e.target.value = "";
            }}
          />
        </header>

        <nav aria-label="Library" className="mt-6 flex items-center gap-6">
          <TextTab active={tab === "yours"} onClick={() => setTab("yours")}>
            Your media
          </TextTab>
          <TextTab active={tab === "ours"} onClick={() => setTab("ours")}>
            Our media
          </TextTab>
        </nav>

        <div className="mt-5 flex items-center gap-3">
          <div className="w-[320px] shrink-0">
            <SearchInput
              leading={<Search />}
              value={q}
              onChange={(e) => search(e.target.value)}
              placeholder={tab === "yours" ? "Search your media" : "Search our media"}
              aria-label="Search media"
            />
          </div>
          <ChipRow role="group" aria-label="Type">
            {KINDS.map((k) => (
              <Chip key={k.value} selected={kind === k.value} onClick={() => setKind(k.value)}>
                {k.label}
              </Chip>
            ))}
          </ChipRow>
        </div>

        {tab === "ours" ? (
          <ChipRow wrap role="toolbar" aria-label="Categories" className="mt-3">
            <Chip selected={category === null} onClick={() => setCategory(null)}>
              All categories
            </Chip>
            {STOCK_CATEGORIES.map((c) => (
              <Chip key={c.slug} selected={category === c.slug} onClick={() => setCategory(category === c.slug ? null : c.slug)}>
                {c.name}
              </Chip>
            ))}
          </ChipRow>
        ) : null}

        <section className="mt-6">
          {tab === "yours" ? (
            <YourMedia orgId={orgId} orgless={orgless} kind={kind} term={term} onPreview={open} />
          ) : (
            /* Keyed by the search, so a new query starts from its first page. */
            <OurMedia key={`${kind}|${category}|${term}`} kind={kind} category={category} term={term} onPreview={open} />
          )}
        </section>
      </main>

      {upload.jobs.length ? <UploadTray jobs={upload.jobs} onDismiss={upload.dismiss} /> : null}

      {dragging ? (
        <div className="pointer-events-none fixed inset-3 flex items-center justify-center rounded-[16px] border-2 border-dashed border-ink/70 bg-black/60 backdrop-blur-[2px]" style={{ zIndex: "var(--z-modal)" }}>
          <div className="text-center">
            <Upload className="mx-auto size-8 text-ink" />
            <div className="mt-3 text-titles text-ink">Drop to upload</div>
            <div className="mt-1 text-default text-ink-secondary">Photos and videos go to Your media</div>
          </div>
        </div>
      ) : null}

      {preview.id ? (
        <MediaPreview
          key={preview.id}
          id={preview.id}
          initial={opened?.id === preview.id ? opened : undefined}
          onClose={preview.close}
          onSwitch={(id) => {
            setOpened(null);
            preview.replace(id);
          }}
        />
      ) : null}
    </div>
  );
}

/* The org's uploads. Few enough to hold in one query and filter here. */
function YourMedia({ orgId, orgless, kind, term, onPreview }: { orgId: string | null | undefined; orgless: boolean; kind: Kind; term: string; onPreview: (item: MediaItem) => void }) {
  const items = useQuery(api.media.list, orgId ? { orgId } : "skip");
  const words = term.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = (items ?? []).filter(
    (item) => (kind === "all" || item.kind === kind) && words.every((w) => [item.name, ...item.tags].join(" ").toLowerCase().includes(w)),
  );

  if (orgless) return <Notice>Choose an organisation to see its media.</Notice>;
  if (items === undefined) return <GridSkeleton />;
  if (!items.length) return <Notice>Nothing uploaded yet. Drop photos and videos anywhere on this page, or use Upload.</Notice>;
  if (!shown.length) return <Notice>Nothing matches. Try another word or type.</Notice>;
  return <LibraryGrid items={shown} adapter={MEDIA} onPreview={onPreview} />;
}

/*
  The stock library, a page at a time as the grid nears the bottom. Every page
  loaded so far is one list, because the masonry places each card in the
  shorter column and a page laid out on its own would leave a ragged seam.
*/
function OurMedia({ kind, category, term, onPreview }: { kind: Kind; category: string | null; term: string; onPreview: (item: MediaItem) => void }) {
  const [pages, setPages] = useState(1);
  const requests = useMemo(
    () =>
      Object.fromEntries(
        Array.from({ length: pages }, (_, page) => [
          String(page),
          {
            query: api.media.searchStock,
            /* Unset filters are left out: a query's arguments cannot hold `undefined`. */
            args: {
              ...(kind !== "all" ? { kind } : {}),
              ...(category ? { category } : {}),
              ...(term ? { q: term } : {}),
              cursor: page * STOCK_PAGE_SIZE,
              pageSize: STOCK_PAGE_SIZE,
            },
          },
        ]),
      ),
    [kind, category, term, pages],
  );
  const results = useQueries(requests) as Record<string, FunctionReturnType<typeof api.media.searchStock> | undefined | Error>;

  const loaded: FunctionReturnType<typeof api.media.searchStock>[] = [];
  for (let page = 0; page < pages; page++) {
    const result = results[String(page)];
    if (!result || result instanceof Error) break;
    loaded.push(result);
  }
  const items = loaded.flatMap((page) => page.items);
  const more = loaded.length === pages && loaded.at(-1)?.cursor !== null;

  if (!loaded.length) {
    return Object.values(results).some((r) => r instanceof Error) ? <Notice>Couldn&rsquo;t load our media. Try again in a moment.</Notice> : <GridSkeleton />;
  }
  if (!items.length) return <Notice>Nothing matches. Try another word or category.</Notice>;
  return <LibraryGrid items={items} adapter={MEDIA} onPreview={onPreview} footer={more ? <LoadMore onVisible={() => setPages(pages + 1)} /> : null} />;
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="flex h-40 items-center justify-center rounded-card bg-panel px-6 text-center text-default text-ink-secondary">{children}</div>;
}

function GridSkeleton() {
  const shapes = ["aspect-[3/4]", "aspect-square", "aspect-[4/5]", "aspect-[9/16]", "aspect-[3/4]"];
  return (
    <div aria-hidden className="flex gap-4">
      {shapes.map((shape, i) => (
        <div key={i} className="flex flex-1 flex-col gap-4">
          <div className={cn("animate-pulse rounded-[12px] bg-card", shape)} />
          <div className={cn("animate-pulse rounded-[12px] bg-card", shapes[(i + 2) % shapes.length])} />
        </div>
      ))}
    </div>
  );
}

/* Files on their way up, in the corner until each lands or is dismissed. */
function UploadTray({ jobs, onDismiss }: { jobs: UploadJob[]; onDismiss: (id: string) => void }) {
  return (
    <div role="status" aria-label="Uploads" className="fixed right-6 bottom-6 flex w-[300px] flex-col gap-1.5 rounded-card bg-panel p-2 shadow-overlay" style={{ zIndex: "var(--z-floating-bar)" }}>
      {jobs.map((job) => (
        <div key={job.id} className="flex items-center gap-2 rounded-[8px] bg-card px-2.5 py-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-cap text-ink">{job.name}</div>
            {job.error ? (
              <div className="truncate text-tiny text-critical">{job.error}</div>
            ) : (
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-raised">
                <div className="h-full rounded-full bg-ink transition-[width] duration-150" style={{ width: `${Math.round(job.progress * 100)}%` }} />
              </div>
            )}
          </div>
          {job.error ? (
            <button type="button" aria-label={`Dismiss ${job.name}`} className="flex size-5 shrink-0 items-center justify-center rounded-full text-ink-secondary hover:text-ink" onClick={() => onDismiss(job.id)}>
              <X className="size-3" />
            </button>
          ) : (
            <span className="shrink-0 text-tiny text-ink-secondary">{Math.round(job.progress * 100)}%</span>
          )}
        </div>
      ))}
    </div>
  );
}

/*
  The whole page is a drop target for files. Enter and leave fire for every
  element the drag crosses, so a counter says whether it is still over the
  page; drags that carry no files (a link, some text) are left alone.
*/
function usePageDrop(onDrop: (files: FileList) => void, enabled: boolean) {
  const [dragging, setDragging] = useState(false);
  const handler = useRef(onDrop);
  useEffect(() => {
    handler.current = onDrop;
  }, [onDrop]);

  useEffect(() => {
    if (!enabled) return;
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth += 1;
      setDragging(true);
    };
    const over = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      if (e.dataTransfer?.files.length) handler.current(e.dataTransfer.files);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [enabled]);

  return dragging && enabled;
}
