import type { Playlist, PlaylistItem } from "../../types/playlist";
import { tauriInvoke } from "../bridge";

export const playlistsApi = {
  fetchPlaylists(): Promise<Playlist[]> {
    return tauriInvoke("db_playlists_fetch_all");
  },
  createPlaylist(id: string, name: string): Promise<Playlist> {
    return tauriInvoke("db_playlists_create", { id, name });
  },
  updatePlaylist(
    id: string,
    updates: Partial<
      Pick<Playlist, "name" | "sortOrder" | "repeatMode" | "isShuffle">
    >,
  ): Promise<Playlist> {
    return tauriInvoke("db_playlists_update", { id, updates });
  },
  deletePlaylist(id: string): Promise<void> {
    return tauriInvoke("db_playlists_delete", { id });
  },
  fetchPlaylistItems(playlistId: string): Promise<PlaylistItem[]> {
    return tauriInvoke("db_playlists_fetch_items", {
      playlistId,
    });
  },
  fetchAllPlaylistItems(): Promise<PlaylistItem[]> {
    return tauriInvoke("db_playlists_fetch_all_items");
  },
  addPlaylistItem(
    id: string,
    playlistId: string,
    soundId: string,
  ): Promise<PlaylistItem> {
    return tauriInvoke("db_playlists_add_item", {
      id,
      playlistId,
      soundId,
    });
  },
  removePlaylistItem(itemId: string): Promise<void> {
    return tauriInvoke("db_playlists_remove_item", { itemId });
  },
  reorderPlaylistItems(playlistId: string, itemIds: string[]): Promise<void> {
    return tauriInvoke("db_playlists_reorder_items", {
      playlistId,
      itemIds,
    });
  },
};
