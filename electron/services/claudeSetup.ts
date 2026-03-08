import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { app } from "electron";
import log from "../logger";

export interface ClaudeSetupResult {
  success: boolean;
  message: string;
  claudeInstalled: boolean;
}

const MCP_SERVER_NAME = "life-editor";

function getClaudeDir(): string {
  return path.join(os.homedir(), ".claude");
}

function getClaudeJsonPath(): string {
  return path.join(os.homedir(), ".claude.json");
}

function getGlobalSettingsPath(): string {
  return path.join(getClaudeDir(), "settings.json");
}

function getMcpServerPath(): string {
  const isDev = !app.isPackaged;
  if (isDev) {
    return path.join(process.cwd(), "mcp-server", "dist", "index.js");
  }
  return path.join(app.getAppPath(), "mcp-server", "dist", "index.js");
}

function getDbPath(): string {
  return path.join(app.getPath("userData"), "sonic-flow.db");
}

function getLifeEditorDir(): string {
  return path.join(os.homedir(), "life-editor");
}

function setupLifeEditorDir(): void {
  const lifeEditorDir = getLifeEditorDir();
  const mcpServerPath = getMcpServerPath();
  const dbPath = getDbPath();

  // Create ~/life-editor/ if needed
  if (!fs.existsSync(lifeEditorDir)) {
    fs.mkdirSync(lifeEditorDir, { recursive: true });
    log.info("[ClaudeSetup] Created ~/life-editor/");
  }

  // Create CLAUDE.md only if it doesn't exist (respect user customization)
  const claudeMdPath = path.join(lifeEditorDir, "CLAUDE.md");
  if (!fs.existsSync(claudeMdPath)) {
    const claudeMdContent = `# Life Editor - AI Life Management Assistant

You are a life management assistant with access to the user's tasks, memos, notes, and schedule via MCP tools.

## Available MCP Tools

- search_all: Search across all domains (use this first to find context!)
- list_tasks / get_task / create_task / update_task / delete_task
- get_memo / upsert_memo: Daily memos (YYYY-MM-DD key)
- list_notes / create_note / update_note
- list_schedule: View schedule for a date

## Guidelines

- Always respond in Japanese
- Use search_all before creating to avoid duplicates
- When creating tasks, ask about scheduling if not specified
`;
    fs.writeFileSync(claudeMdPath, claudeMdContent, "utf-8");
    log.info("[ClaudeSetup] Created ~/life-editor/CLAUDE.md");
  }

  // Create/update .mcp.json for project-level MCP registration
  const projectMcpConfig = {
    mcpServers: {
      [MCP_SERVER_NAME]: {
        command: "node",
        args: [mcpServerPath],
        env: { DB_PATH: dbPath },
        type: "stdio",
      },
    },
  };

  const projectMcpPath = path.join(lifeEditorDir, ".mcp.json");
  fs.writeFileSync(
    projectMcpPath,
    JSON.stringify(projectMcpConfig, null, 2),
    "utf-8",
  );
  log.info("[ClaudeSetup] Updated ~/life-editor/.mcp.json");

  // Create/update .claude/settings.json (permissions only, no mcpServers)
  const projectClaudeDir = path.join(lifeEditorDir, ".claude");
  if (!fs.existsSync(projectClaudeDir)) {
    fs.mkdirSync(projectClaudeDir, { recursive: true });
  }

  const projectSettingsPath = path.join(projectClaudeDir, "settings.json");
  let projectSettings: Record<string, unknown> = {};
  if (fs.existsSync(projectSettingsPath)) {
    try {
      projectSettings = JSON.parse(
        fs.readFileSync(projectSettingsPath, "utf-8"),
      );
    } catch {
      projectSettings = {};
    }
  }
  // Remove stale mcpServers from project settings
  delete projectSettings.mcpServers;
  projectSettings.permissions = { allow: ["mcp__life-editor__*"] };
  fs.writeFileSync(
    projectSettingsPath,
    JSON.stringify(projectSettings, null, 2),
    "utf-8",
  );
  log.info(
    "[ClaudeSetup] Updated ~/life-editor/.claude/settings.json (permissions only)",
  );
}

export interface SkillInfo {
  name: string;
  description: string;
  sourcePath: string;
  scope: "global" | "project";
}

export function readClaudeMd(): string {
  const claudeMdPath = path.join(getLifeEditorDir(), "CLAUDE.md");
  if (!fs.existsSync(claudeMdPath)) {
    // Ensure directory + file exist
    setupLifeEditorDir();
  }
  return fs.readFileSync(claudeMdPath, "utf-8");
}

export function writeClaudeMd(content: string): void {
  const lifeEditorDir = getLifeEditorDir();
  if (!fs.existsSync(lifeEditorDir)) {
    fs.mkdirSync(lifeEditorDir, { recursive: true });
  }
  fs.writeFileSync(path.join(lifeEditorDir, "CLAUDE.md"), content, "utf-8");
  log.info("[ClaudeSetup] Updated ~/life-editor/CLAUDE.md");
}

function readDescriptionFromDir(dirPath: string): string {
  for (const filename of ["instructions.md", "README.md"]) {
    const filePath = path.join(dirPath, filename);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      // First non-empty, non-heading line as description
      const lines = content.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          return trimmed.slice(0, 120);
        }
      }
    }
  }
  return "";
}

