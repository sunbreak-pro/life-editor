import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { effectiveDir, segments, toNativePath } from "../lib/hook-context.mjs";

const HOOKS = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("segments splits on && ; | but not inside quotes", () => {
  assert.deepEqual(segments('cd a && git commit -m "x && y; z" | tail -1'), [
    "cd a",
    'git commit -m "x && y; z"',
    "tail -1",
  ]);
});

test("effectiveDir follows cd up to the target command only", () => {
  const base = resolve("/base");
  assert.equal(effectiveDir("cd wt && git commit -m x", base, "commit").dir, resolve(base, "wt"));
  assert.equal(effectiveDir("git commit -m x && cd elsewhere", base, "commit").dir, base);
  assert.equal(effectiveDir("cd a; cd ../b && FOO=1 git commit", base, "commit").dir, resolve(base, "b"));
  assert.equal(effectiveDir("(cd wt && git commit -F m.txt)", base, "commit").dir, resolve(base, "wt"));
});

test("effectiveDir reads git -C, including after other global options", () => {
  const base = resolve("/base");
  assert.equal(effectiveDir("git -C ../wt commit -m x", base, "commit").dir, resolve(base, "../wt"));
  assert.equal(effectiveDir('git -c core.x=1 -C "my wt" commit', base, "commit").dir, resolve(base, "my wt"));
});

test("effectiveDir reports unknown when a cd target holds a variable", () => {
  const r = effectiveDir('cd "$WT" && git commit -m x', resolve("/base"), "commit");
  assert.equal(r.known, false);
});

test("effectiveDir finds gh pr merge after cd", () => {
  const base = resolve("/base");
  assert.equal(effectiveDir("cd wt && gh pr merge 3 --merge", base, "pr-merge").dir, resolve(base, "wt"));
});

test("toNativePath turns Git Bash drive paths into drive letters on Windows", { skip: process.platform !== "win32" }, () => {
  assert.equal(toNativePath("/c/Users/a"), "C:/Users/a");
  assert.equal(toNativePath("/c"), "C:/");
  assert.equal(toNativePath("/usr/bin"), "/usr/bin");
});

