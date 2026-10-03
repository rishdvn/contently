# computerUse prompt templates

Two prompts, one per pass. Both assume the read-only contract is included verbatim — it is repeated in each because a subagent only sees the prompt you give it, not the conversation.

The `computerUse` subagent is stateful and auto-resumes, so the phase 2 prompt can rely on the browser session from phase 1 while still telling it how to recover if the session expired.

---

## Phase 1 — Recon pass over the outer app

```
You are performing a UI reconnaissance and documentation pass on <PRODUCT> (<URL>). It is <one-line description>. The goal of this pass is to LOG IN and MAP OUT the platform's structure, capturing a screenshot of every distinct screen you reach.

## Credentials (provided by the account owner, who has authorized this exploration)
- Email/username: <USERNAME>
- Password: <PASSWORD>
- URL: <URL>

## Environment
Google Chrome is at /usr/local/bin/google-chrome. A display is available at DISPLAY=:1. Launch Chrome maximized at 1920x1080 or larger so the UI is captured cleanly.

## Steps
1. Navigate to <URL> and screenshot the public landing page.
2. Find and click Log in / Sign in. Screenshot the login screen.
3. Log in.
   - If both "Continue with Google" and email/password are offered, use email/password — SSO usually blocks automated logins.
   - If only magic-link or SSO is available, STOP and report that clearly. Do not loop.
   - If a 2FA or verification code is required, STOP and report it.
4. Screenshot the first authenticated screen.
5. Explore systematically. Screenshot every area you can reach:
   - The main dashboard or home
   - Every item in the primary navigation — click each one
   - List views and their empty states
   - Account settings, profile, workspace/team settings, billing and plan pages
   - Integrations, if present
   - Every "create new" / upload / import entry point — open the modal and screenshot it, but do NOT complete it
   - Help, support, notifications, and search UI
6. For each screen, note the screen name, the URL, and what it does and which controls it carries.

## Constraints
<paste the read-only contract here verbatim>

## Screenshots
Save every screenshot into /tmp/<product>_screenshots/ using descriptive snake_case names prefixed with a two-digit sequence, e.g. 01_<product>_landing_page.png. Report the absolute path of each one paired with the screen it shows.

## Return
1. Whether login succeeded or failed, and if it failed, exactly why.
2. A complete inventory: screen name, URL, purpose, key UI controls.
3. The navigation structure and how screens nest.
4. Absolute paths of all screenshots, labeled.
5. Anything you could NOT reach, and why.

Be thorough. Work methodically and wait for slow pages rather than giving up.
```

---

## Phase 2 — Deep pass over the core surface

Adapt the bracketed parts to whatever the product's primary working surface is.

```
Continue the <PRODUCT> UI mapping. You should already be logged in as <USERNAME> in Chrome from the previous session — if it expired, log back in with <USERNAME> / <PASSWORD>.

In the previous pass you mapped the outer app (<list the areas covered>). You explicitly SKIPPED <the core surface>, which is the heart of the product. That is what I need now.

## Be efficient
This session is being screen-recorded, so work purposefully. Avoid long pauses and dead ends. Target 8-12 minutes of productive interaction.

## Steps
1. Open the existing <document/project/dataset> named "<NAME>". Opening something that already exists is safe and creates nothing.
2. Screenshot the full interface once loaded.
3. Document it systematically, screenshotting each of:
   - Overall layout — identify every panel and region and what each is for
   - Every tab or icon in the left/asset panel — click through ALL of them
   - The properties/inspector panel, with an object selected so it is populated
   - The primary work area, including any playback, zoom, or view controls
   - The timeline / table / grid, including its own controls
   - Every menu in the top toolbar — open, screenshot, close
   - The export/download/share dialog — screenshot the options then CANCEL. Do NOT run it; it consumes credits.
   - Any AI features — screenshot the entry point and panel, but do NOT run them
   - Keyboard shortcut help or command palette, if present
4. Briefly exercise playback or live rendering so the recording captures the product actually working.

## Constraints
<paste the read-only contract here verbatim>

## Screenshots
Continue the existing numbering, starting at <N>. Save into /tmp/<product>_screenshots/. Report absolute paths, labeled.

## Return
1. The layout — every panel, its contents, its purpose.
2. Every tab in the asset panel and what each offers.
3. The inspector options for a selected object.
4. What the export/share dialog offers, without running it.
5. Any AI features and where they live.
6. Absolute paths of all new screenshots, labeled.
7. Anything you couldn't reach, and why.
```

---

## Notes on prompting these passes

**Name the skip explicitly.** Phase 2 works because it tells the subagent what phase 1 avoided and why that was wrong. Without that framing it tends to re-tour the navigation.

**Say that it is being recorded.** This measurably reduces aimless clicking, and the resulting video is publishable rather than embarrassing.

**Give a time target.** Open-ended exploration produces very long recordings that then take longer than the save timeout to encode.

**Ask for absolute paths.** You need them to copy files and to upload them, and reconstructing paths afterwards is error-prone.

**Distinguish safe from unsafe explicitly.** "Open an existing project" versus "create a new project" is not a distinction a subagent will reliably infer from "don't create anything".
