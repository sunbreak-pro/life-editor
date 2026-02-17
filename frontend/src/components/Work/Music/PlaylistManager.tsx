import { useState } from "react";
import { Plus, Trash2, ListMusic, Check, X, Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PlaylistDataResult } from "../../../hooks/usePlaylistData";
import type { Playlist } from "../../../types/playlist";

interface PlaylistManagerProps {
  playlistData: PlaylistDataResult;
  activePlaylistId: string | null;
  onSelectPlaylist: (id: string) => void;
}

export function PlaylistManager({
  playlistData,
  activePlaylistId,
  onSelectPlaylist,
}: PlaylistManagerProps) {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const handleCreate = async () => {
    const pl = await playlistData.createPlaylist(t("playlist.defaultName"));
    onSelectPlaylist(pl.id);
  };

  const startRename = (pl: Playlist) => {
    setEditingId(pl.id);
    setEditingName(pl.name);
  };

  const confirmRename = async () => {
    if (editingId && editingName.trim()) {
      await playlistData.renamePlaylist(editingId, editingName.trim());
    }
    setEditingId(null);
  };

  const cancelRename = () => {
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    await playlistData.deletePlaylist(id);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-notion-text">
          {t("playlist.playlists")}
        </h2>
        <button
          onClick={handleCreate}
          className="flex items-center gap-1 px-2 py-1 text-xs text-notion-text-secondary hover:text-notion-accent rounded-md hover:bg-notion-hover transition-colors"
        >
          <Plus size={12} />
          {t("playlist.create")}
        </button>
      </div>

      <div className="space-y-0.5">
        {playlistData.playlists.map((pl) => {
          const itemCount = (playlistData.itemsByPlaylist[pl.id] || []).length;
          const isActive = pl.id === activePlaylistId;
          const isEditing = editingId === pl.id;

          return (
            <div
              key={pl.id}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors group ${
                isActive
                  ? "bg-notion-accent/10 text-notion-accent"
                  : "hover:bg-notion-hover text-notion-text"
              }`}
              onClick={() => {
                if (!isEditing) onSelectPlaylist(pl.id);
              }}
            >
              <ListMusic size={14} className="shrink-0" />

              {isEditing ? (
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmRename();
                      if (e.key === "Escape") cancelRename();
                    }}
                    className="flex-1 text-sm bg-notion-bg-secondary border border-notion-border rounded px-1.5 py-0.5 text-notion-text outline-none focus:border-notion-accent min-w-0"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      confirmRename();
                    }}
                    className="p-0.5 text-green-500 hover:text-green-600"
                  >
                    <Check size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      cancelRename();
                    }}
                    className="p-0.5 text-notion-text-secondary hover:text-notion-text"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <>
                  <span className="text-sm truncate flex-1 min-w-0">
                    {pl.name}
                  </span>
                  <span className="text-[10px] text-notion-text-secondary">
                    {itemCount}
                  </span>
                  <div className="hidden group-hover:flex items-center gap-0.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startRename(pl);
                      }}
                      className="p-0.5 text-notion-text-secondary hover:text-notion-text"
                    >
                      <Pencil size={11} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(pl.id);
                      }}
                      className="p-0.5 text-notion-text-secondary hover:text-red-500"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}

        {playlistData.playlists.length === 0 && (
          <div className="text-center py-6 text-sm text-notion-text-secondary">
            {t("playlist.empty")}
          </div>
        )}
      </div>
    </div>
  );
}
