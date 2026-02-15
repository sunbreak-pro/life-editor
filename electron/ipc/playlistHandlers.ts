import { ipcMain } from "electron";
import { loggedHandler } from "./handlerUtil";
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
      return repo.create(id, name);
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
        return repo.update(id, updates);
      },
    ),
  );

  ipcMain.handle(
    "db:playlists:delete",
    loggedHandler("Playlists", "delete", (_event, id: string) => {
      repo.delete(id);
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
        return repo.addItem(id, playlistId, soundId);
      },
    ),
  );

  ipcMain.handle(
    "db:playlists:removeItem",
    loggedHandler("Playlists", "removeItem", (_event, itemId: string) => {
      repo.removeItem(itemId);
    }),
  );

  ipcMain.handle(
    "db:playlists:reorderItems",
    loggedHandler(
      "Playlists",
      "reorderItems",
      (_event, playlistId: string, itemIds: string[]) => {
        repo.reorderItems(playlistId, itemIds);
      },
    ),
  );
}
