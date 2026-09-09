import { Badge } from "@/components/ui/badge";
import { Chip, ChipRow } from "@/components/ui/chip";

import { Doc, DocFacts, DocList, DocQuote, DocSection } from "./doc";

/*
  Follows the persona schema exactly: every field should change a downstream
  decision, so every field is shown. Demographics are deliberately thin.
*/
export type PersonaDocData = {
  identity: string;
  demographics: string;
  context: string;
  jobs: string[];
  workaround: string;
  pains: string[];
  desires: string[];
  objections: string[];
  triggers: string[];
  criteria: string[];
  channels: string[];
  awareness: "Unaware" | "Problem-aware" | "Solution-aware" | "Product-aware" | "Most-aware";
};

export function PersonaDoc({ data }: { data: PersonaDocData }) {
  return (
    <Doc>
      <DocSection label="Identity">
        <DocQuote>{data.identity}</DocQuote>
        <DocFacts
          facts={[
            ["Demographics", data.demographics],
            ["Context", data.context],
            ["Enters at", <Badge key="aw" dot={false}>{data.awareness}</Badge>],
          ]}
        />
      </DocSection>

      <DocSection label="Jobs to be done" hint="When ___ I want ___ so I can ___">
        <DocList items={data.jobs} />
      </DocSection>

      <DocSection label="Current workaround" hint="the real competition">
        <p className="text-default leading-6 text-ink">{data.workaround}</p>
      </DocSection>

      <div className="grid gap-6 sm:grid-cols-2">
        <DocSection label="Pains">
          <DocList items={data.pains} />
        </DocSection>
        <DocSection label="Desires">
          <DocList items={data.desires} />
        </DocSection>
      </div>

      <DocSection label="Objections" hint="including the unspoken ones">
        <DocList items={data.objections} />
      </DocSection>

      <DocSection label="Buying triggers">
        <DocList items={data.triggers} />
      </DocSection>

      <DocSection label="Decision criteria">
        <DocList items={data.criteria} />
      </DocSection>

      <DocSection label="Channels">
        <ChipRow wrap>
          {data.channels.map((c) => (
            <Chip key={c} className="h-7 text-cap">
              {c}
            </Chip>
          ))}
        </ChipRow>
      </DocSection>
    </Doc>
  );
}
