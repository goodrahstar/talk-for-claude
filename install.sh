#!/bin/sh
# One-command install for /talk:
#   curl -fsSL https://raw.githubusercontent.com/goodrahstar/talk-for-claude/main/install.sh | sh
# Installs the Claude Code plugin, then sets up the local voice so the first /talk speaks immediately.
set -eu

REPO="goodrahstar/talk-for-claude"
MARKET="talk-for-claude"
PLUGIN="talk"

step() { printf '==> %s\n' "$1"; }
die() { printf 'talk install failed: %s\n' "$1" >&2; exit 1; }

[ "$(uname -s)" = "Darwin" ] && [ "$(uname -m)" = "arm64" ] || die "needs an Apple Silicon Mac (M1 or newer)."
command -v claude >/dev/null 2>&1 || die "Claude Code is not installed. Get it at https://claude.com/claude-code"

if ! command -v uv >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    step "Installing uv (Python package manager) with Homebrew"
    brew install uv
  else
    die "needs uv. Install it with: curl -LsSf https://astral.sh/uv/install.sh | sh   then re-run this command."
  fi
fi

step "Adding the $MARKET marketplace"
claude plugin marketplace add "$REPO" >/dev/null 2>&1 || claude plugin marketplace update "$MARKET" >/dev/null

step "Installing the $PLUGIN plugin"
claude plugin install "$PLUGIN@$MARKET"

CONFIG="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
BIN=$(ls -d "$CONFIG"/plugins/cache/"$MARKET"/"$PLUGIN"/*/bin/talk 2>/dev/null | tail -1)
[ -n "$BIN" ] && [ -x "$BIN" ] || die "plugin installed but bin/talk not found under $CONFIG/plugins/cache"

step "Setting up the voice (one time)"
"$BIN" --setup

if [ "${TALK_QUIET:-0}" != "1" ]; then
  "$BIN" "Talk is installed. In Claude Code, type slash talk to hear the last reply." >/dev/null
fi
step "Done. Restart Claude Code (or run /reload-plugins), then type /talk after any reply."
