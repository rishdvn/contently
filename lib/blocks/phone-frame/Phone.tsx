import type { CSSProperties } from "react";

import type { PropsOf } from "../inputs";
import { BlockImage, BlockVideo } from "../media";
import type { RenderContext } from "../registry";

import type { inputs } from "./schema";

type Props = PropsOf<typeof inputs>;

/*
  Drawn in phone units, about an iPhone's points, and scaled to fit the box:
  `u` is one unit. The phone keeps its proportions and sits centred, as large
  as the box allows, so a wider or taller box only adds space around it.
*/
type Model = {
  body: [number, number];
  radius: number;
  /* The metal band, then the black bezel inside it. */
  band: number;
  bezel: number;
  screenRadius: number;
  /* Side buttons: [top, length] in units down the body. */
  left: [number, number][];
  right: [number, number][];
};

const MODELS: Record<Props["model"], Model> = {
  iphone: { body: [410, 844], radius: 66, band: 5, bezel: 11, screenRadius: 54, left: [[150, 32], [212, 62], [290, 62]], right: [[250, 100]] },
  android: { body: [410, 860], radius: 46, band: 4, bezel: 13, screenRadius: 34, left: [], right: [[210, 66], [300, 116]] },
};

/* Buttons stand this far proud of the band. */
const BUTTON = 3;

/* Metal finishes, lit from the top left. The bezel stays black on every colour, as on the real phones. */
const FINISH: Record<Props["color"], string[]> = {
  black: ["#55555b", "#1e1e21", "#3b3b40", "#161618"],
  white: ["#fbfbfd", "#d6d6dc", "#f1f1f4", "#c8c8cf"],
  titanium: ["#ddd6ca", "#a39b8e", "#cbc3b6", "#8f877b"],
};

const metal = (c: string[], angle = 135) => `linear-gradient(${angle}deg, ${c[0]} 0%, ${c[1]} 38%, ${c[2]} 68%, ${c[3]} 100%)`;

/* What an empty screen shows: a wallpaper, so the frame still reads as a phone. */
const WALLPAPER = "linear-gradient(160deg, #262a45 0%, #5d4574 48%, #df9678 100%)";

const FONT = `"Inter", -apple-system, system-ui, sans-serif`;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/* The tilt-in takes the first 15 % of the block, so it stretches with it. */
const ENTRANCE = 0.15;

