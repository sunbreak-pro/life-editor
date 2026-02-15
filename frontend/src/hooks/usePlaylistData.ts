import { useState, useCallback, useEffect, useRef } from "react";
import { getDataService } from "../services";
import type { Playlist, PlaylistItem } from "../types/playlist";
import { generateId } from "../utils/generateId";

export interface PlaylistDataResult {
  playlists: Playlist[];
  itemsByPlaylist: Record<string, PlaylistItem[]>;
  createPlaylist: (name: string) => Promise<Playlist>;
  renamePlaylist: (id: string, name: string) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  updatePlaylist: (
    id: string,
    updates: Partial<
      Pick<Playlist, "name" | "sortOrder" | "repeatMode" | "isShuffle">
    >,
  ) => Promise<void>;
  addItem: (playlistId: string, soundId: string) => Promise<void>;
  removeItem: (playlistId: string, itemId: string) => Promise<void>;
  reorderItems: (playlistId: string, itemIds: string[]) => Promise<void>;
}

export function usePlaylistData(): PlaylistDataResult {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [itemsByPlaylist, setItemsByPlaylist] = useState<
    Record<string, PlaylistItem[]>
  >({});
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const ds = getDataService();
    Promise.all([ds.fetchPlaylists(), ds.fetchAllPlaylistItems()])
      .then(([pls, items]) => {
        if (!mountedRef.current) return;
        setPlaylists(pls);
        const grouped: Record<string, PlaylistItem[]> = {};
        for (const item of items) {
          if (!grouped[item.playlistId]) grouped[item.playlistId] = [];
          grouped[item.playlistId].push(item);
        }
        setItemsByPlaylist(grouped);
      })
      .catch((e) => console.error("[PlaylistData] load failed:", e));
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const createPlaylist = useCallback(async (name: string) => {
    const id = generateId("playlist");
    const pl = await getDataService().createPlaylist(id, name);
    setPlaylists((prev) => [...prev, pl]);
    return pl;
  }, []);

  const renamePlaylist = useCallback(async (id: string, name: string) => {
    const updated = await getDataService().updatePlaylist(id, { name });
    setPlaylists((prev) => prev.map((p) => (p.id === id ? updated : p)));
  }, []);

  const updatePlaylist = useCallback(
    async (
      id: string,
      updates: Partial<
        Pick<Playlist, "name" | "sortOrder" | "repeatMode" | "isShuffle">
      >,
    ) => {
      const updated = await getDataService().updatePlaylist(id, updates);
      setPlaylists((prev) => prev.map((p) => (p.id === id ? updated : p)));
    },
    [],
  );

  const deletePlaylist = useCallback(async (id: string) => {
    await getDataService().deletePlaylist(id);
    setPlaylists((prev) => prev.filter((p) => p.id !== id));
    setItemsByPlaylist((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const addItem = useCallback(async (playlistId: string, soundId: string) => {
    const itemId = generateId("pli");
    const item = await getDataService().addPlaylistItem(
      itemId,
      playlistId,
      soundId,
    );
    setItemsByPlaylist((prev) => ({
      ...prev,
      [playlistId]: [...(prev[playlistId] || []), item],
    }));
  }, []);

  const removeItem = useCallback(async (playlistId: string, itemId: string) => {
    await getDataService().removePlaylistItem(itemId);
    setItemsByPlaylist((prev) => ({
      ...prev,
      [playlistId]: (prev[playlistId] || []).filter((i) => i.id !== itemId),
    }));
  }, []);

  const reorderItems = useCallback(
    async (playlistId: string, itemIds: string[]) => {
      // Optimistic update
      setItemsByPlaylist((prev) => {
        const items = prev[playlistId] || [];
        const itemMap = new Map(items.map((i) => [i.id, i]));
        const reordered = itemIds
          .map((id, index) => {
            const item = itemMap.get(id);
            return item ? { ...item, sortOrder: index } : null;
          })
          .filter((i): i is PlaylistItem => i !== null);
        return { ...prev, [playlistId]: reordered };
      });
      await getDataService()
        .reorderPlaylistItems(playlistId, itemIds)
        .catch((e) => console.error("[PlaylistData] reorder failed:", e));
    },
    [],
  );

  return {
    playlists,
    itemsByPlaylist,
    createPlaylist,
    renamePlaylist,
    deletePlaylist,
    updatePlaylist,
    addItem,
    removeItem,
    reorderItems,
  };
}
