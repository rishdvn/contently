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
#
# Amazon Linux has no ffmpeg package, and Playwright's own is a recording-only
# build without libx264, so on Linux fetch the static build into ~/.local/bin.
# One && chain on purpose: set -e is ignored inside anything tested by `if`.
install_ffmpeg() {
  local arch
  case "$(uname -m)" in
    x86_64) arch=amd64 ;;
    aarch64) arch=arm64 ;;
    *) return 1 ;;
  esac
  # Keep the upstream file name: the .md5 file checks it by name.
  local file="ffmpeg-release-$arch-static.tar.xz"
  local url="https://johnvansickle.com/ffmpeg/releases/$file"
  local tmp
  tmp=$(mktemp -d) &&
    curl -fsSL -o "$tmp/$file" "$url" &&
    curl -fsSL -o "$tmp/$file.md5" "$url.md5" &&
    (cd "$tmp" && md5sum -c --quiet "$file.md5") &&
    tar -xJf "$tmp/$file" -C "$tmp" &&
    mkdir -p "$HOME/.local/bin" &&
    cp "$tmp"/ffmpeg-*-static/ffmpeg "$tmp"/ffmpeg-*-static/ffprobe "$HOME/.local/bin/"
  local status=$?
  rm -rf "$tmp"
  return $status
}

if ! command -v ffmpeg >/dev/null 2>&1; then
  if [ "$(uname -s)" = Linux ] && install_ffmpeg; then
    echo "installed ffmpeg into ~/.local/bin"
    case ":$PATH:" in
      *":$HOME/.local/bin:"*) ;;
      *) echo "note: ~/.local/bin is not on PATH — add it to use ffmpeg" ;;
    esac
  else
    echo "note: ffmpeg not present — attach recordings as .webm, or install it to convert to .mp4"
  fi
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
