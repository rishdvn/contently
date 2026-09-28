import type { CSSProperties } from "react";

import type { PropsOf } from "../inputs";
import { BlockImage, BlockVideo } from "../media";
import type { RenderContext } from "../registry";

import type { inputs } from "./schema";

type Props = PropsOf<typeof inputs>;

/*
  Laid out on a 1000-unit-wide window and scaled to the block's width: `u` is
  one unit. Wider scales the chrome with it; taller gives the page the extra
  height, the chrome keeping its size. A generic desktop browser rather than
  any one vendor's: traffic lights, one tab, an address bar.
*/
const STAGE = 1000;
const TABS = 44;
const TOOLBAR = 48;
const COMPACT = 52;

const THEMES = {
  light: { frame: "#e7e7ea", tab: "#ffffff", toolbar: "#ffffff", field: "#f0f0f2", ink: "#1f1f1f", meta: "#6b6b70", icon: "#5f6368", hairline: "rgba(0,0,0,0.1)", page: "#f4f4f6", skeleton: "#e4e4e8" },
  dark: { frame: "#1e1e21", tab: "#303034", toolbar: "#303034", field: "#1c1c1f", ink: "#ececee", meta: "#a0a0a6", icon: "#b4b4ba", hairline: "rgba(255,255,255,0.08)", page: "#232326", skeleton: "#2f2f33" },
};

const FONT = `"Inter", -apple-system, system-ui, sans-serif`;

