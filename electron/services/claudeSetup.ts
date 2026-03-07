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

export async function registerMcpServer(): Promise<ClaudeSetupResult> {
  const claudeDir = getClaudeDir();

  if (!fs.existsSync(claudeDir)) {
    return {
      success: false,
      message: "Claude Code is not installed (~/.claude/ not found)",
      claudeInstalled: false,
    };
  }

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
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
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
