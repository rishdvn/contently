"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ComponentType, type ReactNode } from "react";

import { cn } from "@/lib/cn";

/*
  The workspace's libraries — Projects, Media, and Templates to come — share one
  grid: a masonry of cards whose artwork is the card, that play while hovered
  and open the enlarged preview when clicked. What a card *is* stays with its
  library, behind an adapter: how to draw its artwork, what to lay over it
  (name, facts, a menu) and how tall it stands. The grid owns only placement,
  hover and the click.
*/

export type LibraryAdapter<T> = {
  /* Stable across renders; also the React key. */
  key: (item: T) => string;
  /* What the card is called, for its preview button's accessible name. */
  label: (item: T) => string;
  /* The artwork's width over its height. Decides which column a card goes in;
     the artwork still sizes itself. */
  aspect: (item: T) => number;
  /* The artwork. `playing` is true while the card is hovered. */
  Art: ComponentType<{ item: T; playing: boolean }>;
  /* Drawn over the artwork, outside the preview button, so it may hold its
     own controls. */
  Overlay?: ComponentType<{ item: T; hover: boolean }>;
  /* A card that is on screen but cannot be opened yet — a duplicate before
     the server has answered with its id. */
  pending?: (item: T) => boolean;
};

export type LibraryColumns = { base: number; xl: number };

/*
  Cards go into whichever column is shortest so far, in order. Unlike CSS
  columns, which fill one column top to bottom before starting the next, this
  reads left to right from the top, and appending a page leaves every card
  already placed where it was.
*/
export function LibraryGrid<T>({
  items,
  adapter,
  onPreview,
  columns = { base: 4, xl: 5 },
  footer,
  className,
}: {
  items: T[];
  adapter: LibraryAdapter<T>;
  onPreview: (item: T) => void;
  columns?: LibraryColumns;
  /* Under the grid: a "load more" sentinel, typically. */
  footer?: ReactNode;
  className?: string;
}) {
  const wide = useSyncExternalStore(subscribeWide, readWide, () => false);
  const count = Math.max(1, wide ? columns.xl : columns.base);

  const stacks: T[][] = Array.from({ length: count }, () => []);
  const heights = new Array<number>(count).fill(0);
  for (const item of items) {
    const shortest = heights.indexOf(Math.min(...heights));
    stacks[shortest].push(item);
    heights[shortest] += 1 / Math.max(adapter.aspect(item), 0.1);
  }

  return (
    <>
      <div className={cn("flex items-start gap-4", className)}>
        {stacks.map((stack, i) => (
          <div key={i} className="flex min-w-0 flex-1 flex-col gap-4">
            {stack.map((item) => (
              <LibraryCard key={adapter.key(item)} item={item} adapter={adapter} onPreview={onPreview} />
            ))}
          </div>
        ))}
      </div>
      {footer}
    </>
  );
}

/* Tailwind's `xl`, where the grid gains a column. */
const WIDE = "(min-width: 1280px)";
function subscribeWide(onChange: () => void) {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const readWide = () => window.matchMedia(WIDE).matches;

function LibraryCard<T>({ item, adapter, onPreview }: { item: T; adapter: LibraryAdapter<T>; onPreview: (item: T) => void }) {
  const [hover, setHover] = useState(false);
  const pending = adapter.pending?.(item) ?? false;
  const { Art, Overlay } = adapter;

  return (
    <div className={cn("group relative rounded-[12px]", pending && "opacity-60")} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button
        type="button"
        onClick={() => onPreview(item)}
        disabled={pending}
        aria-label={`Preview ${adapter.label(item)}`}
        className="relative block w-full overflow-hidden rounded-[12px] bg-card text-left outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-inset"
      >
        <Art item={item} playing={hover} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 scrim" />
      </button>
      {Overlay ? <Overlay item={item} hover={hover} /> : null}
    </div>
  );
}

/* The name along a card's foot, and a fact badge beside it while hovered. */
export function CardCaption({ name, badge, children }: { name: ReactNode; badge?: ReactNode; children?: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center gap-2">
      {children ?? <span className="truncate text-ui font-medium text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.6)]">{name}</span>}
      {badge ? <span className="shrink-0 rounded-[6px] bg-black/60 px-1.5 py-0.5 text-tiny whitespace-nowrap text-white">{badge}</span> : null}
    </div>
  );
}

/*
  Asks for the next page as the end of the grid nears the bottom of the
  window. It stays mounted between pages, so the callback is kept in a ref
  rather than making the observer restart every render.
*/
export function LoadMore({ onVisible, label = "Loading more…" }: { onVisible: () => void; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const callback = useRef(onVisible);
  useEffect(() => {
    callback.current = onVisible;
  }, [onVisible]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && callback.current(), { rootMargin: "600px 0px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className="py-6 text-center text-cap text-ink-disabled">
      {label}
    </div>
  );
}

/*
  The open preview lives in the URL as ?preview=<id>, as the reference does,
  so it survives a refresh and Back closes it. Native history calls are used
  because the app router keeps them in sync without a navigation. Other query
  parameters on the page are left alone.
*/
const routeListeners = new Set<() => void>();
const notifyRoute = () => routeListeners.forEach((l) => l());
const readPreview = () => new URLSearchParams(window.location.search).get("preview");

function withPreview(id: string | null) {
  const params = new URLSearchParams(window.location.search);
  if (id) params.set("preview", id);
  else params.delete("preview");
  const query = params.toString();
  return `${window.location.pathname}${query ? `?${query}` : ""}`;
}

export function usePreviewRoute() {
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
    window.history.pushState(null, "", withPreview(next));
    pushed.current = true;
    notifyRoute();
  }, []);
  const replace = useCallback((next: string) => {
    window.history.replaceState(null, "", withPreview(next));
    notifyRoute();
  }, []);
  const close = useCallback(() => {
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else {
      window.history.replaceState(null, "", withPreview(null));
      notifyRoute();
    }
  }, []);

  return { id, open, replace, close };
}
