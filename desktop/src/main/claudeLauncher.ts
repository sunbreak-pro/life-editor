/*
 * Claude Code launcher (#1211).
 *
 * The renderer hands this module a folder and it opens an OS terminal running
 * `claude` there. That makes it the only path in the app where a string typed
 * into a text field reaches a process launch, so everything here is built
 * around one rule: the folder never becomes part of a command line. It travels
 * as `cwd`, or — where the platform makes that impossible — inside a file this
 * module writes, quoted for the shell that will read it.
 *
 * Split out of index.ts rather than added to it because index.ts imports
 * `electron` at module scope: a suite that wants to check the win32 / darwin
 * branch or the argument validation would have to boot Electron to reach them.
 * Nothing below imports electron, so `desktop/tests` loads it in plain Node —
 * which is the only reason the OS branching has tests at all.
 */
import {
  dirname,
  isAbsolute,
  join,
  normalize,
  relative,
  resolve,
  win32,
} from "node:path";

/**
 * Why a code and not a message: the renderer owns copy (§6.4), so main names
 * the failure and the Settings card decides how to say it in en / ja.
 */
export type ClaudeLaunchError =
  | "no-project-path"
  | "invalid-project-path"
  | "claude-not-found"
  | "prepare-failed"
  | "spawn-failed";

/**
 * Longest folder path accepted. Well past any real one — this is not a
 * correctness bound but a stop on a renderer handing over a megabyte of text
 * to be written into a file.
 */
export const MAX_PROJECT_PATH_LENGTH = 4096;

/** C0 controls + DEL. Written as escapes so the source stays greppable. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/**
 * Validate the folder the renderer sent, or return null.
 *
 * Absolute-only and control-character-free are both load-bearing rather than
 * tidiness: a relative path would resolve against whatever cwd the main
 * process happens to have, and a newline inside the string would end the `cd`
 * line of the POSIX launcher script below and start a second command. No legal
 * folder name contains one, so these are rejected rather than stripped —
 * silently "fixing" a path would launch somewhere the user did not name.
 */
export function normalizeProjectPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > MAX_PROJECT_PATH_LENGTH) return null;
  if (CONTROL_CHARS.test(trimmed)) return null;
  if (!isAbsolute(trimmed)) return null;
  return normalize(trimmed);
}

/**
 * POSIX single-quoting: close the quote, escape one literal `'`, reopen. Total
 * over every possible string, which is the point — the caller must not have to
 * reason about what is in the path.
 */
function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

/**
 * The script Terminal.app runs. `cd --` so a folder starting with `-` is read
 * as a path and not a flag; `exec` so the window belongs to `claude` itself
 * and closing it does not leave a stray shell behind.
 *
 * #2120: Terminal.app starts with its own environment, so the switch that
 * makes Claude Code read the workspace's CLAUDE.md is exported HERE — an env
 * on the `open` spawn would never reach it.
 */
export function posixLauncherScript(
  projectPath: string,
  workspaceDir: string,
): string {
  return [
    "#!/bin/sh",
    `cd -- ${shellQuote(projectPath)} || exit 1`,
    `export ${ADDITIONAL_DIRECTORIES_CLAUDE_MD_ENV}=1`,
    `exec claude --add-dir ${shellQuote(workspaceDir)}`,
    "",
  ].join("\n");
}

export interface LaunchPlan {
  command: string;
  args: string[];
  cwd: string;
  /** The child's environment: the parent's plus the #2120 variables. */
  env: NodeJS.ProcessEnv;
  /**
   * win32 only: `args` already ARE the command line (spawn's
   * `windowsVerbatimArguments`). Node's own escaping of `"` is the MSVCRT
   * one, which cmd.exe does not read.
   */
  verbatimArguments?: boolean;
  /** When set, write this to the script path (mode 0o700) before spawning. */
  script?: string;
}

/**
 * How each OS opens a terminal running `claude` in `projectPath`.
 *
 * win32 carries the folder as `cwd`, so nothing user-typed appears in `args`
 * at all. darwin cannot: `open` hands the launch to LaunchServices and
 * Terminal.app starts with its own environment, so a `cwd` here is dropped on
 * the floor. There the folder has to travel inside the thing Terminal runs,
 * which is why that branch asks for a script instead of arguments; linux
 * shares the script since #2120 (see below).
 */
