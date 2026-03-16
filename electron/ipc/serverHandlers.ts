import { ipcMain } from "electron";
import { networkInterfaces } from "os";
import { loggedHandler } from "./handlerUtil";
import {
  generateToken,
  getActiveToken,
  revokeToken,
} from "../server/middleware/auth";
import { startServer, stopServer } from "../server/index";
import type Database from "better-sqlite3";

let serverDb: Database.Database | null = null;
let serverRunning = false;

function getLocalIp(): string | null {
  const interfaces = networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}

export function registerServerHandlers(db: Database.Database): void {
  serverDb = db;

  ipcMain.handle(
    "server:getStatus",
    loggedHandler("Server", "getStatus", () => {
      return {
        enabled: serverRunning && !!getActiveToken(),
        token: getActiveToken(),
        ip: getLocalIp(),
      };
    }),
  );

  ipcMain.handle(
    "server:enable",
    loggedHandler("Server", "enable", async () => {
      const token = generateToken();
      if (!serverRunning && serverDb) {
        await startServer(serverDb);
        serverRunning = true;
      }
      return { token, ip: getLocalIp() };
    }),
  );

  ipcMain.handle(
    "server:disable",
    loggedHandler("Server", "disable", async () => {
      revokeToken();
      await stopServer();
      serverRunning = false;
      return { ok: true };
    }),
  );

  ipcMain.handle(
    "server:regenerateToken",
    loggedHandler("Server", "regenerateToken", () => {
      const token = generateToken();
      return { token, ip: getLocalIp() };
    }),
  );
}

export function setServerRunning(running: boolean): void {
  serverRunning = running;
}