export function Phone({ props, ctx }: { props: Props; ctx: RenderContext }) {
  const m = MODELS[props.model];
  const [bw, bh] = m.body;
  const u = Math.min(ctx.width / (bw + BUTTON * 2), ctx.height / bh);
  const finish = FINISH[props.color];
  const video = props.screenVideo.src !== "" || props.screenVideo.mediaId !== undefined;

  const e = props.entrance === "tilt" && ctx.mode === "video" ? easeOut(clamp01(ctx.progress / ENTRANCE)) : 1;
  const k = 1 - e;
  const pose: CSSProperties =
    k > 0
      ? { transform: `translateY(${k * 8}%) rotateX(${k * 26}deg) rotateY(${k * -30}deg) rotateZ(${k * 7}deg) scale(${0.84 + 0.16 * e})`, opacity: clamp01(e * 1.8) }
      : {};

  return (
    <div className="flex size-full items-center justify-center overflow-hidden" style={{ perspective: 1800 * u }}>
      <div className="relative shrink-0" style={{ width: bw * u, height: bh * u, ...pose }}>
        {m.left.map(([top, length], i) => (
          <div key={`l${i}`} className="absolute" style={{ left: -BUTTON * u, top: top * u, width: (BUTTON + 2) * u, height: length * u, borderRadius: 2 * u, background: metal(finish, 90) }} />
        ))}
        {m.right.map(([top, length], i) => (
          <div key={`r${i}`} className="absolute" style={{ right: -BUTTON * u, top: top * u, width: (BUTTON + 2) * u, height: length * u, borderRadius: 2 * u, background: metal(finish, 270) }} />
        ))}
        <div
          className="absolute inset-0"
          style={{
            borderRadius: m.radius * u,
            padding: m.band * u,
            background: metal(finish),
            boxShadow: `inset 0 0 0 ${Math.max(0.5, 0.8 * u)}px rgba(255,255,255,0.18)`,
          }}
        >
          <div className="size-full" style={{ borderRadius: (m.radius - m.band) * u, padding: m.bezel * u, background: "#050505" }}>
            <div className="relative size-full overflow-hidden" style={{ borderRadius: m.screenRadius * u, background: WALLPAPER, fontFamily: FONT }}>
              <BlockImage value={props.screen} className="absolute inset-0 size-full" style={{ objectPosition: "top" }} />
              {video ? <BlockVideo value={props.screenVideo} time={ctx.time} mode={ctx.mode} className="absolute inset-0 size-full" /> : null}
              {props.statusBar !== "hidden" ? <SystemUi model={props.model} ink={props.statusBar === "light" ? "#ffffff" : "#000000"} u={u} /> : null}
              {props.model === "iphone" ? (
                <div className="absolute left-1/2" style={{ top: 11 * u, width: 124 * u, height: 36 * u, marginLeft: -62 * u, borderRadius: 18 * u, background: "#000" }} />
              ) : (
                <div className="absolute left-1/2" style={{ top: 13 * u, width: 22 * u, height: 22 * u, marginLeft: -11 * u, borderRadius: "50%", background: "#000", boxShadow: `0 0 0 ${2 * u}px rgba(0,0,0,0.35)` }} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* The clock, signal, Wi-Fi and battery across the top, and the home indicator at the bottom. */
function SystemUi({ model, ink, u }: { model: Props["model"]; ink: string; u: number }) {
  const iphone = model === "iphone";
  const height = iphone ? 58 : 44;
  return (
    <>
      <div className="absolute inset-x-0 top-0 flex items-center justify-between" style={{ height: height * u, padding: iphone ? `${4 * u}px ${32 * u}px 0 ${50 * u}px` : `0 ${22 * u}px`, color: ink }}>
        <span style={{ fontSize: (iphone ? 17 : 14) * u, fontWeight: 600, letterSpacing: -0.2 * u, lineHeight: 1 }}>9:41</span>
        <div className="flex items-center" style={{ gap: (iphone ? 6 : 5) * u }}>
          <svg width={18 * u} height={12 * u} viewBox="0 0 18 12" fill={ink}>
            <rect x="0" y="8" width="3" height="4" rx="1" />
            <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
            <rect x="10" y="3" width="3" height="9" rx="1" />
            <rect x="15" y="0" width="3" height="12" rx="1" />
          </svg>
          <svg width={16 * u} height={12 * u} viewBox="0 0 16 12" fill={ink}>
            <path d="M8 2.4c2.3 0 4.4.9 6 2.4l1.2-1.3C13.3 1.6 10.8.6 8 .6S2.7 1.6.8 3.5L2 4.8C3.6 3.3 5.7 2.4 8 2.4Z" />
            <path d="M8 5.9c1.4 0 2.6.5 3.6 1.4l1.2-1.3C11.5 4.8 9.8 4.1 8 4.1s-3.5.7-4.8 1.9l1.2 1.3c1-.9 2.2-1.4 3.6-1.4Z" />
            <path d="M8 9.3c.5 0 1 .2 1.3.5L8 11.2 6.7 9.8c.3-.3.8-.5 1.3-.5Z" />
          </svg>
          <svg width={27 * u} height={13 * u} viewBox="0 0 27 13" fill="none">
            <rect x="0.5" y="0.5" width="23" height="12" rx="3.8" stroke={ink} strokeOpacity="0.4" />
            <rect x="2" y="2" width="20" height="9" rx="2.5" fill={ink} />
            <path d="M25 4.5v4c.8-.3 1.4-1.1 1.4-2s-.6-1.7-1.4-2Z" fill={ink} fillOpacity="0.45" />
          </svg>
        </div>
      </div>
      <div
        className="absolute left-1/2"
        style={{ bottom: (iphone ? 8 : 10) * u, width: (iphone ? 140 : 110) * u, height: (iphone ? 5 : 4) * u, marginLeft: (iphone ? -70 : -55) * u, borderRadius: 3 * u, background: ink }}
      />
    </>
  );
}
