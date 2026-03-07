import { ipcMain } from "electron";
import { loggedHandler } from "./handlerUtil";
import type { TerminalManager } from "../terminal/TerminalManager";

export function registerTerminalHandlers(tm: TerminalManager): void {
  ipcMain.handle(
    "terminal:create",
    loggedHandler("Terminal", "create", () => tm.create()),
  );

  ipcMain.handle(
    "terminal:write",
    loggedHandler(
      "Terminal",
      "write",
      (_event, sessionId: string, data: string) => tm.write(sessionId, data),
    ),
  );

  ipcMain.handle(
    "terminal:resize",
    loggedHandler(
      "Terminal",
      "resize",
      (_event, sessionId: string, cols: number, rows: number) =>
        tm.resize(sessionId, cols, rows),
    ),
  );

  ipcMain.handle(
    "terminal:destroy",
    loggedHandler("Terminal", "destroy", (_event, sessionId: string) =>
      tm.destroy(sessionId),
    ),
  );
}
