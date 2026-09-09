"use client";

import { Calendar, Columns3, Compass, LayoutGrid, List, MessageCircleQuestion, Search } from "lucide-react";
import { useState } from "react";

import { DatePicker, TimePicker } from "@/components/ui/date-picker";
import { RadioGroup } from "@/components/ui/radio";
import { SegmentedControl } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Stepper } from "@/components/ui/stepper";

import { Row } from "../_doc";

export function Pickers() {
  const [mode, setMode] = useState<"strategy" | "research" | "ask">("strategy");
  const [platform, setPlatform] = useState<string | null>(null);
  const [view, setView] = useState<"board" | "list" | "grid">("board");
  const [range, setRange] = useState<"week" | "month">("month");
  const [opacity, setOpacity] = useState(72);
  const [scale, setScale] = useState(100);
  const [slides, setSlides] = useState(8);
  const [awareness, setAwareness] = useState<"problem" | "solution" | "product">("problem");
  const [date, setDate] = useState<Date | null>(new Date(2026, 8, 14));
  const [time, setTime] = useState<string | null>("09:30");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Row label="select · field">
          <div className="w-64">
            <Select
              value={platform}
              onChange={setPlatform}
              label="Platform"
              placeholder="Choose a platform"
              options={[
                { value: "instagram", label: "Instagram", detail: "4:5 carousel, 10 slides max" },
                { value: "tiktok", label: "TikTok", detail: "9:16 photo mode" },
                { value: "linkedin", label: "LinkedIn", detail: "PDF document post" },
              ]}
            />
          </div>
          <div className="w-64">
            <Select value={null} onChange={() => {}} options={[]} placeholder="Small" size="sm" />
          </div>
        </Row>
        <Row label="select · inline">
          <Select
            variant="inline"
            size="sm"
            value={mode}
            onChange={setMode}
            options={[
              { value: "strategy", label: "Strategy", icon: <Compass /> },
              { value: "research", label: "Research", icon: <Search /> },
              { value: "ask", label: "Ask", icon: <MessageCircleQuestion /> },
            ]}
          />
          <Select variant="inline" value="sonnet" onChange={() => {}} options={[{ value: "sonnet", label: "Sonnet 4.5" }, { value: "opus", label: "Opus 4.1" }]} />
        </Row>
      </div>

      <Row label="segmented">
        <SegmentedControl
          value={view}
          onChange={setView}
          options={[
            { value: "board", label: "Board", icon: <Columns3 /> },
            { value: "list", label: "List", icon: <List /> },
            { value: "grid", label: "Grid", icon: <LayoutGrid /> },
          ]}
        />
        <SegmentedControl size="sm" value={range} onChange={setRange} options={[{ value: "week", label: "Week" }, { value: "month", label: "Month" }]} />
      </Row>

      <Row label="slider">
        <div className="flex w-full max-w-md flex-col gap-3">
          <Slider label="Opacity" value={opacity} onChange={setOpacity} format={(v) => `${v}%`} />
          <Slider label="Scale" value={scale} onChange={setScale} min={50} max={200} format={(v) => `${v}%`} />
          <Slider label="Disabled" value={40} onChange={() => {}} disabled />
        </div>
      </Row>

      <Row label="stepper">
        <Stepper value={slides} onChange={setSlides} min={3} max={10} label="Slides" />
        <span className="text-cap text-ink-disabled">3–10 slides</span>
      </Row>

      <Row label="radio">
        <RadioGroup
          value={awareness}
          onChange={setAwareness}
          className="max-w-md"
          options={[
            { value: "problem", label: "Problem-aware", description: "Feels the pain, no known solution. Agitate and empathise." },
            { value: "solution", label: "Solution-aware", description: "Knows solutions exist. Differentiate the category." },
            { value: "product", label: "Product-aware", description: "Knows us. Prove superiority, handle objections." },
          ]}
        />
      </Row>

      <Row label="date · time">
        <DatePicker value={date} onChange={setDate} disabledBefore={new Date(2026, 8, 1)} />
        <TimePicker value={time} onChange={setTime} />
        <span className="inline-flex items-center gap-1.5 text-cap text-ink-disabled">
          <Calendar className="size-3.5" /> The same MonthGrid the Calendar surface uses
        </span>
      </Row>
    </div>
  );
}