// The real hooks, copied into a throwaway repo so their own location is that repo's main checkout.
let root;
let main;
let wt;
const git = (cwd, ...a) => execFileSync("git", ["-C", cwd, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

before(() => {
  root = mkdtempSync(join(tmpdir(), "hook-ctx-"));
  main = join(root, "main");
  wt = join(root, "wf-1");
  mkdirSync(main);
  git(main, "init", "-q", "-b", "main");
  git(main, "config", "user.email", "t@example.com");
  git(main, "config", "user.name", "t");
  writeFileSync(join(main, "a.txt"), "a\n");
  git(main, "add", ".");
  git(main, "commit", "-q", "-m", "init");
  cpSync(HOOKS, join(main, ".claude", "hooks"), { recursive: true });
  git(main, "worktree", "add", "-q", "-b", "lane/wf-1", wt);
  mkdirSync(join(wt, ".claude", "comm"), { recursive: true });
  writeFileSync(join(wt, ".claude", "comm", ".session-name"), "wf-1\n");
});

after(() => {
  if (root) rmSync(root, { recursive: true, force: true });
});

function runHook(file, input) {
  const hook = join(main, ".claude", "hooks", file);
  const cmd = file.endsWith(".mjs") ? "node" : "bash";
  const r = spawnSync(cmd, [hook], { input: JSON.stringify(input), encoding: "utf8", cwd: main });
  let decision = "";
  try {
    decision = JSON.parse(r.stdout).hookSpecificOutput.permissionDecision;
  } catch {}
  return { code: r.status, stderr: r.stderr, decision };
}

test("pre-commit-tracker-guard reads the index of the worktree the command cds into", () => {
  mkdirSync(join(wt, ".claude", "memory"), { recursive: true });
  writeFileSync(join(wt, ".claude", "memory", "chat-wf-1.md"), "x\n");
  writeFileSync(join(wt, "b.txt"), "b\n");
  git(wt, "add", ".claude/memory/chat-wf-1.md", "b.txt");
  try {
    const r = runHook("pre-commit-tracker-guard.sh", { cwd: main, tool_input: { command: `cd ${wt} && git commit -m x` } });
    assert.equal(r.code, 2);
    assert.match(r.stderr, /chat-wf-1\.md/);
    const clean = runHook("pre-commit-tracker-guard.sh", { cwd: main, tool_input: { command: "git commit -m x" } });
    assert.equal(clean.code, 0, "the main checkout has nothing staged");
  } finally {
    git(wt, "reset", "-q");
  }
});

test("merge-gate denies a subagent and a merge from inside a lane worktree", () => {
  const cmd = "gh pr merge 1 -R sunbreak-pro/life-editor --squash";
  assert.equal(runHook("merge-gate.mjs", { cwd: main, agent_id: "a1", tool_input: { command: cmd } }).decision, "deny");
  assert.equal(runHook("merge-gate.mjs", { cwd: main, tool_input: { command: `cd ${wt} && ${cmd}` } }).decision, "deny");
  assert.equal(runHook("merge-gate.mjs", { cwd: main, tool_input: { command: cmd } }).decision, "ask");
});

// work-finishers runs merge-round for a run whose merge こうだいさん chose in issue-workflow's confirmation;
// chat-main records that choice in finisher-approved.json.
const MERGE = "gh pr merge 1 -R sunbreak-pro/life-editor --squash";
const roundDir = () => join(main, ".git", "merge-round");
function approve(hoursAgo) {
  mkdirSync(roundDir(), { recursive: true });
  const approvedAt = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
  writeFileSync(join(roundDir(), "finisher-approved.json"), JSON.stringify({ approvedAt }));
}
const asFinisher = (command, agent_type = "work-finishers") =>
  runHook("merge-gate.mjs", { cwd: main, agent_id: "a1", agent_type, tool_input: { command } }).decision;

test("merge-gate lets only work-finishers past the subagent deny", () => {
  try {
    approve(0);
    assert.equal(asFinisher(MERGE), "ask", "a fresh approval but no active round");
    assert.equal(asFinisher(MERGE, "general-purpose"), "deny");
    assert.equal(runHook("merge-gate.mjs", { cwd: main, agent_id: "a1", tool_input: { command: MERGE } }).decision, "deny");
  } finally {
    rmSync(roundDir(), { recursive: true, force: true });
  }
});

test("merge-gate denies work-finishers without a fresh approval marker", () => {
  try {
    assert.equal(asFinisher(MERGE), "deny", "no marker");
    approve(7);
    assert.equal(asFinisher(MERGE), "deny", "a 7-hour-old marker");
    writeFileSync(join(roundDir(), "finisher-approved.json"), "{");
    assert.equal(asFinisher(MERGE), "deny", "an unreadable marker");
  } finally {
    rmSync(roundDir(), { recursive: true, force: true });
  }
});

test("merge-gate applies every later check to work-finishers", () => {
  const writeRound = (round) =>
    writeFileSync(
      join(roundDir(), "active.json"),
      JSON.stringify({ id: "r1", startedAt: new Date().toISOString(), verifiedTree: "t", prs: [1], heads: { 1: "h1" }, checked: { 1: "h1" }, ...round }),
    );
  try {
    approve(0);
    writeRound({});
    assert.equal(asFinisher(MERGE), "allow", "a checked PR of the active round");
    assert.equal(asFinisher(`cd ${wt} && ${MERGE}`), "deny", "from inside a lane worktree");
    assert.equal(asFinisher(`${MERGE} --admin`), "ask", "a different command shape");
    assert.equal(asFinisher("gh pr merge 2 -R sunbreak-pro/life-editor --squash"), "ask", "not in the round's list");
    writeRound({ checked: {} });
    assert.equal(asFinisher(MERGE), "ask", "check has not passed");
    writeRound({ startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() });
    assert.equal(asFinisher(MERGE), "ask", "the round is older than 2 hours");
    writeRound({});
    git(main, "checkout", "-q", "-b", "not-main");
    try {
      assert.equal(asFinisher(MERGE), "ask", "the main checkout is not on main");
    } finally {
      git(main, "checkout", "-q", "main");
    }
  } finally {
    rmSync(roundDir(), { recursive: true, force: true });
  }
});
