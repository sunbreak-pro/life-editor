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
//   node .claude/scripts/merge-round.mjs autofix-start <n>          文書・lockfile・翻訳だけの衝突を一時 worktree に出す
//   node .claude/scripts/merge-round.mjs autofix-push <n>           解いた結果を確かめて PR のブランチへ push する
//   node .claude/scripts/merge-round.mjs autofix-abort <n>          一時 worktree を片付ける
//
// CI の緑は GitHub Actions を見ず、plan が一時 worktree（merge-verify）で scripts/local-ci.mjs を回して決める（Actions 停止中の代わり）。
// 状態は git の共通ディレクトリ（.git/merge-round/）に置く。commit されず、worktree からも同じ場所を指す。
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = "sunbreak-pro/life-editor";
const RECORD_BRANCH = /^chore\/(tracker|outbox|routine)-/;
const REVERT_BRANCH = /^revert\//;
const MIGRATION = /^supabase\/migrations\//;
const LOCKFILE = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock)$/;
const LOCALE = /\/i18n\/locales\/[^/]+\.json$/;
const TEST = /(^|\/)tests?\//;
const HOLD_LABEL = "merge:hold";
const AUTOFIX_PREFIX = "autofix-";
const PLAN_TTL_MS = 30 * 60 * 1000;

// ---------- 小道具 ----------
// 日本語のファイル名を引用符で包ませない（包まれると拡張子の判定と git show が外れる）
process.env.GIT_CONFIG_PARAMETERS = "'core.quotepath=false'";
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
// 試験では MERGE_ROUND_FAKE_GH に node スクリプトを指定し、gh の代わりに走らせる
const ghJson = (...args) =>
  JSON.parse(
    (process.env.MERGE_ROUND_FAKE_GH ? run(process.execPath, [process.env.MERGE_ROUND_FAKE_GH, ...args]) : run("gh", args)) || "null",
  );
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
  "number,title,headRefName,headRefOid,baseRefName,isDraft,body,labels,mergeable,mergeStateStatus,files,createdAt";

