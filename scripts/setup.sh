#!/bin/sh
# One-time setup for talk: private Python env + Kokoro-82M voice model.
# Usage: setup.sh <data-dir>   (normally run via `talk --setup`)
set -eu

DATA="${1:-$HOME/.claude-talk}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

say_step() { printf '==> %s\n' "$1"; }
die() { printf 'talk setup failed: %s\n' "$1" >&2; exit 1; }

[ "$(uname -s)" = "Darwin" ] || die "talk needs macOS (it uses Apple's MLX and afplay)."
[ "$(uname -m)" = "arm64" ] || die "talk needs an Apple Silicon Mac (M1 or newer)."

if ! command -v uv >/dev/null 2>&1; then
  for p in "$HOME/.local/bin/uv" "$HOME/.cargo/bin/uv" /opt/homebrew/bin/uv; do
    [ -x "$p" ] && PATH="$(dirname "$p"):$PATH" && break
  done
fi
command -v uv >/dev/null 2>&1 || die "uv is missing. Install it with: brew install uv   (or see https://docs.astral.sh/uv/)"

# espeak-ng (used for unusual words) cannot open data paths longer than ~160 characters.
ESPEAK_DATA="$DATA/venv/lib/python3.12/site-packages/espeakng_loader/espeak-ng-data/phontab"
[ "${#ESPEAK_DATA}" -lt 150 ] || die "data folder path is too long for espeak-ng; set TALK_HOME to a shorter folder (default: ~/.claude-talk)."

mkdir -p "$DATA"
rm -f "$DATA/.ready"

say_step "Creating a private Python 3.12 environment in $DATA/venv"
uv venv -q --python 3.12 --allow-existing "$DATA/venv"

say_step "Installing the voice engine (mlx-audio + English text processing, about 400 MB)"
VIRTUAL_ENV="$DATA/venv" uv pip install -q -r "$ROOT/engine/requirements.txt"

say_step "Downloading Kokoro-82M (about 340 MB, once) and warming it up"
HF_HUB_DISABLE_PROGRESS_BARS=1 TALK_HOME="$DATA" "$DATA/venv/bin/python" -I "$ROOT/engine/talk.py" --out "$DATA/setup-check.wav" --no-play "Setup check." >/dev/null
rm -f "$DATA/setup-check.wav"

date -u +%Y-%m-%dT%H:%M:%SZ > "$DATA/.ready"
say_step "Done. talk is ready."