export function planLaunch(
  platform: NodeJS.Platform,
  projectPath: string,
  scriptPath: string,
  env: NodeJS.ProcessEnv,
  workspaceDir: string,
): LaunchPlan {
  // #2120: `--add-dir <workspace>` + the switch that makes Claude Code read
  // that folder's CLAUDE.md and rules. The workspace path is the app's own
  // (userData), never something the user typed.
  const childEnv: NodeJS.ProcessEnv = {
    ...env,
    [ADDITIONAL_DIRECTORIES_CLAUDE_MD_ENV]: "1",
    [CLAUDE_WORKSPACE_ENV]: workspaceDir,
  };
  if (platform === "win32") {
    // `start` is a cmd builtin, so cmd.exe has to be the process we spawn. The
    // empty "" is start's title argument — without it `start` reads the next
    // token as a window title and never runs it.
    //
    // The workspace path can hold spaces (a user name), so it needs quotes,
    // and cmd.exe only reads `"`-quoting it is handed verbatim. Rather than
    // quote a path for cmd by hand, the line names an env var and cmd expands
    // it inside the quotes: the only text on the command line is ours.
    //
    // The working folder is the user's project, and Windows looks for a bare
    // program name there BEFORE PATH — a cloned repo holding `cmd.exe` or
    // `claude.cmd` would run on launch. So cmd.exe is spawned by absolute
    // path (both hops: Node's and start's, via %ComSpec%), and
    // NoDefaultCurrentDirectoryInExePath makes cmd skip the working folder
    // when it resolves `claude`. Checked on Windows 11 with a decoy
    // claude.cmd in the working folder and a workspace path holding spaces
    // and `&`.
    const comspec =
      env["ComSpec"] ||
      win32.join(env["SystemRoot"] || "C:\\Windows", "System32", "cmd.exe");
    return {
      command: comspec,
      args: [
        "/c",
        "start",
        '""',
        '"%ComSpec%"',
        "/k",
        `claude --add-dir "%${CLAUDE_WORKSPACE_ENV}%"`,
      ],
      cwd: projectPath,
      env: {
        ...childEnv,
        ComSpec: comspec,
        NoDefaultCurrentDirectoryInExePath: "1",
      },
      verbatimArguments: true,
    };
  }
  // darwin and linux run the same script: `open` hands the launch to
  // LaunchServices (no cwd, no env reach Terminal.app), and terminal
  // emulators disagree on whether `-e` takes one string or an argv — a
  // single script path is the one thing every one of them runs as given.
  const script = posixLauncherScript(projectPath, workspaceDir);
  if (platform === "darwin") {
    return {
      command: "open",
      args: ["-a", "Terminal", scriptPath],
      cwd: projectPath,
      env: childEnv,
      script,
    };
  }
  // Everything else gets the freedesktop convention: $TERMINAL is what the
  // user's own session sets, x-terminal-emulator the alternative most distros
  // still provide.
  return {
    command: env["TERMINAL"] || "x-terminal-emulator",
    args: ["-e", scriptPath],
    cwd: projectPath,
    env: childEnv,
    script,
  };
}

/**
 * Where to look for the `claude` binary.
 *
 * PATH alone is not enough off Windows: a GUI-launched Electron app never goes
 * through a login shell, so its PATH is the OS default and misses the dirs the
 * npm / homebrew / native installers use. Scanning only PATH would report "not
 * installed" on a machine where a Terminal finds `claude` instantly — a false
 * refusal, which is worse than the missing-binary error it imitates.
 */
export function claudeSearchDirs(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
  home: string,
): string[] {
  const separator = platform === "win32" ? ";" : ":";
  const fromPath = (env["PATH"] ?? "").split(separator).filter(Boolean);
  if (platform === "win32") return fromPath;
  return [
    ...fromPath,
    join(home, ".local", "bin"),
    join(home, ".claude", "local"),
    "/usr/local/bin",
    "/opt/homebrew/bin",
  ];
}

/**
 * Windows resolves a bare `claude` through PATHEXT, so the shim can be any of
 * these; POSIX installs one extension-less file.
 */
export function claudeExecutableNames(platform: NodeJS.Platform): string[] {
  return platform === "win32"
    ? ["claude.cmd", "claude.exe", "claude.bat"]
    : ["claude"];
}

