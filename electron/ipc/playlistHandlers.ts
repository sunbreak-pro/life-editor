import { ipcMain } from "electron";
import { loggedHandler } from "./handlerUtil";
import { broadcastChange } from "../server/broadcast";
import type { PlaylistRepository } from "../database/playlistRepository";

export function registerPlaylistHandlers(repo: PlaylistRepository): void {
  ipcMain.handle(
    "db:playlists:fetchAll",
    loggedHandler("Playlists", "fetchAll", () => {
      return repo.fetchAll();
    }),
  );

  ipcMain.handle(
    "db:playlists:create",
    loggedHandler("Playlists", "create", (_event, id: string, name: string) => {
      const result = repo.create(id, name);
      broadcastChange("playlist", "create", id);
      return result;
    }),
  );

  ipcMain.handle(
    "db:playlists:update",
    loggedHandler(
      "Playlists",
      "update",
      (
        _event,
        id: string,
        updates: {
          name?: string;
          sortOrder?: number;
          repeatMode?: string;
          isShuffle?: boolean;
        },
      ) => {
        const result = repo.update(id, updates);
        broadcastChange("playlist", "update", id);
        return result;
      },
    ),
  );

  ipcMain.handle(
    "db:playlists:delete",
    loggedHandler("Playlists", "delete", (_event, id: string) => {
      repo.delete(id);
      broadcastChange("playlist", "delete", id);
    }),
  );

  ipcMain.handle(
    "db:playlists:fetchItems",
    loggedHandler("Playlists", "fetchItems", (_event, playlistId: string) => {
      return repo.fetchItems(playlistId);
    }),
  );

  ipcMain.handle(
    "db:playlists:fetchAllItems",
    loggedHandler("Playlists", "fetchAllItems", () => {
      return repo.fetchAllItems();
    }),
  );

  ipcMain.handle(
    "db:playlists:addItem",
    loggedHandler(
      "Playlists",
      "addItem",
      (_event, id: string, playlistId: string, soundId: string) => {
        const result = repo.addItem(id, playlistId, soundId);
        broadcastChange("playlistItem", "create", id);
        return result;
      },
    ),
  );

  ipcMain.handle(
    "db:playlists:removeItem",
    loggedHandler("Playlists", "removeItem", (_event, itemId: string) => {
      repo.removeItem(itemId);
      broadcastChange("playlistItem", "delete", itemId);
    }),
  );

  ipcMain.handle(
    "db:playlists:reorderItems",
    loggedHandler(
      "Playlists",
      "reorderItems",
      (_event, playlistId: string, itemIds: string[]) => {
        repo.reorderItems(playlistId, itemIds);
        broadcastChange("playlistItem", "bulk", playlistId);
      },
    ),
  );
}
