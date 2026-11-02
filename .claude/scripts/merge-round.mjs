#!/usr/bin/env node
// merge-round — chat-main が open PR をまとめて merge する 1 回ぶんの下ごしらえ。
//
// GitHub には何も書き込まない（merge・コメント・ラベルは打たない）。merge そのものは
// Claude が `gh pr merge <n> -R sunbreak-pro/life-editor --squash` を 1 本ずつ打ち、
// `.claude/hooks/merge-gate.mjs` がこのスクリプトの書いた一覧と照らして通す。
// 手順と判断の決まりは `.claude/skills/merge-round/SKILL.md` が正本。
//
//   node .claude/scripts/merge-round.mjs plan [--only 2455,2453]   事前確認と merge の順番
//   node .claude/scripts/merge-round.mjs start                      plan の「merge」を今回の一覧として登録
//   node .claude/scripts/merge-round.mjs check <n>                  merge 直前の再確認（終了コードで返す）
//   node .claude/scripts/merge-round.mjs fixes                      衝突・CI 赤の PR をレーンごとの /goal にする
//   node .claude/scripts/merge-round.mjs finish                     回を閉じ、merge した commit を記録する
//   node .claude/scripts/merge-round.mjs status                     進行中の回を表示する
//
// 状態は git の共通ディレクトリ（.git/merge-round/）に置く。commit されず、worktree からも同じ場所を指す。
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const REPO = "sunbreak-pro/life-editor";
const RECORD_BRANCH = /^chore\/(tracker|outbox|routine)-/;
const REVERT_BRANCH = /^revert\//;
const MIGRATION = /^supabase\/migrations\//;
const LOCKFILE = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock)$/;
const LOCALE = /\/i18n\/locales\/[^/]+\.json$/;
const TEST = /(^|\/)tests?\//;
const HOLD_LABEL = "merge:hold";
const PLAN_TTL_MS = 30 * 60 * 1000;

// ---------- 小道具 ----------
function run(cmd, args) {
  return execFileSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
}
function tryRun(cmd, args) {
  try {
    return { code: 0, out: run(cmd, args) };
  } catch (e) {
    return { code: e.status ?? 1, out: String(e.stdout ?? "").trim() };
  }
}
const ghJson = (...args) => JSON.parse(run("gh", args) || "null");
const git = (...args) => run("git", args);
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const die = (msg, code = 2) => {
  console.error(`[merge-round] ${msg}`);
  process.exit(code);
};

const COMMON = resolve(git("rev-parse", "--path-format=absolute", "--git-common-dir"));
const STATE = join(COMMON, "merge-round");
const PLAN = join(STATE, "plan.json");
const ACTIVE = join(STATE, "active.json");
const PROMPTED = join(STATE, "prompted.json");
const readJson = (p, fallback = null) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : fallback);
const writeJson = (p, v) => {
  mkdirSync(STATE, { recursive: true });
  mkdirSync(join(STATE, "rounds"), { recursive: true });
  writeFileSync(p, JSON.stringify(v, null, 2) + "\n");
};

// ---------- 読み取り ----------
const PR_FIELDS =
  "number,title,headRefName,headRefOid,baseRefName,isDraft,body,labels,mergeable,mergeStateStatus,files,statusCheckRollup,createdAt";

function openPrs() {
  return ghJson("pr", "list", "-R", REPO, "--state", "open", "--limit", "100", "--json", PR_FIELDS);
}

function ciState(rollup) {
  const failing = [];
  const pending = [];
  for (const c of rollup ?? []) {
    const name = c.name ?? c.context ?? "?";
    if (c.__typename === "StatusContext") {
      if (c.state === "PENDING" || c.state === "EXPECTED") pending.push(name);
      else if (c.state !== "SUCCESS") failing.push(name);
    } else if (c.status !== "COMPLETED") pending.push(name);
    else if (!["SUCCESS", "SKIPPED", "NEUTRAL"].includes(c.conclusion)) failing.push(name);
  }
  if (!rollup?.length) return { state: "none", failing, pending };
  return { state: failing.length ? "fail" : pending.length ? "pending" : "pass", failing, pending };
}

