import { dialog, BrowserWindow } from "electron";
import { query, loggedHandler } from "./handlerUtil";
import { ipcMain } from "electron";
import {
  createFileSystemService,
  type FileSystemService,
} from "../services/fileSystemService";
import type { AppSettingsRepository } from "../database/appSettingsRepository";
import * as os from "os";
import * as path from "path";

const SETTINGS_KEY = "files_root_path";
const DEFAULT_ROOT = path.join(os.homedir(), "life-editor", "files");

function getOrCreateService(repo: AppSettingsRepository): FileSystemService {
  const rootPath = repo.get(SETTINGS_KEY) ?? DEFAULT_ROOT;
  return createFileSystemService(rootPath);
}

export function registerFileHandlers(repo: AppSettingsRepository): void {
  // Folder selection dialog
  query("files:selectFolder", "Files", "selectFolder", async () => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win!, {
      properties: ["openDirectory", "createDirectory"],
      title: "Select Files Root Folder",
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  // Get configured root path
  query("files:getRootPath", "Files", "getRootPath", () => {
    return repo.get(SETTINGS_KEY) ?? DEFAULT_ROOT;
  });

  // List directory contents
  query(
    "files:listDirectory",
    "Files",
    "listDirectory",
    (_event, relativePath: string) => {
      const svc = getOrCreateService(repo);
      return svc.listDirectory(relativePath);
    },
  );

  // Get file info
  query(
    "files:getFileInfo",
    "Files",
    "getFileInfo",
    (_event, relativePath: string) => {
      const svc = getOrCreateService(repo);
      return svc.getFileInfo(relativePath);
    },
  );

  // Read text file
  query(
    "files:readTextFile",
    "Files",
    "readTextFile",
    (_event, relativePath: string) => {
      const svc = getOrCreateService(repo);
      return svc.readTextFile(relativePath);
    },
  );

  // Read binary file
  query(
    "files:readFile",
    "Files",
    "readFile",
    (_event, relativePath: string) => {
      const svc = getOrCreateService(repo);
      const buf = svc.readFile(relativePath);
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    },
  );

  // Create directory
  ipcMain.handle(
    "files:createDirectory",
    loggedHandler(
      "Files",
      "createDirectory",
      (_event, relativePath: string) => {
        const svc = getOrCreateService(repo);
        svc.createDirectory(relativePath);
      },
    ),
  );

  // Create file
  ipcMain.handle(
    "files:createFile",
    loggedHandler("Files", "createFile", (_event, relativePath: string) => {
      const svc = getOrCreateService(repo);
      svc.createFile(relativePath);
    }),
  );

  // Write text file
  ipcMain.handle(
    "files:writeTextFile",
    loggedHandler(
      "Files",
      "writeTextFile",
      (_event, relativePath: string, content: string) => {
        const svc = getOrCreateService(repo);
        svc.writeTextFile(relativePath, content);
      },
    ),
  );

  // Rename
  ipcMain.handle(
    "files:rename",
    loggedHandler(
      "Files",
      "rename",
      (_event, oldPath: string, newPath: string) => {
        const svc = getOrCreateService(repo);
        svc.rename(oldPath, newPath);
      },
    ),
  );

  // Move
  ipcMain.handle(
    "files:move",
    loggedHandler(
      "Files",
      "move",
      (_event, sourcePath: string, destPath: string) => {
        const svc = getOrCreateService(repo);
        svc.move(sourcePath, destPath);
      },
    ),
  );

  // Delete (move to trash)
  ipcMain.handle(
    "files:delete",
    loggedHandler("Files", "delete", async (_event, relativePath: string) => {
      const svc = getOrCreateService(repo);
      await svc.delete(relativePath);
    }),
  );

  // Open in system default app
  query(
    "files:openInSystem",
    "Files",
    "openInSystem",
    async (_event, relativePath: string) => {
      const svc = getOrCreateService(repo);
      return svc.openInSystem(relativePath);
    },
  );
}