export function findClaudeExecutable(
  dirs: string[],
  platform: NodeJS.Platform,
  exists: (path: string) => boolean,
): string | null {
  for (const dir of dirs) {
    for (const name of claudeExecutableNames(platform)) {
      const candidate = join(dir, name);
      if (exists(candidate)) return candidate;
    }
  }
  return null;
}
// ---------------------------------------------------------------------------
// Claude customization folder (#2120, Epic #2117 R3)
// ---------------------------------------------------------------------------
//
// What the user keeps for Claude in Life Editor — rules, memories, Claude
// skills (#2118) — reaches Claude Code as FILES in a folder only this app
// writes, added to the session with `--add-dir` (D-20261006-main-1):
//
//   <userData>/claude-workspace/.claude/CLAUDE.md                 rules
//   <userData>/claude-workspace/.claude/rules/memory.md           memories
//   <userData>/claude-workspace/.claude/rules/life-editor.md      how to write back
//   <userData>/claude-workspace/.claude/skills/<slug>/SKILL.md    one per skill
//
// Memories get their own file under rules/ rather than being appended to
// CLAUDE.md: CLAUDE.md stays exactly what the user wrote, and Claude Code
// reads `.claude/rules/*.md` of an added directory under the same switch.
//
// Claude Code reads an added directory's CLAUDE.md and rules only when
// CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1 is in its environment; the
// skills under `.claude/skills/` are read either way.
//
// The DB is the source of truth and the folder is disposable: `.claude/` is
// deleted and rebuilt on every launch that carries the content, so a skill
// deleted in the app does not linger as a file. The user's project folder is
// never written to.
//
// The content arrives from the renderer over the existing `claude:launch`
// channel (no new IPC). It is text that goes INTO files, never onto a command
// line: the only thing the launch adds to argv is this folder's own path,
// which the app decides.

/** Folder name under the app's userData directory. */
export const CLAUDE_WORKSPACE_DIRNAME = "claude-workspace";

/** Set for the launched Claude Code so it reads the added folder's CLAUDE.md. */
export const ADDITIONAL_DIRECTORIES_CLAUDE_MD_ENV =
  "CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD";

/**
 * Carries the workspace path to the win32 command line by NAME, so the path
 * itself never has to be quoted for cmd.exe by hand (see planLaunch).
 */
export const CLAUDE_WORKSPACE_ENV = "LIFE_EDITOR_CLAUDE_DIR";

/**
 * The 0037 limits (shared/src/services/aiCustomizationLimits.ts — the main
 * process does not import shared/, so the numbers are repeated and
 * desktop/tests pins them to shared's). Counted in code points, like the DB.
 */
export const CUSTOMIZATION_LIMITS = {
  ruleBody: 40_000,
  memoryBody: 1_000,
  skillSlug: 64,
  skillDescription: 1_024,
  skillBody: 40_000,
  /** Not a DB limit: a stop on a renderer asking for unbounded file writes. */
  memories: 2_000,
  skills: 500,
} as const;

const SLUG_SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/;
const LINE_BREAK = /[\r\n]/;

/**
 * True when `text` has more than `max` code points (Postgres `char_length`).
 * Decided from `.length` first — a code point is 1 or 2 UTF-16 units — so a
 * renderer handing over a huge string is refused without walking it, and the
 * walk that remains never builds an array.
 */
function exceeds(text: string, max: number): boolean {
  if (text.length <= max) return false;
  if (text.length > max * 2) return true;
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    // A high surrogate followed by a low one is one code point.
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) i++;
    }
    if (++count > max) return true;
  }
  return false;
}

export interface ClaudeCustomizationSkill {
  slug: string;
  description: string;
  body: string;
}

export interface ClaudeCustomization {
  rules: string;
  memories: string[];
  skills: ClaudeCustomizationSkill[];
}

/**
 * The slug check that keeps a skill's folder inside `.claude/skills/`. A
 * kebab-case name cannot hold `/`, `\`, `.` or `..`, so this regex alone is
 * what forbids a path out of the folder; `resolveInside` below re-checks the
 * joined path anyway.
 */