function issueRefs(pr) {
  const nums = new Set();
  const text = `${pr.title}\n${pr.body ?? ""}`;
  for (const m of text.matchAll(/\brefs?\s+((?:#\d+[\s,、]*(?:and\s+)?)+)/gi))
    for (const n of m[1].matchAll(/#(\d+)/g)) nums.add(Number(n[1]));
  if (!RECORD_BRANCH.test(pr.headRefName)) {
    const b = pr.headRefName.match(/-(\d{2,6})(?:-|$)/);
    if (b) nums.add(Number(b[1]));
  }
  return [...nums];
}

function dependsOn(body) {
  const out = new Set();
  const lines = String(body ?? "").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    let value = null;
    const inline = lines[i].match(/^\s*(?:[-*]\s*)?(?:依存する作業|依存|Parent)\s*[:：]\s*(.*)$/);
    if (inline) value = inline[1];
    else if (/^#{2,4}\s*依存する作業\s*$/.test(lines[i])) value = lines.slice(i + 1).find((l) => l.trim()) ?? "";
    if (value === null || /^\s*なし/.test(value)) continue;
    for (const n of value.matchAll(/#(\d+)/g)) out.add(Number(n[1]));
  }
  return [...out];
}

const issueCache = new Map();
function issue(n) {
  if (!issueCache.has(n)) {
    const r = tryRun("gh", ["issue", "view", String(n), "-R", REPO, "--json", "number,state,title,labels,body"]);
    issueCache.set(n, r.code === 0 ? JSON.parse(r.out) : null);
  }
  return issueCache.get(n);
}

let mergedCache = null;
function landed(n) {
  mergedCache ??= ghJson(
    "pr", "list", "-R", REPO, "--state", "merged", "--limit", "300", "--json", "number,headRefName,body,title,mergeCommit",
  );
  return mergedCache.some((pr) => {
    if (!issueRefs(pr).includes(n) || !pr.mergeCommit?.oid) return false;
    return tryRun("git", ["merge-base", "--is-ancestor", pr.mergeCommit.oid, "origin/main"]).code === 0;
  });
}

function worktrees() {
  const out = [];
  let cur = null;
  for (const line of git("worktree", "list", "--porcelain").split(/\r?\n/)) {
    if (line.startsWith("worktree ")) out.push((cur = { path: line.slice(9) }));
    else if (line.startsWith("HEAD ")) cur.head = line.slice(5);
    else if (line.startsWith("branch ")) cur.branch = line.slice(7).replace(/^refs\/heads\//, "");
  }
  const [main, ...lanes] = out;
  for (const wt of lanes) {
    wt.slug = basename(wt.path);
    wt.dirty = tryRun("git", ["-C", wt.path, "status", "--porcelain", "--untracked-files=no"]).out !== "";
  }
  return { main, lanes };
}

function laneFor(pr, lanes, issues) {
  const onBranch = lanes.find((wt) => wt.branch === pr.headRefName);
  if (onBranch) return onBranch;
  const rec = pr.headRefName.match(/^chore\/(?:tracker|outbox|routine)-(.+?)-\d{8}/);
  if (rec) return lanes.find((wt) => wt.slug === rec[1]) ?? null;
  for (const iss of issues) {
    const labels = (iss?.labels ?? []).map((l) => l.name);
    const tag = iss?.title?.match(/^\[([^\]]+)\]/)?.[1];
    if (labels.includes("shared-fix") && tag && tag !== "all") {
      const hit = lanes.find((wt) => wt.slug === tag);
      if (hit) return hit;
    }
    for (const l of labels) {
      const id = l.match(/^section:(.+)$/)?.[1];
      const hits = id ? lanes.filter((wt) => wt.slug.startsWith(id)) : [];
      if (hits.length === 1) return hits[0];
    }
  }
  return null;
}

function conflictFiles(headOid) {
  const r = tryRun("git", ["merge-tree", "--write-tree", "--name-only", "--no-messages", "origin/main", headOid]);
  if (r.code === 0) return [];
  if (r.code === 1) return r.out.split(/\r?\n/).slice(1).filter(Boolean);
  return ["(merge-tree が失敗したので手で確かめる)"];
}

function mainCi() {
  const runs = ghJson(
    "run", "list", "-R", REPO, "--branch", "main", "--workflow", "ci.yml", "--limit", "1", "--json", "status,conclusion,headSha,url",
  );
  return runs?.[0] ?? null;
}

// ---------- plan ----------
function plan(onlyArg) {
  git("fetch", "origin", "--prune", "--quiet");
  const only = onlyArg ? new Set(onlyArg.split(",").map(Number)) : null;
  const base = git("rev-parse", "origin/main");
  const ci = mainCi();
  // cancelled は concurrency で古い実行が止められただけなので赤に数えない
  const mainRed = Boolean(ci && ci.status === "completed" && ["failure", "timed_out", "startup_failure"].includes(ci.conclusion));
  const { lanes } = worktrees();
  const prs = openPrs().filter((pr) => !only || only.has(pr.number));

  const items = prs.map((pr) => {
    const labels = pr.labels.map((l) => l.name);
    const kind = RECORD_BRANCH.test(pr.headRefName) ? "record" : REVERT_BRANCH.test(pr.headRefName) ? "revert" : "impl";
    const refs = issueRefs(pr);
    const issues = refs.map(issue);
    const lane = laneFor(pr, lanes, issues);
    const files = pr.files.map((f) => f.path);
    const c = ciState(pr.statusCheckRollup);
    // GitHub の mergeable は merge 直後しばらく UNKNOWN なので、衝突は手元の merge-tree で決める
    const conflicts = conflictFiles(pr.headRefOid);
    const item = {
      number: pr.number, title: pr.title, branch: pr.headRefName, headOid: pr.headRefOid, kind, refs, files,
      createdAt: pr.createdAt, ci: c, mergeable: pr.mergeable, conflicts,
      lane: lane ? { slug: lane.slug, path: lane.path, branch: lane.branch, dirty: lane.dirty, head: lane.head } : null,
      deps: [], verdict: "merge", reason: "事前確認を通った",
    };
    const hold = (reason) => Object.assign(item, { verdict: "hold", reason });
    const fix = (reason) => Object.assign(item, { verdict: "fix", reason });

    if (pr.baseRefName !== "main") return hold(`宛先が main でない（${pr.baseRefName}）`);
    if (pr.isDraft) return hold("下書きの PR");
    if (labels.includes(HOLD_LABEL)) return hold(`${HOLD_LABEL} ラベルで止めてある`);
    if (files.some((f) => MIGRATION.test(f))) return hold("マイグレーションを含む。db push との順番をこうだいさんが決める");
    if (kind === "impl" && refs.length === 0) return hold("Refs #番号 が無く、依頼した Issue を確かめられない");
    const frozen = issues.find((i) => i?.labels?.some((l) => l.name === "status:frozen"));
    if (frozen) return hold(`Issue #${frozen.number} が status:frozen`);
    if (conflicts.length) return fix(`main と衝突（${conflicts.join(", ")}）`);
    if (c.state === "fail") return fix(`CI が赤（${c.failing.join(", ")}）`);
    if (c.state === "pending") return hold(`CI が実行中（${c.pending.join(", ")}）`);
    if (c.state === "none") return hold("CI が走っていない");
    if (lane && lane.branch === pr.headRefName && lane.dirty)
      return hold(`レーン ${lane.slug} に未コミットの変更があり、作業中`);
    if (lane && lane.branch === pr.headRefName && lane.head !== pr.headRefOid)
      return hold(`レーン ${lane.slug} の手元と PR の先頭が違う（push 前の commit がある）`);
    if (kind === "impl") {
      for (const iss of issues) for (const d of dependsOn(iss?.body)) item.deps.push(d);
    }
    return item;
  });

  // 依存: 今回 merge する PR が片付ける Issue なら順番で満たす。そうでなければ着地済みか確かめる。
  const covers = new Map();
  for (const it of items) if (it.verdict === "merge") for (const r of it.refs) covers.set(r, it.number);
  for (const it of items) {
    if (it.verdict !== "merge") continue;
    const missing = it.deps.filter((d) => !covers.has(d) && !landed(d));
    if (missing.length) Object.assign(it, { verdict: "hold", reason: `依存先 ${missing.map((d) => `#${d}`).join(" ")} が main に未着地` });
  }
  // 依存先を止めたら、その先も止める（1 回で収まるまで回す）
  for (let changed = true; changed; ) {
    changed = false;
    const ok = new Set(items.filter((i) => i.verdict === "merge").flatMap((i) => i.refs));
    for (const it of items) {
      if (it.verdict !== "merge") continue;
      const blocked = it.deps.filter((d) => covers.has(d) && !ok.has(d));
      if (blocked.length) {
        Object.assign(it, { verdict: "hold", reason: `依存先 ${blocked.map((d) => `#${d}`).join(" ")} の PR が今回 merge できない` });
        changed = true;
      }
    }
  }

  // 順番: 依存の前後 → 実装・revert を先、記録を後 → 他の PR と同じファイルを触る数が少ない順 → 古い順
  const ready = items.filter((i) => i.verdict === "merge");
  const overlap = (it) => ready.filter((o) => o !== it && o.files.some((f) => it.files.includes(f))).length;
  const key = (it) => [it.kind === "record" ? 1 : 0, overlap(it), Date.parse(it.createdAt)];
  const cmp = (a, b) => {
    const ka = key(a), kb = key(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
    return 0;
  };
  const order = [];
  const left = new Set(ready);
  while (left.size) {
    const free = [...left].filter((it) =>
      it.deps.every((d) => !covers.has(d) || order.some((o) => o.refs.includes(d)) || covers.get(d) === it.number),
    );
    const pick = (free.length ? free : [...left]).sort(cmp)[0];
    order.push(pick);
    left.delete(pick);
  }

  const result = { createdAt: new Date().toISOString(), base, mainCi: ci, mainRed, items, order: order.map((o) => o.number) };
  writeJson(PLAN, result);
  printPlan(result);
  if (mainRed) die(`main の CI が赤い（${ci.url}）。SKILL.md の「main が赤いとき」を先に済ませる。`, 3);
}

function printPlan(p) {
  console.log(`# merge-round plan  base=${p.base.slice(0, 8)}  main CI=${p.mainCi ? `${p.mainCi.status}/${p.mainCi.conclusion || "-"}` : "不明"}\n`);
  console.log("| 順番 | PR | 判定 | 理由 | レーン | 題 |");
  console.log("| ---- | -- | ---- | ---- | ------ | -- |");
  const label = { merge: "merge", fix: "直してもらう", hold: "今回は見送り" };
  const rows = [
    ...p.order.map((n, i) => [i + 1, p.items.find((x) => x.number === n)]),
    ...p.items.filter((x) => x.verdict !== "merge").map((x) => ["—", x]),
  ];
  for (const [i, it] of rows)
    console.log(`| ${i} | #${it.number} | ${label[it.verdict]} | ${it.reason} | ${it.lane?.slug ?? "不明"} | ${it.title.replace(/\|/g, "/")} |`);
  console.log(`\nmerge ${p.order.length} / 直してもらう ${p.items.filter((x) => x.verdict === "fix").length} / 見送り ${p.items.filter((x) => x.verdict === "hold").length}（open ${p.items.length}）`);
}

// ---------- start / check / finish ----------
function start() {
  const p = readJson(PLAN);
  if (!p) die("plan.json が無い。先に plan を回す。");
  if (Date.now() - Date.parse(p.createdAt) > PLAN_TTL_MS) die("plan が 30 分より古い。plan を回し直す。");
  if (p.mainRed) die("main の CI が赤いので始めない。");
  const prev = readJson(ACTIVE);
  if (prev) die(`回 ${prev.id} が閉じていない。finish してから始める。`);
  if (!p.order.length) die("merge できる PR が 0 本。fixes で直してもらう分の指示文だけ出す。", 0);
  const id = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const heads = Object.fromEntries(p.items.filter((i) => p.order.includes(i.number)).map((i) => [i.number, i.headOid]));
  writeJson(ACTIVE, { id, startedAt: new Date().toISOString(), base: p.base, prs: p.order, heads });
  console.log(`回 ${id} を始めた。戻る地点（この回の前の main）= ${p.base}`);
  console.log(`merge する順番: ${p.order.map((n) => `#${n}`).join(" → ")}`);
}

function check(nArg) {
  const n = Number(nArg);
  const a = readJson(ACTIVE);
  if (!a) die("進行中の回が無い。");
  if (!a.prs.includes(n)) die(`#${n} は今回の一覧に無い。`, 6);
  for (let i = 0; i < 20; i++) {
    const pr = ghJson("pr", "view", String(n), "-R", REPO, "--json", "state,mergeable,mergeStateStatus,headRefOid,labels");
    if (pr.state === "MERGED") return die(`#${n} は merge 済み。`, 10);
    if (pr.state !== "OPEN") return die(`#${n} は ${pr.state}。`, 7);
    if (pr.labels.some((l) => l.name === HOLD_LABEL)) return die(`#${n} に ${HOLD_LABEL} が付いた。飛ばす。`, 8);
    if (pr.headRefOid !== a.heads[String(n)]) return die(`#${n} は plan の後に push された。今回は飛ばす。`, 5);
    if (pr.mergeable === "CONFLICTING") return die(`#${n} は前の merge で main と衝突した。fixes に回す。`, 3);
    if (pr.mergeable === "MERGEABLE") {
      console.log(`#${n} は merge できる（${pr.mergeStateStatus}）。`);
      return;
    }
    sleep(3000);
  }
  die(`#${n} の mergeable が 60 秒たっても決まらない。今回は飛ばす。`, 4);
}

function finish() {
  const a = readJson(ACTIVE);
  if (!a) die("進行中の回が無い。");
  git("fetch", "origin", "--prune", "--quiet");
  const merged = [];
  for (const n of a.prs) {
    const pr = ghJson("pr", "view", String(n), "-R", REPO, "--json", "number,title,state,mergeCommit,mergedAt");
    if (pr.state === "MERGED") merged.push({ number: n, title: pr.title, mergeCommit: pr.mergeCommit?.oid, mergedAt: pr.mergedAt });
  }
  merged.sort((x, y) => Date.parse(x.mergedAt) - Date.parse(y.mergedAt));
  const after = git("rev-parse", "origin/main");
  const record = { ...a, finishedAt: new Date().toISOString(), after, merged };
  writeJson(join(STATE, "rounds", `${a.id}.json`), record);
  rmSync(ACTIVE);
  console.log(`回 ${a.id} を閉じた。main ${a.base.slice(0, 8)} → ${after.slice(0, 8)}、merge ${merged.length} 本。`);
  console.log("戻すときは新しい順に revert する（SKILL.md「merge した後に戻す」）:");
  for (const m of [...merged].reverse()) console.log(`  #${m.number} ${m.mergeCommit}  ${m.title}`);
  const ci = mainCi();
  console.log(`main の CI: ${ci ? `${ci.status}/${ci.conclusion || "-"} ${ci.headSha?.slice(0, 8)} ${ci.url}` : "不明"}`);
}

function status() {
  const a = readJson(ACTIVE);
  console.log(a ? JSON.stringify(a, null, 2) : "進行中の回は無い。");
}

// ---------- fixes ----------
function modelFor(entries) {
  let tier = 0;
  for (const e of entries) {
    if (e.ci) tier = 2;
    for (const f of e.conflicts) {
      if (/\.md$/i.test(f) || LOCKFILE.test(f)) continue;
      tier = Math.max(tier, LOCALE.test(f) || TEST.test(f) ? 1 : 2);
    }
  }
  return [
    ["Haiku 5.5", "claude-haiku-5-5", "衝突が文書と lockfile だけで、両方を残すか作り直せば済むため"],
    ["Sonnet 5.5", "claude-sonnet-5-5", "衝突が翻訳ファイルとテストに収まり、両側の追加を残せば済むため"],
    ["Opus 5.5", "claude-opus-5-5", entries.some((e) => e.ci) ? "CI の赤は原因の調査から始まるため" : "衝突がコードにあり、両側の振る舞いを読んで合わせる判断が要るため"],
  ][tier];
}

function fixes() {
  git("fetch", "origin", "--prune", "--quiet");
  const { lanes } = worktrees();
  const prompted = readJson(PROMPTED, {});
  const groups = new Map();
  const unrouted = [];
  for (const pr of openPrs()) {
    if (pr.isDraft || pr.baseRefName !== "main" || pr.labels.some((l) => l.name === HOLD_LABEL)) continue;
    const conflicts = conflictFiles(pr.headRefOid);
    const c = ciState(pr.statusCheckRollup);
    if (!conflicts.length && c.state !== "fail") continue;
    const issues = issueRefs(pr).map(issue);
    const lane = laneFor(pr, lanes, issues);
    const entry = { number: pr.number, branch: pr.headRefName, head: pr.headRefOid, conflicts, ci: c.state === "fail" ? c.failing : null };
    if (!lane) unrouted.push(entry);
    else {
      if (!groups.has(lane.slug)) groups.set(lane.slug, { lane, entries: [] });
      groups.get(lane.slug).entries.push(entry);
    }
  }
  if (!groups.size && !unrouted.length) {
    console.log("直してもらう PR は無い。");
    return;
  }
  console.log("## 直してもらう\n");
  const next = {};
  for (const [slug, { lane, entries }] of groups) {
    const [name, id, why] = modelFor(entries);
    const again = entries.every((e) => prompted[e.number] === e.head);
    const items = entries
      .map((e) => {
        const parts = [];
        if (e.conflicts.length)
          parts.push(`conflicts in ${e.conflicts.slice(0, 6).join(", ")}${e.conflicts.length > 6 ? ` and ${e.conflicts.length - 6} more` : ""}`);
        if (e.ci) parts.push(`CI failing at ${e.ci.join(", ")} (reproduce with local-ci first)`);
        return `#${e.number} on ${e.branch} (${parts.join("; ")})`;
      })
      .join(", ");
    const goal =
      `/goal in the life-editor worktree for ${slug}: every PR below merges cleanly into the latest origin/main, ` +
      `node scripts/local-ci.mjs passes every step on its branch, the branch is pushed, and gh pr view <n> -R ${REPO} --json mergeable shows MERGEABLE — ${items}. ` +
      `For each PR: git checkout <branch> and write the branch name to .claude/comm/.session-branch, git pull --ff-only, git fetch origin && git merge origin/main --no-edit, ` +
      `resolve conflicts with the git-conflict-resolver skill keeping the behavior of both sides, then run local-ci and git push. ` +
      `Never rebase or force-push, merge nothing yourself, stop and report if a conflict needs a product decision, ` +
      `and end with the hand-off table defined in the "セッション終了時の引き継ぎ表" section of .claude/skills/docs-workflow/SKILL.md.`;
    console.log(`### ${slug}  ← ${entries.length} 件（${entries.map((e) => `#${e.number}`).join(" ")}）${again ? "  ※前回と同じ指示（まだ直っていない）" : ""}`);
    console.log(goal);
    console.log(`モデル: ${name}（${why}）。貼る前に /model ${id}`);
    if (lane.dirty && !entries.some((e) => e.branch === lane.branch))
      console.log(`注意: ${slug} は別のブランチ（${lane.branch}）で作業中。いまの /goal が終わってから貼る（後から貼ると前の /goal が消える）。`);
    console.log("停止: 載せた PR がすべて MERGEABLE になり push が済んだら（merge は待たない）\n");
    for (const e of entries) next[e.number] = e.head;
  }
  if (unrouted.length) {
    console.log("## 宛先が決まらない\n");
    for (const e of unrouted) console.log(`- #${e.number} ${e.branch}（どのレーンにもチェックアウトされておらず、Issue のラベルからも決まらない）`);
  }
  writeJson(PROMPTED, { ...prompted, ...next });
}

// ---------- 入口 ----------
const [cmd, ...rest] = process.argv.slice(2);
const flag = (name) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
};
switch (cmd) {
  case "plan": plan(flag("--only")); break;
  case "start": start(); break;
  case "check": check(rest[0]); break;
  case "fixes": fixes(); break;
  case "finish": finish(); break;
  case "status": status(); break;
  default:
    die("使い方: merge-round.mjs plan [--only 1,2] | start | check <n> | fixes | finish | status");
}
