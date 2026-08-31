// @vitest-environment node
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  MAX_PROJECT_PATH_LENGTH,
  claudeExecutableNames,
  claudeSearchDirs,
  findClaudeExecutable,
  normalizeProjectPath,
  planLaunch,
  posixLauncherScript,
} from "../src/main/claudeLauncher";

/*
 * Claude Code launcher (#1211).
 *
 * This module turns a string someone typed into a Settings field into a
 * process launch, so the suite is written around the two things that would
 * actually hurt: a path that escapes into a command, and a launch that looks
 * like it worked while pointing somewhere else. The OS branches are here for a
 * duller reason — CI runs on one platform and ships all three, so the two the
 * runner is not is otherwise never executed at all.
 */

const WIN = "win32" as NodeJS.Platform;
const MAC = "darwin" as NodeJS.Platform;
const LINUX = "linux" as NodeJS.Platform;

describe("normalizeProjectPath", () => {
  it("keeps an absolute path", () => {
    // Posix and Windows shapes both, since `isAbsolute` answers per platform
    // and only one of them is true wherever this test happens to run.
    const candidates = ["/home/u/life-editor", "C:\\Users\\u\\life-editor"];
    expect(candidates.map(normalizeProjectPath).filter(Boolean)).not.toEqual(
      [],
    );
  });

  it("rejects anything that is not a non-empty string", () => {
    for (const value of [undefined, null, 42, {}, [], "", "   "]) {
      expect(normalizeProjectPath(value)).toBeNull();
    }
  });

  it("rejects a relative path", () => {
    // Would resolve against whatever cwd the main process happens to have —
    // a launch somewhere the user never named.
    expect(normalizeProjectPath("life-editor")).toBeNull();
    expect(normalizeProjectPath("../life-editor")).toBeNull();
  });

  it("rejects control characters", () => {
    // The one that matters: a newline would end the `cd` line of the POSIX
    // launcher script and start a second command on the next one.
    expect(normalizeProjectPath("/home/u\nrm -rf /")).toBeNull();
    expect(normalizeProjectPath("/home/u\u0000/x")).toBeNull();
    expect(normalizeProjectPath("/home/u\u007f/x")).toBeNull();
  });

  it("rejects a path longer than the cap", () => {
    const long = `/${"a".repeat(MAX_PROJECT_PATH_LENGTH)}`;
    expect(normalizeProjectPath(long)).toBeNull();
  });
});

describe("posixLauncherScript", () => {
  it("quotes the folder so its contents cannot become a command", () => {
    // Single quotes are the only total escape in sh: the shell reads nothing
    // inside them, so spaces, $, ; and backticks are all just characters.
    const script = posixLauncherScript("/home/u/my repo; rm -rf ~");
    expect(script).toContain("cd -- '/home/u/my repo; rm -rf ~'");
  });

  it("escapes an embedded single quote instead of closing on it", () => {
    // Close, escape one literal quote, reopen — the one sequence that keeps
    // the `'...'` wrapper intact for every possible string.
    expect(posixLauncherScript("/home/u/it's")).toContain(
      "cd -- '/home/u/it'\\''s'",
    );
  });

  it("hands the window to claude rather than leaving a shell behind", () => {
    const script = posixLauncherScript("/home/u/x");
    expect(script.startsWith("#!/bin/sh\n")).toBe(true);
    expect(script).toContain("exec claude");
  });
});

describe("planLaunch", () => {
  const scriptPath = "/tmp/life-editor-claude.command";

  it("carries the folder as cwd on win32, never in the arguments", () => {
    const plan = planLaunch(WIN, "C:\\Users\\u\\life-editor", scriptPath, {});
    expect(plan.cwd).toBe("C:\\Users\\u\\life-editor");
    expect(plan.args.join(" ")).not.toContain("life-editor");
    expect(plan.script).toBeUndefined();
  });

  it("spawns cmd.exe with start's empty title argument on win32", () => {
    // Without the "" the next token is read as the window title and the
    // command never runs — a launch that silently opens an empty console.
    const plan = planLaunch(WIN, "C:\\x", scriptPath, {});
    expect(plan.command).toBe("cmd.exe");
    expect(plan.args).toEqual(["/c", "start", "", "cmd.exe", "/k", "claude"]);
  });

  it("routes the folder through a script on darwin", () => {
    // `open` hands off to LaunchServices, so Terminal.app ignores our cwd —
    // the folder has to be inside the thing Terminal runs.
    const plan = planLaunch(MAC, "/Users/u/life-editor", scriptPath, {});
    expect(plan.command).toBe("open");
    expect(plan.args).toEqual(["-a", "Terminal", scriptPath]);
    expect(plan.script).toContain("cd -- '/Users/u/life-editor'");
  });

  it("prefers $TERMINAL and falls back to x-terminal-emulator on linux", () => {
    expect(planLaunch(LINUX, "/home/u/x", scriptPath, {}).command).toBe(
      "x-terminal-emulator",
    );
    expect(
      planLaunch(LINUX, "/home/u/x", scriptPath, { TERMINAL: "kitty" }).command,
    ).toBe("kitty");
  });

  it("keeps the folder out of the argument list on linux too", () => {
    const plan = planLaunch(LINUX, "/home/u/life-editor", scriptPath, {});
    expect(plan.args).toEqual(["-e", "claude"]);
    expect(plan.cwd).toBe("/home/u/life-editor");
  });
});

describe("claudeSearchDirs", () => {
  it("splits PATH with the platform's separator", () => {
    expect(
      claudeSearchDirs(WIN, { PATH: "C:\\a;C:\\b" }, "C:\\Users\\u"),
    ).toEqual(["C:\\a", "C:\\b"]);
  });

  it("adds the install dirs a GUI launch's PATH is missing off Windows", () => {
    // Electron started from the dock / start menu never runs a login shell, so
    // PATH here is the OS default. Scanning only it would report "not
    // installed" on a machine where a Terminal finds claude instantly.
    const dirs = claudeSearchDirs(MAC, { PATH: "/usr/bin" }, "/Users/u");
    expect(dirs).toContain("/usr/bin");
    expect(dirs).toContain("/opt/homebrew/bin");
    expect(dirs.some((d) => d.includes(".claude"))).toBe(true);
  });

  it("survives an unset PATH", () => {
    expect(claudeSearchDirs(WIN, {}, "C:\\Users\\u")).toEqual([]);
  });
});

describe("findClaudeExecutable", () => {
  it("looks for the PATHEXT shims on win32 and a bare name elsewhere", () => {
    expect(claudeExecutableNames(WIN)).toContain("claude.cmd");
    expect(claudeExecutableNames(MAC)).toEqual(["claude"]);
  });

  it("returns the first hit", () => {
    // Joined, not concatenated: the separator is the RUNNER's, and CI on
    // Windows would otherwise compare a backslash path against a slash one.
    const hit = join("/b", "claude");
    const found = findClaudeExecutable(["/a", "/b"], MAC, (path) => path === hit);
    expect(found).toBe(hit);
  });

  it("returns null when nothing matches", () => {
    expect(findClaudeExecutable(["/a"], MAC, () => false)).toBeNull();
  });
});
