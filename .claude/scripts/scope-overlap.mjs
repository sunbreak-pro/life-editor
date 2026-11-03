#!/usr/bin/env node
// scope-overlap — checks whether a branch, a set of globs or a batch of Issues touches the same files as
// the other work in flight (open PRs and the other worktrees), and whether it stays inside its lane and
// its plan's Scope.
//
// Read-only: it never writes to GitHub or git (apart from one `git fetch origin`). The lane map and the
// hub-file rules live in `.claude/scripts/lane-ownership.json`; the procedure is in the worktree-policy skill.
//
//   node .claude/scripts/scope-overlap.mjs                         this worktree's branch vs everything in flight
//   node .claude/scripts/scope-overlap.mjs --branch origin/<b>     another branch
//   node .claude/scripts/scope-overlap.mjs --paths "<glob>,<glob>" before starting an Issue (no branch yet)
//   node .claude/scripts/scope-overlap.mjs --issues <file.json>    {"#2447": ["web/src/wikitag/**"], ...}
//   node .claude/scripts/scope-overlap.mjs --check-map             validate lane-ownership.json against the tree
//   options: --lane <slug> --scope-plan <plan.md> --base origin/main --json --no-merge-tree --strict-lane
//            --fixture <file.json> (replaces every gh / git call; used by scope-overlap.test.mjs)
//
// Exit codes: 0 = no BLOCK (WARN rows may remain), 1 = at least one BLOCK, 2 = usage error,
//             3 = unconfirmed (PR or worktree list unavailable, or any unexpected error).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = "sunbreak-pro/life-editor";
const RECORD_BRANCH = /^chore\/(tracker|outbox|routine)-/;
// Runtime chat files are rewritten by every session and never land in a product PR.
const RUNTIME_PATH = /^\.claude\/(comm|memory|history)\//;
const MAP_PATH = fileURLToPath(new URL("./lane-ownership.json", import.meta.url));

// ---------- helpers (copied from merge-round.mjs so this script stands alone) ----------
// `trim: false` keeps leading spaces, which `git status --porcelain` uses as the "unchanged in index" column.
function run(cmd, args, { trim = true, ...opts } = {}) {
  const out = execFileSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
    // A credential prompt on Windows hangs forever without a terminal; fail fast instead.
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never" },
    timeout: 120_000,
    ...opts,
  });
  return trim ? out.trim() : out;
}
function tryRun(cmd, args, opts) {
  try {
    return { code: 0, out: run(cmd, args, opts) };
  } catch (e) {
    return { code: e.status ?? 1, out: String(e.stdout ?? "").trim(), err: String(e.stderr ?? "").trim() };
  }
}
const parseJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};
const git = (...args) => run("git", args);
class UsageError extends Error {}
const die = (msg, code = 2) => {
  console.error(`[scope-overlap] ${msg}`);
  process.exit(code);
};

// ---------- globs ----------
export function globToRegExp(pattern) {
  let p = String(pattern).trim().replace(/\\/g, "/");
  if (p.endsWith("/")) p += "**";
  let re = "";
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === "*" && p[i + 1] === "*") {
      if (p[i + 2] === "/") {
        re += "(?:.*/)?";
        i += 2;
      } else {
        re += ".*";
        i += 1;
      }
    } else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}
const isGlob = (p) => /[*?]/.test(p) || p.endsWith("/");
const norm = (f) => String(f).replace(/\\/g, "/");
function matcher(globs) {
  const res = (globs ?? []).map(globToRegExp);
  return (f) => res.some((r) => r.test(norm(f)));
}

// ---------- the map ----------
export function loadMap(path = MAP_PATH) {
  return JSON.parse(readFileSync(path, "utf8"));
}
function laneMatchers(map) {
  return Object.entries(map.lanes ?? {}).map(([name, lane]) => {
    const inc = matcher(lane.paths);
    const exc = matcher(lane.exclude);
    return { name, lane, test: (f) => inc(f) && !exc(f) };
  });
}
function hubOf(map, file) {
  for (const hub of map.hubs ?? []) if (matcher(hub.paths)(file)) return hub;
  return null;
}
const hubOwners = (hub) => hub.owners ?? (hub.owner ? [hub.owner] : []);
// The fallback lane only takes what no named lane claims, so it never counts as a second owner.
function ownerLanes(map, file) {
  const named = laneMatchers(map)
    .filter((l) => l.test(file))
    .map((l) => l.name);
  if (named.length) return named;
  const fb = map.fallbackLane;
  return fb && matcher(fb.paths)(file) ? [fb.name] : [];
}
const isCrossCutting = (map, lane) => (map.crossCutting?.lanes ?? []).includes(lane);
// A worktree directory is a lane only when it owns paths of its own or is listed as cross-cutting.
const laneOfDir = (map, name) =>
  (map.lanes?.[name] && !map.lanes[name].anyLane) || isCrossCutting(map, name) ? name : null;
