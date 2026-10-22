#!/bin/sh
# One-command publish: create (or update) the public GitHub repo, its description and topics,
# push main, and attach the release zip for the current plugin.json version. Safe to re-run.
# Usage: npm run publish            (or: sh scripts/publish.sh --dry-run)
set -eu
cd "$(dirname "$0")/.."

DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1
run() { if [ "$DRY" = 1 ]; then printf 'DRY: %s\n' "$*"; else "$@"; fi; }

OWNER=$(gh api user --jq .login)
NAME=$(node -p "require('./.claude-plugin/marketplace.json').name")
REPO="$OWNER/$NAME"
V=$(node -p "require('./.claude-plugin/plugin.json').version")
DESC=$(node -p "require('./.claude-plugin/plugin.json').description")
TOPICS=$(node -p "require('./.claude-plugin/plugin.json').keywords.concat(['claude-code','claude-code-plugin']).join(',')")
ZIP="dist/$NAME-v$V.zip"

if [ -n "$(git status --porcelain)" ]; then
  [ "$DRY" = 1 ] && echo "note: uncommitted changes would block a real publish" || { echo "publish: commit your changes first" >&2; exit 1; }
fi

node checks/release.mjs secrets >/dev/null || { node checks/release.mjs secrets; echo "publish: secret scan failed, nothing pushed" >&2; exit 1; }

if gh repo view "$REPO" >/dev/null 2>&1; then
  echo "repo exists: $REPO"
  run git push -q origin HEAD:main
else
  run gh repo create "$REPO" --public --source . --push --description "$DESC"
fi
run gh repo edit "$REPO" --description "$DESC" --homepage "https://github.com/$REPO" --add-topic "$TOPICS"

sh scripts/build-zip.sh >/dev/null
sh scripts/build-cloud-zip.sh >/dev/null
CLOUD="dist/talk-claude-ai-skill.zip"
if gh release view "v$V" --repo "$REPO" >/dev/null 2>&1; then
  run gh release upload "v$V" "$ZIP" "$CLOUD" --repo "$REPO" --clobber
else
  run gh release create "v$V" "$ZIP" "$CLOUD" --repo "$REPO" --title "$NAME $V" --notes "Install: curl -fsSL https://raw.githubusercontent.com/$REPO/main/install.sh | sh"
fi
echo "published https://github.com/$REPO (v$V)"
