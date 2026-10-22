#!/bin/sh
# Build dist/talk-claude-ai-skill.zip for claude.ai (Customize > Skills > Upload a skill).
# The zip holds one folder, talk/, whose name matches the skill name in SKILL.md.
set -eu
cd "$(dirname "$0")/.."
mkdir -p dist
rm -f dist/talk-claude-ai-skill.zip
(cd cloud && zip -q -r -X ../dist/talk-claude-ai-skill.zip talk -x '*.DS_Store')
echo dist/talk-claude-ai-skill.zip
