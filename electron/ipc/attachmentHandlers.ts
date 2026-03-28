import { ipcMain } from "electron";
import { loggedHandler } from "./handlerUtil";
import type {
  AttachmentRepository,
  AttachmentMeta,
} from "../database/attachmentRepository";

export function registerAttachmentHandlers(repo: AttachmentRepository): void {
  ipcMain.handle(
    "attachment:fetchMetas",
    loggedHandler("Attachment", "fetchMetas", () => {
      return repo.fetchAllMetas();
    }),
  );

  ipcMain.handle(
    "attachment:save",
    loggedHandler(
      "Attachment",
      "save",
      (_event, meta: AttachmentMeta, data: ArrayBuffer) => {
        repo.saveMeta(meta);
        repo.saveBlob(meta.id, Buffer.from(data));
      },
    ),
  );

  ipcMain.handle(
    "attachment:load",
    loggedHandler("Attachment", "load", (_event, id: string) => {
      const buf = repo.loadBlob(id);
      if (!buf) return null;
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    }),
  );

  ipcMain.handle(
    "attachment:delete",
    loggedHandler("Attachment", "delete", (_event, id: string) => {
      repo.deletePermanent(id);
    }),
  );
}
