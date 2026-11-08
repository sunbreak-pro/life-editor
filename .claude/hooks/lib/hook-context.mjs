#!/usr/bin/env node
// Where a Bash command really acts, for the PreToolUse guards.
//
// The hooks always run from the main checkout's .claude/hooks when the session is the main chat,
// and so do the hooks of its subagents. Workflow agents start every Bash call in the main checkout
// and reach their worktree with `cd <worktree> && ...` (issue-workflow trial, 2026-11-08). So neither
// the hook's own location nor input.cwd says which repo a `git commit` stages from, or whether a
// `gh issue create` comes from a lane. This reads the `cd` / `git -C` chain in front of the command.
//
// CLI: node hook-context.mjs <commit|issue-create|pr-merge> <fallbackDir>  (hook JSON on stdin)
// prints one line, fields joined by \x1f: agent, known, dir, toplevel, linked, sessionName
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Git Bash spells C:/Users as /c/Users; Node's resolve on Windows needs the drive form. */
export function toNativePath(p) {
  if (process.platform === "win32") {
    const m = p.match(/^\/([a-zA-Z])(?:\/(.*))?$/);
    if (m) return `${m[1].toUpperCase()}:/${m[2] ?? ""}`;
  }
  return p;
}

/** Splits on && || ; | & and newlines outside quotes. Rough on purpose: it only has to find cd and the target. */
export function segments(command) {
  const out = [];
  let cur = "";
  let q = null;
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (q) {
      if (c === "\\" && q === '"' && i + 1 < command.length) {
        cur += c + command[++i];
        continue;
      }
      if (c === q) q = null;
      cur += c;
      continue;
    }
    if (c === "'" || c === '"') {
      q = c;
      cur += c;
      continue;
    }
    if (c === ";" || c === "\n" || c === "|" || c === "&") {
      out.push(cur);
      cur = "";
      if ((c === "|" || c === "&") && command[i + 1] === c) i++;
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}

export function words(segment) {
  const out = [];
  const re = /"((?:\\.|[^"\\])*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(segment))) out.push(m[1] ?? m[2] ?? m[3]);
  // Leading `( ` of a subshell and env assignments (FOO=1 git commit) are not the command.
  while (out.length && (out[0] === "(" || /^[A-Za-z_][A-Za-z0-9_]*=/.test(out[0]))) out.shift();
  if (out.length && out[0].startsWith("(")) out[0] = out[0].slice(1);
  return out;
}

/** Drops git's global options so `git -C x -c y=z commit` reads as commit; returns { sub, cDirs }. */
function gitSub(w) {
  const cDirs = [];
  let i = 1;
  while (i < w.length && w[i].startsWith("-")) {
    if (w[i] === "-C") cDirs.push(w[i + 1]);
    if (w[i] === "-C" || w[i] === "-c" || w[i] === "--git-dir" || w[i] === "--work-tree") i += 2;
    else i += 1;
  }
  return { sub: w[i], cDirs };
}

const TARGETS = {
  commit: (w) => w[0] === "git" && gitSub(w).sub === "commit",
  "issue-create": (w) => w[0] === "gh" && w.includes("issue") && w[w.indexOf("issue") + 1] === "create",
  "pr-merge": (w) => w[0] === "gh" && w.includes("pr") && w[w.indexOf("pr") + 1] === "merge",
};

function resolveDir(base, p) {
  if (p === undefined || /[$`*?]/.test(p)) return null;
  let q = p;
  if (q === "~" || q.startsWith("~/")) q = homedir() + q.slice(1);
  return resolve(base, toNativePath(q));
}

/**
 * Follows `cd` up to the first segment that runs the target command.
 * known is false when a cd target holds a variable or glob, so the caller can fall back.
 */
export function effectiveDir(command, startDir, kind) {
  const isTarget = TARGETS[kind];
  let dir = startDir;
  let known = true;
  for (const seg of segments(command)) {
    const w = words(seg);
    if (!w.length) continue;
    if (isTarget && isTarget(w)) {
      if (w[0] === "git") {
        for (const c of gitSub(w).cDirs) {
          const r = resolveDir(dir, c);
          if (r === null) return { dir, known: false };
          dir = r;
        }
      }
      return { dir, known };
    }
    if (w[0] === "cd" || w[0] === "pushd") {
      const r = w[1] === undefined ? homedir() : resolveDir(dir, w[1]);
      if (r === null) known = false;
      else dir = r;
    }
  }
  return { dir, known };
}

/** toplevel, whether it is a linked worktree, and its .claude/comm/.session-name. Empty strings when not a repo. */
export function repoInfo(dir) {
  const git = (...a) =>
    execFileSync("git", ["-C", dir, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  try {
    const toplevel = git("rev-parse", "--show-toplevel");
    const norm = (p) => resolve(p).toLowerCase();
    const linked =
      norm(git("rev-parse", "--path-format=absolute", "--git-dir")) !==
      norm(git("rev-parse", "--path-format=absolute", "--git-common-dir"));
    let sessionName = "";
    try {
      sessionName = readFileSync(join(toplevel, ".claude", "comm", ".session-name"), "utf8").trim();
    } catch {}
    return { toplevel, linked, sessionName };
  } catch {
    return { toplevel: "", linked: false, sessionName: "" };
  }
}

export function hookContext(input, kind, fallbackDir) {
  const command = String(input?.tool_input?.command ?? "");
  const start = input?.cwd ? toNativePath(String(input.cwd)) : fallbackDir;
  const { dir, known } = effectiveDir(command, start, kind);
  return { agent: input?.agent_id ? String(input.agent_id) : "", known, dir, ...repoInfo(dir) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let input = {};
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
  } catch {}
  const c = hookContext(input, process.argv[2], process.argv[3] || process.cwd());
  // \x1f, not a tab: bash `read` collapses runs of whitespace separators, which would shift an empty agent field.
  const clean = (s) => String(s).replace(/[\x1f\n]/g, " ");
  process.stdout.write(
    [c.agent, c.known ? "1" : "0", c.dir, c.toplevel, c.linked ? "1" : "0", c.sessionName].map(clean).join("\x1f") + "\n",
  );
}
