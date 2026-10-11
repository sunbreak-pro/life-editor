// @vitest-environment node
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  rmdirSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  lstatSync,
  symlinkSync,
  unlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ADDITIONAL_DIRECTORIES_CLAUDE_MD_ENV,
  CLAUDE_WORKSPACE_ENV,
  CUSTOMIZATION_LIMITS,
  WRITE_BACK_RULE,
  isSafeSkillSlug,
  memoryMarkdown,
  neutralizeImports,
  planLaunch,
  resolveInside,
  sanitizeCustomization,
  skillMarkdown,
  workspaceFiles,
  writeClaudeWorkspace,
  type ClaudeCustomization,
} from "../src/main/claudeLauncher";
import { aiSkillToSkillMarkdown } from "../../shared/src/services/aiCustomizationMapper";
import * as limits from "../../shared/src/services/aiCustomizationLimits";

/*
 * Claude customization folder (#2120). Two promises are pinned:
 *
 * 1. What the user wrote reaches Claude Code only as FILE CONTENT in the
 *    app's own folder — never as a command-line argument, never as a path
 *    outside that folder, and never in the user's project.
 * 2. The launch on each OS carries `--add-dir <that folder>` and the env var
 *    without which Claude Code ignores the folder's CLAUDE.md.
 */

const WIN = "win32" as NodeJS.Platform;
const MAC = "darwin" as NodeJS.Platform;
const LINUX = "linux" as NodeJS.Platform;

const WORKSPACE_WIN =
  "C:\\Users\\Jo Doe\\AppData\\Roaming\\life-editor\\claude-workspace";
const WORKSPACE_POSIX =
  "/Users/jo/Library/Application Support/life-editor/claude-workspace";
const SCRIPT = "/tmp/life-editor-claude.command";
/** A rules body that would be a command if it ever reached a shell. */
const HOSTILE = `"; rm -rf ~ & del /q C:\\ \`whoami\` $(id) %PATH%`;

const sample = (
  over: Partial<ClaudeCustomization> = {},
): ClaudeCustomization => ({
  rules: `# Rules\n\n${HOSTILE}`,
  memories: ["likes tea", "two\nlines"],
  skills: [
    {
      slug: "weekly-review",
      description: "Run on Fridays: plan",
      body: "# Steps\n",
    },
  ],
  ...over,
});

describe("planLaunch adds the workspace (#2120)", () => {
  it("win32: --add-dir names the folder through an env var, not its text", () => {
    const plan = planLaunch(
      WIN,
      "C:\\Users\\u\\repo",
      SCRIPT,
      { PATH: "x" },
      WORKSPACE_WIN,
    );
    expect(plan.args).toEqual([
      "/c",
      "start",
      '""',
      '"%ComSpec%"',
      "/k",
      `claude --add-dir "%${CLAUDE_WORKSPACE_ENV}%"`,
    ]);
    // Quoting is ours (the argv above IS the command line), because Node's
    // MSVCRT-style escaping of `"` is not what cmd.exe reads.
    expect(plan.verbatimArguments).toBe(true);
    expect(plan.cwd).toBe("C:\\Users\\u\\repo");
    expect(plan.env).toMatchObject({
      PATH: "x",
      [ADDITIONAL_DIRECTORIES_CLAUDE_MD_ENV]: "1",
      [CLAUDE_WORKSPACE_ENV]: WORKSPACE_WIN,
    });
    // Neither the project folder nor the workspace path is on the line.
    const line = plan.args.join(" ");
    expect(line).not.toContain("repo");
    expect(line).not.toContain("Jo Doe");
  });

  it("darwin: the script exports the switch and passes the quoted folder", () => {
    const plan = planLaunch(MAC, "/Users/u/repo", SCRIPT, {}, WORKSPACE_POSIX);
    expect(plan.args).toEqual(["-a", "Terminal", SCRIPT]);
    expect(plan.script).toContain(
      `export ${ADDITIONAL_DIRECTORIES_CLAUDE_MD_ENV}=1`,
    );
    expect(plan.script).toContain(`exec claude --add-dir '${WORKSPACE_POSIX}'`);
    // Terminal.app does not inherit spawn's env — the script is the only place.
    expect(plan.script!.indexOf("export")).toBeLessThan(
      plan.script!.indexOf("exec claude"),
    );
  });

  it("linux: runs the same script as darwin", () => {
    const plan = planLaunch(LINUX, "/home/u/repo", SCRIPT, {}, WORKSPACE_POSIX);
    expect(plan.args).toEqual(["-e", SCRIPT]);
    expect(plan.script).toContain(`exec claude --add-dir '${WORKSPACE_POSIX}'`);
    expect(plan.script).toContain(
      `export ${ADDITIONAL_DIRECTORIES_CLAUDE_MD_ENV}=1`,
    );
    expect(plan.verbatimArguments).toBeFalsy();
  });

  it("never puts the user's content in argv or the script on any OS", () => {
    for (const platform of [WIN, MAC, LINUX]) {
      const plan = planLaunch(
        platform,
        "/home/u/repo",
        SCRIPT,
        {},
        WORKSPACE_POSIX,
      );
      const text = [plan.command, ...plan.args, plan.script ?? ""].join("\n");
      expect(text).not.toContain("rm -rf ~");
      expect(text).not.toContain("likes tea");
    }
  });
});

