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

### Stacked PRs

If your ticket needs code from another PR that hasn't merged, stack it: branch from that PR's branch, open your PR against it (`gh stack` helps), and say so at the top of the description. PRs are squash-merged, so once the one underneath lands, its commits are not in `main` under the same hashes. Rebase the next one with `git rebase --onto origin/main <old base tip>` (the old base branch's last commit), then retarget the PR to `main`. A plain `git rebase origin/main` replays the base's commits again and conflicts with their squashed copy.

### Linear looks after itself

Status follows the PR, so don't set it by hand:

| What you do | What the ticket does |
|---|---|
| Draft PR opened | → In Progress |
| PR marked ready for review | → In Review |
| PR merged | → Done |

A ticket sitting In Progress with no PR attached means something went wrong — a branch pushed without a PR, or a body missing `Closes CRE-<id>`. Fix the PR; don't drag the ticket.

**Linking a ticket from someone else's PR can stall it.** If a ticket's own PR merges while another open PR links the same ticket as contributing (`Part of`, `Ref`), Linear keeps the ticket in In Review, and it stays there even after that other PR merges too. Last round a finished ticket sat in In Review for exactly this reason. So in a PR that may merge later than a sibling ticket's own PR, don't link the sibling at all: name it in words ("the Stock slot ticket"), or put `skip` before the id.

### Never write a closing keyword next to another ticket's id

Linear scans the PR title, body and commit messages for a keyword beside an issue id. **It does not read context.** Backticks, quotation marks, an example, a sentence explaining the convention — all invisible. If the pair is in the text, the ticket closes when the PR merges.

This has already cost us once: a docs PR quoted the closing syntax while explaining how linking works, and merging it marked an unrelated ticket Done while that ticket's own PR was still an open draft with none of its code in `main`. Nothing warns you. The only symptom is a ticket in Done that nobody finished, which is worse than a loud failure because the board looks healthy.

So: **a closing keyword is only ever for the one ticket this PR completes.** To mention any other ticket:

| Intent | Write | Effect |
|---|---|---|
| This PR completes it | `Closes CRE-<id>` | Links, and closes on merge |
| This PR contributes to it | `Part of CRE-<id>`, `Ref CRE-<id>` | Links, never closes; can hold the ticket in In Review (see above) |
| Just pointing at it | `CRE-<id>` alone, no keyword nearby | Links from the title only; inert in the body |
| Don't touch it at all | `skip CRE-<id>` | Suppresses linking entirely |

Closing keywords are `close`, `fix`, `resolve`, `complete`, `implement` and their tenses. When in doubt, name the ticket in words ("the render-worker ticket") and put the id nowhere near a verb.

## The Convex deployment is shared with production

`chatty-giraffe-3` is the **only** Convex deployment. Every workspace, every Vercel preview **and production** use it, and a push (`npx convex dev --once`, `npx convex deploy`) replaces *all* functions and the schema with the ones in your tree. Most UI work needs no push. Until production has a deployment of its own (the production-deployment ticket, CRE-71), when yours does:

1. Push only from a branch rebased on current `main`.
2. Keep schema changes **additive**: new tables, new optional fields, new functions. Never remove or rename a function, field, index or table that `main` uses, and never make an existing field required.
3. Right before pushing, compare `npx convex function-spec` with your tree. Functions on the deployment that your tree doesn't have belong to another workspace's unmerged branch. Push from a temporary worktree that also contains their `convex/` files, so you don't delete them, and say in your PR which branches you folded in.
4. Keep test data in your own test org. Don't rewrite production projects, media or templates beyond what your ticket asks.
5. Push as rarely as you can.

After a batch of PRs merges, push `main`'s `convex/`, so the deployment is `main` again rather than the last branch that happened to push.

## Verifying behaviour

Keep throwaway scripts outside the repo (`/tmp`). `playwright-core` driving the installed Chrome works well:

```js
import { chromium } from "playwright-core";
// channel "chrome" finds the installed Chrome wherever the OS put it (/opt/google/chrome on the sandbox)
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const base = `http://localhost:${process.env.CONDUCTOR_PORT || 3000}`;
// Sign in first: every route is behind Clerk, and a project belongs to an organisation.
await page.goto(`${base}/editor/new?kind=video`); // creates one and redirects to its id
await page.waitForSelector(".artboard");
// press t / r / o on the canvas to add a heading, rectangle, ellipse
```

Useful facts for scripts:
- **Use `localhost`, never `127.0.0.1`.** Next 16 treats them as different origins and answers 403 to static chunks requested from a non-allowed one. Hydration then never happens and you get a blank backdrop with zero buttons — it reads exactly like an app crash. `curl` will not reproduce it, because it sends no `Origin` header.
- **Don't hardcode port 3000.** Local Conductor workspaces each get their own port as `$CONDUCTOR_PORT` so parallel workspaces don't collide; a hardcoded port means you may be testing a different workspace's app. Cloud workspaces have a VM each and no `$CONDUCTOR_PORT`, so read it and fall back to 3000, as the Run button does.
- Scope canvas selectors to `.world .block` — the timeline filmstrip renders a second copy of each artboard.
- Timeline rows are `.timeline-scroll .cursor-grab`; the scene end handle is `[aria-label="Scene length"]`; the timeline resize grip is `role="separator"`.
- Projects live in Convex, autosaved ~500 ms after a change. Assert against the deployment, not the browser: `POST <NEXT_PUBLIC_CONVEX_URL>/api/query` with `{ path: "projects:get", args: { orgId, id }, format: "json" }` and `Authorization: Bearer <await window.Clerk.session.getToken()>`.
- Clerk test users (`…+clerk_test@example.com`) verify a new device with the code `424242`; `window.Clerk.setActive({ session, organization })` switches org without the switcher.
- The Next.js dev badge sits over the bottom-left corner; don't click there.
- Drags on an unselected block work at any speed; sample geometry per step when checking for drift.

For anything visual, capture before/after stills or a short recording. A reviewer should be able to judge the change without running it.

### Recording a run, and where the evidence goes

The repo ships a Playwright MCP server (`.mcp.json`), already headless, isolated, at 1440×900, writing to `.evidence/` (gitignored). The `devtools` capability is on, which is what makes recording available — without it you only get stills.

- `browser_take_screenshot` — a still, returned to you as an image so you can judge it yourself, and written to `.evidence/`.
- `browser_start_video` / `browser_stop_video` — records the session to WebM. Pass `cursor: true`: it draws a cursor and paces actions so the result is watchable rather than a blur.
- `browser_video_chapter` — a titled card between steps. Use it to narrate ("before", "after the fix"), so the reviewer can follow without a written commentary.
- **The video file is only finalised when recording stops.** Stop it before you try to attach anything, or you will attach an empty file.

Evidence belongs on the **Linear issue**, not the pull request — that is where review happens, and Linear accepts uploads from an API key while GitHub's media endpoint rejects app and CI tokens.

```sh
node scripts/attach-evidence.mjs CRE-51 .evidence/video-1234.webm "Shortcuts sheet opens with ?"
```

Then say in the PR description what you attached and to which ticket, so a reader on GitHub knows to look. Convert WebM to MP4 first if `ffmpeg` is available (`ffmpeg -i in.webm -c:v libx264 -pix_fmt yuv420p out.mp4`) — it previews more widely; attach the WebM if not.

What is worth recording: the gesture or flow the ticket asked for, end to end. What is not: the whole session, a page loading, or anything a still would say better. One clip under thirty seconds beats four minutes of scrolling.

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

- **Stacked PRs:** after each merge, rebase the next PR in the stack with `--onto` (see "Stacked PRs" above) before re-running its checks.
- **Convex:** after the batch, push `main`'s `convex/` (see "The Convex deployment is shared with production").
- **Blocks:** after a PR that adds or changes a block merges, run `npm run block-previews` from `main` against the deployment (`--only <id>` for one block). Until it runs, the Blocks panel has no stored preview for that block and falls back to drawing it live. Don't run it from an unmerged branch: it writes the previews every workspace and production read.
