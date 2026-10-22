# Gates: claude-talk plugin release

OWNS: .claude-plugin/**, commands/**, bin/**, engine/**, scripts/**, checks/**, docs/**, README.md, LICENSE, package.json, .gitignore, GATES.md

Scope: /talk packaged as a Claude Code plugin in a public GitHub repo that is its own marketplace, installable with one command, plus a release zip.

- [ ] P1: plugin and marketplace manifests pass Claude Code's own validator
  CHECK: node checks/release.mjs validate
  EXPECT: P1 validate passed
  EVIDENCE: pending

- [ ] P2: engine works from the repo: real speech, offline, fast, background playback, stop, markdown cleaning
  CHECK: node checks/engine.mjs all
  EXPECT: P2 engine passed
  EVIDENCE: pending

- [ ] P3: no secrets or personal paths in tracked files (detector proven on a planted key and a planted home path)
  CHECK: node checks/release.mjs secrets
  EXPECT: P3 secrets passed
  EVIDENCE: pending

- [ ] P4: fresh install from the public GitHub repo, in an isolated Claude config and data dir, sets itself up from zero and speaks
  CHECK: node checks/release.mjs fresh-install
  EXPECT: P4 fresh install passed
  EVIDENCE: pending

- [ ] P5: public repo is live with description, topics, README, MIT license, and a release whose zip contains a valid plugin
  CHECK: node checks/release.mjs published
  EXPECT: P5 published passed
  EVIDENCE: pending

- [ ] P6: README one-line install command matches the marketplace and plugin names that actually installed in P4
  CHECK: node checks/release.mjs readme
  EXPECT: P6 readme passed
  EVIDENCE: pending
