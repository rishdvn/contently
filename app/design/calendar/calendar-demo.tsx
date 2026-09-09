"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { PostStrip, ScheduleMonth, ScheduleWeek, type ScheduledPost } from "@/components/patterns/calendar";
import { Button, IconButton } from "@/components/ui/button";
import { Illustration } from "@/components/ui/imagery";
import { SegmentedControl } from "@/components/ui/segmented";

import { AppFrame, AppHeader } from "../_app-shell";
import { Page, PageHeader, Section } from "../_doc";

const art = [
  "linear-gradient(160deg,#f6d5c4,#c98f74)",
  "linear-gradient(160deg,#e7d9f5,#9b7fc4)",
  "linear-gradient(160deg,#d8e6c8,#7f9d63)",
  "linear-gradient(160deg,#fbe3c9,#d59a5c)",
  "linear-gradient(160deg,#cfe3f5,#6d97c2)",
];

const today = new Date(2026, 8, 9);
const d = (day: number) => new Date(2026, 8, day);

const posts: ScheduledPost[] = [
  { id: "1", date: d(2), time: "09:00", title: "Three things a barrier cream can't do", platform: "Instagram", thumbnail: art[2], status: "posted" },
  { id: "2", date: d(4), time: "18:30", title: "The mirror test", platform: "TikTok", thumbnail: art[0], status: "posted" },
  { id: "3", date: d(8), time: "09:00", title: "Why does your prescription burn…", platform: "Instagram", thumbnail: art[0], status: "failed" },
  { id: "4", date: d(10), time: "12:00", title: "Your wedding photos last forever", platform: "Instagram", thumbnail: art[1] },
  { id: "5", date: d(10), time: "18:30", title: "Six months out", platform: "TikTok", thumbnail: art[1] },
  { id: "6", date: d(10), time: "20:00", title: "What your derm didn't say", platform: "LinkedIn", thumbnail: art[3] },
  { id: "7", date: d(14), time: "09:00", title: "Prescription vs. barrier — v2", platform: "Instagram", thumbnail: art[0] },
  { id: "8", date: d(17), time: "18:30", title: "The 7am mirror, honestly", platform: "TikTok", thumbnail: art[4] },
  { id: "9", date: d(24), time: "09:00", title: "Before / after: Maya, day 30", platform: "Instagram", thumbnail: art[2] },
];

export function CalendarDemo() {
  const [range, setRange] = useState<"week" | "month">("month");

  return (
    <Page wide>
      <PageHeader
        eyebrow="Patterns"
        title="Calendar"
        lede="When finished carousels go out. Built on the same month grid as the DatePicker so the two can never disagree about a week. Posting is the last step in the product, so the surface stays plain: no colour per platform, no heat map — the artwork is the colour."
        note="Composed from: MonthGrid math, SegmentedControl, IconButton, Badge states on PostStrip, Illustration."
      />

      <Section title="Month" rule="Large cells, two posts visible per day and a count for the rest. Today is the inverted disc. Days outside the month recede to the canvas fill.">
        <AppFrame active="calendar">
          <AppHeader crumbs={["Calendar", "September 2026"]}>
            <SegmentedControl size="sm" value={range} onChange={setRange} options={[{ value: "week", label: "Week" }, { value: "month", label: "Month" }]} />
            <div className="ml-2 flex items-center">
              <IconButton aria-label="Previous" size="sm">
                <ChevronLeft />
              </IconButton>
              <Button variant="ghost" size="sm">
                Today
              </Button>
              <IconButton aria-label="Next" size="sm">
                <ChevronRight />
              </IconButton>
            </div>
            <Button size="sm">Schedule a post</Button>
          </AppHeader>
          <div className="px-5 pb-5">
            {range === "month" ? (
              <div className="overflow-hidden rounded-nav bg-canvas/60 ring-1 ring-line">
                <ScheduleMonth year={2026} month={8} posts={posts} today={today} />
              </div>
            ) : (
              <ScheduleWeek start={d(7)} posts={posts} />
            )}
          </div>
        </AppFrame>
      </Section>

      <Section title="The post strip" rule="First slide, title, time and platform. Posted fades; failed gets a critical ring and nothing else — the fix lives in the post, not on the calendar.">
        <div className="grid max-w-2xl gap-2 sm:grid-cols-3">
          <PostStrip post={posts[3]} />
          <PostStrip post={posts[0]} />
          <PostStrip post={posts[2]} />
        </div>
      </Section>

      <Section title="Empty month" rule="The grid is still drawn — an empty calendar should look like a calendar — with one line and one action in the middle.">
        <AppFrame active="calendar" className="min-h-[360px]">
          <AppHeader crumbs={["Calendar", "October 2026"]} />
          <div className="relative px-5 pb-5">
            <div className="overflow-hidden rounded-nav bg-canvas/60 ring-1 ring-line opacity-40">
              <ScheduleMonth year={2026} month={9} posts={[]} today={today} />
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
              <Illustration name="empty-calendar" />
              <p className="text-panels text-ink">Nothing scheduled in October</p>
              <p className="max-w-xs text-default text-ink-secondary">Drag a carousel from Review onto a day, or let the model propose a cadence.</p>
              <Button size="sm">Propose a cadence</Button>
            </div>
          </div>
        </AppFrame>
      </Section>
    </Page>
  );
}