describe("sanitizeCustomization", () => {
  it("keeps a well-formed payload", () => {
    expect(sanitizeCustomization(sample())).toEqual(sample());
  });

  it("refuses a payload of the wrong shape", () => {
    for (const raw of [
      undefined,
      null,
      "x",
      1,
      [],
      { rules: 1, memories: [], skills: [] },
      { rules: "", memories: "x", skills: [] },
    ]) {
      expect(sanitizeCustomization(raw)).toBeNull();
    }
  });

  it("drops a skill whose name could leave the skills folder", () => {
    const clean = sanitizeCustomization(
      sample({
        skills: [
          { slug: "../escape", description: "d", body: "" },
          { slug: "a/b", description: "d", body: "" },
          { slug: "..", description: "d", body: "" },
          { slug: "C:\\x", description: "d", body: "" },
          { slug: "con", description: "d", body: "" },
          { slug: "ok-one", description: "d", body: "" },
        ],
      }),
    );
    expect(clean?.skills.map((s) => s.slug)).toEqual(["ok-one"]);
  });

  it("drops oversized and duplicate rows, keeps the rest", () => {
    const clean = sanitizeCustomization(
      sample({
        memories: ["ok", " ", "x".repeat(CUSTOMIZATION_LIMITS.memoryBody + 1)],
        skills: [
          { slug: "dup", description: "first", body: "" },
          { slug: "dup", description: "second", body: "" },
          { slug: "multi", description: "a\nb", body: "" },
        ],
      }),
    );
    expect(clean?.memories).toEqual(["ok"]);
    expect(clean?.skills).toEqual([
      { slug: "dup", description: "first", body: "" },
    ]);
  });

  it("refuses an oversized string without walking it", () => {
    const huge = "x".repeat(CUSTOMIZATION_LIMITS.ruleBody * 2 + 1);
    expect(sanitizeCustomization(sample({ rules: huge }))?.rules).toBe("");
    // Surrogate pairs count once, like Postgres char_length.
    const emoji = "😀".repeat(CUSTOMIZATION_LIMITS.memoryBody);
    expect(sanitizeCustomization(sample({ memories: [emoji] }))?.memories).toEqual([
      emoji,
    ]);
    expect(
      sanitizeCustomization(sample({ memories: [emoji + "x"] }))?.memories,
    ).toEqual([]);
  });

  it("refuses an unbounded number of rows", () => {
    expect(
      sanitizeCustomization(
        sample({
          memories: Array(CUSTOMIZATION_LIMITS.memories + 1).fill("m"),
        }),
      ),
    ).toBeNull();
  });
});

describe("the files", () => {
  it("lays out CLAUDE.md, the two rules and one SKILL.md per skill", () => {
    expect(workspaceFiles(sample()).map((f) => f.relPath)).toEqual([
      ".claude/CLAUDE.md",
      ".claude/rules/memory.md",
      ".claude/rules/life-editor.md",
      ".claude/skills/weekly-review/SKILL.md",
    ]);
  });

  it("writes the rules verbatim and the memories as a list", () => {
    const files = workspaceFiles(sample());
    expect(files[0].content).toBe(sample().rules);
    expect(memoryMarkdown(["likes tea", "two\nlines"])).toContain(
      "- likes tea\n- two\n  lines",
    );
  });

  it("keeps `@path` in a memory from importing a file", () => {
    const md = memoryMarkdown(["see @~/.ssh/id_rsa"]);
    expect(md).not.toMatch(/@~/);
    expect(md).toContain(neutralizeImports("@~/.ssh/id_rsa"));
  });

  it("tells Claude to write back through the MCP tools", () => {
    for (const tool of [
      "add_ai_memory",
      "create_ai_skill",
      "update_ai_skill",
      "list_ai_memories",
    ]) {
      expect(WRITE_BACK_RULE).toContain(tool);
    }
  });

  it("writes SKILL.md exactly as shared does", () => {
    const skill = {
      slug: "123",
      description: 'say: "hi" # not a comment',
      body: "a\r\nb\n",
    };
    expect(skillMarkdown(skill)).toBe(aiSkillToSkillMarkdown(skill));
  });

  it("uses the 0037 limits shared uses", () => {
    expect(CUSTOMIZATION_LIMITS.ruleBody).toBe(limits.AI_RULE_BODY_MAX_CHARS);
    expect(CUSTOMIZATION_LIMITS.memoryBody).toBe(
      limits.AI_MEMORY_BODY_MAX_CHARS,
    );
    expect(CUSTOMIZATION_LIMITS.skillSlug).toBe(limits.AI_SKILL_SLUG_MAX_CHARS);
    expect(CUSTOMIZATION_LIMITS.skillDescription).toBe(
      limits.AI_SKILL_DESCRIPTION_MAX_CHARS,
    );
    expect(CUSTOMIZATION_LIMITS.skillBody).toBe(limits.AI_SKILL_BODY_MAX_CHARS);
    for (const slug of [
      "ok",
      "a-b-1",
      "-x",
      "x-",
      "a--b",
      "A",
      "con",
      "lpt9",
      "x".repeat(64),
      "x".repeat(65),
      "../a",
    ]) {
      expect(isSafeSkillSlug(slug)).toBe(
        limits.aiSkillSlugIssue(slug) === null,
      );
    }
  });
});

