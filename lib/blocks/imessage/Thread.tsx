import type { CSSProperties } from "react";

import type { PropsOf } from "../inputs";
import { BlockImage } from "../media";
import type { RenderContext } from "../registry";

import type { inputs } from "./index";

type Props = PropsOf<typeof inputs>;
type Message = Props["messages"][number];

/*
  The Messages app's thread, laid out in iPhone points and scaled to the block's
  width: `u` is one point. Resizing wider scales the type; resizing taller shows
  more history, and a thread longer than its box keeps the newest message in
  view, as the app does.
*/
const PT = 390;

const THEMES = {
  light: { bg: "#ffffff", header: "#f6f6f6", hairline: "#d8d8dc", name: "#000000", meta: "#8e8e93", received: "#e9e9eb", receivedInk: "#000000", sent: "#0b84ff", sentInk: "#ffffff", dot: "#8e8e93" },
  dark: { bg: "#000000", header: "#1c1c1e", hairline: "#2c2c2e", name: "#ffffff", meta: "#8e8e93", received: "#262629", receivedInk: "#ffffff", sent: "#0b84ff", sentInk: "#ffffff", dot: "#8e8e93" },
};
type Theme = (typeof THEMES)["light"];

const FONT = `"Inter", -apple-system, system-ui, sans-serif`;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
/* A small overshoot, so a bubble lands rather than fades. */
const easeOutBack = (t: number) => {
  const c = 1.4;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

/*
  When each message arrives, in seconds from the block's in point. The last
  fifth of the block is a hold on the finished thread. A received message is
  preceded by the other person typing, so it gets a longer slot than one you
  send, which just appears.
*/
export function schedule(messages: Message[], showTyping: boolean, duration: number) {
  const typed = (m: Message) => showTyping && m.side === "received";
  const weights = messages.map((m) => (typed(m) ? 1.6 : 1));
  const unit = (duration * 0.8) / Math.max(1, weights.reduce((a, b) => a + b, 0));
  const pop = Math.min(0.32, unit * 0.5);
  let at = unit * 0.15;
  return {
    pop,
    slots: messages.map((m, i) => {
      const start = at;
      const appear = typed(m) ? start + unit * 0.9 : start;
      at += unit * weights[i];
      return { typingFrom: typed(m) ? start : null, appear };
    }),
  };
}

export function Thread({ props, ctx }: { props: Props; ctx: RenderContext }) {
  const theme = THEMES[props.theme];
  const u = ctx.width / PT;
  const { messages } = props;
  const { pop, slots } = schedule(messages, props.showTyping, ctx.duration);
  const t = ctx.time;
  const lastIndex = messages.length - 1;

  return (
    <div
      className="size-full overflow-hidden"
      style={{ display: "flex", flexDirection: "column", background: theme.bg, borderRadius: 34 * u, fontFamily: FONT, WebkitFontSmoothing: "antialiased" }}
    >
      <Header name={props.contactName} avatar={props.avatar} theme={theme} u={u} />
      {/* Grows to fill when the thread is short; overflows at the top when it is long. */}
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
        <div style={{ flex: "1 0 auto", paddingTop: 12 * u, paddingBottom: 18 * u }}>
          <div style={{ textAlign: "center", color: theme.meta, fontSize: 11.5 * u, lineHeight: 1.35, paddingBottom: 10 * u }}>
            <div style={{ fontWeight: 600 }}>iMessage</div>
            <div>Today 9:41</div>
          </div>
          {messages.map((m, i) => {
            const slot = slots[i];
            const shown = clamp01((t - slot.appear) / pop);
            const typing = slot.typingFrom === null ? 0 : Math.min(clamp01((t - slot.typingFrom) / pop), 1 - clamp01((t - slot.appear) / (pop * 0.6)));
            const next = messages[i + 1];
            /* The tail marks the end of a run from one side. */
            const tail = !next || next.side !== m.side;
            const gap = i > 0 && messages[i - 1].side !== m.side ? 10 : 2;
            return (
              <div key={i}>
                {typing > 0 ? (
                  <Grow f={easeOut(typing)}>
                    <Row side="received" u={u} gap={gap}>
                      <Typing theme={theme} u={u} t={t} f={typing} />
                    </Row>
                  </Grow>
                ) : null}
                <Grow f={easeOut(shown)}>
                  <Row side={m.side} u={u} gap={gap}>
                    <Bubble message={m} theme={theme} u={u} tail={tail} f={shown} />
                  </Row>
                  {i === lastIndex && m.side === "sent" ? (
                    <div style={{ textAlign: "right", color: theme.meta, fontSize: 11 * u, fontWeight: 500, padding: `${3 * u}px ${16 * u}px 0` }}>Delivered</div>
                  ) : null}
                </Grow>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/*
  Height from 0 to natural without measuring anything: a single grid row sized
  in `fr` below 1 takes that fraction of its content. So a new bubble pushes the
  thread up smoothly instead of popping the layout.
*/
function Grow({ f, children }: { f: number; children: React.ReactNode }) {
  if (f <= 0) return null;
  return (
    <div style={{ display: "grid", gridTemplateRows: `${f >= 1 ? 1 : f}fr` }}>
      <div style={{ minHeight: 0, overflow: f >= 1 ? undefined : "hidden" }}>{children}</div>
    </div>
  );
}

function Row({ side, u, gap, children }: { side: Message["side"]; u: number; gap: number; children: React.ReactNode }) {
  return <div style={{ display: "flex", justifyContent: side === "sent" ? "flex-end" : "flex-start", padding: `${gap * u}px ${16 * u}px 0` }}>{children}</div>;
}

function Bubble({ message, theme, u, tail, f }: { message: Message; theme: Theme; u: number; tail: boolean; f: number }) {
  const sent = message.side === "sent";
  const fill = sent ? theme.sent : theme.received;
  const s = 0.6 + 0.4 * easeOutBack(clamp01(f));
  return (
    <div
      style={{
        position: "relative",
        maxWidth: "74%",
        padding: `${7.5 * u}px ${13 * u}px`,
        borderRadius: 19 * u,
        background: fill,
        color: sent ? theme.sentInk : theme.receivedInk,
        fontSize: 17 * u,
        lineHeight: 1.3,
        letterSpacing: -0.2 * u,
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        transform: f >= 1 ? undefined : `scale(${s})`,
        transformOrigin: sent ? "100% 100%" : "0% 100%",
        opacity: clamp01(f * 2.5),
      }}
    >
      {tail ? <Tail side={message.side} fill={fill} bg={theme.bg} u={u} /> : null}
      <span style={{ position: "relative" }}>{message.text || " "}</span>
    </div>
  );
}

/*
  The hooked corner of the last bubble in a run: a blob in the bubble's colour
  with a background-coloured scoop cut out of it, the same two shapes the app
  draws.
*/
function Tail({ side, fill, bg, u }: { side: Message["side"]; fill: string; bg: string; u: number }) {
  const sent = side === "sent";
  const blob: CSSProperties = { position: "absolute", bottom: 0, width: 20 * u, height: 20 * u, background: fill };
  /* A point taller than the blob, so no anti-aliased seam of its top edge survives beside the bubble. */
  const scoop: CSSProperties = { position: "absolute", bottom: 0, width: 10 * u, height: 21 * u, background: bg };
  return sent ? (
    <>
      <span style={{ ...blob, right: -7 * u, borderBottomLeftRadius: 16 * u }} />
      <span style={{ ...scoop, right: -10 * u, borderBottomLeftRadius: 10 * u }} />
    </>
  ) : (
    <>
      <span style={{ ...blob, left: -7 * u, borderBottomRightRadius: 16 * u }} />
      <span style={{ ...scoop, left: -10 * u, borderBottomRightRadius: 10 * u }} />
    </>
  );
}

/* Three dots breathing in turn, driven by the timeline clock so it scrubs. */
function Typing({ theme, u, t, f }: { theme: Theme; u: number; t: number; f: number }) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        gap: 4.5 * u,
        padding: `${13 * u}px ${15 * u}px`,
        borderRadius: 19 * u,
        background: theme.received,
        transform: `scale(${0.6 + 0.4 * easeOutBack(clamp01(f))})`,
        transformOrigin: "0% 100%",
        opacity: clamp01(f * 2.5),
      }}
    >
      <Tail side="received" fill={theme.received} bg={theme.bg} u={u} />
      {[0, 1, 2].map((k) => {
        const wave = Math.max(0, Math.sin(t * Math.PI * 2 * 1.2 - k * 0.9));
        return <span key={k} style={{ position: "relative", width: 8.5 * u, height: 8.5 * u, borderRadius: "50%", background: theme.dot, opacity: 0.4 + 0.6 * wave }} />;
      })}
    </div>
  );
}

function Header({ name, avatar, theme, u }: { name: string; avatar: Props["avatar"]; theme: Theme; u: number }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div
      style={{
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 5 * u,
        padding: `${16 * u}px ${16 * u}px ${10 * u}px`,
        background: theme.header,
        borderBottom: `${Math.max(1, 0.5 * u)}px solid ${theme.hairline}`,
      }}
    >
      <div
        style={{
          position: "relative",
          width: 54 * u,
          height: 54 * u,
          borderRadius: "50%",
          overflow: "hidden",
          background: "linear-gradient(180deg, #a6abb8, #858994)",
          color: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22 * u,
          fontWeight: 500,
        }}
      >
        {initials}
        <BlockImage value={avatar} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 3 * u, color: theme.name, fontSize: 12.5 * u, fontWeight: 500 }}>
        <span style={{ maxWidth: 260 * u, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name || "Contact"}</span>
        <span style={{ color: theme.meta, fontSize: 11 * u }}>›</span>
      </div>
    </div>
  );
}
