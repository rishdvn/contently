#!/usr/bin/env bash
# Runs once in $CONDUCTOR_WORKSPACE_PATH when a workspace is created.
set -euo pipefail

npm ci

# LayoutProps and PageProps are globals Next generates into .next/types. Until
# something generates them, `tsc --noEmit` fails on a fresh clone for reasons
# that have nothing to do with the change being checked.
npx next typegen

# Chromium for the Playwright MCP server. --with-deps installs the shared
# libraries through apt-get, so it only works on Debian-family images; the cloud
# sandbox is Amazon Linux, which already has them, and there it would abort
# the rest of this script.
if command -v apt-get >/dev/null 2>&1; then
  npx --yes playwright install --with-deps chromium
else
  npx --yes playwright install chromium
fi

# Video comes out of the recorder as WebM. ffmpeg is only needed to convert it
# to something that previews everywhere; never fail setup over it.
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "note: ffmpeg not present — attach recordings as .webm, or install it to convert to .mp4"
fi

# The app cannot render without these: Clerk rejects a fake publishable key, so
# a missing value produces a blank page rather than a useful error. Say so now,
# at setup, instead of letting an agent debug a phantom bug for an hour.
missing=()
for key in NEXT_PUBLIC_CONVEX_URL NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY CLERK_SECRET_KEY; do
  [ -n "${!key:-}" ] || missing+=("$key")
done

if [ ${#missing[@]} -gt 0 ]; then
  cat >&2 <<EOF

  ────────────────────────────────────────────────────────────────
  Missing: ${missing[*]}

  The app will not render and nothing can be verified in a browser.
  Set these in Conductor → Settings → Organization → Cloud Computer →
  Environment, then rebuild. Locally, 'vercel env pull .env.local'
  fetches the same values.
  ────────────────────────────────────────────────────────────────

EOF
fi

# Only needed to attach evidence to a ticket; absent is fine for code-only work.
[ -n "${LINEAR_API_KEY:-}" ] || echo "note: LINEAR_API_KEY unset — scripts/attach-evidence.mjs will not run"
