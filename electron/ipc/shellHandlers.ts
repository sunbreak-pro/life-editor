import { ipcMain, shell } from "electron";
import * as path from "path";
import * as fs from "fs";
import { app } from "electron";
import { loggedHandler } from "./handlerUtil";

const ATTACHMENTS_DIR = path.join(app.getPath("userData"), "attachments");

export function registerShellHandlers(): void {
  ipcMain.handle(
    "shell:openExternal",
    loggedHandler("Shell", "openExternal", (_event, url: string) => {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error(`Blocked protocol: ${parsed.protocol}`);
      }
      return shell.openExternal(url);
    }),
  );

  ipcMain.handle(
    "shell:openPath",
    loggedHandler("Shell", "openPath", (_event, attachmentId: string) => {
      const filePath = path.join(ATTACHMENTS_DIR, attachmentId);
      const resolved = path.resolve(filePath);
      if (!resolved.startsWith(path.resolve(ATTACHMENTS_DIR))) {
        throw new Error("Path traversal detected");
      }
      if (!fs.existsSync(resolved)) {
        throw new Error(`Attachment file not found: ${attachmentId}`);
      }
      return shell.openPath(resolved);
    }),
  );
}
