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
import { isAbsolute, join, normalize } from "node:path";

/**
 * Why a code and not a message: the renderer owns copy (§6.4), so main names
 * the failure and the Settings card decides how to say it in en / ja.
 */
export type ClaudeLaunchError =
  | "no-project-path"
  | "invalid-project-path"
  | "claude-not-found"
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
 */
export function posixLauncherScript(projectPath: string): string {
  return [
    "#!/bin/sh",
    `cd -- ${shellQuote(projectPath)} || exit 1`,
    "exec claude",
    "",
  ].join("\n");
}

export interface LaunchPlan {
  command: string;
  args: string[];
  cwd: string;
  /** When set, write this to the script path (mode 0o700) before spawning. */
  script?: string;
}

/**
 * How each OS opens a terminal running `claude` in `projectPath`.
 *
 * win32 and linux carry the folder as `cwd`, so nothing user-typed appears in
 * `args` at all. darwin cannot: `open` hands the launch to LaunchServices and
 * Terminal.app starts with its own environment, so a `cwd` here is dropped on
 * the floor. There the folder has to travel inside the thing Terminal runs,
 * which is why that branch asks for a script instead of arguments.
 */
export function planLaunch(
  platform: NodeJS.Platform,
  projectPath: string,
  scriptPath: string,
  env: NodeJS.ProcessEnv,
): LaunchPlan {
  if (platform === "win32") {
    // `start` is a cmd builtin, so cmd.exe has to be the process we spawn. The
    // empty "" is start's title argument — without it `start` reads the next
    // token as a window title and never runs it.
    return {
      command: "cmd.exe",
      args: ["/c", "start", "", "cmd.exe", "/k", "claude"],
      cwd: projectPath,
    };
  }
  if (platform === "darwin") {
    return {
      command: "open",
      args: ["-a", "Terminal", scriptPath],
      cwd: projectPath,
      script: posixLauncherScript(projectPath),
    };
  }
  // Everything else gets the freedesktop convention: $TERMINAL is what the
  // user's own session sets, x-terminal-emulator the alternative most distros
  // still provide.
  return {
    command: env["TERMINAL"] || "x-terminal-emulator",
    args: ["-e", "claude"],
    cwd: projectPath,
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
