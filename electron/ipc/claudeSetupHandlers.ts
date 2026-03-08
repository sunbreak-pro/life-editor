import { ipcMain } from "electron";
import {
  registerMcpServer,
  readClaudeMd,
  writeClaudeMd,
  listAvailableSkills,
  listInstalledSkills,
  installSkill,
  uninstallSkill,
} from "../services/claudeSetup";

export function registerClaudeSetupHandlers(): void {
  ipcMain.handle("claude:registerMcp", async () => {
    return registerMcpServer();
  });

  ipcMain.handle("claude:readClaudeMd", () => {
    return readClaudeMd();
  });

  ipcMain.handle("claude:writeClaudeMd", (_event, content: string) => {
    writeClaudeMd(content);
    return { success: true };
  });

  ipcMain.handle("claude:listAvailableSkills", () => {
    return listAvailableSkills();
  });

  ipcMain.handle("claude:listInstalledSkills", () => {
    return listInstalledSkills();
  });

  ipcMain.handle(
    "claude:installSkill",
    (_event, sourcePath: string, name: string) => {
      installSkill(sourcePath, name);
      return { success: true };
    },
  );

  ipcMain.handle("claude:uninstallSkill", (_event, name: string) => {
    uninstallSkill(name);
    return { success: true };
  });
}
