"use client";

import { FileText, Images, MessageSquare, Search, Target, Users } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { ListRow, StackedList } from "@/components/ui/list";
import { Progress, ProgressRing } from "@/components/ui/progress";
import { TabBar } from "@/components/ui/tabs";
import { Table, TableBody, TableHead, Td, Th, Tr } from "@/components/ui/table";

import { Row } from "../_doc";

const rows = [
  { title: "Why does your prescription burn more than your acne?", persona: "Burned Professional", stage: "Problem-aware", slides: 8, status: "Scheduled", tone: "positive" as const },
  { title: "The mirror test", persona: "Burned Professional", stage: "Problem-aware", slides: 6, status: "Needs review", tone: "caution" as const },
  { title: "Your wedding photos last forever", persona: "Bride", stage: "Solution-aware", slides: 8, status: "Draft", tone: "neutral" as const },
  { title: "What your derm didn't say about barriers", persona: "Burned Professional", stage: "Product-aware", slides: 7, status: "Failed to post", tone: "critical" as const },
];

export function Lists() {
  const [selected, setSelected] = useState(1);
  const [tab, setTab] = useState<"persona" | "angles" | "briefs" | "assets">("angles");
  const [row, setRow] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <span className="text-cap text-ink-disabled">table</span>
        <Table>
          <TableHead>
            <Th>Brief</Th>
            <Th>Persona</Th>
            <Th>Stage</Th>
            <Th align="right">Slides</Th>
            <Th>Status</Th>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <Tr key={r.title} selected={row === r.title} onClick={() => setRow(row === r.title ? null : r.title)}>
                <Td className="max-w-[320px] truncate">{r.title}</Td>
                <Td muted>{r.persona}</Td>
                <Td muted>{r.stage}</Td>
                <Td align="right">{r.slides}</Td>
                <Td>
                  <Badge tone={r.tone}>{r.status}</Badge>
                </Td>
              </Tr>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <span className="text-cap text-ink-disabled">stacked list</span>
          <StackedList>
            {[
              { icon: <MessageSquare />, title: "Vitamin C — Q4 strategy", desc: "2 turns · 5 artifacts", meta: "2h" },
              { icon: <Search />, title: "Competitor scan: Glossier, Ordinary", desc: "184 posts · 6 patterns", meta: "Yesterday" },
              { icon: <Users />, title: "Bride persona from reviews", desc: "Draft", meta: "Mon" },
              { icon: <Target />, title: "Hooks for problem-aware", desc: "8 hooks", meta: "Sun" },
            ].map((r, i) => (
              <ListRow key={r.title} leading={r.icon} title={r.title} description={r.desc} trailing={r.meta} selected={selected === i} onClick={() => setSelected(i)} />
            ))}
          </StackedList>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <span className="text-cap text-ink-disabled">tab bar</span>
            <TabBar
              value={tab}
              onChange={setTab}
              tabs={[
                { value: "persona", label: "Persona", icon: <Users /> },
                { value: "angles", label: "Angles", icon: <Target />, count: 7 },
                { value: "briefs", label: "Briefs", icon: <FileText />, count: 2 },
                { value: "assets", label: "Assets", icon: <Images /> },
              ]}
            />
            <p className="pt-2 text-cap text-ink-secondary">Showing {tab}.</p>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-cap text-ink-disabled">progress</span>
            <Progress label="Briefs generated" value={5} max={8} />
            <Progress label="Scheduled this week" value={3} max={12} size="sm" />
            <Progress label="Rendering carousel" value={62} spectrum />
            <Row label="ring">
              <ProgressRing value={25} />
              <ProgressRing value={62} />
              <ProgressRing value={100} />
              <ProgressRing value={62} size={32} />
            </Row>
          </div>
        </div>
      </div>
    </div>
  );
}
