// Release gates. Usage: node checks/release.mjs <validate|secrets|fresh-install|published|readme>
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readWav } from "./wav.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = "goodrahstar/talk-for-claude";
const plugin = JSON.parse(readFileSync(join(ROOT, ".claude-plugin/plugin.json"), "utf8"));
const market = JSON.parse(readFileSync(join(ROOT, ".claude-plugin/marketplace.json"), "utf8"));
const TAG = `v${plugin.version}`;
const ZIP = `talk-for-claude-${TAG}.zip`;
const which = process.argv[2];

function fail(msg) {
  console.log(`FAIL ${which}: ${msg}`);
  process.exit(1);
}
function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", timeout: 900000, cwd: ROOT, ...opts });
  return { ...r, out: (r.stdout || "") + (r.stderr || "") };
}
function walk(dir, base = dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, base, out);
    else out.push(p.slice(base.length + 1));
  }
  return out;
}

if (which === "validate") {
  const r = sh("claude", ["plugin", "validate", "."]);
  if (r.status !== 0 || !r.out.includes("Validation passed")) fail(r.out.slice(-800));
  if (/ICON_MISSING|error/i.test(r.out.replace(/Validation passed/, ""))) fail(`validator reported: ${r.out.slice(-600)}`);
  if (market.plugins[0].name !== plugin.name) fail("marketplace entry name differs from plugin.json name");
  console.log(`validator clean for ${plugin.name}@${market.name} ${plugin.version}`);
  console.log("P1 validate passed");
} else if (which === "secrets") {
  const detectors = [
    [/sk-[A-Za-z0-9_-]{20,}/, "OpenAI/Anthropic-style key"],
    [/sk-ant-[A-Za-z0-9_-]{20,}/, "Anthropic key"],
    [/gh[pousr]_[A-Za-z0-9]{30,}/, "GitHub token"],
    [/AIza[0-9A-Za-z_-]{30,}/, "Google key"],
    [/xox[abpr]-[A-Za-z0-9-]{10,}/, "Slack token"],
    [/eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\./, "JWT"],
    [/tln_[A-Za-z0-9._-]{20,}/, "Timeln token"],
    [/hf_[A-Za-z0-9]{30,}/, "Hugging Face token"],
    [/\/Users\/rahulkumar/, "personal home path"],
    [/official\.rahulk@/, "personal email"],
  ];
  // Positive controls: every detector must fire on a planted sample, or a clean result proves nothing.
  const planted = [
    "sk-" + "A".repeat(24), "sk-ant-" + "B".repeat(24), "ghp_" + "C".repeat(36), "AIza" + "D".repeat(33),
    "xoxb-" + "1".repeat(12), "eyJ" + "a".repeat(20) + ".eyJ" + "b".repeat(20) + ".", "tln_" + "E".repeat(24),
    "hf_" + "F".repeat(34), "/Users/" + "rahulkumar/x", "official." + "rahulk@x",
  ].join("\n");
  const blind = detectors.filter(([re]) => !re.test(planted)).map(([, n]) => n);
  if (blind.length) fail(`detectors did not fire on planted samples: ${blind.join(", ")}`);
  const ls = sh("git", ["ls-files", "--cached", "--others", "--exclude-standard"]);
  if (ls.status !== 0) fail("git ls-files failed");
  const files = ls.stdout.split("\n").filter(Boolean);
  const forbiddenFiles = files.filter((f) => /(^|\/)(\.env|\.venv|venv|__pycache__)(\/|$)|\.wav$|\.pid$|\.log$/.test(f));
  if (forbiddenFiles.length) fail(`would publish: ${forbiddenFiles.join(", ")}`);
  const hits = [];
  for (const f of files) {
    if (/\.(png|jpg|zip)$/.test(f)) continue;
    const text = readFileSync(join(ROOT, f), "utf8");
    for (const [re, name] of detectors) if (re.test(text) && f !== "checks/release.mjs") hits.push(`${f}: ${name}`);
  }
  if (hits.length) fail(hits.join("; "));
  console.log(`${files.length} files scanned, ${detectors.length} detectors proven on planted samples, 0 hits`);
  console.log("P3 secrets passed");
} else if (which === "fresh-install") {
  // Isolated Claude config + isolated data + isolated Hugging Face cache: nothing from this machine is reused.
  const cfg = mkdtempSync(join(tmpdir(), "talkcfg-"));
  const data = "/tmp/talk-fresh"; // short on purpose: espeak-ng rejects long data paths
  const hf = "/tmp/talk-fresh-hf";
  rmSync(data, { recursive: true, force: true });
  rmSync(hf, { recursive: true, force: true });
  const env = { ...process.env, CLAUDE_CONFIG_DIR: cfg };
  const add = sh("claude", ["plugin", "marketplace", "add", REPO], { env, cwd: tmpdir() });
  if (add.status !== 0) fail(`marketplace add: ${add.out.slice(-400)}`);
  const inst = sh("claude", ["plugin", "install", `${plugin.name}@${market.name}`], { env, cwd: tmpdir() });
  if (inst.status !== 0 || !/install/i.test(inst.out)) fail(`install: ${inst.out.slice(-400)}`);
  // The marketplace clone also contains bin/talk; the installed plugin lives under plugins/cache.
  const found = walk(cfg).filter((p) => p.endsWith("bin/talk") && p.includes("plugins/cache/"));
  if (found.length !== 1) fail(`expected one installed bin/talk under plugins/cache, found ${found.length}`);
  const pluginDir = join(cfg, dirname(dirname(found[0])));
  if (!existsSync(join(pluginDir, "skills/talk/SKILL.md"))) fail("installed copy has no skills/talk/SKILL.md");
  const talk = join(pluginDir, "bin/talk");
  const tenv = { ...process.env, TALK_HOME: data, HF_HOME: hf };
  const t0 = Date.now();
  const setup = sh(talk, ["--setup"], { env: tenv });
  if (setup.status !== 0) fail(`setup: ${setup.out.slice(-600)}`);
  const setupS = ((Date.now() - t0) / 1000).toFixed(0);
  const wav = join(data, "fresh.wav");
  const say = sh(talk, ["--out", wav, "--no-play", "Installed from GitHub and speaking."], { env: tenv });
  if (say.status !== 0) fail(`synth: ${say.out.slice(-400)}`);
  const w = readWav(wav);
  if (w.seconds < 1 || w.rms < 0.01) fail("fresh install produced empty audio");
  console.log(`installed ${plugin.name}@${market.name} from ${REPO} into ${cfg}; setup from zero took ${setupS}s; spoke ${w.seconds.toFixed(1)}s`);
  rmSync(cfg, { recursive: true, force: true });
  console.log("P4 fresh install passed");
} else if (which === "published") {
  const v = sh("gh", ["repo", "view", REPO, "--json", "visibility,description,repositoryTopics,licenseInfo,url"]);
  if (v.status !== 0) fail(v.out);
  const j = JSON.parse(v.stdout);
  if (j.visibility !== "PUBLIC") fail(`visibility ${j.visibility}`);
  if (!j.description || j.description.length < 40) fail("missing description");
  if ((j.repositoryTopics || []).length < 5) fail("fewer than 5 topics");
  if (!j.licenseInfo || j.licenseInfo.key !== "mit") fail("license is not detected as MIT");
  const readme = sh("gh", ["api", `repos/${REPO}/readme`, "--jq", ".name"]);
  if (readme.stdout.trim() !== "README.md") fail("README not found on GitHub");
  const dir = mkdtempSync(join(tmpdir(), "talkzip-"));
  const dl = sh("gh", ["release", "download", TAG, "--repo", REPO, "--pattern", ZIP, "--dir", dir]);
  if (dl.status !== 0) fail(`release asset: ${dl.out}`);
  const unz = sh("unzip", ["-q", join(dir, ZIP), "-d", join(dir, "x")]);
  if (unz.status !== 0) fail("zip does not extract");
  const top = readdirSync(join(dir, "x"));
  const pdir = join(dir, "x", top.length === 1 ? top[0] : "");
  const val = sh("claude", ["plugin", "validate", pdir]);
  if (val.status !== 0 || !val.out.includes("Validation passed")) fail(`zip plugin invalid: ${val.out.slice(-400)}`);
  if (!(statSync(join(pdir, "bin/talk")).mode & 0o111)) fail("bin/talk in zip is not executable");
  rmSync(dir, { recursive: true, force: true });
  console.log(`${j.url} public, MIT, ${j.repositoryTopics.length} topics; ${TAG}/${ZIP} validates`);
  console.log("P5 published passed");
} else if (which === "readme") {
  const md = readFileSync(join(ROOT, "README.md"), "utf8");
  const oneLiner = `claude plugin marketplace add ${REPO} && claude plugin install ${plugin.name}@${market.name}`;
  if (!md.includes(oneLiner)) fail(`README lacks the exact one-liner: ${oneLiner}`);
  if (!md.includes(`/plugin install ${plugin.name}@${market.name}`)) fail("README lacks the in-session install line");
  if (!md.includes("docs/banner.png")) fail("README lacks the banner");
  console.log(`README one-liner matches ${plugin.name}@${market.name}`);
  console.log("P6 readme passed");
} else {
  fail("unknown check");
}