/* "https://www.glow.shop/summer?x" → "www.glow.shop/summer?x" for the address bar, "glow.shop" for the tab. */
const shown = (url: string) => url.trim().replace(/^[a-z]+:\/\//i, "");
const host = (url: string) => shown(url).split(/[/?#]/)[0].replace(/^www\./i, "") || "New Tab";

export function Browser({ props, ctx }: { props: Props; ctx: RenderContext }) {
  const t = THEMES[props.theme];
  const u = ctx.width / STAGE;
  const video = props.contentVideo.src !== "" || props.contentVideo.mediaId !== undefined;

  return (
    <div
      className="flex size-full flex-col overflow-hidden"
      style={{ borderRadius: 12 * u, background: t.frame, boxShadow: `inset 0 0 0 ${Math.max(1, u)}px ${t.hairline}`, fontFamily: FONT, color: t.ink, WebkitFontSmoothing: "antialiased" }}
    >
      {props.showTabs ? (
        <>
          <div className="flex shrink-0 items-end" style={{ height: TABS * u, paddingLeft: 16 * u }}>
            <Lights u={u} style={{ alignSelf: "center" }} />
            <div
              className="relative flex items-center"
              style={{ marginLeft: 22 * u, width: 240 * u, height: 36 * u, padding: `0 ${12 * u}px`, gap: 8 * u, background: t.tab, borderRadius: `${10 * u}px ${10 * u}px 0 0` }}
            >
              <Favicon letter={host(props.url)[0]} u={u} />
              <span className="min-w-0 flex-1 truncate" style={{ fontSize: 13 * u, lineHeight: 1.3, fontWeight: 500 }}>
                {host(props.url)}
              </span>
              <svg width={10 * u} height={10 * u} viewBox="0 0 10 10" stroke={t.icon} strokeWidth="1.4" strokeLinecap="round">
                <path d="M2 2l6 6M8 2L2 8" />
              </svg>
            </div>
            <svg width={14 * u} height={14 * u} viewBox="0 0 14 14" stroke={t.icon} strokeWidth="1.5" strokeLinecap="round" style={{ alignSelf: "center", marginLeft: 12 * u }}>
              <path d="M7 2v10M2 7h10" />
            </svg>
          </div>
          <div className="flex shrink-0 items-center" style={{ height: TOOLBAR * u, padding: `0 ${14 * u}px`, gap: 14 * u, background: t.toolbar, borderBottom: `${Math.max(1, u)}px solid ${t.hairline}` }}>
            <NavIcons u={u} color={t.icon} />
            <Address url={props.url} theme={t} u={u} grow />
            <MenuDots u={u} color={t.icon} />
          </div>
        </>
      ) : (
        <div className="flex shrink-0 items-center" style={{ height: COMPACT * u, padding: `0 ${16 * u}px`, gap: 18 * u, background: t.toolbar, borderBottom: `${Math.max(1, u)}px solid ${t.hairline}` }}>
          <Lights u={u} />
          <NavIcons u={u} color={t.icon} />
          <div className="flex flex-1 justify-center">
            <Address url={props.url} theme={t} u={u} width={460} />
          </div>
          <MenuDots u={u} color={t.icon} />
        </div>
      )}
      <div className="relative min-h-0 flex-1 overflow-hidden" style={{ background: t.page }}>
        <Skeleton color={t.skeleton} u={u} />
        <BlockImage value={props.content} className="absolute inset-0 size-full" style={{ objectPosition: "top" }} />
        {video ? <BlockVideo value={props.contentVideo} time={ctx.time} mode={ctx.mode} className="absolute inset-0 size-full" /> : null}
      </div>
    </div>
  );
}

function Lights({ u, style }: { u: number; style?: CSSProperties }) {
  return (
    <div className="flex shrink-0" style={{ gap: 8 * u, ...style }}>
      {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
        <div key={c} style={{ width: 12 * u, height: 12 * u, borderRadius: "50%", background: c, boxShadow: `inset 0 0 0 ${0.5 * u}px rgba(0,0,0,0.12)` }} />
      ))}
    </div>
  );
}

/* A letter in a rounded square: the site's icon, which the block cannot know. */
function Favicon({ letter, u }: { letter?: string; u: number }) {
  return (
    <div className="flex shrink-0 items-center justify-center" style={{ width: 16 * u, height: 16 * u, borderRadius: 4 * u, background: "#1f1f1f", color: "#fff", fontSize: 10 * u, fontWeight: 700, lineHeight: 1 }}>
      {(letter ?? "").toUpperCase()}
    </div>
  );
}

function NavIcons({ u, color }: { u: number; color: string }) {
  const icon = { width: 16 * u, height: 16 * u, viewBox: "0 0 16 16", fill: "none", stroke: color, strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <div className="flex shrink-0 items-center" style={{ gap: 14 * u }}>
      <svg {...icon}>
        <path d="M10 3L5 8l5 5" />
      </svg>
      <svg {...icon} style={{ opacity: 0.4 }}>
        <path d="M6 3l5 5-5 5" />
      </svg>
      <svg {...icon}>
        <path d="M13 8a5 5 0 1 1-1.6-3.7M13 2.5v3h-3" />
      </svg>
    </div>
  );
}

function MenuDots({ u, color }: { u: number; color: string }) {
  return (
    <svg width={16 * u} height={16 * u} viewBox="0 0 16 16" fill={color} className="shrink-0">
      <circle cx="8" cy="3" r="1.4" />
      <circle cx="8" cy="8" r="1.4" />
      <circle cx="8" cy="13" r="1.4" />
    </svg>
  );
}

function Address({ url, theme, u, grow, width }: { url: string; theme: (typeof THEMES)["light"]; u: number; grow?: boolean; width?: number }) {
  return (
    <div
      className="flex min-w-0 items-center"
      style={{ flex: grow ? 1 : undefined, width: width ? width * u : undefined, maxWidth: "100%", height: 32 * u, padding: `0 ${14 * u}px`, gap: 8 * u, borderRadius: 16 * u, background: theme.field }}
    >
      <svg width={12 * u} height={12 * u} viewBox="0 0 12 12" fill="none" stroke={theme.meta} strokeWidth="1.3" className="shrink-0">
        <rect x="2" y="5.5" width="8" height="5.5" rx="1.2" fill={theme.meta} stroke="none" />
        <path d="M3.8 5.5V4a2.2 2.2 0 0 1 4.4 0v1.5" />
      </svg>
      <span className="min-w-0 truncate" style={{ fontSize: 14 * u, lineHeight: 1.3 }}>
        {shown(url) || <span style={{ color: theme.meta }}>Search or type a URL</span>}
      </span>
    </div>
  );
}

/* What an empty page shows: the outline of a website, so the window still reads as one. */
function Skeleton({ color, u }: { color: string; u: number }) {
  const bar = (w: number | string, h: number, extra?: CSSProperties) => <div style={{ width: typeof w === "number" ? w * u : w, height: h * u, borderRadius: 6 * u, background: color, ...extra }} />;
  return (
    <div className="absolute inset-0 flex flex-col" style={{ padding: `${36 * u}px ${56 * u}px`, gap: 16 * u }}>
      <div className="flex items-center justify-between">
        {bar(90, 18)}
        <div className="flex" style={{ gap: 18 * u }}>
          {bar(50, 10)}
          {bar(50, 10)}
          {bar(50, 10)}
        </div>
      </div>
      <div className="flex" style={{ gap: 40 * u, marginTop: 40 * u }}>
        <div className="flex flex-1 flex-col" style={{ gap: 14 * u }}>
          {bar("80%", 34)}
          {bar("60%", 34)}
          {bar("90%", 12, { marginTop: 10 * u })}
          {bar("75%", 12)}
          {bar(140, 40, { marginTop: 14 * u, borderRadius: 20 * u })}
        </div>
        {bar(360, 240, { borderRadius: 16 * u })}
      </div>
    </div>
  );
}