function laneLabel(map, name) {
  return isCrossCutting(map, name) ? `${name}（横断。持ち分なし）` : name;
}
function migrationNumber(map, file) {
  const dir = map.serialRules?.migrationDir;
  if (!dir || !norm(file).startsWith(`${dir}/`)) return null;
  const rest = norm(file).slice(dir.length + 1);
  if (rest.includes("/") || !rest.endsWith(".sql")) return null;
  const m = rest.match(new RegExp(map.serialRules.migrationPattern));
  return m ? m[1] : null;
}

// ---------- classification (pure; exported for the test) ----------
// input: {
//   self: { files: string[], globs?: string[], lane?: string|null, branch?: string|null },
//   others: [{ with: "PR #n" | "worktree <name>", type: "pr"|"worktree", strength: "strong"|"weak",
//              headRefName?: string, files: string[] }],
//   mergeTree?: { [headRefName]: string[] }        self-vs-PR conflicts; a missing key means merge-tree did not run
//   prBaseConflicts?: { [headRefName]: string[] }  the PR's own conflicts with base
//   baseConflicts?: string[]                       self's own conflicts with base
//   mainTree?: string[]                            base tree, for the migration-number check
//   map, strictLane?, scopeGlobs?: string[] | null, baseName?: string
// }
// Levels: BLOCK fails the check; WARN is an overlap the check could not settle (no merge-tree); INFO is fine.
export function classify(input) {
  const {
    self,
    others = [],
    mergeTree = {},
    prBaseConflicts = {},
    mainTree = [],
    map,
    strictLane = false,
    scopeGlobs = null,
    baseName = "origin/main",
  } = input;
  const baseConflicts = new Set((input.baseConflicts ?? []).map(norm));
  const findings = [];
  const add = (level, kind, file, withWho, detail) => findings.push({ level, kind, file, with: withWho, detail });
  // Two branches cut from different main commits also "conflict" on what main changed in between,
  // so conflicts with main itself are reported apart from the PR-to-PR ones.
  for (const f of baseConflicts)
    add("BLOCK", "CONFLICT", f, baseName, `main と衝突している。先に ${baseName} を取り込んで解く`);
  const prConflictDetail = (f) =>
    baseConflicts.has(f)
      ? `中身が衝突する（main とも衝突しているので、先に ${baseName} を取り込む）`
      : "中身が衝突する。先行の PR の merge 後に取り込んで解く";
  const selfFiles = [...new Set((self.files ?? []).map(norm))];
  const selfGlobMatch = self.globs?.length ? matcher(self.globs) : null;
  const selfSet = new Set(selfFiles);
  const selfHas = (f) => selfSet.has(norm(f)) || (selfGlobMatch ? selfGlobMatch(f) : false);
  const lane = self.lane ?? null;
  // Record branches (tracker / outbox / routine) are where decisions get transcribed, whoever opens them.
  const recordBranch = RECORD_BRANCH.test(String(self.branch ?? "").replace(/^origin\//, ""));
  const ownerOnly = (hub, f, withWho) => {
    const owners = hubOwners(hub);
    if (owners.includes(lane) || (recordBranch && hub.recordBranches)) {
      if (withWho) add("INFO", "owner-only", f, withWho, `同じファイルに別の書き手がいる。${hub.how}`);
      return;
    }
    add("BLOCK", "owner-only", f, withWho ?? "—", `${owners.join(" / ")} 専用。${hub.how}`);
  };

  for (const f of selfFiles) {
    const hub = hubOf(map, f);
    if (hub?.kind === "owner-only") ownerOnly(hub, f, null);
  }

  for (const o of others) {
    const shared = [...new Set((o.files ?? []).map(norm))].filter(selfHas);
    const conflicts = o.headRefName != null ? mergeTree[o.headRefName] : undefined;
    const ran = Array.isArray(conflicts);
    // A PR that already conflicts with main brings those conflicts into any merge-tree run against it, so
    // they count against self only on files self touches too.
    const theirs = new Set((o.headRefName != null ? (prBaseConflicts[o.headRefName] ?? []) : []).map(norm));
    const conflictSet = new Set((conflicts ?? []).map(norm));
    const withWho = o.strength === "weak" ? `${o.with}（weak）` : o.with;
    if (shared.length && theirs.size)
      add(
        "INFO",
        "stale-pr",
        [...theirs].sort().join(", "),
        withWho,
        `${o.with} は ${baseName} とすでに衝突している。この分は相手の PR が直すので、こちらの衝突には数えない`,
      );
    for (const f of shared) {
      const hub = hubOf(map, f);
      if (conflictSet.has(f)) {
        const detail = theirs.has(f) ? `${prConflictDetail(f)}（相手の PR も main と衝突している）` : prConflictDetail(f);
        add("BLOCK", "CONFLICT", f, withWho, detail);
        continue;
      }
      if (hub?.kind === "owner-only") {
        ownerOnly(hub, f, withWho);
        continue;
      }
      if (hub?.kind === "generated") {
        add("INFO", "generated", f, withWho, `merge 後に作り直す。${hub.how}`);
        continue;
      }
      if (hub?.kind === "append") {
        if (ran) add("INFO", "append", f, withWho, `merge-tree では衝突しない。${hub.how}`);
        else add("WARN", "append", f, withWho, `merge-tree を回していないので、衝突するかは未確認。${hub.how}`);
        continue;
      }
      const hint =
        o.type === "pr" && ran
          ? "今は別の箇所で、自動で合流する見込み。直列にするか、先行 PR の merge 後に着手する"
          : "直列にする。先行の変更が merge されてから origin/main で切り直す";
      add("BLOCK", "same-file", f, withWho, hint);
    }
    // merge-tree can report conflicts on files the name lists do not share (renames, deletes).
    for (const f of conflictSet)
      // A file the PR does not touch that also conflicts with main came in through the PR's newer base.
      if (!shared.includes(f) && !baseConflicts.has(f) && !theirs.has(f))
        add("BLOCK", "CONFLICT", f, withWho, prConflictDetail(f));
  }

  // Migration numbers: the same NNNN twice breaks `supabase db push` even when git merges cleanly.
  const mainSet = new Set(mainTree.map(norm));
  for (const f of selfFiles) {
    const n = migrationNumber(map, f);
    if (!n) continue;
    for (const m of mainTree)
      if (migrationNumber(map, m) === n && norm(m) !== f && !mainSet.has(f))
        add("BLOCK", "migration-number", f, `${baseName} ${m}`, `番号 ${n} は main で使用済み。次の番号に取り直す`);
    for (const o of others)
      for (const of of o.files ?? [])
        if (migrationNumber(map, of) === n && norm(of) !== f)
          add("BLOCK", "migration-number", f, `${o.with} ${norm(of)}`, `番号 ${n} が重なる。後から出すほうが番号を取り直す`);
  }

  // Plan Scope: shared hub files (i18n, barrels, generated) are not required in a Scope list.
  if (scopeGlobs) {
    const inScope = matcher(scopeGlobs);
    for (const f of selfFiles) {
      if (inScope(f) || RUNTIME_PATH.test(f)) continue;
      const hub = hubOf(map, f);
      if (hub && hub.kind !== "owner-only") continue;
      add("BLOCK", "scope", f, "計画書の Scope", "Scope 外。P-008 に従い、実装せず判断キューへ出す");
    }
  }

  // Lane report: only files another standing lane owns are worth routing; shared areas are open to all.
  const laneEntry = lane ? map.lanes?.[lane] : null;
  if (laneEntry && !laneEntry.anyLane) {
    const mine = laneMatchers(map).filter((l) => l.name === lane);
    for (const f of selfFiles) {
      if (f.startsWith(".claude/") || mine.some((l) => l.test(f))) continue;
      const hub = hubOf(map, f);
      if (hub && (hub.kind === "append" || hub.kind === "generated")) continue;
      const owned = ownerLanes(map, f).filter((n) => map.lanes?.[n] && !map.lanes[n].anyLane);
      if (!owned.length) continue;
      add(strictLane ? "BLOCK" : "INFO", "off-lane", f, "—", `レーン外 ${f} (担当 ${owned.join(" / ")})`);
    }
  }

  return {
    findings,
    blocked: findings.some((x) => x.level === "BLOCK"),
    warned: findings.some((x) => x.level === "WARN"),
  };
}

// Pairs of Issues whose Scope globs reach the same file. Without commits there is no merge-tree, so a
// pair that shares only append hubs (i18n, barrels) is WARN: such files often merge but not always.
export function issuePairs(issues, tree, map) {
  const entries = Object.entries(issues).filter(([, g]) => Array.isArray(g) && g.length);
  const files = new Map(entries.map(([id, g]) => [id, expand(g, tree)]));
  const pairs = [];
  for (let i = 0; i < entries.length; i++)
    for (let j = i + 1; j < entries.length; j++) {
      const [a, ga] = entries[i];
      const [b, gb] = entries[j];
      const ma = matcher(ga);
      const mb = matcher(gb);
      const shared = new Set([...files.get(a).filter(mb), ...files.get(b).filter(ma)]);
      if (!shared.size) continue;
      const list = [...shared].sort();
      const kinds = list.map((f) => hubOf(map, f)?.kind ?? "normal");
      const level = kinds.some((k) => k === "normal" || k === "owner-only")
        ? "BLOCK"
        : kinds.includes("append")
          ? "WARN"
          : "INFO";
      pairs.push({ a, b, files: list, level, blocking: level === "BLOCK" });
    }
  return pairs;
}

function expand(globs, tree) {
  const out = new Set();
  const m = matcher(globs);
  for (const f of tree) if (m(f)) out.add(norm(f));
  for (const g of globs) if (!isGlob(g)) out.add(norm(g).trim());
  return [...out];
}

export function checkMap(map, tree) {
  const problems = [];
  const unmatched = (where, g) => {
    const r = globToRegExp(g);
    if (!tree.some((f) => r.test(f))) problems.push(`一致するファイルがない: ${where} ${g}`);
  };
  for (const [name, lane] of Object.entries(map.lanes ?? {}))
    for (const g of [...(lane.paths ?? []), ...(lane.exclude ?? [])]) unmatched(`lanes.${name}`, g);
  for (const g of map.fallbackLane?.paths ?? []) unmatched("fallbackLane", g);
  for (const hub of map.hubs ?? []) {
    if (hub.kind === "owner-only") continue;
    for (const g of hub.paths ?? []) unmatched(`hubs(${hub.kind})`, g);
  }
  for (const name of map.crossCutting?.lanes ?? [])
    if (map.lanes?.[name]) problems.push(`横断レーンが持ち分も持っている: ${name}`);
  const lanes = laneMatchers(map);
  for (const f of tree) {
    const owners = lanes.filter((l) => l.test(f)).map((l) => l.name);
    if (owners.length > 1) problems.push(`2 つのレーンが持っている: ${f} (${owners.join(", ")})`);
  }
  return problems;
}

// ---------- data sources ----------
function parseArgs(argv) {
  const o = { base: "origin/main", json: false, mergeTree: true, strictLane: false };
  const need = (i) => {
    if (argv[i + 1] === undefined || argv[i + 1].startsWith("--")) throw new UsageError(`${argv[i]} に値がない`);
    return argv[i + 1];
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--branch") o.branch = need(i++);
    else if (a === "--lane") o.lane = need(i++);
    else if (a === "--paths") o.paths = need(i++).split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--scope-plan") o.scopePlan = need(i++);
    else if (a === "--issues") o.issues = need(i++);
    else if (a === "--base") o.base = need(i++);
    else if (a === "--fixture") o.fixture = need(i++);
    else if (a === "--json") o.json = true;
    else if (a === "--no-merge-tree") o.mergeTree = false;
    else if (a === "--strict-lane") o.strictLane = true;
    else if (a === "--check-map") o.checkMap = true;
    else if (a === "-h" || a === "--help") o.help = true;
    else throw new UsageError(`知らない引数: ${a}`);
  }
  const modes = [o.branch !== undefined, o.paths !== undefined, o.issues !== undefined, !!o.checkMap].filter(Boolean);
  if (modes.length > 1) throw new UsageError("--branch / --paths / --issues / --check-map は 1 つだけ指定する");
  return o;
}

function parseScopePlan(path) {
  if (!existsSync(path)) throw new UsageError(`計画書が見つからない: ${path}`);
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  const start = lines.findIndex((l) => /^##\s+Scope/.test(l));
  if (start < 0) throw new UsageError(`'## Scope' の見出しがない: ${path}`);
  const open = lines.findIndex((l, i) => i > start && /^\s*```/.test(l));
  if (open < 0) throw new UsageError(`'## Scope' の後にコードブロックがない: ${path}`);
  const globs = [];
  for (let i = open + 1; i < lines.length && !/^\s*```/.test(lines[i]); i++) {
    const t = lines[i].trim();
    if (t && !t.startsWith("#")) globs.push(t);
  }
  return globs;
}

function samePath(a, b) {
  const n = (p) => resolve(p).replace(/\\/g, "/").replace(/\/+$/, "");
  return process.platform === "win32" ? n(a).toLowerCase() === n(b).toLowerCase() : n(a) === n(b);
}

// Input is the raw `git status --porcelain -z` output; it must not be trimmed (see run()).
export function parsePorcelainZ(text) {
  const parts = String(text).split("\0");
  const files = [];
  for (let i = 0; i < parts.length; i++) {
    const e = parts[i];
    if (e.length < 4) continue;
    const xy = e.slice(0, 2);
    files.push(e.slice(3));
    if (/[RC]/.test(xy)) i++; // the next entry is the rename source
  }
  return files.map(norm).filter((f) => !RUNTIME_PATH.test(f));
}

function statusFiles(dir) {
  const r = tryRun("git", ["-C", dir, "-c", "core.quotepath=false", "status", "--porcelain", "-z", "-uall"], {
    trim: false,
  });
  return r.code === 0 ? parsePorcelainZ(r.out) : null;
}

function parseWorktrees(text) {
  const out = [];
  let cur = null;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("worktree ")) {
      cur = { path: line.slice(9), branch: null, detached: false, bare: false };
      out.push(cur);
    } else if (!cur) continue;
    else if (line.startsWith("branch ")) cur.branch = line.slice(7).replace(/^refs\/heads\//, "");
    else if (line === "detached") cur.detached = true;
    else if (line === "bare") cur.bare = true;
  }
  return out;
}

// Files a worktree branch still adds on top of base. Merging into base first drops the files a squash
// merge already landed, which `diff base...HEAD` would keep showing.
function committedFiles(dir, base) {
  const mt = tryRun("git", ["-C", dir, "merge-tree", "--write-tree", "--no-messages", base, "HEAD"]);
  const tree = mt.out.split(/\r?\n/)[0];
  if ((mt.code === 0 || mt.code === 1) && /^[0-9a-f]{40,64}$/.test(tree)) {
    const d = tryRun("git", ["-C", dir, "-c", "core.quotepath=false", "diff", "--name-only", base, tree]);
    if (d.code === 0) return d.out ? d.out.split(/\r?\n/).map(norm) : [];
  }
  const d = tryRun("git", ["-C", dir, "-c", "core.quotepath=false", "diff", "--name-only", `${base}...HEAD`]);
  return d.code === 0 && d.out ? d.out.split(/\r?\n/).map(norm) : [];
}

function realSource(opts) {
  const notes = [];
  const fetched = tryRun("git", ["fetch", "origin", "--quiet"]);
  if (fetched.code !== 0) notes.push("origin を取得できず。手元の参照で調べる");
  const top = git("rev-parse", "--show-toplevel");
  const tree = () => {
    const r = tryRun("git", ["-c", "core.quotepath=false", "ls-tree", "-r", "--name-only", opts.base]);
    if (r.code !== 0) throw new UsageError(`${opts.base} の tree を読めない`);
    return r.out.split(/\r?\n/).filter(Boolean);
  };
  return {
    notes,
    top,
    tree,
    prs() {
      const r = tryRun("gh", [
        "pr", "list", "-R", REPO, "--state", "open", "--limit", "200",
        "--json", "number,title,headRefName,headRefOid,isDraft,files",
      ]);
      if (r.code !== 0) return null;
      const prs = parseJson(r.out || "[]");
      if (!Array.isArray(prs)) return null;
      for (const pr of prs) {
        pr.files = (pr.files ?? []).map((f) => f.path);
        // gh pr list stops at 100 files per PR.
        if (pr.files.length >= 100) {
          const all = tryRun("gh", ["api", `repos/${REPO}/pulls/${pr.number}/files`, "--paginate", "--jq", ".[].filename"]);
          if (all.code === 0) pr.files = all.out.split(/\r?\n/).filter(Boolean);
        }
      }
      return prs;
    },
    worktrees() {
      const r = tryRun("git", ["worktree", "list", "--porcelain"]);
      if (r.code !== 0) return null;
      const list = parseWorktrees(r.out);
      return list.map((w, i) => ({ ...w, name: basename(w.path), main: i === 0 }));
    },
    dirty: (w) => statusFiles(w.path),
    committed: (w) => committedFiles(w.path, opts.base),
    resolveRef(ref) {
      for (const cand of [ref, `origin/${ref}`])
        if (tryRun("git", ["rev-parse", "--verify", "--quiet", `${cand}^{commit}`]).code === 0) return cand;
      throw new UsageError(`ブランチが見つからない: ${ref}`);
    },
    currentBranch: () => git("rev-parse", "--abbrev-ref", "HEAD"),
    diffFiles(ref) {
      const r = tryRun("git", ["-c", "core.quotepath=false", "diff", "--name-only", `${opts.base}...${ref}`]);
      if (r.code !== 0) throw new UsageError(`${opts.base}...${ref} の差分を取れない`);
      return r.out ? r.out.split(/\r?\n/).map(norm) : [];
    },
    // The PR's own conflicts with base. Without them, a stale PR's conflicts would be blamed on self.
    prBaseConflicts(headRefName) {
      return this.mergeTree(opts.base, headRefName);
    },
    mergeTree(selfRef, headRefName, otherRef) {
      const other = otherRef ?? `origin/${headRefName}`;
      if (tryRun("git", ["rev-parse", "--verify", "--quiet", `${other}^{commit}`]).code !== 0) return undefined;
      const r = tryRun("git", ["merge-tree", "--write-tree", "--name-only", selfRef, other]);
      if (r.code === 0) return [];
      if (r.code !== 1) return undefined;
      const lines = r.out.split(/\r?\n/);
      const files = [];
      for (let i = 1; i < lines.length && lines[i].trim() !== ""; i++) files.push(norm(lines[i].trim()));
      return files;
    },
  };
}

function fixtureSource(fx) {
  return {
    notes: [],
    top: fx.selfPath ?? "<fixture-self>",
    tree: () => fx.tree ?? [],
    prs: () =>
      fx.error ? null : (fx.prs ?? []).map((p) => ({ ...p, files: (p.files ?? []).map((f) => (typeof f === "string" ? f : f.path)) })),
    worktrees: () => (fx.error ? null : (fx.worktrees ?? []).map((w) => ({ detached: false, main: false, ...w }))),
    dirty: (w) => w.dirty ?? [],
    committed: (w) => w.committed ?? [],
    resolveRef: (ref) => ref,
    currentBranch: () => fx.selfBranch ?? "fixture-self",
    diffFiles: () => fx.selfFiles ?? [],
    mergeTree: (_self, head, otherRef) =>
      otherRef ? (fx.baseConflicts ?? []) : fx.mergeTree === undefined ? undefined : (fx.mergeTree[head] ?? []),
    prBaseConflicts: (head) => fx.prBaseConflicts?.[head] ?? [],
  };
}

// ---------- main ----------
function collectOthers(src, { selfBranch, selfPath }) {
  const prs = src.prs();
  const wts = src.worktrees();
  if (!prs || !wts) return null;
  const others = [];
  const prBranches = new Set(prs.map((p) => p.headRefName));
  const openPrs = prs.filter((p) => p.headRefName !== selfBranch);
  for (const p of openPrs)
    others.push({ with: `PR #${p.number}`, type: "pr", strength: "strong", headRefName: p.headRefName, files: p.files });
  let weakUsed = false;
  for (const w of wts) {
    if (w.bare || w.detached || !w.branch) continue;
    if (w.main && w.branch === "main") continue;
    if (samePath(w.path, selfPath) || (selfBranch && w.branch === selfBranch)) continue;
    const dirty = src.dirty(w);
    if (dirty?.length) others.push({ with: `worktree ${w.name}`, type: "worktree", strength: "strong", files: dirty });
    if (!prBranches.has(w.branch) && !RECORD_BRANCH.test(w.branch)) {
      const committed = src.committed(w);
      if (committed?.length) {
        weakUsed = true;
        others.push({ with: `worktree ${w.name}`, type: "worktree", strength: "weak", files: committed });
      }
    }
  }
  return { others, openPrs, worktrees: wts, weakUsed };
}

// With --branch, the lane is that of the worktree holding the branch, not of the directory the command runs in.
function resolveLane(opts, wts, selfPath, selfBranch, map) {
  if (opts.lane) return opts.lane;
  const list = wts ?? [];
  const holder =
    opts.branch !== undefined
      ? list.find((w) => w.branch && w.branch === selfBranch)
      : list.find((w) => samePath(w.path, selfPath));
  if (!holder) return null;
  if (holder.main) return "chat-main";
  return laneOfDir(map, holder.name ?? basename(holder.path));
}

function formatTable(findings) {
  const rows = findings.map(
    (f) => `| ${f.issue ? `${f.issue} ` : ""}${f.level} ${f.kind} | ${f.file} | ${f.with} | ${f.detail} |`,
  );
  return ["| 区分 | ファイル | 相手 | 対処 |", "| --- | --- | --- | --- |", ...rows].join("\n");
}

function readJsonFile(path, what) {
  if (!existsSync(path)) throw new UsageError(`${what}が見つからない: ${path}`);
  const v = parseJson(readFileSync(path, "utf8"));
  if (v === null) throw new UsageError(`${what}が JSON として読めない: ${path}`);
  return v;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 18).join("\n"));
    return;
  }
  const map = loadMap();
  const fx = opts.fixture ? readJsonFile(opts.fixture, "fixture ") : null;
  const src = fx ? fixtureSource(fx) : null;

  if (opts.checkMap) {
    const tree = src ? src.tree() : runTree(opts.base);
    const problems = checkMap(map, tree);
    if (opts.json) console.log(JSON.stringify({ ok: !problems.length, problems }, null, 2));
    else if (problems.length) console.log(problems.join("\n"));
    else console.log(`lane-ownership.json は ${opts.base} の tree と合っている（${tree.length} ファイル）`);
    process.exit(problems.length ? 1 : 0);
  }

  const s = src ?? realSource(opts);
  const tree = s.tree();
  const scopeGlobs = opts.scopePlan ? parseScopePlan(opts.scopePlan) : null;
  const unchecked = [];
  let self;
  let selfRef = null;
  let selfBranch;
  let issueBatch = null;

  if (opts.issues) {
    issueBatch = readJsonFile(opts.issues, "Issue の Scope ファイル");
    selfBranch = null;
  } else if (opts.paths) {
    selfBranch = null;
    for (const g of opts.paths) if (isGlob(g) && !expand([g], tree).length) unchecked.push(`${g}（一致するファイルがない）`);
    self = { files: expand(opts.paths, tree), globs: opts.paths };
  } else {
    selfRef = opts.branch !== undefined ? s.resolveRef(opts.branch) : "HEAD";
    selfBranch = (opts.branch ?? s.currentBranch()).replace(/^origin\//, "");
    self = { files: fx ? (fx.selfFiles ?? []) : s.diffFiles(selfRef) };
  }

  const collected = collectOthers(s, { selfBranch, selfPath: s.top });
  if (!collected) {
    const msg = "未確認: open PR か worktree の一覧を取得できなかった。gh の認証かネットワークを直して再実行する";
    if (opts.json) console.log(JSON.stringify({ error: msg, blocked: null }, null, 2));
    else console.log(msg);
    process.exit(3);
  }
  const { others, openPrs, worktrees, weakUsed } = collected;

  // The branch's own worktree adds its uncommitted edits to the self side.
  if (self && !opts.paths) {
    const own = worktrees.find((w) => w.branch && w.branch === selfBranch);
    const dirty = own ? s.dirty(own) : opts.branch === undefined && !fx ? statusFiles(s.top) : null;
    if (dirty?.length) self.files = [...new Set([...self.files, ...dirty])];
  }

  const lane = fx?.lane ?? resolveLane(opts, worktrees, s.top, selfBranch, map);
  const mainTree = tree;
  const run1 = (selfSide, ref) => {
    const mt = {};
    const theirs = {};
    let baseConflicts = [];
    // A path set (--paths / --issues) has no commit to merge, so merge-tree only runs for a branch.
    if (opts.mergeTree && ref) {
      const selfSet = new Set(selfSide.files);
      for (const p of openPrs) {
        if (!p.files.some((f) => selfSet.has(norm(f)))) continue;
        const c = s.mergeTree(ref, p.headRefName);
        if (c === undefined) continue;
        mt[p.headRefName] = c;
        if (c.length) theirs[p.headRefName] = s.prBaseConflicts(p.headRefName) ?? [];
      }
      baseConflicts = s.mergeTree(ref, null, opts.base) ?? [];
    }
    return classify({
      self: { ...selfSide, lane, branch: selfBranch },
      others,
      mergeTree: mt,
      prBaseConflicts: theirs,
      baseConflicts,
      mainTree,
      map,
      strictLane: opts.strictLane,
      scopeGlobs,
      baseName: opts.base,
    });
  };

  let findings = [];
  const pairLines = [];
  if (issueBatch) {
    const pairs = issuePairs(issueBatch, tree, map);
    const pairDetail = {
      BLOCK: "片方を止まっているに回し、先に配るほうの番号を書く",
      WARN: "i18n などの追記型ファイルが重なる。merge-tree なしでは衝突するか分からないので、同じ時期に配らない",
      INFO: "作り直す生成物だけが重なる",
    };
    for (const p of pairs) {
      pairLines.push(`${p.a} × ${p.b}: ${p.files.join(", ")}`);
      for (const f of p.files)
        findings.push({ level: p.level, kind: "issue-pair", file: f, with: `Issue ${p.a} × ${p.b}`, detail: pairDetail[p.level] });
    }
    for (const [id, globs] of Object.entries(issueBatch)) {
      if (!Array.isArray(globs) || !globs.length) {
        unchecked.push(`${id}（Scope なし）`);
        continue;
      }
      const r = run1({ files: expand(globs, tree), globs }, null);
      for (const f of r.findings) findings.push({ ...f, issue: id });
    }
  } else {
    findings = run1(self, selfRef).findings;
  }

  const count = (level) => findings.filter((f) => f.level === level).length;
  const nBlock = count("BLOCK");
  const nWarn = count("WARN");
  const blocked = nBlock > 0;
  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          self: { branch: selfBranch, lane, files: self?.files ?? [] },
          findings,
          unchecked,
          notes: s.notes,
          blocked,
          warned: nWarn > 0,
        },
        null,
        2,
      ),
    );
  } else {
    const head = issueBatch
      ? `Issue ${Object.keys(issueBatch).length} 本 / レーン ${lane ? laneLabel(map, lane) : "なし"}`
      : `${selfBranch ?? "(--paths)"} / レーン ${lane ? laneLabel(map, lane) : "なし"} / ${self.files.length} ファイル`;
    console.log(head);
    for (const n of s.notes) console.log(n);
    if (pairLines.length) console.log(["Issue 同士の重なり:", ...pairLines.map((l) => `  ${l}`)].join("\n"));
    if (findings.length) console.log(formatTable(findings));
    if (weakUsed && findings.some((f) => String(f.with).includes("（weak）")))
      console.log("weak = PR のないブランチの commit 済みの変更。squash 済みの枝では見かけのファイルが出ることがある");
    if (unchecked.length) console.log(`未検査: ${unchecked.join(", ")}`);
    if (blocked) console.log(`結論: 重なりあり (BLOCK ${nBlock} 件)`);
    else if (nWarn)
      console.log(`結論: BLOCK はない。WARN ${nWarn} 件は未確認なので、PR の前にブランチを指定して検査し直す`);
    else console.log("結論: 重なりなし");
  }
  process.exit(blocked ? 1 : 0);
}

function runTree(base) {
  const r = tryRun("git", ["-c", "core.quotepath=false", "ls-tree", "-r", "--name-only", base]);
  if (r.code !== 0) throw new UsageError(`${base} の tree を読めない`);
  return r.out.split(/\r?\n/).filter(Boolean);
}

// Exit 1 means "overlap found", so a crash must not exit 1: anything unexpected is reported as unconfirmed (3).
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main();
  } catch (e) {
    if (e instanceof UsageError) die(e.message);
    const msg = `未確認: ${String(e?.message ?? e).split(/\r?\n/)[0]}`;
    if (process.argv.includes("--json")) console.log(JSON.stringify({ error: msg, blocked: null }, null, 2));
    console.error(`[scope-overlap] ${msg}`);
    process.exit(3);
  }
}