function openPrs() {
  return ghJson("pr", "list", "-R", REPO, "--state", "open", "--limit", "100", "--json", PR_FIELDS);
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

// 依存の行には Issue 番号だけでなく PR 番号も書かれる（scope-overlap の BLOCK を写すと PR 番号になる）。
// n が merge 済み PR そのものなら、その merge commit で決める。Issue 番号なら、それを Refs に書いた merge 済み PR で決める。
// open の PR の番号は merged に無く、Refs にも現れないので、未着地のまま残る
export function landedIn(merged, n, isAncestor) {
  const onMain = (pr) => Boolean(pr.mergeCommit?.oid) && isAncestor(pr.mergeCommit.oid);
  const self = merged.find((pr) => pr.number === n);
  if (self) return (self.baseRefName ?? "main") === "main" && onMain(self);
  return merged.some((pr) => issueRefs(pr).includes(n) && onMain(pr));
}

let mergedCache = null;
function landed(n) {
  mergedCache ??= ghJson(
    "pr", "list", "-R", REPO, "--state", "merged", "--limit", "300", "--json", "number,headRefName,baseRefName,body,title,mergeCommit",
  );
  return landedIn(mergedCache, n, (oid) => tryRun("git", ["merge-base", "--is-ancestor", oid, "origin/main"]).code === 0);
}

function worktrees() {
  const out = [];
  let cur = null;
  for (const line of git("worktree", "list", "--porcelain").split(/\r?\n/)) {
    if (line.startsWith("worktree ")) out.push((cur = { path: line.slice(9) }));
    else if (line.startsWith("HEAD ")) cur.head = line.slice(5);
    else if (line.startsWith("branch ")) cur.branch = line.slice(7).replace(/^refs\/heads\//, "");
  }
  const [main, ...rest] = out;
  // chat-main が衝突を直すために作る一時 worktree（autofix-<n>）はレーンに数えない
  const lanes = rest.filter((wt) => !basename(wt.path).startsWith(AUTOFIX_PREFIX) && !basename(wt.path).startsWith(VERIFY_PREFIX));
  for (const wt of lanes) {
    wt.slug = basename(wt.path);
    wt.dirty = tryRun("git", ["-C", wt.path, "status", "--porcelain", "--untracked-files=no"]).out !== "";
  }
  return { main, lanes, all: out };
}

// ブランチがどこかの worktree で開かれているか（開いているなら、書き手はそのレーン）。
// 先頭の commit を detached で開いている場合も、開いているとみなす
const checkedOut = (all, branch, head) => all.some((wt) => wt.branch === branch || (head && wt.head === head));

function prNumber(arg) {
  const n = Number(arg);
  if (!Number.isInteger(n) || n <= 0) die(`PR 番号が正しくない: ${arg}`);
  return n;
}

// chat-main が直してよい衝突か: 文書・lockfile・翻訳ファイルだけ
const mechanical = (files) => files.length > 0 && files.every((f) => /\.md$/i.test(f) || LOCKFILE.test(f) || LOCALE.test(f));

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

// gh の files は件数に上限があるので、マイグレーションの有無は git で決める
function touchesMigration(headOid) {
  const r = tryRun("git", ["diff", "--name-only", `origin/main...${headOid}`]);
  if (r.code !== 0) return true;
  return r.out.split(/\r?\n/).some((f) => MIGRATION.test(f));
}

// merge の回は chat-main（リポジトリ直下の checkout・main ブランチ）だけで動かす
function requireChatMain() {
  const gitDir = resolve(git("rev-parse", "--path-format=absolute", "--git-dir")).toLowerCase();
  if (gitDir !== COMMON.toLowerCase()) die("作業レーン（worktree）では回を動かさない。chat-main で打つ。");
  const branch = git("branch", "--show-current");
  if (branch !== "main") die(`chat-main が main にいない（いま ${branch || "detached"}）。`);
}

function mainCi() {
  const runs = ghJson(
    "run", "list", "-R", REPO, "--branch", "main", "--workflow", "ci.yml", "--limit", "1", "--json", "status,conclusion,headSha,url",
  );
  return runs?.[0] ?? null;
}

// ---------- ローカル CI（GitHub Actions の代わり） ----------
// Actions が支払いのロックで動かないあいだ、PR の CI の緑は手元で作る。
// 順番に重ねた一時 worktree（merge-verify）で scripts/local-ci.mjs を回し、緑になった組み合わせの
// tree と PR の head を plan.json に記録する。start は、その記録どおりの一覧だけを回に入れる。
const VERIFY_PREFIX = "merge-verify";
const BILLING = /billing issue|recent account payments|spending limit/i;

// 1 回ぶんの local-ci。出力は .git/merge-round/verify/<label>.log に残す
function runLocalCi(cwd, label) {
  const r = spawnSync(process.execPath, ["scripts/local-ci.mjs"], {
    cwd,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  mkdirSync(join(STATE, "verify"), { recursive: true });
  const log = join(STATE, "verify", `${label}.log`);
  writeFileSync(log, out);
  if (r.error) return { green: false, failing: [`local-ci を起動できない（${r.error.message}）`], log };
  if (r.status === 0) return { green: true, failing: [], log };
  // local-ci の最後の行「FAILED: [job] step, …」から落ちたステップを取る
  const m = out.match(/FAILED: (.+)$/m);
  return { green: false, failing: m ? m[1].split(", ") : ["（終了コードだけ。ログを見る）"], log };
}

// base の上に PR を順に merge する。衝突した PR は外して返す（同じ tree を再現できるよう、順番どおりに重ねる）
function stackOn(path, base, prs) {
  const g = (...args) => tryRun("git", ["-C", path, ...args]);
  g("merge", "--abort");
  g("reset", "--hard");
  // ignored（node_modules）は消さない。npm ci は local-ci 自身が回す
  g("clean", "-fd");
  if (g("checkout", "--detach", "-f", base).code !== 0) die(`検査用 worktree を ${base.slice(0, 8)} に合わせられない（${path}）`);
  const kept = [];
  const conflicted = [];
  for (const pr of prs) {
    if (g("merge", "--no-ff", "--no-edit", "-m", `merge-round verify #${pr.number}`, pr.headOid).code === 0) kept.push(pr);
    else {
      g("merge", "--abort");
      conflicted.push(pr);
    }
  }
  return { kept, conflicted, tree: g("rev-parse", "HEAD^{tree}").out };
}

function stackAndRun(path, base, prs, label) {
  const { kept, conflicted, tree } = stackOn(path, base, prs);
  if (!kept.length) return { green: false, failing: ["重ねられる PR が無い"], log: null, tree: null, keptPrs: [], conflicted };
  const r = runLocalCi(path, label);
  return { green: r.green, failing: r.failing, log: r.log, tree, keptPrs: kept, conflicted };
}

// 順番どおりに全部重ねて local-ci。赤なら 1 本ずつ確かめ、通ったものだけを重ね直して確かめる
function verifyRound(prs, base, stamp) {
  const path = scratchPath(VERIFY_PREFIX);
  if (!existsSync(path)) git("worktree", "add", "--detach", path, base);
  const first = stackAndRun(path, base, prs, `${stamp}-all`);
  if (first.green) return { ...first, kept: first.keptPrs.map((p) => p.number), reds: {}, allRed: false };

  const reds = {};
  const singles = [];
  for (const pr of prs) {
    const one = stackAndRun(path, base, [pr], `${stamp}-${pr.number}`);
    if (one.green) singles.push(pr);
    else reds[pr.number] = one.failing;
  }
  if (!singles.length) return { green: false, tree: null, kept: [], conflicted: first.conflicted, reds, allRed: true, log: first.log };
  const rest = stackAndRun(path, base, singles, `${stamp}-rest`);
  return {
    ...rest,
    kept: rest.keptPrs.map((p) => p.number),
    conflicted: [...first.conflicted, ...rest.conflicted],
    reds,
    allRed: false,
  };
}

// 検査用 worktree の場所（worktree-policy: リポジトリの外に絶対パスで置く）
function scratchPath(name) {
  return resolve(worktrees().main.path, "..", "workspaces", "life-editor", name).replace(/\\/g, "/");
}

// Actions が支払いの理由で止まっているか。文言が出ているか、どのステップも始まっていないとき
function billingLocked(run) {
  const id = run?.url?.match(/\/runs\/(\d+)/)?.[1];
  if (!id || run.conclusion === "success") return false;
  const r = tryRun("gh", ["run", "view", id, "-R", REPO, "--json", "jobs"]);
  if (r.code !== 0) return false;
  if (BILLING.test(r.out)) return true;
  const jobs = JSON.parse(r.out || "{}").jobs ?? [];
  const started = jobs.some((j) => (j.steps ?? []).some((s) => s.conclusion && s.conclusion !== "skipped"));
  return jobs.length > 0 && !started;
}

// ---------- plan ----------
function plan(onlyArg) {
  git("fetch", "origin", "--prune", "--quiet");
  const only = onlyArg ? new Set(onlyArg.split(",").map(Number)) : null;
  const base = git("rev-parse", "origin/main");
  const ci = mainCi();
  const locked = Boolean(ci && ci.status === "completed" && billingLocked(ci));
  // cancelled は concurrency で古い実行が止められただけなので赤に数えない。支払いのロックも赤に数えない
  const mainRed = Boolean(
    ci && ci.status === "completed" && !locked && ["failure", "timed_out", "startup_failure"].includes(ci.conclusion),
  );
  const { lanes } = worktrees();
  const prs = openPrs().filter((pr) => !only || only.has(pr.number));

  const items = prs.map((pr) => {
    const labels = pr.labels.map((l) => l.name);
    const kind = RECORD_BRANCH.test(pr.headRefName) ? "record" : REVERT_BRANCH.test(pr.headRefName) ? "revert" : "impl";
    const refs = issueRefs(pr);
    const issues = refs.map(issue);
    const lane = laneFor(pr, lanes, issues);
    const files = pr.files.map((f) => f.path);
    // GitHub の mergeable は merge 直後しばらく UNKNOWN なので、衝突は手元の merge-tree で決める
    const conflicts = conflictFiles(pr.headRefOid);
    const item = {
      number: pr.number, title: pr.title, branch: pr.headRefName, headOid: pr.headRefOid, kind, refs, files,
      createdAt: pr.createdAt, conflicts,
      lane: lane ? { slug: lane.slug, path: lane.path, branch: lane.branch, dirty: lane.dirty, head: lane.head } : null,
      deps: [], ci: null, verdict: "merge", reason: "事前確認を通った",
    };
    const hold = (reason) => Object.assign(item, { verdict: "hold", reason });
    const fix = (reason) => Object.assign(item, { verdict: "fix", reason });

    if (pr.baseRefName !== "main") return hold(`宛先が main でない（${pr.baseRefName}）`);
    if (pr.isDraft) return hold("下書きの PR");
    if (labels.includes(HOLD_LABEL)) return hold(`${HOLD_LABEL} ラベルで止めてある`);
    if (touchesMigration(pr.headRefOid)) return hold("マイグレーションを含む。db push との順番をこうだいさんが決める");
    if (kind === "impl" && refs.length === 0) return hold("Refs #番号 が無く、依頼した Issue を確かめられない");
    const unreadable = refs.filter((_, i) => !issues[i]);
    if (unreadable.length) return hold(`Issue ${unreadable.map((n) => `#${n}`).join(" ")} を読めず、依存と凍結を確かめられない`);
    const frozen = issues.find((i) => i?.labels?.some((l) => l.name === "status:frozen"));
    if (frozen) return hold(`Issue #${frozen.number} が status:frozen`);
    if (conflicts.length) return fix(`main と衝突（${conflicts.join(", ")}）`);
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

  // main が赤いときは、戻すための revert の PR だけを merge する
  if (mainRed)
    for (const it of items)
      if (it.verdict === "merge" && it.kind !== "revert")
        Object.assign(it, { verdict: "hold", reason: "main の CI が赤いので、revert 以外は見送り" });

  // 順番: 依存の前後 → 実装・revert を先、記録を後 → 他の PR と同じファイルを触る数が少ない順 → 古い順
  const ready = items.filter((i) => i.verdict === "merge");
  const overlap = (it) => ready.filter((o) => o !== it && o.files.some((f) => it.files.includes(f))).length;
  const key = (it) => [it.kind === "record" ? 1 : 0, overlap(it), Date.parse(it.createdAt)];
  const cmp = (a, b) => {
    const ka = key(a), kb = key(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
    return 0;
  };
  let order = [];
  const left = new Set(ready);
  while (left.size) {
    const free = [...left].filter((it) =>
      it.deps.every((d) => !covers.has(d) || order.some((o) => o.refs.includes(d)) || covers.get(d) === it.number),
    );
    const pick = (free.length ? free : [...left]).sort(cmp)[0];
    order.push(pick);
    left.delete(pick);
  }

  // ローカル CI: 順番どおりに重ねて検査する。main が赤のときは revert 以外を検査しても使わないので省く
  let local = null;
  if (order.length && !mainRed) {
    const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
    local = verifyRound(order, base, stamp);
    for (const pr of local.conflicted) Object.assign(pr, { verdict: "fix", reason: "他の PR と積み重ねると衝突" });
    for (const [n, failing] of Object.entries(local.reds)) {
      const it = items.find((x) => x.number === Number(n));
      Object.assign(it, { verdict: "fix", reason: `ローカル CI が赤（${failing.join(", ") || "不明"}）`, ci: { state: "fail", failing } });
    }
    order = order.filter((it) => local.kept.includes(it.number));
    // 落ちた PR に依存していた PR は、検査した組み合わせから外れるので使えない
    const keptRefs = new Set(order.flatMap((i) => i.refs));
    const broken = order.some((it) => it.deps.some((d) => covers.has(d) && !keptRefs.has(d)));
    if (!local.green || broken) {
      const why = !local.green ? "組み合わせのローカル CI が赤（1 本ずつは通る）" : "依存先がローカル CI の組み合わせから外れた";
      for (const it of order) Object.assign(it, { verdict: "hold", reason: why });
      order = [];
    }
  }

  const result = {
    createdAt: new Date().toISOString(),
    base,
    mainCi: ci,
    mainLocked: locked,
    mainRed,
    items,
    order: order.map((o) => o.number),
    localCi: local && order.length
      ? { green: true, base, tree: local.tree, heads: Object.fromEntries(order.map((o) => [o.number, o.headOid])), numbers: order.map((o) => o.number), log: local.log }
      : local ? { green: false, base, tree: null, heads: {}, numbers: [], log: local.log } : null,
  };
  writeJson(PLAN, result);
  printPlan(result);
  if (local?.allRed) die("すべての PR が 1 本ずつでもローカル CI で赤。main 自身が手元で赤い疑い（SKILL.md の「main が赤いとき」）。", 3);
  if (mainRed)
    die(`main の CI が赤い（${ci.url}）。revert の PR だけを merge できる。SKILL.md の「main が赤いとき」を先に済ませる。`, 3);
}

function printPlan(p) {
  const mainText = p.mainCi
    ? `${p.mainCi.status}/${p.mainCi.conclusion || "-"}${p.mainLocked ? "（支払いのロックで Actions が止まっている。手元の CI で代える）" : ""}`
    : "不明";
  const localText = p.localCi ? (p.localCi.green ? "緑" : "赤") : "未実行";
  console.log(`# merge-round plan  base=${p.base.slice(0, 8)}  main CI=${mainText}  ローカル CI=${localText}\n`);
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
  requireChatMain();
  const p = readJson(PLAN);
  if (!p) die("plan.json が無い。先に plan を回す。");
  if (Date.now() - Date.parse(p.createdAt) > PLAN_TTL_MS) die("plan が 30 分より古い。plan を回し直す。");
  const prev = readJson(ACTIVE);
  if (prev) die(`回 ${prev.id} が閉じていない。finish してから始める。`);
  if (!p.order.length) die("merge できる PR が 0 本。fixes で直してもらう分の指示文だけ出す。", 0);
  if (!p.localCi?.green) die("ローカル CI の組み合わせが緑になっていない。plan の表を見て直し、plan を回し直す。");
  if (p.localCi.numbers.join(",") !== p.order.join(",")) die("plan の検査と一覧が違う。plan を回し直す。");
  git("fetch", "origin", "--prune", "--quiet");
  if (git("rev-parse", "origin/main") !== p.base) die("plan の後に main が進んだ。戻る地点がずれるので plan を回し直す。");
  const id = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  writeJson(ACTIVE, {
    id,
    startedAt: new Date().toISOString(),
    base: p.base,
    prs: p.order,
    heads: p.localCi.heads,
    verifiedTree: p.localCi.tree,
    checked: {},
  });
  console.log(`回 ${id} を始めた。戻る地点（この回の前の main）= ${p.base}`);
  console.log(`検査した組み合わせの tree = ${p.localCi.tree}`);
  console.log(`merge する順番: ${p.order.map((n) => `#${n}`).join(" → ")}`);
}

// merge 直前の確認。CI は GitHub に聞かず、手元の検査の head と今の head が同じかを見る
function check(nArg) {
  requireChatMain();
  const n = prNumber(nArg);
  const a = readJson(ACTIVE);
  if (!a) die("進行中の回が無い。");
  if (!a.prs.includes(n)) die(`#${n} は今回の一覧に無い。`, 6);
  for (let i = 0; i < 20; i++) {
    const pr = ghJson(
      "pr", "view", String(n), "-R", REPO, "--json", "state,mergeable,mergeStateStatus,headRefOid,labels,isDraft,baseRefName",
    );
    if (pr.state === "MERGED") return die(`#${n} は merge 済み。`, 10);
    if (pr.state !== "OPEN") return die(`#${n} は ${pr.state}。`, 7);
    if (pr.labels.some((l) => l.name === HOLD_LABEL)) return die(`#${n} に ${HOLD_LABEL} が付いた。飛ばす。`, 8);
    if (pr.isDraft || pr.baseRefName !== "main") return die(`#${n} が下書きになったか、宛先が main でなくなった。飛ばす。`, 9);
    if (pr.headRefOid !== a.heads[String(n)]) return die(`#${n} は手元の検査の後に push された。今回は飛ばす。`, 5);
    if (pr.mergeable === "CONFLICTING") return die(`#${n} は前の merge で main と衝突した。fixes に回す。`, 3);
    if (pr.mergeable === "MERGEABLE") {
      // hook は、この印がある PR の、この head だけを通す
      writeJson(ACTIVE, { ...a, checked: { ...(a.checked ?? {}), [n]: pr.headRefOid } });
      console.log(`#${n} は merge できる（${pr.mergeStateStatus}）。`);
      return;
    }
    sleep(3000);
  }
  die(`#${n} の mergeable が 60 秒たっても決まらない。今回は飛ばす。`, 4);
}

function finish() {
  requireChatMain();
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

  // 全部 merge できたときだけ、main の tree が検査した tree と一致するかを見る
  if (merged.length === a.prs.length) {
    const tree = git("rev-parse", "origin/main^{tree}");
    if (tree === a.verifiedTree) console.log(`main の tree は検査した tree と一致（${tree.slice(0, 8)}）。`);
    else
      console.log(
        `注意: main の tree が検査した tree と違う（検査 ${a.verifiedTree.slice(0, 8)} / main ${tree.slice(0, 8)}）。` +
          "merge の途中で main が動いたか、squash の内容が検査と違う。次の回の前に確かめる。",
      );
  } else {
    console.log("一部だけ merge したので、tree の一致は比べない。");
  }

  const ci = mainCi();
  if (ci && billingLocked(ci)) console.log("main の CI: Actions が支払いのロックで止まっている（手元の CI で代えた。こうだいさんの手番）。");
  else console.log(`main の CI: ${ci ? `${ci.status}/${ci.conclusion || "-"} ${ci.headSha?.slice(0, 8)} ${ci.url}` : "不明"}`);
}

function status() {
  const a = readJson(ACTIVE);
  console.log(a ? JSON.stringify(a, null, 2) : "進行中の回は無い。");
}

// ---------- fixes ----------
// plan が「直してもらう」と決めた PR を、レーンごとの /goal にまとめる。CI の赤は plan の手元 CI の結果
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
  const p = readJson(PLAN);
  if (!p) die("plan.json が無い。先に plan を回す。");
  git("fetch", "origin", "--prune", "--quiet");
  if (git("rev-parse", "origin/main") !== p.base)
    console.log("注意: plan の後に main が進んだ。衝突の結果が変わるので、plan を回し直してから直す。\n");
  const { lanes, all } = worktrees();
  const prompted = readJson(PROMPTED, {});
  const failed = readJson(join(STATE, "autofix-failed.json"), {});
  const groups = new Map();
  const unrouted = [];
  const auto = [];
  for (const it of p.items.filter((i) => i.verdict === "fix")) {
    const entry = {
      number: it.number,
      branch: it.branch,
      head: it.headOid,
      conflicts: it.conflicts,
      ci: it.ci?.failing?.length ? it.ci.failing : null,
    };
    const lane = it.lane ? lanes.find((w) => w.slug === it.lane.slug) : null;
    // 文書・lockfile・翻訳ファイルだけの衝突で、どのレーンもそのブランチを開いていなければ chat-main が直す
    if (!entry.ci && mechanical(entry.conflicts) && !checkedOut(all, it.branch, it.headOid) && failed[it.number] !== it.headOid) auto.push(entry);
    else if (!lane) unrouted.push(entry);
    else {
      if (!groups.has(lane.slug)) groups.set(lane.slug, { lane, entries: [] });
      groups.get(lane.slug).entries.push(entry);
    }
  }
  if (!groups.size && !unrouted.length && !auto.length) {
    console.log("直してもらう PR は無い。");
    return;
  }
  if (auto.length) {
    console.log("## chat-main が直す（文書・lockfile・翻訳ファイルだけの衝突）\n");
    for (const e of auto) console.log(`- #${e.number} ${e.branch}（${e.conflicts.join(", ")}）→ node .claude/scripts/merge-round.mjs autofix-start ${e.number}`);
    console.log("");
  }
  if (!groups.size && !unrouted.length) return;
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
    if (goal.length > 4000)
      console.log(`注意: この /goal は ${goal.length} 字で、上限の 4,000 字を超える。PR を 2 つに分けて、1 本目が終わってから 2 本目を貼る。`);
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

// ---------- autofix: 機械的な衝突を chat-main が一時 worktree で直す ----------
// 書き手が 2 人にならないよう、どのレーンも開いていないブランチだけを扱う。
// 解くのはサブエージェント（Sonnet）。push は autofix-push が確かめてから fast-forward だけで行う。
const AUTOFIX_DIR = join(STATE, "autofix");
const AUTOFIX_FAILED = join(STATE, "autofix-failed.json");
const autofixState = (n) => join(AUTOFIX_DIR, `${n}.json`);
function autofixPath(n) {
  return scratchPath(`${AUTOFIX_PREFIX}${n}`);
}

const MARKER = (file) => (/\.md$/i.test(file) ? /^(<{7}|>{7})( |$)/m : /^(<{7}|={7}|>{7})( |$)/m);

function autofixStart(nArg) {
  requireChatMain();
  const n = prNumber(nArg);
  if (existsSync(autofixState(n))) die(`#${n} の autofix は始まっている。autofix-push か autofix-abort で閉じる。`);
  git("fetch", "origin", "--prune", "--quiet");
  const pr = ghJson("pr", "view", String(n), "-R", REPO, "--json", "state,isDraft,baseRefName,headRefName,headRefOid,labels");
  if (pr.state !== "OPEN" || pr.isDraft || pr.baseRefName !== "main" || pr.labels.some((l) => l.name === HOLD_LABEL))
    die(`#${n} は open の main 宛てで、下書きでも ${HOLD_LABEL} でもない PR に限る。`);
  const { all } = worktrees();
  if (checkedOut(all, pr.headRefName, pr.headRefOid)) die(`${pr.headRefName} はレーンが開いている。レーンへの /goal に回す。`);
  if (touchesMigration(pr.headRefOid)) die(`#${n} はマイグレーションを含むので直さない。`);
  const conflicts = conflictFiles(pr.headRefOid);
  if (!mechanical(conflicts)) die(`#${n} の衝突は文書・lockfile・翻訳ファイルだけではない（${conflicts.join(", ") || "衝突なし"}）。`);

  const path = autofixPath(n);
  if (existsSync(path)) die(`${path} が既にある。前の autofix の残りなら autofix-abort ${n} で片付ける。`);
  const mainOid = git("rev-parse", "origin/main");
  git("worktree", "add", "--detach", path, pr.headRefOid);
  mkdirSync(join(path, ".claude", "comm"), { recursive: true });
  writeFileSync(join(path, ".claude", "comm", ".session-branch"), `${pr.headRefName}\n`);
  tryRun("git", ["-C", path, "merge", "--no-ff", "-m", `Merge origin/main into ${pr.headRefName} (merge-round autofix)`, mainOid]);
  const unmerged = tryRun("git", ["-C", path, "diff", "--name-only", "--diff-filter=U"]).out.split(/\r?\n/).filter(Boolean);
  mkdirSync(AUTOFIX_DIR, { recursive: true });
  writeJson(autofixState(n), {
    number: n, branch: pr.headRefName, head: pr.headRefOid, main: mainOid, path, conflicts: unmerged, startedAt: new Date().toISOString(),
  });
  if (!mechanical(unmerged)) {
    console.log(`手元の merge で衝突したファイルが想定と違う（${unmerged.join(", ") || "衝突なし"}）。autofix-abort ${n} で片付けて、レーンへの /goal に回す。`);
    process.exit(4);
  }
  console.log(`#${n} の一時 worktree を作り、main を merge した。衝突: ${unmerged.join(", ")}`);
  console.log(`\n--- サブエージェント（model: sonnet）への指示 ---\n${autofixPrompt(n, pr.headRefName, path, unmerged)}\n---`);
}

function autofixPrompt(n, branch, path, files) {
  return [
    `life-editor の PR #${n}（ブランチ ${branch}）に main を merge した途中の衝突を解いてください。`,
    `作業場所は ${path} です（git worktree、detached HEAD、merge の途中）。このフォルダの外のファイルには触りません。git は必ず \`git -C ${path} ...\` の形で打ちます。`,
    `衝突しているファイル: ${files.join(", ")}`,
    "",
    "解き方は ~/.claude/skills/git-conflict-resolver/SKILL.md の §2（docs）と §3（lockfile）を参考にします。同じスキルの §5（commit と push）には従いません。手順は下の 1〜4 だけです。",
    "- Markdown: 両側が足しただけなら両方を残し、日付や番号の順に並べます。同じ行を両側が書き換えていたら main 側の事実を残し、PR 側が新しい事実を足していればそれを加えます。",
    "- lockfile: 手で直さず、main 側を取ってから、その lockfile があるフォルダで `npm install --package-lock-only` を打って作り直します。",
    "- 翻訳ファイル（i18n/locales/*.json）: 両側が足したキーを両方残します。同じキーを両側が違う値に変えていたら、直さずに止めます。",
    "- 衝突しているファイル以外は編集しません。",
    "",
    "終わったら次を順に打ちます。",
    `1. \`git -C ${path} add <解いたファイル>\``,
    `2. \`git -C ${path} grep -n -E "^(<<<<<<<|>>>>>>>)( |$)" -- <解いたファイル>\` が何も出さないことを確かめる`,
    `3. JSON は \`node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" <ファイル>\` で読めることを確かめる`,
    `4. \`git -C ${path} -c core.editor=true merge --continue\``,
    "",
    "push・PR の merge・worktree の削除・merge --abort はしません。chat-main が確かめてから行います。",
    "どちらが新しいか読み取れない衝突があれば、そのファイルを解かずに止め、ファイル名と理由を報告します。",
    "報告は 5 行以内で、解いたファイルごとに、どちらを残したかを 1 行で書きます。",
  ].join("\n");
}

function autofixPush(nArg) {
  requireChatMain();
  const n = prNumber(nArg);
  const s = readJson(autofixState(n));
  if (!s) die(`#${n} の autofix は始まっていない。`);
  const g = (...args) => tryRun("git", ["-C", s.path, ...args]);
  if (g("rev-parse", "-q", "--verify", "MERGE_HEAD").code === 0) die("merge がまだ終わっていない（merge --continue の前）。");
  if (g("status", "--porcelain", "--untracked-files=no").out) die("一時 worktree に commit していない変更が残っている。");
  const parents = g("rev-list", "--parents", "-n", "1", "HEAD").out.split(" ").slice(1);
  if (parents[0] !== s.head || parents[1] !== s.main) die("HEAD が「PR の先頭に main を merge した commit」になっていない。");

  // 自動 merge の結果と比べ、変わってよいのは衝突したファイルだけ（確かめられなければ止める）
  const auto = tryRun("git", ["merge-tree", "--write-tree", "--no-messages", s.main, s.head]).out.split(/\r?\n/)[0];
  if (!/^[0-9a-f]{40}([0-9a-f]{24})?$/.test(auto)) die("自動 merge の結果を作れず、変わったファイルを確かめられない。");
  const diff = g("diff", "--no-renames", "--name-only", auto, "HEAD");
  if (diff.code !== 0) die("自動 merge の結果との差分を取れず、変わったファイルを確かめられない。");
  const changed = diff.out.split(/\r?\n/).filter(Boolean);
  const outside = changed.filter((f) => !s.conflicts.includes(f));
  if (outside.length) die(`衝突していないファイルまで変わっている: ${outside.join(", ")}`);
  const exists = (rev, f) => tryRun("git", ["cat-file", "-e", `${rev}:${f}`]).code === 0;
  for (const f of s.conflicts) {
    const body = g("show", `HEAD:${f}`);
    if (body.code !== 0) {
      // 消してよいのは、片側が消していたファイル（modify/delete の衝突）だけ
      if (exists(s.main, f) && exists(s.head, f)) die(`${f} が消えている。両側にあるファイルは消さない。`);
      continue;
    }
    if (MARKER(f).test(body.out)) die(`${f} に衝突の印が残っている。`);
    if (f.endsWith(".json")) {
      try {
        JSON.parse(body.out);
      } catch {
        die(`${f} が JSON として読めない。`);
      }
    }
  }

  const remote = tryRun("git", ["ls-remote", "origin", `refs/heads/${s.branch}`]).out.split(/\s/)[0];
  if (remote !== s.head) die(`${s.branch} は autofix の間に push された。上書きしないので autofix-abort ${n} で片付ける。`);
  if (checkedOut(worktrees().all.filter((wt) => wt.path !== s.path), s.branch, s.head)) die(`${s.branch} をレーンが開いた。autofix-abort ${n} で片付ける。`);

  const push = g("push", "origin", `HEAD:refs/heads/${s.branch}`);
  if (push.code !== 0) die(`push に失敗した（fast-forward でない可能性）。autofix-abort ${n} で片付ける。`);
  console.log(`#${n} を直して push した（${s.branch} → ${g("rev-parse", "--short", "HEAD").out}）。CI が通れば次の回で merge できる。`);
  cleanupAutofix(n, s);
}

function autofixAbort(nArg) {
  requireChatMain();
  const n = prNumber(nArg);
  const s = readJson(autofixState(n)) ?? { path: autofixPath(n) };
  if (existsSync(s.path)) tryRun("git", ["-C", s.path, "merge", "--abort"]);
  // 同じ先頭のあいだは、fixes がこの PR をレーンへの指示文に回す
  if (s.head) writeJson(AUTOFIX_FAILED, { ...readJson(AUTOFIX_FAILED, {}), [n]: s.head });
  cleanupAutofix(n, s);
  console.log(`#${n} の autofix を片付けた。レーンへの /goal に回す。`);
}

function cleanupAutofix(n, s) {
  if (existsSync(s.path)) {
    // 消すのは autofix が作った一時 worktree だけ。中身は push 済みか、捨てると決めたもの
    if (resolve(s.path).toLowerCase() !== resolve(autofixPath(n)).toLowerCase())
      die(`${s.path} は autofix の一時 worktree ではないので消さない。`);
    const r = tryRun("git", ["worktree", "remove", "--force", s.path]);
    if (r.code !== 0) console.log(`一時 worktree を消せなかった: ${s.path}（worktree-policy の「Windows での worktree 削除」で手で消す）`);
  }
  if (existsSync(autofixState(n))) rmSync(autofixState(n));
}

// ---------- 入口 ----------
// 試験が landedIn を import したときに、使い方の表示で終了しないよう、直接起動のときだけ動かす
const invokedDirectly =
  process.argv[1] && resolve(fileURLToPath(import.meta.url)).toLowerCase() === resolve(process.argv[1]).toLowerCase();
const [cmd, ...rest] = process.argv.slice(2);
const flag = (name) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
};
if (invokedDirectly) {
  switch (cmd) {
    case "plan": plan(flag("--only")); break;
    case "start": start(); break;
    case "check": check(rest[0]); break;
    case "fixes": fixes(); break;
    case "finish": finish(); break;
    case "status": status(); break;
    case "autofix-start": autofixStart(rest[0]); break;
    case "autofix-push": autofixPush(rest[0]); break;
    case "autofix-abort": autofixAbort(rest[0]); break;
    default:
      die("使い方: merge-round.mjs plan [--only 1,2] | start | check <n> | fixes | finish | status | autofix-start|autofix-push|autofix-abort <n>");
  }
}
