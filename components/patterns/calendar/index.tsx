"use client";

import { Clock } from "lucide-react";

import { WEEKDAYS, monthGrid, sameDay } from "@/components/ui/date-picker";
import { cn } from "@/lib/cn";

/*
  The Calendar: when finished carousels go out.

  A month of large cells built on the same grid math as the DatePicker, so the
  two agree about weeks. Each post is a strip — first slide, title, time — and
  the day's cell is the drop target. Scheduling is the last thing in the
  product, so this surface stays plain: no colour coding by platform, no heat
  map. The artwork is the colour.
*/

export type ScheduledPost = {
  id: string;
  date: Date;
  time: string;
  title: string;
  platform: "Instagram" | "TikTok" | "LinkedIn";
  thumbnail: string;
  status?: "scheduled" | "posted" | "failed";
};

export function PostStrip({ post, compact = false, className }: { post: ScheduledPost; compact?: boolean; className?: string }) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 rounded-[8px] bg-card p-1 pr-2 text-left outline-none",
        "transition-colors hover:bg-raised focus-visible:ring-2 focus-visible:ring-ink/25",
        post.status === "failed" && "ring-1 ring-inset ring-critical/50",
        post.status === "posted" && "opacity-60",
        className,
      )}
    >
      <span className={cn("shrink-0 rounded-[5px]", compact ? "h-7 w-[22px]" : "h-9 w-7")} style={{ backgroundImage: post.thumbnail }} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-cap leading-4 text-ink">{post.title}</span>
        <span className="truncate text-tiny text-ink-disabled">
          {post.time} · {post.platform}
        </span>
      </span>
    </button>
  );
}

export function ScheduleMonth({
  year,
  month,
  posts,
  today = new Date(),
  className,
}: {
  year: number;
  month: number;
  posts: ScheduledPost[];
  today?: Date;
  className?: string;
}) {
  const days = monthGrid(year, month);
  return (
    <div className={cn("flex flex-col", className)}>
      <div className="grid grid-cols-7 border-b border-line">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-2 py-1.5 text-cap text-ink-disabled">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6">
        {days.map((d, i) => {
          const inMonth = d.getMonth() === month;
          const isToday = sameDay(d, today);
          const dayPosts = posts.filter((p) => sameDay(p.date, d));
          return (
            <div
              key={d.toISOString()}
              className={cn(
                "flex min-h-[104px] flex-col gap-1 border-b border-line p-1.5",
                i % 7 !== 6 && "border-r",
                !inMonth && "bg-canvas/40",
              )}
            >
              <div className="flex items-center justify-between px-0.5">
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full text-cap tabular-nums",
                    isToday ? "bg-ink text-canvas" : inMonth ? "text-ink" : "text-ink-disabled",
                  )}
                >
                  {d.getDate()}
                </span>
                {dayPosts.length > 2 ? <span className="text-tiny text-ink-disabled">+{dayPosts.length - 2}</span> : null}
              </div>
              {dayPosts.slice(0, 2).map((p) => (
                <PostStrip key={p.id} post={p} compact />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** One week, hour rows. For the day the user is actually filling. */
export function ScheduleWeek({ start, posts, className }: { start: Date; posts: ScheduledPost[]; className?: string }) {
  const days = Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  return (
    <div className={cn("grid grid-cols-7 gap-2", className)}>
      {days.map((d) => {
        const dayPosts = posts.filter((p) => sameDay(p.date, d)).sort((a, b) => a.time.localeCompare(b.time));
        return (
          <div key={d.toISOString()} className="flex min-h-[260px] flex-col gap-1.5 rounded-nav bg-canvas/60 p-2">
            <div className="flex items-baseline gap-1.5 px-0.5 pb-1">
              <span className="text-cap text-ink-secondary">{WEEKDAYS[(d.getDay() + 6) % 7]}</span>
              <span className="text-ui text-ink tabular-nums">{d.getDate()}</span>
            </div>
            {dayPosts.map((p) => (
              <PostStrip key={p.id} post={p} />
            ))}
            {dayPosts.length === 0 ? (
              <div className="flex flex-1 items-center justify-center rounded-[8px] border border-dashed border-line text-tiny text-ink-disabled">
                <Clock className="mr-1 size-3" /> free
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
