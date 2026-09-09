"use client";

import { useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";

import { Row } from "../_doc";

export function Toggles() {
  const [auto, setAuto] = useState(true);
  const [watermark, setWatermark] = useState(false);
  const [a, setA] = useState(true);
  const [b, setB] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      <Row label="switch">
        <div className="flex flex-col gap-3">
          <Switch
            checked={auto}
            onCheckedChange={setAuto}
            label="Auto-schedule approved carousels"
            description="Posts at the best time for each platform."
          />
          <Switch checked={watermark} onCheckedChange={setWatermark} label="Watermark exports" />
          <Switch checked onCheckedChange={() => undefined} disabled label="Locked by plan" />
        </div>
      </Row>
      <Row label="checkbox">
        <div className="flex flex-col gap-2.5">
          <label className="flex items-center gap-2.5 text-default text-ink">
            <Checkbox checked={a} onCheckedChange={setA} /> The Burned Professional
          </label>
          <label className="flex items-center gap-2.5 text-default text-ink">
            <Checkbox checked={b} onCheckedChange={setB} /> The Bride
          </label>
          <label className="flex items-center gap-2.5 text-default text-ink">
            <Checkbox indeterminate /> All personas
          </label>
          <label className="flex items-center gap-2.5 text-default text-ink-disabled">
            <Checkbox disabled /> Archived
          </label>
        </div>
      </Row>
    </div>
  );
}
