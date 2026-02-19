import { useState, useCallback, useEffect, useRef } from "react";
import { getDataService } from "../services";
import type { Playlist, PlaylistItem } from "../types/playlist";
import { generateId } from "../utils/generateId";
import { useUndoRedo } from "../components/shared/UndoRedo";

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
  const { push } = useUndoRedo();

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

  const createPlaylist = useCallback(
    async (name: string) => {
      const id = generateId("playlist");
      const pl = await getDataService().createPlaylist(id, name);
      setPlaylists((prev) => [...prev, pl]);

      push("playlist", {
        label: "createPlaylist",
        undo: async () => {
          await getDataService().deletePlaylist(id);
          setPlaylists((prev) => prev.filter((p) => p.id !== id));
          setItemsByPlaylist((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        },
        redo: async () => {
          const restored = await getDataService().createPlaylist(id, name);
          setPlaylists((prev) => [...prev, restored]);
        },
      });

      return pl;
    },
    [push],
  );

  const renamePlaylist = useCallback(
    async (id: string, name: string) => {
      const prev = playlists.find((p) => p.id === id);
      const oldName = prev?.name ?? "";
      const updated = await getDataService().updatePlaylist(id, { name });
      setPlaylists((p) => p.map((pl) => (pl.id === id ? updated : pl)));

      push("playlist", {
        label: "renamePlaylist",
        undo: async () => {
          const restored = await getDataService().updatePlaylist(id, {
            name: oldName,
          });
          setPlaylists((p) => p.map((pl) => (pl.id === id ? restored : pl)));
        },
        redo: async () => {
          const reapplied = await getDataService().updatePlaylist(id, { name });
          setPlaylists((p) => p.map((pl) => (pl.id === id ? reapplied : pl)));
        },
      });
    },
    [playlists, push],
  );

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

  const deletePlaylist = useCallback(
    async (id: string) => {
      const targetPlaylist = playlists.find((p) => p.id === id);
      const targetItems = itemsByPlaylist[id] || [];

      await getDataService().deletePlaylist(id);
      setPlaylists((prev) => prev.filter((p) => p.id !== id));
      setItemsByPlaylist((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

      if (targetPlaylist) {
        push("playlist", {
          label: "deletePlaylist",
          undo: async () => {
            const restored = await getDataService().createPlaylist(
              targetPlaylist.id,
              targetPlaylist.name,
            );
            setPlaylists((prev) => [...prev, restored]);
            // Re-add items
            for (const item of targetItems) {
              await getDataService().addPlaylistItem(item.id, id, item.soundId);
            }
            setItemsByPlaylist((prev) => ({ ...prev, [id]: targetItems }));
          },
          redo: async () => {
            await getDataService().deletePlaylist(id);
            setPlaylists((prev) => prev.filter((p) => p.id !== id));
            setItemsByPlaylist((prev) => {
              const next = { ...prev };
              delete next[id];
              return next;
            });
          },
        });
      }
    },
    [playlists, itemsByPlaylist, push],
  );

  const addItem = useCallback(
    async (playlistId: string, soundId: string) => {
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

      push("playlist", {
        label: "addItem",
        undo: async () => {
          await getDataService().removePlaylistItem(itemId);
          setItemsByPlaylist((prev) => ({
            ...prev,
            [playlistId]: (prev[playlistId] || []).filter(
              (i) => i.id !== itemId,
            ),
          }));
        },
        redo: async () => {
          const restored = await getDataService().addPlaylistItem(
            itemId,
            playlistId,
            soundId,
          );
          setItemsByPlaylist((prev) => ({
            ...prev,
            [playlistId]: [...(prev[playlistId] || []), restored],
          }));
        },
      });
    },
    [push],
  );

  const removeItem = useCallback(
    async (playlistId: string, itemId: string) => {
      const target = (itemsByPlaylist[playlistId] || []).find(
        (i) => i.id === itemId,
      );
      await getDataService().removePlaylistItem(itemId);
      setItemsByPlaylist((prev) => ({
        ...prev,
        [playlistId]: (prev[playlistId] || []).filter((i) => i.id !== itemId),
      }));

      if (target) {
        push("playlist", {
          label: "removeItem",
          undo: async () => {
            const restored = await getDataService().addPlaylistItem(
              target.id,
              playlistId,
              target.soundId,
            );
            setItemsByPlaylist((prev) => ({
              ...prev,
              [playlistId]: [...(prev[playlistId] || []), restored],
            }));
          },
          redo: async () => {
            await getDataService().removePlaylistItem(itemId);
            setItemsByPlaylist((prev) => ({
              ...prev,
              [playlistId]: (prev[playlistId] || []).filter(
                (i) => i.id !== itemId,
              ),
            }));
          },
        });
      }
    },
    [itemsByPlaylist, push],
  );

  const reorderItems = useCallback(
    async (playlistId: string, itemIds: string[]) => {
      const prevItems = itemsByPlaylist[playlistId] || [];
      const prevOrder = prevItems.map((i) => i.id);

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

      push("playlist", {
        label: "reorderItems",
        undo: async () => {
          setItemsByPlaylist((prev) => {
            const items = prev[playlistId] || [];
            const itemMap = new Map(items.map((i) => [i.id, i]));
            const restored = prevOrder
              .map((id, index) => {
                const item = itemMap.get(id);
                return item ? { ...item, sortOrder: index } : null;
              })
              .filter((i): i is PlaylistItem => i !== null);
            return { ...prev, [playlistId]: restored };
          });
          await getDataService()
            .reorderPlaylistItems(playlistId, prevOrder)
            .catch((e) =>
              console.error("[PlaylistData] undo reorder failed:", e),
            );
        },
        redo: async () => {
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
            .catch((e) =>
              console.error("[PlaylistData] redo reorder failed:", e),
            );
        },
      });
    },
    [itemsByPlaylist, push],
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
