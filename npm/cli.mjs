#!/usr/bin/env node
// npx talk-for-claude  ->  installs the /talk plugin for Claude Code and sets up the local voice.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const arg = process.argv[2];
if (arg === "-h" || arg === "--help") {
  console.log("Usage: npx talk-for-claude\n\nInstalls the /talk plugin for Claude Code (Apple Silicon Mac) and sets up its local Kokoro-82M voice.\nhttps://github.com/goodrahstar/talk-for-claude");
  process.exit(0);
}
if (process.platform !== "darwin" || process.arch !== "arm64") {
  console.error("talk-for-claude needs an Apple Silicon Mac (M1 or newer).");
  process.exit(1);
}
const script = join(dirname(fileURLToPath(import.meta.url)), "..", "install.sh");
const r = spawnSync("/bin/sh", [script], { stdio: "inherit" });
process.exit(r.status ?? 1);
