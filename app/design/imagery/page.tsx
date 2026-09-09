import { Heart, MoreHorizontal } from "lucide-react";

import { AgentMark, Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { Illustration, Logo, Thumbnail, Wordmark } from "@/components/ui/imagery";

import { Page, PageHeader, Row, Section } from "../_doc";

export const metadata = {
  title: "Imagery · Contently design",
};

const art = [
  "linear-gradient(160deg,#f6d5c4,#c98f74)",
  "linear-gradient(160deg,#e7d9f5,#9b7fc4)",
  "linear-gradient(160deg,#d8e6c8,#7f9d63)",
  "linear-gradient(160deg,#fbe3c9,#d59a5c)",
];

export default function ImageryPage() {
  return (
    <Page>
      <PageHeader
        title="Imagery"
        lede="Pictures in the chrome. The interface is monochrome so that the user's artwork is the only colour on screen; everything on this page is the frame that artwork sits in, or the one mark that is allowed to carry the spectrum."
        note="Avatar & mark · Thumbnail · Logo · Illustration. The full Mobbin Imagery category."
      />

      <Section
        id="avatars"
        title="Avatar & mark"
        rule="People are round and fall back to initials on a raised fill; workspaces and brands are square. The agent has no face — it is an empty spectrum ring, the one place the gradient may be persistent, because it names who is speaking. It breathes while a reply is streaming."
      >
        <Row label="people">
          <Avatar name="Hanna Moore" size="xs" />
          <Avatar name="Hanna Moore" size="sm" />
          <Avatar name="Hanna Moore" size="md" />
          <Avatar name="Hanna Moore" size="lg" />
        </Row>
        <Row label="workspace">
          <Avatar name="Glow Labs" shape="square" size="sm" />
          <Avatar name="Glow Labs" shape="square" size="md" />
          <Avatar name="Glow Labs" shape="square" size="lg" />
        </Row>
        <Row label="agent">
          <AgentMark size="xs" />
          <AgentMark size="sm" />
          <AgentMark size="md" />
          <AgentMark size="lg" />
          <span className="pl-2 text-cap text-ink-disabled">streaming &rarr;</span>
          <AgentMark size="md" active />
        </Row>
      </Section>

      <Section
        id="thumbnails"
        title="Thumbnail"
        rule="Artwork at a fixed ratio on a 20px radius — the only place besides the card that the large radius appears. An overlay row lays over a scrim so type stays legible on any picture. No source means a raised fill and a glyph, never a broken image."
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {art.map((bg, i) => (
            <Thumbnail
              key={i}
              ratio="4:5"
              style={{ backgroundImage: bg }}
              selected={i === 1}
              overlay={
                <div className="flex items-end justify-between gap-2">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-cap text-white">Slide {i + 1}</span>
                    <span className="text-tiny text-white/70">4:5 · 1080×1350</span>
                  </div>
                  <IconButton aria-label="More" size="sm" className="size-7 text-white hover:bg-white/15 hover:text-white">
                    <MoreHorizontal />
                  </IconButton>
                </div>
              }
            />
          ))}
        </div>
        <Row label="ratios">
          <Thumbnail ratio="1:1" className="w-20" />
          <Thumbnail ratio="4:5" className="w-20" />
          <Thumbnail ratio="9:16" className="w-20" />
          <Thumbnail ratio="16:9" className="w-32" />
          <Thumbnail ratio="1:1" className="w-20">
            <Heart className="size-5" />
          </Thumbnail>
        </Row>
      </Section>

      <Section
        id="logo"
        title="Logo"
        rule="A lowercase c drawn as a broken ring — the gap is where the spectrum begins. Monochrome in the chrome; the spectrum version is for the app icon and the empty state only. The wordmark is the italic serif already used in the sidebar."
      >
        <Row label="mark">
          <Logo size={16} className="text-ink" />
          <Logo size={24} className="text-ink" />
          <Logo size={32} className="text-ink" />
          <Logo size={48} className="text-ink" />
          <Logo size={48} spectrum />
        </Row>
        <Row label="wordmark">
          <Wordmark />
        </Row>
        <Row label="on dark">
          <div className="flex items-center gap-6 rounded-nav bg-canvas px-6 py-4">
            <Logo size={32} className="text-ink" />
            <Logo size={32} spectrum />
            <Badge tone="spectrum" dot={false}>
              App icon
            </Badge>
          </div>
        </Row>
      </Section>

      <Section
        id="illustration"
        title="Illustration"
        rule="Empty-state glyphs: a few strokes on a 96px stage in the same 1.5px line as the icons, so an empty screen and a full screen share one hand. Named by what is missing, not by what they depict."
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {(["empty-board", "empty-calendar", "empty-library", "empty-thread", "no-results"] as const).map((n) => (
            <div key={n} className="flex flex-col items-center gap-3 rounded-nav bg-card p-6">
              <Illustration name={n} />
              <span className="font-mono text-cap text-ink-secondary">{n}</span>
            </div>
          ))}
        </div>
      </Section>
    </Page>
  );
}
