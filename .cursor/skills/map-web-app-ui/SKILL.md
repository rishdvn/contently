---
name: map-web-app-ui
description: "Log into a live web app, systematically map every screen with screenshots and screen recordings, and publish the result as a Notion page. Use when asked to document, audit, map, or capture the UI of an external product or platform."
compatibility: "Requires a Cloud Agent environment with Chrome, an X display, ffmpeg, the computerUse and RecordScreen tools, the /opt/cursor/artifacts mount, and an authenticated Notion MCP connection. Phase 0 checks for these."
---

# Mapping a web app's UI and publishing it to Notion

Drive a real browser through a live web product, capture every distinct screen, and publish a single reviewable document. The output is a Notion page with inline screenshots, screen recordings, and a written analysis — not a folder of loose images.

This runs against **someone's real production account**. The read-only contract in this skill is not optional.

## When to use

Use for requests like "map out this platform", "document this app's UI", "screenshot every screen of X", "show me how competitor Y's editor works". Also use when the goal is competitive or design reference work, since the analysis matters as much as the images.

Do not use for testing code you just changed — that is ordinary manual verification, and the walkthrough-artifacts guidance covers it.

## Inputs to gather before starting

You need four things. Ask only for what is genuinely missing; infer the rest.

1. **URL** of the product.
2. **Credentials**, and how it authenticates. Prefer a dedicated test account with 2FA disabled. If the account requires a time-based code from the user's device, or only offers SSO or a magic link, stop and say so rather than looping on the login screen.
3. **Scope** — which areas matter. Absent direction, map everything reachable.
4. **Destination** — where the output goes. Default to a Notion page.

Credentials belong in Cloud Agent secrets (Dashboard → Cloud Agents → Secrets), not in chat. Note the timing trap: **secrets are injected at VM boot, so a run that is already in progress cannot see secrets added mid-session.** Check with `env | grep -i <PREFIX>`; if they are absent and the user supplied credentials in chat, use those and mention that the secrets will be picked up by the next run.

If the user pasted a real password into chat, tell them to rotate it once you are done.

## Phase 0 — Preflight

Confirm the environment can do the job before committing to a long exploration.

```bash
curl -sS -o /dev/null -w "status=%{http_code} final=%{url_effective}\n" -L --max-time 25 <URL>
which google-chrome chromium firefox; echo "DISPLAY=$DISPLAY"
ls -la /opt/cursor/artifacts/
df -h /
```

A non-200 status, a redirect to a login wall you have no credentials for, or an unreachable host means the target is behind a VPN or allowlist. Say so and stop; do not spend a browser session discovering it.

## Phase 1 — Recon pass over the outer app

Start a recording, then hand a `computerUse` subagent the full task. Recording first means the login flow is captured.

```
RecordScreen: START_RECORDING
Task(computerUse): <recon prompt>
RecordScreen: SAVE_RECORDING
```

The recon prompt should cover the public landing page, the login flow, then every item in the primary navigation, every settings and billing surface, and every "create new" entry point. See `references/computer-use-prompts.md` for a prompt that works.

**Expect the recon pass to skip the deepest and most important surface.** A subagent told to avoid creating resources will interpret "don't create anything" as "don't open the editor", and you will get a complete map of the shell around an empty middle. Plan for phase 2 from the start.

## Phase 2 — Deep pass over the core surface

Whatever the product actually *is* — the editor, the canvas, the dashboard, the query console — gets its own recording and its own subagent pass. Opening a pre-existing document or project is safe and creates nothing.

Tell the subagent to work purposefully because it is being recorded, and give it a target of 8–12 minutes. Have it click every tab in every panel, select an object to populate the inspector, and open the export and share dialogs without confirming them.

## The read-only contract

Paste this into every `computerUse` prompt verbatim. It is the difference between a documentation pass and an incident.

> This is a REAL production account. Do NOT: run an export or render; run any AI generation; delete anything; upload files; create new projects; change account settings or passwords; purchase, upgrade or cancel a subscription; invite or remove members; send any message or email. Open dialogs to screenshot them, then dismiss with Cancel or Escape — never confirm. If you change something to inspect its properties, undo it with Ctrl+Z.

Two reasons this is worth being pedantic about. Anything metered (renders, AI calls) **spends the user's money**. And anything destructive is unrecoverable in someone else's account.

Afterwards, verify compliance instead of assuming it: check the product's own usage meters read unchanged, and confirm the recording shows dialogs being cancelled rather than confirmed.

## Recording mechanics and their failure modes

These behaviours are surprising enough to call out, and all of them were hit in practice.

**`SAVE_RECORDING` will probably time out.** A ~25 minute capture at 1920x1200 takes longer than the tool's 660s limit to encode. **The timeout is not a failure** — encoding continues in the background and the file usually lands correctly. Do not re-issue the call. Instead poll:

```bash
pgrep -a ffmpeg                                    # still encoding?
ls -la /opt/cursor/recording-staging/*/recording/  # watch recording_full.mp4 grow
ls -la /opt/cursor/artifacts/                      # it appears here when done
```

If encoding finished but the file never reached `/opt/cursor/artifacts/`, copy it there yourself.

