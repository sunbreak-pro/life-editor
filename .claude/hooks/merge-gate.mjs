#!/usr/bin/env node
// merge-gate — `gh pr merge` を chat-main の merge-round の中だけで確認なしに通す（POLICY P-001、2026-11-02 改定）。
//
// settings.json には gh pr merge の allow も ask も置かない。確認を消すのはこの hook の allow だけにする:
//   - サブエージェントが打った → deny。ただし agent_type が work-finishers のものだけはこの deny を外し、
//     下の条件をすべて同じように当てる（issue-workflow の実行で、こうだいさんが確認の場で merge-round を選んだ回だけ
//     work-finishers が merge-round を回すため。P-001 の例外）
//   - 作業レーン（git worktree）から打った → deny（レーンは merge しない）
//   - chat-main だが main にいない / 形が決まりと違う / 回が始まっていない / 一覧に無い / check 前 → ask
//   - chat-main・main・決まった形・進行中の回の一覧にあり check を通った PR → allow
// 回の一覧と check の印は `.claude/scripts/merge-round.mjs` が .git/merge-round/active.json に書く。
// ask ルールを置かないのは、settings の ask は hook の allow より強く、置くと allow が効かないため。
// allow ルールを置かないのは、hook が落ちたときに素通りさせないため（落ちたら通常の権限判定に戻る）。
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { hookContext } from "./lib/hook-context.mjs";

const SHAPE = /^\s*gh\s+pr\s+merge\s+(\d+)\s+-R\s+sunbreak-pro\/life-editor\s+--squash\s*$/;
const ROUND_TTL_MS = 2 * 60 * 60 * 1000;

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
  // input.cwd is the main checkout for chat-main's subagents too, so the worktree check below misses
  // them; agent_id and the `cd` in front of the command catch them (issue-workflow trial, 2026-11-08).
  const ctx = hookContext(input, "pr-merge", process.cwd());
  if (ctx.agent && input.agent_type !== "work-finishers")
    decide("deny", "サブエージェントは merge しません（POLICY P-001）。merge は chat-main の merge-round スキルが行います。");
  if (ctx.known && ctx.linked && ctx.sessionName !== "main")
    decide("deny", "作業レーン（worktree）の中からは merge しません（POLICY P-001）。merge は chat-main の merge-round スキルが行います。");

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
    decide("ask", "merge-round の回が始まってから 2 時間を過ぎたので確認します。finish して plan からやり直してください。");
  if (!round.verifiedTree)
    decide("ask", "merge-round の回に手元の CI の記録が無いので確認します（plan の手元 CI が緑のときだけ start が回を作ります）。");
  if (!round.prs?.includes(Number(m[1])))
    decide("ask", `#${m[1]} は今回の事前確認を通った一覧にないので確認します。`);
  if (!round.checked?.[m[1]] || round.checked[m[1]] !== round.heads?.[m[1]])
    decide("ask", `#${m[1]} は merge-round.mjs check をまだ通っていないので確認します。`);

  decide("allow", `merge-round ${round.id} の事前確認を通った #${m[1]} です。`);
} catch (e) {
  decide("ask", `merge-gate が判定できなかったので確認します（${String(e?.message ?? e).split("\n")[0]}）。`);
}
