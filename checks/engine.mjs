// Engine gates for talk, run against this repo's bin/talk.
// Usage: node checks/engine.mjs <synth|offline|speed|playback|clean|all>
// Uses TALK_HOME (default /tmp/talk-check) and runs `talk --setup` there first if needed.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readWav } from "./wav.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TALK = join(ROOT, "bin/talk");
const TALK_HOME = process.env.TALK_HOME || "/tmp/talk-check";
const ENV = { ...process.env, TALK_HOME };
let which = process.argv[2] || "all";

function fail(msg) {
  console.log(`FAIL ${which}: ${msg}`);
  process.exit(1);
}

function run(args, opts = {}) {
  const t0 = Date.now();
  const r = spawnSync(TALK, args, { encoding: "utf8", timeout: 600000, env: ENV, ...opts });
  return { ...r, ms: Date.now() - t0, out: (r.stdout || "") + (r.stderr || "") };
}

function synthTo(text, extraEnv) {
  const dir = mkdtempSync(join(tmpdir(), "talkgate-"));
  const wav = join(dir, "out.wav");
  const r = run(["--out", wav, "--no-play", text], extraEnv ? { env: { ...ENV, ...extraEnv } } : {});
  if (r.status !== 0) fail(`talk exited ${r.status}: ${r.out.slice(-400)}`);
  if (!existsSync(wav)) fail("no WAV written");
  const w = readWav(wav);
  rmSync(dir, { recursive: true, force: true });
  return { ...w, ms: r.ms };
}

const procsInGroup = (pgid) =>
  spawnSync("ps", ["-axo", "pid=,pgid=,comm="], { encoding: "utf8" })
    .stdout.split("\n").map((l) => l.trim().split(/\s+/)).filter((p) => p[1] === String(pgid));
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const checks = {
  synth() {
    const w = synthTo("Hello. This is a quick check that your local voice works.");
    if (w.sampleRate !== 24000) fail(`unexpected sample rate ${w.sampleRate}`);
    if (w.seconds < 1.5) fail(`audio too short: ${w.seconds.toFixed(2)}s`);
    if (w.rms < 0.01) fail(`audio is near-silent: rms ${w.rms.toFixed(4)}`);
    console.log(`synth: ${w.seconds.toFixed(1)}s @ ${w.sampleRate}Hz rms ${w.rms.toFixed(3)}`);
  },
  offline() {
    const dead = "http://127.0.0.1:9";
    const w = synthTo("Offline check.", { HF_HUB_OFFLINE: "1", HTTPS_PROXY: dead, HTTP_PROXY: dead, https_proxy: dead, http_proxy: dead, ALL_PROXY: dead });
    if (w.seconds < 0.5 || w.rms < 0.01) fail("offline audio empty");
    console.log(`offline: ${w.seconds.toFixed(1)}s audio with network blocked`);
  },
  speed() {
    const text =
      "I cleaned up your Mac today. You started with about three gigabytes free, and now you have eighty four. " +
      "The biggest wins were old voice models, browser caches, and build folders from projects you no longer use. " +
      "I kept everything you still need, like your voice clone and the transcription models. Next, you can look through your Desktop folder.";
    const words = text.split(/\s+/).length;
    const w = synthTo(text);
    console.log(`speed: ${words} words -> ${w.seconds.toFixed(1)}s audio in ${(w.ms / 1000).toFixed(1)}s wall (cold start)`);
    if (w.seconds < 10) fail("audio shorter than expected for ~60 words");
    if (w.ms >= 10000) fail(`too slow: ${w.ms}ms`);
  },
  playback() {
    const pidFile = join(TALK_HOME, "play.pid");
    const r = run(["Playback check. This sentence starts playing and is then stopped by the test."]);
    if (r.status !== 0) fail(`talk exited ${r.status}: ${r.out}`);
    if (r.ms >= 3000) fail(`talk took ${r.ms}ms to return`);
    if (!existsSync(pidFile)) fail("no play.pid written");
    const pgid = readFileSync(pidFile, "utf8").trim();
    let playing = false;
    for (let i = 0; i < 80 && !playing; i++) {
      playing = procsInGroup(pgid).some((p) => p[2] && p[2].endsWith("afplay"));
      if (!playing) sleep(250);
    }
    if (!playing) fail("afplay never started in the speaker's process group");
    const s = run(["--stop"]);
    if (!s.out.includes("stopped")) fail(`--stop said: ${s.out}`);
    sleep(700);
    const left = procsInGroup(pgid);
    if (left.length) fail(`processes alive after --stop: ${JSON.stringify(left)}`);
    console.log(`playback: returned in ${r.ms}ms, afplay ran, --stop cleaned group ${pgid}`);
  },
  clean() {
    const fixture = [
      "## Done ✅", "**You now have 84 GB free.** Run `talk --stop` to stop.",
      "| Step | Freed |", "|---|---|", "| Hugging Face | ~20 GB |",
      "- first item", "1. second item",
      "See [the docs](https://example.com/x) or https://foo.bar/baz → next",
      "```bash", "rm -rf ~/secret", "```", "> quoted line 🎉",
    ].join("\n");
    const forbidden = [/\*/, /`/, /#/, /\|/, /https?:/, /→/, /✅/, /🎉/, /rm -rf/, /^\s*[-*]\s/m, /^\s*\d+\.\s/m, /^>/m];
    const missed = forbidden.filter((re) => !re.test(fixture)); // positive control
    if (missed.length) fail(`control fixture does not contain ${missed.join(", ")}`);
    const r = run(["--print-clean"], { input: fixture });
    if (r.status !== 0) fail(`talk exited ${r.status}`);
    const hits = forbidden.filter((re) => re.test(r.stdout));
    if (hits.length) fail(`cleaned text still has ${hits.join(", ")}:\n${r.stdout}`);
    for (const keep of ["84 GB free", "talk --stop", "Hugging Face", "the docs", "first item", "second item", "quoted line"])
      if (!r.stdout.includes(keep)) fail(`cleaning dropped "${keep}"`);
    console.log("clean: markdown, code, links and emoji removed; words kept");
  },
};

const doc = run(["--doctor"]);
if (!doc.out.includes("READY") || doc.out.includes("NOT_READY")) {
  console.log(`setting up ${TALK_HOME} ...`);
  const s = run(["--setup"]);
  if (s.status !== 0) fail(`setup failed: ${s.out.slice(-500)}`);
}

const names = which === "all" ? Object.keys(checks) : [which];
for (const n of names) {
  if (!checks[n]) fail("unknown check");
  which = n;
  checks[n]();
}
console.log(names.length > 1 ? "P2 engine passed" : `${names[0]} passed`);
