import { ipcMain } from "electron";
import { registerMcpServer } from "../services/claudeSetup";

export function registerClaudeSetupHandlers(): void {
  ipcMain.handle("claude:registerMcp", async () => {
    return registerMcpServer();
  });
}
