#!/usr/bin/env node
// merge-gate — `gh pr merge` を chat-main の merge-round の中だけで確認なしに通す（POLICY P-001、2026-11-02 改定）。
//
// settings.json の allow は `Bash(gh pr merge * --squash)` を許す。この hook がその手前で次のように振り分ける:
//   - 作業レーン（git worktree）から打った → deny（レーンは merge しない）
//   - chat-main だが main にいない / 形が決まりと違う / 回が始まっていない / 一覧に無い PR → ask（従来どおり確認）
//   - chat-main・main・決まった形・進行中の回の一覧にある PR → allow
// 回の一覧は `.claude/scripts/merge-round.mjs start` が .git/merge-round/active.json に書く。
// 判定できないときは ask に倒す（hook が落ちて allow ルールだけで通るのを防ぐ）。
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const SHAPE = /^\s*gh\s+pr\s+merge\s+(\d+)\s+-R\s+sunbreak-pro\/life-editor\s+--squash\s*$/;
const ROUND_TTL_MS = 6 * 60 * 60 * 1000;

function decide(permissionDecision, permissionDecisionReason) {
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision, permissionDecisionReason } }),
  );
  process.exit(0);
}

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}
const command = String(input?.tool_input?.command ?? "");
if (!/\bgh\s+pr\s+merge\b/.test(command)) process.exit(0);

try {
  const cwd = input.cwd || process.cwd();
  const git = (...args) =>
    execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  const norm = (p) => resolve(p).toLowerCase();
  const gitDir = norm(git("rev-parse", "--path-format=absolute", "--git-dir"));
  const common = norm(git("rev-parse", "--path-format=absolute", "--git-common-dir"));

  if (gitDir !== common)
    decide("deny", "作業レーン（worktree）からは merge しません（POLICY P-001）。merge は chat-main の merge-round スキルが行います。");

  const branch = git("branch", "--show-current");
  if (branch !== "main") decide("ask", `chat-main が main にいません（いま ${branch || "detached"}）。merge してよいか確認します。`);

  const m = command.match(SHAPE);
  if (!m)
    decide("ask", "merge-round の形（gh pr merge <番号> -R sunbreak-pro/life-editor --squash を単独で打つ）と違うので確認します。");

  const marker = join(git("rev-parse", "--path-format=absolute", "--git-common-dir"), "merge-round", "active.json");
  if (!existsSync(marker)) decide("ask", "merge-round の回が始まっていないので確認します（merge-round.mjs start の後なら通ります）。");

  const round = JSON.parse(readFileSync(marker, "utf8"));
  if (!(Date.now() - Date.parse(round.startedAt) <= ROUND_TTL_MS))
    decide("ask", "merge-round の回が始まってから 6 時間を過ぎたので確認します。finish して plan からやり直してください。");
  if (!round.prs?.includes(Number(m[1])))
    decide("ask", `#${m[1]} は今回の事前確認を通った一覧にないので確認します。`);

  decide("allow", `merge-round ${round.id} の事前確認を通った #${m[1]} です。`);
} catch (e) {
  decide("ask", `merge-gate が判定できなかったので確認します（${String(e?.message ?? e).split("\n")[0]}）。`);
}
