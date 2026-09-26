<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Contently

A block-based media editor (images, carousels, videos) that replicates Butter (butter.video) in look and behaviour. Butter is the reference: when a ticket says "match Butter", open Butter's studio, do the gesture there, then make ours behave the same. Where Butter has no equivalent, follow Canva/Figma conventions.

## Map

| Area | Files | Notes |
|---|---|---|
| Document model | `lib/editor/types.ts`, `lib/editor/factory.ts` | Project → Slides (scenes) → Blocks. Geometry is in artboard px. `groupId` is a flat tag, not a container. |
| Store | `lib/editor/store.ts` | zustand + zundo. Only `project` is in undo history; selection, viewport, playback are UI state. Add actions here, not ad-hoc `setState` in components. |
| Persistence | `lib/editor/persistence.ts` | localStorage. `blob:`/`data:` URLs are stripped on save. |
| Canvas | `components/editor/canvas/Viewport.tsx`, `Gizmo.tsx`, `BlockView.tsx`, `Artboard.tsx` | Moveable + Selecto. Gestures write to the DOM and commit to the store once on release. `BlockView` can be driven by `PlaybackContext` outside the studio (hub previews). |
| Canvas chrome | `SelectionToolbar.tsx`, `ContextMenu.tsx` | |
| Timeline / slide strip | `components/editor/chrome/Bottom.tsx` | Scene bars, layer pills, drag helper (`useTimelineDrag`), collapsed bar, `useBottomUi` for panel state. Large file; coordinate before editing. |
| Inspector | `components/editor/chrome/Inspector.tsx`, `components/editor/controls.tsx` | Column of cards. The `.inspector` scope re-anchors surface tones in `globals.css`. |
| Rail / flyout / top bar | `Rail.tsx`, `LeftPanel.tsx`, `TopBar.tsx`, `panels/*` | Rail hover peeks a panel (`usePeek`), click pins it. Layout insets are computed in `components/editor/Editor.tsx`. |
| Hub | `components/hub/*` | Project cards with hover playback and the enlarged preview modal. |
| Export | `lib/editor/export.ts`, `components/editor/dialogs/*` | PNG via html-to-image, MP4 via WebCodecs + mp4-muxer. |
| Presets / design tokens | `lib/editor/presets.ts`, `app/globals.css`, `docs/butter-tokens.txt` | Tokens come from Butter's published set; do not invent new greys. |

Hot files that most tickets touch: `Bottom.tsx`, `Gizmo.tsx`, `Inspector.tsx`, `store.ts`, `globals.css`. If your ticket and another open PR both edit one of these, expect conflicts and rebase early.

## Working on a ticket

1. Branch from current `main`. One ticket per branch and PR; keep the PR to what the ticket asks. Anything else you notice goes in the PR description as a follow-up, not in the diff.
   **Put the Linear issue id in the branch name** — `cre-41`, not `t-101`. The `T-` number is ours; `CRE-` is the only id Linear matches on.
2. **Open a draft PR on your first push**, before the work is finished, with `Closes CRE-<id>` on its own line in the body. That line is what links the PR to the ticket and moves it to In Progress. A pushed branch with no PR is invisible work: nobody can review it and nothing will ever merge it.
3. Read the relevant files before editing. Reuse existing primitives (`Panel`, `Card`, `Section`, `Group`, `Row`, `NumberField`, `Select`, `Segmented`, `Tooltip`, `Menu`) rather than adding one-off markup.
4. Commit per logical change with a message that says why, not just what. Push as you go; the PR stays a draft while you work.
5. Before **marking the PR ready for review**, all of these must pass:
   - `npx tsc --noEmit -p .`
   - `npx eslint . --max-warnings=0` (the React Compiler rules are on: no `setState` directly inside effects; use `useSyncExternalStore` or event handlers instead).
   - A headless Playwright pass of the behaviour you changed (see below), with stills or a recording attached.
6. Mark it ready only once those pass. If they don't, **leave it as a draft** and say plainly what is failing and what you tried. Draft means "still mine"; ready means "yours to review". Never mark a PR ready to signal that you have run out of ideas.

### Linear looks after itself

Status follows the PR, so don't set it by hand:

