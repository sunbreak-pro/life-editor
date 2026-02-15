import { useState, useMemo } from "react";
import { PanelRight, Search, X, Plus, Volume2, Headphones } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAudioContext } from "../../hooks/useAudioContext";
import { useSoundTags } from "../../hooks/useSoundTags";
import { useAudioFileUpload } from "../../hooks/useAudioFileUpload";
import { SOUND_TYPES } from "../../constants/sounds";
import { SoundTagFilter } from "./SoundTagFilter";
import { MusicSoundItem } from "./MusicSoundItem";
import { PlaylistManager } from "./PlaylistManager";

type MusicTab = "sounds" | "playlists";

interface MusicSidebarProps {
  width: number;
  onToggle: () => void;
  activeTab: MusicTab;
  onTabChange: (tab: MusicTab) => void;
  selectedPlaylistId: string | null;
  onSelectPlaylist: (id: string) => void;
}

export function MusicSidebar({
  width,
  onToggle,
  activeTab,
  onTabChange,
  selectedPlaylistId,
  onSelectPlaylist,
}: MusicSidebarProps) {
  const { t } = useTranslation();
  const audio = useAudioContext();
  const soundTagState = useSoundTags();
  const [searchQuery, setSearchQuery] = useState("");

  const allSoundsList = useMemo(() => {
    const items = [
      ...SOUND_TYPES.map((s) => ({
        id: s.id,
        label: s.label,
        isCustom: false,
      })),
      ...audio.customSounds.map((s) => ({
        id: s.id,
        label: s.label,
        isCustom: true,
      })),
    ];
    const search = searchQuery.toLowerCase().trim();
    let filtered = items;
    if (search) {
      filtered = filtered.filter((s) => {
        const displayName = soundTagState.getDisplayName(s.id) || s.label;
        return displayName.toLowerCase().includes(search);
      });
    }
    if (soundTagState.filterTagIds.length > 0) {
      filtered = filtered.filter((s) => soundTagState.soundPassesFilter(s.id));
    }
    return filtered;
  }, [searchQuery, audio.customSounds, soundTagState]);

  const handleAddCustomSound = useAudioFileUpload(audio.addSound);

  return (
    <div
      className="h-screen bg-notion-bg-subsidebar border-l border-notion-border flex flex-col"
      style={{ width }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3">
        <span className="text-[20px] font-semibold uppercase tracking-wider text-notion-text-secondary">
          {t("music.title")}
        </span>
        <button
          onClick={onToggle}
          className="p-1 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
        >
          <PanelRight size={18} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-3 pb-2">
        <button
          onClick={() => onTabChange("sounds")}
          className={`flex items-center gap-1 px-3 py-1 text-xs rounded-md transition-colors ${
            activeTab === "sounds"
              ? "bg-notion-accent/10 text-notion-accent font-medium"
              : "text-notion-text-secondary hover:bg-notion-hover"
          }`}
        >
          <Volume2 size={12} />
          {t("playlist.tabSounds")}
        </button>
        <button
          onClick={() => onTabChange("playlists")}
          className={`flex items-center gap-1 px-3 py-1 text-xs rounded-md transition-colors ${
            activeTab === "playlists"
              ? "bg-notion-accent/10 text-notion-accent font-medium"
              : "text-notion-text-secondary hover:bg-notion-hover"
          }`}
        >
          <Headphones size={12} />
          {t("playlist.tabPlaylists")}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0 px-2">
        {activeTab === "sounds" && (
          <>
            {/* Search */}
            <div className="relative mb-2">
              <Search
                size={14}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-notion-text-secondary"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("music.searchSounds")}
                className="w-full pl-7 pr-7 py-1.5 text-xs rounded-md bg-notion-bg-secondary border border-notion-border text-notion-text placeholder:text-notion-text-secondary focus:outline-none focus:border-notion-accent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-notion-text-secondary hover:text-notion-text"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Tag filter */}
            <div className="mb-2">
              <SoundTagFilter soundTagState={soundTagState} />
            </div>

            {/* Sound list */}
            <div className="space-y-0.5">
              {allSoundsList.map((s) => (
                <MusicSoundItem
                  key={s.id}
                  soundId={s.id}
                  defaultLabel={s.label}
                  isCustom={s.isCustom}
                  soundTagState={soundTagState}
                  toggleWorkscreenSelection={audio.toggleWorkscreenSelection}
                  isWorkscreenSelected={audio.isWorkscreenSelected}
                />
              ))}
            </div>

            {allSoundsList.length === 0 && (
              <div className="text-center py-6 text-notion-text-secondary text-xs">
                {t("music.noSoundsAll")}
              </div>
            )}

            {/* Add custom sound */}
            <button
              onClick={handleAddCustomSound}
              className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-dashed border-notion-border text-xs text-notion-text-secondary hover:text-notion-text hover:border-notion-accent/50 transition-colors"
            >
              <Plus size={14} />
              {t("music.addCustomSound")}
            </button>
          </>
        )}

        {activeTab === "playlists" && (
          <PlaylistManager
            playlistData={audio.playlistData}
            activePlaylistId={selectedPlaylistId}
            onSelectPlaylist={onSelectPlaylist}
          />
        )}
      </div>
    </div>
  );
}
