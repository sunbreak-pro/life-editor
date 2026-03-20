import { query, mutation } from "./handlerUtil";
import type { PlaylistRepository } from "../database/playlistRepository";

export function registerPlaylistHandlers(repo: PlaylistRepository): void {
  query("db:playlists:fetchAll", "Playlists", "fetchAll", () =>
    repo.fetchAll(),
  );

  query(
    "db:playlists:fetchItems",
    "Playlists",
    "fetchItems",
    (_event, playlistId: string) => repo.fetchItems(playlistId),
  );

  query("db:playlists:fetchAllItems", "Playlists", "fetchAllItems", () =>
    repo.fetchAllItems(),
  );

  mutation(
    "db:playlists:create",
    "Playlists",
    "create",
    "playlist",
    "create",
    (_event, id: string, name: string) => repo.create(id, name),
  );

  mutation(
    "db:playlists:update",
    "Playlists",
    "update",
    "playlist",
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
    ) => repo.update(id, updates),
  );

  mutation(
    "db:playlists:delete",
    "Playlists",
    "delete",
    "playlist",
    "delete",
    (_event, id: string) => {
      repo.delete(id);
    },
  );

  mutation(
    "db:playlists:addItem",
    "Playlists",
    "addItem",
    "playlistItem",
    "create",
    (_event, id: string, playlistId: string, soundId: string) =>
      repo.addItem(id, playlistId, soundId),
  );

  mutation(
    "db:playlists:removeItem",
    "Playlists",
    "removeItem",
    "playlistItem",
    "delete",
    (_event, itemId: string) => {
      repo.removeItem(itemId);
    },
  );

  mutation(
    "db:playlists:reorderItems",
    "Playlists",
    "reorderItems",
    "playlistItem",
    "bulk",
    (_event, playlistId: string, itemIds: string[]) => {
      repo.reorderItems(playlistId, itemIds);
    },
  );
}
