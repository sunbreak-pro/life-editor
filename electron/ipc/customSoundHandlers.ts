import { ipcMain } from "electron";
import { loggedHandler } from "./handlerUtil";
import type { CustomSoundRepository } from "../database/customSoundRepository";
import type { CustomSoundMeta } from "../types";

export function registerCustomSoundHandlers(repo: CustomSoundRepository): void {
  ipcMain.handle(
    "db:customSound:fetchMetas",
    loggedHandler("CustomSound", "fetchMetas", () => {
      return repo.fetchAllMetas();
    }),
  );

  ipcMain.handle(
    "db:customSound:save",
    loggedHandler(
      "CustomSound",
      "save",
      (_event, meta: CustomSoundMeta, data: ArrayBuffer) => {
        repo.saveMeta(meta);
        repo.saveBlob(meta.id, Buffer.from(data));
      },
    ),
  );

  ipcMain.handle(
    "db:customSound:load",
    loggedHandler("CustomSound", "load", (_event, id: string) => {
      const buf = repo.loadBlob(id);
      if (!buf) return null;
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    }),
  );

  ipcMain.handle(
    "db:customSound:delete",
    loggedHandler("CustomSound", "delete", (_event, id: string) => {
      repo.softDeleteMeta(id);
    }),
  );

  ipcMain.handle(
    "db:customSound:fetchDeleted",
    loggedHandler("CustomSound", "fetchDeleted", () => {
      return repo.fetchDeletedMetas();
    }),
  );

  ipcMain.handle(
    "db:customSound:restore",
    loggedHandler("CustomSound", "restore", (_event, id: string) => {
      repo.restoreMeta(id);
    }),
  );

  ipcMain.handle(
    "db:customSound:permanentDelete",
    loggedHandler("CustomSound", "permanentDelete", (_event, id: string) => {
      repo.permanentDelete(id);
    }),
  );
}
