import {
  BookOpen,
  Blocks,
  Compass,
  Info,
  LayoutTemplate,
  Plus,
  Search,
  Tag,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Chip, ChipRow, TextTab } from "@/components/ui/chip";
import { SearchInput } from "@/components/ui/input";
import { NavItem, Sidebar, SidebarGroup } from "@/components/ui/nav";

export const metadata = {
  title: "Reference parity · Contently",
};

/*
  A like-for-like rebuild of the reference product's template browser, using
  only Contently primitives. It exists so the two can be screenshotted at the
  same size and diffed whenever the tokens change — if this page drifts from
  the reference, the system has drifted.
*/

const categories = [
  "Apparel",
  "Beauty",
  "Before and After",
  "Comparisons",
  "Customer Reviews",
  "Feature Callouts",
  "Food and Beverage",
];

export default function ParityPage() {
  return (
    <div className="flex flex-col gap-4 px-8 py-12">
      <p className="max-w-3xl text-cap text-ink-disabled">
        Reference parity. A like-for-like rebuild of the source product&rsquo;s template browser
        from Contently primitives, framed at the width it is diffed at. If this drifts from the
        reference, the system has drifted.
      </p>
    <div className="flex min-h-[820px] overflow-hidden rounded-[var(--radius-overlay)] bg-canvas ring-1 ring-line">
      <Sidebar>
        <div className="px-2.5 pt-1 pb-2 text-titles text-ink italic">Contently</div>
        <SidebarGroup label="Home">
          <NavItem icon={<Compass />}>Explore</NavItem>
          <NavItem icon={<LayoutTemplate />} active>
            Templates
          </NavItem>
          <NavItem icon={<Blocks />}>Blocks</NavItem>
        </SidebarGroup>
        <SidebarGroup label="More">
          <NavItem icon={<BookOpen />}>Blog</NavItem>
          <NavItem icon={<Tag />}>Pricing</NavItem>
          <NavItem icon={<Info />}>Learn More</NavItem>
        </SidebarGroup>
      </Sidebar>

      <main className="min-w-0 flex-1 px-8 py-6">
        <header className="flex items-start justify-between gap-4">
          <span className="text-panels text-ink">Templates</span>
          <Button variant="primary" size="lg">
            <Plus /> Create
          </Button>
        </header>

        <div className="mt-10 w-[405px]">
          <SearchInput placeholder="Search templates" leading={<Search />} />
        </div>

        <ChipRow className="mt-4">
          {categories.map((c) => (
            <Chip key={c}>{c}</Chip>
          ))}
        </ChipRow>

        <div className="mt-10 flex items-baseline gap-3">
          <h1 className="text-sections text-ink">All Templates</h1>
          <p className="text-default text-ink-secondary">
            Browse templates from the world&rsquo;s top brands
          </p>
        </div>

        <div className="mt-3 flex items-center gap-5">
          <TextTab active>Carousel</TextTab>
          <TextTab>Static</TextTab>
        </div>

        <div className="mt-6 grid grid-cols-4 gap-5">
          {[
            "linear-gradient(160deg,#efe3cf,#c9a877)",
            "linear-gradient(160deg,#6ee86e,#2f9e4f)",
            "linear-gradient(160deg,#e8ded4,#b98f6f)",
            "linear-gradient(160deg,#4cc9f0,#2a7fb8)",
          ].map((bg, i) => (
            <div
              key={i}
              className="aspect-[4/5] rounded-card"
              style={{ backgroundImage: bg }}
            />
          ))}
        </div>
      </main>
    </div>
    </div>
  );
}
