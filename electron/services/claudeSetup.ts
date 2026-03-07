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

function getSettingsPath(): string {
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

  // Create/update .claude/settings.json (always update — paths may change)
  const projectClaudeDir = path.join(lifeEditorDir, ".claude");
  if (!fs.existsSync(projectClaudeDir)) {
    fs.mkdirSync(projectClaudeDir, { recursive: true });
  }

  const projectSettings = {
    permissions: { allow: ["mcp__life-editor__*"] },
    mcpServers: {
      [MCP_SERVER_NAME]: {
        command: "node",
        args: [mcpServerPath],
        env: { DB_PATH: dbPath },
      },
    },
  };

  const projectSettingsPath = path.join(projectClaudeDir, "settings.json");
  fs.writeFileSync(
    projectSettingsPath,
    JSON.stringify(projectSettings, null, 2),
    "utf-8",
  );
  log.info("[ClaudeSetup] Updated ~/life-editor/.claude/settings.json");
}

function writeGlobalSettings(
  settingsPath: string,
  settings: Record<string, unknown>,
): void {
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
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

  // Register in global ~/.claude/settings.json
  const settingsPath = getSettingsPath();
  let settings: Record<string, unknown> = {};

  if (fs.existsSync(settingsPath)) {
    try {
      const raw = fs.readFileSync(settingsPath, "utf-8");
      settings = JSON.parse(raw);
    } catch (e) {
      log.warn("[ClaudeSetup] Failed to parse settings.json, using empty:", e);
      settings = {};
    }
  }

  const mcpServers =
    (settings.mcpServers as Record<string, unknown> | undefined) ?? {};

  mcpServers[MCP_SERVER_NAME] = {
    command: "node",
    args: [getMcpServerPath()],
    env: {
      DB_PATH: getDbPath(),
    },
  };

  settings.mcpServers = mcpServers;

  try {
    writeGlobalSettings(settingsPath, settings);
    log.info("[ClaudeSetup] MCP Server registered successfully");
    return {
      success: true,
      message: "MCP Server registered successfully",
      claudeInstalled: true,
    };
  } catch (e) {
    log.error("[ClaudeSetup] Failed to write settings.json:", e);
    return {
      success: false,
      message: `Failed to write settings: ${e instanceof Error ? e.message : String(e)}`,
      claudeInstalled: true,
    };
  }
}