export function isSafeSkillSlug(slug: unknown): slug is string {
  return (
    typeof slug === "string" &&
    !exceeds(slug, CUSTOMIZATION_LIMITS.skillSlug) &&
    SLUG_SHAPE.test(slug) &&
    !WINDOWS_RESERVED.test(slug)
  );
}

/**
 * Validate what the renderer sent, or return null for "nothing usable".
 *
 * Whole-payload type errors (not an object, wrong field types) return null and
 * the launch leaves the folder as it was. A single skill or memory that breaks
 * a limit is dropped and the rest is kept — the DB CHECKs already refuse those
 * rows, so one reaching here means a renderer bug, and one bad row should not
 * cost the user every other skill. Duplicate slugs keep the first.
 */
export function sanitizeCustomization(
  raw: unknown,
): ClaudeCustomization | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { rules, memories, skills } = raw as Record<string, unknown>;
  if (typeof rules !== "string") return null;
  if (!Array.isArray(memories) || !Array.isArray(skills)) return null;
  if (memories.length > CUSTOMIZATION_LIMITS.memories) return null;
  if (skills.length > CUSTOMIZATION_LIMITS.skills) return null;

  const seen = new Set<string>();
  const cleanSkills: ClaudeCustomizationSkill[] = [];
  for (const skill of skills) {
    if (typeof skill !== "object" || skill === null) continue;
    const { slug, description, body } = skill as Record<string, unknown>;
    if (!isSafeSkillSlug(slug) || seen.has(slug)) continue;
    if (typeof description !== "string" || typeof body !== "string") continue;
    if (description.trim() === "" || LINE_BREAK.test(description)) continue;
    if (exceeds(description, CUSTOMIZATION_LIMITS.skillDescription)) continue;
    if (exceeds(body, CUSTOMIZATION_LIMITS.skillBody)) continue;
    seen.add(slug);
    cleanSkills.push({ slug, description, body });
  }

  return {
    rules: exceeds(rules, CUSTOMIZATION_LIMITS.ruleBody) ? "" : rules,
    memories: memories.filter(
      (m): m is string =>
        typeof m === "string" &&
        m.trim() !== "" &&
        !exceeds(m, CUSTOMIZATION_LIMITS.memoryBody),
    ),
    skills: cleanSkills,
  };
}

/**
 * SKILL.md — the same text shared's `aiSkillToSkillMarkdown` writes (#2118),
 * pinned to it by desktop/tests. Name and description are JSON strings, which
 * are valid YAML double-quoted scalars: a description holding `: ` or `#`
 * cannot change how the frontmatter parses.
 */
export function skillMarkdown(skill: ClaudeCustomizationSkill): string {
  const body = skill.body.replace(/\r\n/g, "\n");
  const lines = [
    "---",
    `name: ${JSON.stringify(skill.slug)}`,
    `description: ${JSON.stringify(skill.description)}`,
    "---",
    "",
  ];
  if (body !== "") lines.push(body.endsWith("\n") ? body.slice(0, -1) : body);
  return `${lines.join("\n")}\n`;
}

/**
 * Claude Code reads `@path` in a CLAUDE.md or rules file as "import that
 * file". A memory is a short note, and Claude itself can add one through
 * MCP (#2121) — from any device — so `@~/.ssh/id_rsa` in one must stay text.
 * A zero-width space after every `@` keeps it readable and inert.
 */
export function neutralizeImports(text: string): string {
  return text.replace(/@/g, "@​");
}

/** Memories as a Markdown list; a multi-line item keeps its lines indented. */
export function memoryMarkdown(memories: readonly string[]): string {
  const items = memories.map(
    (m) =>
      `- ${neutralizeImports(m.replace(/\r\n/g, "\n").trim())
        .split("\n")
        .join("\n  ")}`,
  );
  return [
    "# Memory",
    "",
    "Things the user asked you to remember across sessions, kept in Life Editor.",
    "",
    ...(items.length > 0 ? items : ["(none yet)"]),
    "",
  ].join("\n");
}

/**
 * The fixed rule telling Claude how to write back (#2121). The tool names are
 * the MCP server's; `mcp-server/tests` is not involved, so the wording names
 * them plainly and desktop/tests checks they are still in the catalog.
 */
