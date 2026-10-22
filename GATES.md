# Gates: claude-talk plugin release

OWNS: .claude-plugin/**, commands/**, bin/**, engine/**, scripts/**, checks/**, docs/**, README.md, LICENSE, package.json, .gitignore, GATES.md

Scope: /talk packaged as a Claude Code plugin in a public GitHub repo that is its own marketplace, installable with one command, plus a release zip.

- [x] P1: plugin and marketplace manifests pass Claude Code's own validator
  CHECK: node checks/release.mjs validate
  EXPECT: P1 validate passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=<repo>; path=34ec615918d0/18 entries; output=validator clean for talk@talk-for-claude 0.1.0 | P1 validate passed

- [x] P2: engine works from the repo: real speech, offline, fast, background playback, stop, markdown cleaning
  CHECK: node checks/engine.mjs all
  EXPECT: P2 engine passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=<repo>; path=34ec615918d0/18 entries; output=clean: markdown, code, links and emoji removed; words kept | P2 engine passed

- [x] P3: no secrets or personal paths in tracked files (detector proven on a planted key and a planted home path)
  CHECK: node checks/release.mjs secrets
  EXPECT: P3 secrets passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=<repo>; path=34ec615918d0/18 entries; output=20 committed files scanned, 10 detectors proven on planted samples, 0 hits | P3 secrets passed

- [x] P4: fresh install from the public GitHub repo, in an isolated Claude config and data dir, sets itself up from zero and speaks
  CHECK: node checks/release.mjs fresh-install
  EXPECT: P4 fresh install passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=<repo>; path=34ec615918d0/18 entries; output=installed talk@talk-for-claude from goodrahstar/talk-for-claude into /var/folders/r0/c3_blnys55q2gt91xxbbfyt40000gn/T/talkcfg-PR548Q; setup from zero took 28s; spoke 2.5s | P4 fresh install passed

- [x] P5: public repo is live with description, topics, README, MIT license, and a release whose zip contains a valid plugin
  CHECK: node checks/release.mjs published
  EXPECT: P5 published passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=<repo>; path=34ec615918d0/18 entries; output=https://github.com/goodrahstar/talk-for-claude public, MIT, 12 topics; v0.1.0/talk-for-claude-v0.1.0.zip validates | P5 published passed

- [x] P6: README one-line install command matches the marketplace and plugin names that actually installed in P4
  CHECK: node checks/release.mjs readme
  EXPECT: P6 readme passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=<repo>; path=34ec615918d0/18 entries; output=README one-liner matches talk@talk-for-claude | P6 readme passed

- [x] P7: one command (curl | sh from GitHub) installs the plugin AND sets up the voice, in an isolated config, then speaks
  CHECK: node checks/release.mjs one-command
  EXPECT: P7 one-command passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=<repo>; path=34ec615918d0/18 entries; output=curl https://raw.githubusercontent.com/goodrahstar/talk-for-claude/main/install.sh | sh -> plugin installed, voice ready, spoke 2.1s; total 31s | P7 one-command passed

- [x] P8: one command (`npm run publish`) creates or updates the public repo with description, topics and the release zip; safe to re-run
  CHECK: node checks/release.mjs publish-script
  EXPECT: P8 publish-script passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=<repo>; path=34ec615918d0/18 entries; output=dry run resolves goodrahstar/talk-for-claude v0.1.0: repo, description+topics, push, release zip | P8 publish-script passed

- [ ] P9: cloud: a skill zip (no bin/) passes the skill format check and its player page speaks in a real browser, Kokoro first with system-voice fallback
  CHECK: node checks/release.mjs cloud-skill
  EXPECT: P9 cloud-skill passed
  EVIDENCE: pending

- [ ] P11: the cloud skill installs in Rahul's claude.ai account (Customize > Skills) and a claude.ai chat produces a working talk player
  EVIDENCE: pending

- [x] P10: Rahul's own Mac uses the published plugin: old local /talk copies backed up and removed, plugin installed, voice ready
  CHECK: node checks/release.mjs local-switch
  EXPECT: P10 local-switch passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=<repo>; path=34ec615918d0/18 entries; output=old copies gone; talk@talk-for-claude installed; READY | P10 local-switch passed

