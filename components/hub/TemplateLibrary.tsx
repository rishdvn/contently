"use client";

import { useQuery } from "convex/react";
import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Chip, ChipRow, TextTab } from "@/components/ui/chip";
import { SearchInput } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/cn";
import { googleFontsHref } from "@/lib/editor/fonts";

import { HubNav } from "./HubNav";
import { LibraryGrid, usePreviewRoute } from "./LibraryGrid";
import { TEMPLATES, type TemplateSummary } from "./TemplateCard";
import { TemplatePreview } from "./TemplatePreview";

/*
  `/templates`, after Butter's templates page: a search, the categories as
  chips, Video / Static, and a masonry of templates that play while hovered and
  open the enlarged preview, where Create makes a project from one.

  The library is small, so it is one query — the published templates and the
  caller's organisations' drafts, marked — filtered here as fast as the user
  types.
*/

/* Static is everything that isn't a video: images and carousels. */
type Family = "video" | "static";
const familyOf = (kind: string): Family => (kind === "video" ? "video" : "static");

export function TemplateLibrary() {
  const all = useQuery(api.templates.list, { drafts: true });
  const [family, setFamily] = useState<Family>("video");
  const [category, setCategory] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const preview = usePreviewRoute();

  /* The chips are whatever categories the library uses, most used first. */
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of all ?? []) for (const c of t.categories) counts.set(c, (counts.get(c) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => c);
  }, [all]);

  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matching = (all ?? []).filter((t) => (!category || t.categories.includes(category)) && words.every((w) => haystack(t).includes(w)));
  const shown = matching.filter((t) => familyOf(t.kind) === family);
  const elsewhere = matching.length - shown.length;
  const filtered = !!category || words.length > 0;

  const clear = () => {
    setCategory(null);
    setQ("");
  };

  return (
    <div className="flex min-h-dvh bg-canvas text-ink">
      <link rel="stylesheet" href={googleFontsHref()} crossOrigin="anonymous" />
      <HubNav />

      <main className="min-w-0 flex-1 px-8 py-6">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-panels text-ink">Templates</h1>
        </header>

        <div className="mt-6 w-[480px] max-w-full">
          <SearchInput leading={<Search />} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search templates" aria-label="Search templates" />
        </div>

        {/* As in the reference, picking a category folds the row down to that one chip. */}
        {category ? (
          <ChipRow className="mt-3">
            <Chip selected onClick={() => setCategory(null)} aria-label={`Remove filter ${category}`} className="capitalize">
              {category}
              <X className="size-3.5" />
            </Chip>
          </ChipRow>
        ) : categories.length ? (
          <ChipRow role="toolbar" aria-label="Categories" className="mt-3 [scrollbar-width:none]">
            {categories.map((c) => (
              <Chip key={c} onClick={() => setCategory(c)} className="capitalize">
                {c}
              </Chip>
            ))}
          </ChipRow>
        ) : null}

        <section className="mt-8">
          <div className="flex items-baseline gap-3">
            <h2 className={cn("text-sections text-ink", category && "capitalize")}>{category ?? "All templates"}</h2>
            <p className="text-default text-ink-secondary">Start from a finished design and make it yours</p>
          </div>

          <nav aria-label="Format" className="mt-4 flex items-center gap-4">
            <TextTab active={family === "video"} onClick={() => setFamily("video")}>
              Video
            </TextTab>
            <TextTab active={family === "static"} onClick={() => setFamily("static")}>
              Static
            </TextTab>
          </nav>

          <div className="mt-5">
            {all === undefined ? (
              <GridSkeleton />
            ) : !all.length ? (
              <Notice>No templates yet.</Notice>
            ) : shown.length ? (
              <LibraryGrid items={shown} adapter={TEMPLATES} columns={{ base: 3, xl: 4 }} onPreview={(t) => preview.open(t.id)} />
            ) : (
              <Notice>
                {elsewhere ? (
                  <>
                    No {family} templates {filtered ? "match" : "yet"}.{" "}
                    <LinkButton onClick={() => setFamily(family === "video" ? "static" : "video")}>
                      Show {elsewhere} {family === "video" ? "static" : "video"}
                    </LinkButton>
                  </>
                ) : (
                  <>
                    Nothing matches. <LinkButton onClick={clear}>Clear the search and category</LinkButton>
                  </>
                )}
              </Notice>
            )}
          </div>
        </section>
      </main>

      {preview.id ? (
        <TemplatePreview
          key={preview.id}
          id={preview.id}
          initial={all?.find((t) => t.id === preview.id)}
          library={all ?? []}
          onClose={preview.close}
          onSwitch={preview.replace}
        />
      ) : null}
    </div>
  );
}

/* Everything a search matches: name, categories, tags, kind and scene names. */
function haystack(t: TemplateSummary) {
  return [t.name, t.kind, ...t.categories, ...t.tags, ...t.scenes.map((s) => s.name)].join(" ").toLowerCase();
}

function LinkButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className="ml-1 text-ink underline underline-offset-2" onClick={onClick}>
      {children}
    </button>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="flex h-40 items-center justify-center rounded-card bg-panel px-6 text-center text-default text-ink-secondary">{children}</div>;
}

function GridSkeleton() {
  const shapes = ["aspect-[9/16]", "aspect-[4/5]", "aspect-[9/16]", "aspect-[4/5]", "aspect-[9/16]"];
  return (
    <div aria-hidden className="flex gap-4">
      {shapes.map((shape, i) => (
        <div key={i} className="flex flex-1 flex-col gap-4">
          <div className={cn("animate-pulse rounded-[12px] bg-card", shape)} />
        </div>
      ))}
    </div>
  );
}