export const WRITE_BACK_RULE = [
  "# Life Editor",
  "",
  "You were started from Life Editor. The rules, memory and skills in this folder",
  "are kept in its database and rewritten every time it launches you, so do not",
  "edit these files — changes made here are lost on the next launch.",
  "",
  "Write back through the life-editor MCP tools instead:",
  "",
  "- To remember something for later sessions, call `add_ai_memory` (one fact per",
  "  call; check `list_ai_memories` first, and fix an old item with `update_ai_memory`).",
  "- To save a reusable procedure as a skill, call `create_ai_skill` (or",
  "  `update_ai_skill`) instead of writing a SKILL.md file.",
  "",
  "What you save this way reaches the user's phone at once and is written out",
  "here the next time Life Editor launches you.",
  "",
].join("\n");

/** One file to write, relative to the workspace folder. */
export interface WorkspaceFile {
  relPath: string;
  content: string;
}

export function workspaceFiles(
  customization: ClaudeCustomization,
): WorkspaceFile[] {
  return [
    { relPath: ".claude/CLAUDE.md", content: customization.rules },
    {
      relPath: ".claude/rules/memory.md",
      content: memoryMarkdown(customization.memories),
    },
    { relPath: ".claude/rules/life-editor.md", content: WRITE_BACK_RULE },
    ...customization.skills.map((skill) => ({
      relPath: `.claude/skills/${skill.slug}/SKILL.md`,
      content: skillMarkdown(skill),
    })),
  ];
}

/**
 * `root` joined with `relPath`, or a throw when the result is not strictly
 * inside `root`. The slug check already makes an escape impossible; this is
 * the second lock, on the path that is actually written.
 */
export function resolveInside(root: string, relPath: string): string {
  const base = resolve(root);
  const target = resolve(base, relPath);
  const rel = relative(base, target);
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`refusing to write outside ${base}: ${relPath}`);
  }
  return target;
}

/** The file-system calls the writer needs — injected so tests can use a tmpdir or a fake. */
export interface WorkspaceFs {
  lstatSync(path: string): {
    isSymbolicLink(): boolean;
    isDirectory(): boolean;
  };
  readdirSync(path: string): string[];
  unlinkSync(path: string): void;
  rmdirSync(path: string): void;
  mkdirSync(path: string, options: { recursive: true }): unknown;
  writeFileSync(
    path: string,
    data: string,
    options: { encoding: "utf8" },
  ): void;
}

function isMissing(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "ENOENT";
}

/**
 * Delete `path` without ever following a link. Claude Code can write inside
 * the workspace (it is an `--add-dir`), so a symlink or a Windows junction
 * planted there must lose only the LINK on the next rebuild — a recursive
 * delete that followed it would empty whatever folder it points at.
 */
export function removeTreeNoFollow(path: string, fs: WorkspaceFs): void {
  let stat;
  try {
    stat = fs.lstatSync(path);
  } catch (error) {
    if (isMissing(error)) return;
    throw error;
  }
  if (stat.isSymbolicLink()) {
    // A directory link (junction / dir symlink) needs rmdir on Windows and
    // unlink elsewhere; neither touches the target.
    try {
      fs.unlinkSync(path);
    } catch {
      fs.rmdirSync(path);
    }
    return;
  }
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(path)) {
      removeTreeNoFollow(join(path, name), fs);
    }
    fs.rmdirSync(path);
    return;
  }
  fs.unlinkSync(path);
}

/**
 * Rebuild `<root>/.claude` from `customization`. Every path is resolved and
 * checked BEFORE anything is deleted, so a refusal leaves the old folder whole.
 */
export function writeClaudeWorkspace(
  root: string,
  customization: ClaudeCustomization,
  fs: WorkspaceFs,
): void {
  // The workspace itself must be a real folder: one swapped for a link would
  // aim the rebuild — and its delete — at the link's target.
  if (fs.lstatSync(root).isSymbolicLink()) {
    throw new Error(`refusing a linked Claude workspace: ${root}`);
  }
  const files = workspaceFiles(customization).map((file) => ({
    path: resolveInside(root, file.relPath),
    content: file.content,
  }));
  removeTreeNoFollow(resolveInside(root, ".claude"), fs);
  for (const file of files) {
    fs.mkdirSync(dirname(file.path), { recursive: true });
    fs.writeFileSync(file.path, file.content, { encoding: "utf8" });
  }
}
