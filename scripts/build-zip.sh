#!/bin/sh
# Build dist/talk-for-claude-v<version>.zip from tracked files only (no venvs, logs or audio).
set -eu
cd "$(dirname "$0")/.."
V=$(node -p "require('./.claude-plugin/plugin.json').version")
mkdir -p dist
rm -f "dist/talk-for-claude-v$V.zip"
git archive --format=zip --prefix=talk-for-claude/ -o "dist/talk-for-claude-v$V.zip" HEAD
echo "dist/talk-for-claude-v$V.zip"