describe("resolveInside", () => {
  it("refuses a path that leaves the root", () => {
    expect(() => resolveInside("/w", "../x")).toThrow();
    expect(() => resolveInside("/w", ".claude/skills/../../../x")).toThrow();
    expect(() => resolveInside("/w", ".")).toThrow();
    expect(resolveInside("/w", ".claude/CLAUDE.md")).toBe(
      resolve("/w", ".claude", "CLAUDE.md"),
    );
  });
});

describe("writeClaudeWorkspace", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "le-claude-ws-"));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const fs = {
    lstatSync,
    readdirSync: (path: string) => readdirSync(path),
    unlinkSync,
    rmdirSync,
    mkdirSync,
    writeFileSync,
  };

  /** A folder outside the workspace that a planted link points at. */
  function victim(): string {
    const dir = mkdtempSync(join(tmpdir(), "le-claude-victim-"));
    writeFileSync(join(dir, "precious.txt"), "keep me");
    return dir;
  }

  it("removes a planted link without touching its target", () => {
    // Claude Code can write in the workspace (it is an --add-dir). A junction
    // there must not turn the next rebuild into a delete of its target.
    const target = victim();
    try {
      writeClaudeWorkspace(root, sample(), fs);
      symlinkSync(target, join(root, ".claude", "skills", "x"), "junction");
      writeClaudeWorkspace(root, sample(), fs);
      expect(readFileSync(join(target, "precious.txt"), "utf8")).toBe(
        "keep me",
      );
      expect(existsSync(join(root, ".claude", "skills", "x"))).toBe(false);
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  });

  it("refuses a .claude that is itself a link, leaving the target whole", () => {
    const target = victim();
    try {
      symlinkSync(target, join(root, ".claude"), "junction");
      writeClaudeWorkspace(root, sample(), fs);
      expect(readFileSync(join(target, "precious.txt"), "utf8")).toBe(
        "keep me",
      );
      // The link itself is gone and a real folder is in its place.
      expect(lstatSync(join(root, ".claude")).isSymbolicLink()).toBe(false);
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  });

  it("refuses a workspace that is itself a link", () => {
    const target = victim();
    const linked = join(root, "linked");
    try {
      symlinkSync(target, linked, "junction");
      expect(() => writeClaudeWorkspace(linked, sample(), fs)).toThrow(
        /linked Claude workspace/,
      );
      expect(readdirSync(target)).toEqual(["precious.txt"]);
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  });

  it("writes the files under the root", () => {
    writeClaudeWorkspace(root, sample(), fs);
    expect(readFileSync(join(root, ".claude", "CLAUDE.md"), "utf8")).toBe(
      sample().rules,
    );
    expect(
      readFileSync(
        join(root, ".claude", "skills", "weekly-review", "SKILL.md"),
        "utf8",
      ),
    ).toContain('name: "weekly-review"');
  });

  it("rebuilds from scratch, so a skill deleted in the app disappears", () => {
    writeClaudeWorkspace(root, sample(), fs);
    writeClaudeWorkspace(root, sample({ skills: [] }), fs);
    expect(readdirSync(join(root, ".claude"))).not.toContain("skills");
  });

  it("leaves anything outside .claude alone", () => {
    writeFileSync(join(root, "keep.txt"), "x");
    writeClaudeWorkspace(root, sample(), fs);
    expect(existsSync(join(root, "keep.txt"))).toBe(true);
  });
});
