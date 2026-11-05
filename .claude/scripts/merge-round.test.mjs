// merge-gate の判定をテストする。実行: node --test .claude/scripts/merge-round.test.mjs
// merge-round.mjs 本体（plan / fixes）は GitHub と全体の local-ci を使うので、ここでは触らない。
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const GATE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "hooks", "merge-gate.mjs");
const MERGE = "gh pr merge 5 -R sunbreak-pro/life-editor --squash";
const git = (cwd, ...args) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

// 一時の repo に main と、その worktree（レーン）を作る
function setup() {
  const root = mkdtempSync(join(tmpdir(), "merge-gate-test-"));
  const repo = join(root, "repo");
  const lane = join(root, "lane");
  mkdirSync(repo);
  git(repo, "init", "-q", "-b", "main");
  git(repo, "-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "--allow-empty", "-m", "init");
  git(repo, "worktree", "add", "-q", "-b", "lane-branch", lane);
  return { root, repo, lane, marker: join(repo, ".git", "merge-round", "active.json") };
}

function writeRound(marker, round) {
  mkdirSync(dirname(marker), { recursive: true });
  writeFileSync(marker, JSON.stringify(round));
}

function gate(cwd, command) {
  const r = spawnSync(process.execPath, [GATE], {
    input: JSON.stringify({ cwd, tool_input: { command } }),
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr);
  if (!r.stdout) return null;
  return JSON.parse(r.stdout).hookSpecificOutput.permissionDecision;
}

const round = (over = {}) => ({
  id: "20260101T000000Z",
  startedAt: new Date().toISOString(),
  base: "abc",
  prs: [5],
  heads: { 5: "h5" },
  verifiedTree: "tree1",
  checked: { 5: "h5" },
  ...over,
});

test("作業レーン（worktree）からの merge は deny する", () => {
  const s = setup();
  try {
    assert.equal(gate(s.lane, MERGE), "deny");
  } finally {
    rmSync(s.root, { recursive: true, force: true });
  }
});

test("merge 以外のコマンドには判定を出さない", () => {
  const s = setup();
  try {
    assert.equal(gate(s.repo, "git status"), null);
  } finally {
    rmSync(s.root, { recursive: true, force: true });
  }
});

test("回が始まっていない chat-main の merge は ask にする", () => {
  const s = setup();
  try {
    assert.equal(gate(s.repo, MERGE), "ask");
  } finally {
    rmSync(s.root, { recursive: true, force: true });
  }
});

test("検査した tree の記録が無い回は、check を通っていても ask にする", () => {
  const s = setup();
  try {
    writeRound(s.marker, round({ verifiedTree: undefined }));
    assert.equal(gate(s.repo, MERGE), "ask");
  } finally {
    rmSync(s.root, { recursive: true, force: true });
  }
});

test("検査した組み合わせの一覧にあり、check を通った PR だけ allow する", () => {
  const s = setup();
  try {
    writeRound(s.marker, round());
    assert.equal(gate(s.repo, MERGE), "allow");
  } finally {
    rmSync(s.root, { recursive: true, force: true });
  }
});

test("check の後に head が変わった PR は ask にする", () => {
  const s = setup();
  try {
    writeRound(s.marker, round({ checked: { 5: "old" } }));
    assert.equal(gate(s.repo, MERGE), "ask");
  } finally {
    rmSync(s.root, { recursive: true, force: true });
  }
});

test("一覧に無い PR は ask にする", () => {
  const s = setup();
  try {
    writeRound(s.marker, round({ prs: [6], heads: { 6: "h5" }, checked: { 6: "h5" } }));
    assert.equal(gate(s.repo, MERGE), "ask");
  } finally {
    rmSync(s.root, { recursive: true, force: true });
  }
});

test("回が 2 時間を過ぎたら ask にする", () => {
  const s = setup();
  try {
    writeRound(s.marker, round({ startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() }));
    assert.equal(gate(s.repo, MERGE), "ask");
  } finally {
    rmSync(s.root, { recursive: true, force: true });
  }
});