| What you do | What the ticket does |
|---|---|
| Draft PR opened | → In Progress |
| PR marked ready for review | → In Review |
| PR merged | → Done |

A ticket sitting In Progress with no PR attached means something went wrong — a branch pushed without a PR, or a body missing `Closes CRE-<id>`. Fix the PR; don't drag the ticket.

## Verifying behaviour

Keep throwaway scripts outside the repo (`/tmp`). `playwright-core` driving the installed Chrome works well:

```js
import { chromium } from "playwright-core";
const browser = await chromium.launch({ executablePath: "/usr/local/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
// Sign in first: every route is behind Clerk, and a project belongs to an organisation.
await page.goto("http://localhost:3000/editor/new?kind=video"); // creates one and redirects to its id
await page.waitForSelector(".artboard");
// press t / r / o on the canvas to add a heading, rectangle, ellipse
```

Useful facts for scripts:
- **Use `localhost`, never `127.0.0.1`.** Next 16 treats them as different origins and answers 403 to static chunks requested from a non-allowed one. Hydration then never happens and you get a blank backdrop with zero buttons — it reads exactly like an app crash. `curl` will not reproduce it, because it sends no `Origin` header.
- **Don't hardcode port 3000.** Conductor gives each workspace its own port as `$CONDUCTOR_PORT` so parallel workspaces don't collide; read it and fall back to 3000. A hardcoded port means you may be testing a different workspace's app.
- Scope canvas selectors to `.world .block` — the timeline filmstrip renders a second copy of each artboard.
- Timeline rows are `.timeline-scroll .cursor-grab`; the scene end handle is `[aria-label="Scene length"]`; the timeline resize grip is `role="separator"`.
- Projects live in Convex, autosaved ~500 ms after a change. Assert against the deployment, not the browser: `POST <NEXT_PUBLIC_CONVEX_URL>/api/query` with `{ path: "projects:get", args: { orgId, id }, format: "json" }` and `Authorization: Bearer <await window.Clerk.session.getToken()>`.
- Clerk test users (`…+clerk_test@example.com`) verify a new device with the code `424242`; `window.Clerk.setActive({ session, organization })` switches org without the switcher.
- The Next.js dev badge sits over the bottom-left corner; don't click there.
- Drags on an unselected block work at any speed; sample geometry per step when checking for drift.

For anything visual, capture before/after stills or a short recording and attach them to the PR. A reviewer should be able to judge the change without running it.

## Matching Butter

- Log in with the `BUTTER_USERNAME` / `BUTTER_PASSWORD` secrets (paste them; typing can drop symbols). The studio is at `butter.video/studio/<id>`; templates at `butter.video/templates` → open one → **Create**. Use **Break Apart** on a template to see its layers on the timeline.
- Compare at the same zoom with full-resolution crops; the frame viewer downscales, so measure in the real image.
- Things already verified against Butter (don't re-derive): scene/layer extend with frozen scale and edge auto-scroll; layer pills with ⋯/lock/eye; text resize model (corners scale type, sides re-wrap, no top/bottom handles on text); rail peek on hover / pin on click and folding into ⋮; collapsed timeline bar; inspector as a card column from the top edge; canvas context menu with align items; `W×H` label while resizing.

## Environment quirks

- Tailwind `hover:` variants are media-gated and do not fire for pointers that report no hover capability (the VNC desktop here). For anything that must show on hover, drive it from pointer-event state and keep the CSS variant as a fallback.
- Tooltips, menus and any floating label must portal to `body` or clamp to the viewport; overflow-hidden panels clip children and absolutely positioned children widen scroll containers.
- Moveable ships `z-index: 3000` on its control box; ours is pinned to 1150 so menus (1200) paint above it.
- The screen recorder can drop frames during fast gestures. If a recording looks frozen, confirm with frame grabs before treating it as a bug.
- Vercel deploys every branch (`contently-git-<branch>-juno-c9a0f66d.vercel.app`) behind team SSO.

## Merging

`main` is the integration branch. Merge approved PRs one at a time in dependency order: rebase onto current `main`, re-run the checks, then fast-forward or squash-merge. After a batch lands, walk the key flows on the production deploy once.