export function listAvailableSkills(): SkillInfo[] {
  const skills: SkillInfo[] = [];
  const globalDir = path.join(
    os.homedir(),
    "dev/Claude/original-skills-storage/skills/custom/global",
  );
  const projectDir = path.join(
    os.homedir(),
    "dev/Claude/original-skills-storage/skills/custom/projects/notion-timer",
  );

  for (const [dir, scope] of [
    [globalDir, "global"],
    [projectDir, "project"],
  ] as const) {
    if (!fs.existsSync(dir)) continue;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillPath = path.join(dir, entry.name);
      skills.push({
        name: entry.name,
        description: readDescriptionFromDir(skillPath),
        sourcePath: skillPath,
        scope,
      });
    }
  }
  return skills;
}

export function listInstalledSkills(): string[] {
  const skillsDir = path.join(getLifeEditorDir(), ".claude", "skills");
  if (!fs.existsSync(skillsDir)) return [];
  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isSymbolicLink() || e.isDirectory())
    .map((e) => e.name);
}

export function installSkill(sourcePath: string, name: string): void {
  const skillsDir = path.join(getLifeEditorDir(), ".claude", "skills");
  if (!fs.existsSync(skillsDir)) {
    fs.mkdirSync(skillsDir, { recursive: true });
  }
  const targetPath = path.join(skillsDir, name);
  if (fs.existsSync(targetPath)) {
    throw new Error(`Skill "${name}" is already installed`);
  }
  fs.symlinkSync(sourcePath, targetPath);
  log.info(`[ClaudeSetup] Installed skill: ${name}`);
}

export function uninstallSkill(name: string): void {
  const targetPath = path.join(getLifeEditorDir(), ".claude", "skills", name);
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Skill "${name}" is not installed`);
  }
  const stat = fs.lstatSync(targetPath);
  if (!stat.isSymbolicLink()) {
    throw new Error(`Skill "${name}" is not a symlink — refusing to delete`);
  }
  fs.unlinkSync(targetPath);
  log.info(`[ClaudeSetup] Uninstalled skill: ${name}`);
}

export async function registerMcpServer(): Promise<ClaudeSetupResult> {
  const claudeDir = getClaudeDir();

  if (!fs.existsSync(claudeDir)) {
    return {
      success: false,
      message: "Claude Code is not installed (~/.claude/ not found)",
      claudeInstalled: false,
    };
  }

  // Setup ~/life-editor/ directory
  try {
    setupLifeEditorDir();
  } catch (e) {
    log.warn("[ClaudeSetup] Failed to setup ~/life-editor/:", e);
  }

  // Clean up stale mcpServers from ~/.claude/settings.json
  try {
    const globalSettingsPath = getGlobalSettingsPath();
    if (fs.existsSync(globalSettingsPath)) {
      const raw = fs.readFileSync(globalSettingsPath, "utf-8");
      const globalSettings = JSON.parse(raw) as Record<string, unknown>;
      const oldMcpServers = globalSettings.mcpServers as
        | Record<string, unknown>
        | undefined;
      if (oldMcpServers && MCP_SERVER_NAME in oldMcpServers) {
        delete oldMcpServers[MCP_SERVER_NAME];
        if (Object.keys(oldMcpServers).length === 0) {
          delete globalSettings.mcpServers;
        }
        fs.writeFileSync(
          globalSettingsPath,
          JSON.stringify(globalSettings, null, 2),
          "utf-8",
        );
        log.info(
          "[ClaudeSetup] Cleaned up stale mcpServers from ~/.claude/settings.json",
        );
      }
    }
  } catch (e) {
    log.warn("[ClaudeSetup] Failed to clean up ~/.claude/settings.json:", e);
  }

  // Register in global ~/.claude.json (where Claude Code actually reads MCP config)
  const claudeJsonPath = getClaudeJsonPath();
  let claudeJson: Record<string, unknown> = {};

  if (fs.existsSync(claudeJsonPath)) {
    try {
      const raw = fs.readFileSync(claudeJsonPath, "utf-8");
      claudeJson = JSON.parse(raw);
    } catch (e) {
      log.warn("[ClaudeSetup] Failed to parse ~/.claude.json:", e);
      return {
        success: false,
        message: `Failed to parse ~/.claude.json: ${e instanceof Error ? e.message : String(e)}`,
        claudeInstalled: true,
      };
    }
  }

  const mcpServers =
    (claudeJson.mcpServers as Record<string, unknown> | undefined) ?? {};

  mcpServers[MCP_SERVER_NAME] = {
    command: "node",
    args: [getMcpServerPath()],
    env: {
      DB_PATH: getDbPath(),
    },
    type: "stdio",
  };

  claudeJson.mcpServers = mcpServers;

  try {
    fs.writeFileSync(
      claudeJsonPath,
      JSON.stringify(claudeJson, null, 2),
      "utf-8",
    );
    log.info("[ClaudeSetup] MCP Server registered in ~/.claude.json");
    return {
      success: true,
      message: "MCP Server registered successfully",
      claudeInstalled: true,
    };
  } catch (e) {
    log.error("[ClaudeSetup] Failed to write ~/.claude.json:", e);
    return {
      success: false,
      message: `Failed to write ~/.claude.json: ${e instanceof Error ? e.message : String(e)}`,
      claudeInstalled: true,
    };
  }
}