**Do not write to `/opt/cursor/artifacts/` while a recording is saving.** That store is a slow network-backed FUSE mount, and concurrent writes during a save produce `Input/output error` on some files and can make the directory temporarily unreadable. Copy screenshots either before starting a recording or after the save settles, and retry failed copies:

```bash
for try in 1 2 3; do cp "$f" /opt/cursor/artifacts/ 2>/dev/null && break || sleep 5; done
```

Individual writes to that mount can take 30–60 seconds. This is normal, not a hang.

**Encoding leaves multi-gigabyte intermediates.** Each session writes a `recording_render_proxy_1080p.mp4` that can exceed 7 GB. Delete the proxy from completed sessions before starting another recording.

**Recordings arrive condensed.** The renderer strips idle time, so a 25-minute session becomes roughly 2 minutes of continuous interaction. This is desirable — describe the timeline of the *output* video, not the wall-clock session.

## Verify recordings before publishing

Always run the `videoReview` subagent over the recordings before referencing or publishing them. State what you believe each video shows and ask it to confirm. Include these four questions every time:

1. Is the footage legible at this resolution?
2. Is there any point where the session looks broken, stuck, or errored?
3. Does anything destructive or credit-consuming visibly happen?
4. **Are any credentials or sensitive account details readable on screen, and at what timestamp?**

Question 4 is the one that matters. In practice a login recording exposed the account email in plaintext in the email field, and then again in a Chrome "Save password?" prompt several seconds after login. Neither was obvious without watching the footage frame by frame.

### Redacting a window of a video

Blur the offending time range rather than cutting it, so the flow stays intact:

```bash
ffmpeg -y -i raw.mp4 -vf "scale=1280:-2,boxblur=luma_radius=30:luma_power=3:chroma_radius=30:chroma_power=3:enable='between(t,5,22.5)'" \
  -c:v libx264 -crf 32 -preset veryfast -an -movflags +faststart redacted.mp4
```

Then **verify the redaction visually** — extract a frame inside the window and one outside it, and actually look at them:

```bash
ffmpeg -y -ss 8 -i redacted.mp4 -frames:v 1 inside.png -loglevel error
ffmpeg -y -ss 30 -i redacted.mp4 -frames:v 1 outside.png -loglevel error
```

Delete the unredacted copy from `/opt/cursor/artifacts/` once the redacted version exists.

## Publish to Notion

Full mechanics, including the two API gotchas that will otherwise cost you a cycle each, are in `references/notion-publishing.md`. The essentials:

- Upload every asset with `notion-create-file-upload`, then a multipart `POST` to the returned `upload_url`. Batch the MCP calls in parallel, then do all the `curl`s in one shell loop.
- **Unattached uploads expire one hour after upload.** Upload assets, then create the page promptly. If there is a lot of work left, create the page first and add heavy assets in a follow-up update.
- Single-part uploads cap at **20 MiB**, so compress video first (`scale=1280:-2`, `-crf 32` reliably lands a screen recording well under the cap).
- Read `notion://docs/enhanced-markdown-spec` before writing page content. Images are `![Caption](file-upload://<id>)`; video is `<video src="file-upload://<id>">Caption</video>`.
- Create with `creation_mode: "draft"` unless the user named a destination, then tell them it is private and offer to move it.

### Verify the published page

Fetch the page back and confirm every reference resolved. Any remaining `file-upload://` string means a broken asset:

```bash
grep -o 'file-upload://[^")>]*' "$fetched" | wc -l   # must be 0
grep -o '[0-9][0-9]_[a-z_]*\.png' "$fetched" | sort -u | wc -l   # must equal your screenshot count
```

## Write the page as analysis, not an inventory

A numbered list of screens with captions is a worse deliverable than it looks — the reader learns nothing they could not get by logging in themselves. Structure the page so it answers *what this product is and how it is built*:

- Open with what the product is and what its architecture divides into.
- A navigation tree as a code block, showing real URL paths.
- Walk the surfaces in a logical order, with each screenshot placed inside the section it illustrates rather than pooled in a gallery.
- Put the pricing and usage-limit page into a table. Metering reveals what a product considers expensive, which is often the most strategically useful thing on the whole page.
- An **observations** section: what the product optimises for, what it deliberately omits, and what the omissions imply. Absent features are evidence about priorities.
- A **coverage and gaps** section listing what you did not exercise and why, so the reader knows the map's edges.
- Close with a privacy warning if the page documents a real account: plan status, usage, member lists and emails are all visible in screenshots even when recordings are redacted.

Note relevant details the user did not ask for but will care about. Cross-reference the findings against work already in their workspace when it is genuinely related.

## Checklist

- [ ] Target reachable, browser and display available
- [ ] Read-only contract in every subagent prompt
- [ ] Recording started before each pass, saved after
- [ ] Core product surface covered, not just the shell
- [ ] `videoReview` run on every recording
- [ ] Credentials redacted, redaction verified on extracted frames, unredacted copy deleted
- [ ] Usage meters confirm nothing metered was consumed
- [ ] All assets uploaded and page created within the one-hour expiry window
- [ ] Fetched page has zero unresolved `file-upload://` references
- [ ] Page reads as analysis; privacy warning included
- [ ] Draft location flagged to the user with an offer to move it
