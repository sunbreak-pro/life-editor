import { useState, useMemo, useEffect, useCallback } from "react";
import { Volume2, Plus, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SortDropdown } from "../shared/SortDropdown";
import { SearchBar, type SearchSuggestion } from "../shared/SearchBar";
import { useAudioContext } from "../../hooks/useAudioContext";
import { useSoundTags } from "../../hooks/useSoundTags";
import { useAudioFileUpload } from "../../hooks/useAudioFileUpload";
import { usePreviewAudio } from "../../hooks/usePreviewAudio";
import { SOUND_TYPES } from "../../constants/sounds";
import { sortSounds, type SoundSortMode } from "../../utils/sortSounds";
import { SoundTagManager } from "./Music/SoundTagManager";
import { SoundTagFilter } from "./Music/SoundTagFilter";
import { MusicSoundItem } from "./Music/MusicSoundItem";
import { PlaylistManager } from "./Music/PlaylistManager";
import { PlaylistDetail } from "./Music/PlaylistDetail";

const SOUND_SORT_OPTIONS: readonly SoundSortMode[] = [
  "default",
  "name",
  "custom-first",
];

export function WorkMusicContent() {
  const { t } = useTranslation();
  const audio = useAudioContext();
  const soundTagState = useSoundTags();
  const preview = usePreviewAudio();

  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SoundSortMode>("default");
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(
    audio.playlistPlayer.activePlaylistId,
  );
  const [rightPanelView, setRightPanelView] = useState<"list" | "detail">(
    "list",
  );
  const [isAddMode, setIsAddMode] = useState(false);
  const [selectedSoundIds, setSelectedSoundIds] = useState<Set<string>>(
    new Set(),
  );

  const soundSortLabelMap: Record<SoundSortMode, string> = {
    default: t("music.sortDefault"),
    name: t("music.sortName"),
    "custom-first": t("music.sortCustomFirst"),
  };

  const allItems = useMemo(
    () => [
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
    ],
    [audio.customSounds],
  );

  const filteredSounds = useMemo(() => {
    let filtered = allItems;

    // Tag filter
    if (soundTagState.filterTagIds.length > 0) {
      filtered = filtered.filter((s) => soundTagState.soundPassesFilter(s.id));
    }

    // Search by name or tag
    const search = searchQuery.toLowerCase().trim();
    if (search) {
      filtered = filtered.filter((s) => {
        const displayName = soundTagState.getDisplayName(s.id) || s.label;
        const tags = soundTagState.getTagsForSound(s.id);
        const tagMatch = tags.some((tag) =>
          tag.name.toLowerCase().includes(search),
        );
        return displayName.toLowerCase().includes(search) || tagMatch;
      });
    }

    return sortSounds(filtered, sortMode, soundTagState.getDisplayName);
  }, [allItems, searchQuery, sortMode, soundTagState]);

  // Search suggestions: sounds + playlists
  const soundSuggestions = useMemo<SearchSuggestion[]>(() => {
    const items: SearchSuggestion[] = [];
    const sounds = allItems.slice(0, 8).map((s) => ({
      id: `sound:${s.id}`,
      label: soundTagState.getDisplayName(s.id) || s.label,
      icon: "sound" as const,
    }));
    items.push(...sounds);
    for (const p of audio.playlistData.playlists) {
      const count = audio.playlistData.itemsByPlaylist[p.id]?.length ?? 0;
      items.push({
        id: `playlist:${p.id}`,
        label: p.name,
        icon: "playlist" as const,
        sublabel: `${count} sounds`,
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return items.filter((i) => i.label.toLowerCase().includes(q));
    }
    return items;
  }, [
    allItems,
    audio.playlistData.playlists,
    audio.playlistData.itemsByPlaylist,
    searchQuery,
    soundTagState,
  ]);

  // Currently selected playlist's existing sound IDs
  const existingSoundIdsInPlaylist = useMemo(() => {
    if (!selectedPlaylistId) return new Set<string>();
    const items = audio.playlistData.itemsByPlaylist[selectedPlaylistId] || [];
    return new Set(items.map((i) => i.soundId));
  }, [selectedPlaylistId, audio.playlistData.itemsByPlaylist]);

  // Reset rightPanelView if selected playlist is deleted
  useEffect(() => {
    if (
      selectedPlaylistId &&
      !audio.playlistData.playlists.some((p) => p.id === selectedPlaylistId)
    ) {
      setSelectedPlaylistId(null);
      setRightPanelView("list");
      exitAddMode();
    }
  }, [audio.playlistData.playlists, selectedPlaylistId]);

  const handleAddCustomSound = useAudioFileUpload(audio.addSound);

  const enterAddMode = useCallback(() => {
    setIsAddMode(true);
    setSelectedSoundIds(new Set());
  }, []);

  const exitAddMode = useCallback(() => {
    setIsAddMode(false);
    setSelectedSoundIds(new Set());
  }, []);

  const toggleSoundSelection = useCallback((soundId: string) => {
    setSelectedSoundIds((prev) => {
      const next = new Set(prev);
      if (next.has(soundId)) {
        next.delete(soundId);
      } else {
        next.add(soundId);
      }
      return next;
    });
  }, []);

  const confirmAddSounds = useCallback(() => {
    if (!selectedPlaylistId) return;
    for (const soundId of selectedSoundIds) {
      audio.playlistData.addItem(selectedPlaylistId, soundId);
    }
    exitAddMode();
  }, [selectedPlaylistId, selectedSoundIds, audio.playlistData, exitAddMode]);

  const handleSelectPlaylist = useCallback(
    (id: string) => {
      setSelectedPlaylistId(id);
      setRightPanelView("detail");
      exitAddMode();
    },
    [exitAddMode],
  );

  const handleSuggestionSelect = useCallback(
    (compositeId: string) => {
      if (compositeId.startsWith("playlist:")) {
        const id = compositeId.slice("playlist:".length);
        handleSelectPlaylist(id);
      } else if (compositeId.startsWith("sound:")) {
        const id = compositeId.slice("sound:".length);
        preview.togglePreview(id);
      }
    },
    [handleSelectPlaylist, preview],
  );

  const handleBack = useCallback(() => {
    setRightPanelView("list");
    exitAddMode();
  }, [exitAddMode]);

  const handleRequestAddMode = useCallback(() => {
    enterAddMode();
  }, [enterAddMode]);

  return (
    <div className="flex-1 overflow-hidden flex">
      {/* Left Panel: Sound Library */}
      <div className="w-90 shrink-0 border-r border-notion-border flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Sound Tag Manager (collapsible) */}
          <SoundTagManager soundTagState={soundTagState} />

          {/* Add Custom Sound */}
          <button
            onClick={handleAddCustomSound}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-dashed border-notion-border text-sm text-notion-text-secondary hover:text-notion-text hover:border-notion-accent/50 transition-colors"
          >
            <Plus size={14} />
            {t("music.addCustomSound")}
          </button>

          {/* Search + Sort */}
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={t("music.searchAll")}
            showSuggestionsOnFocus={false}
            suggestions={soundSuggestions}
            onSuggestionSelect={handleSuggestionSelect}
            className=""
            rightAction={
              <SortDropdown<SoundSortMode>
                sortMode={sortMode}
                onSortChange={setSortMode}
                options={SOUND_SORT_OPTIONS}
                labelMap={soundSortLabelMap}
                defaultMode="default"
              />
            }
          />

          {/* Tag Filter */}
          <SoundTagFilter soundTagState={soundTagState} />

          {/* Sound List */}
          <div className="space-y-0.5">
            {filteredSounds.map((s) => (
              <MusicSoundItem
                key={s.id}
                soundId={s.id}
                defaultLabel={s.label}
                isCustom={s.isCustom}
                soundTagState={soundTagState}
                previewingId={preview.previewingId}
                onTogglePreview={preview.togglePreview}
                isAddMode={isAddMode}
                isChecked={selectedSoundIds.has(s.id)}
                isAlreadyInPlaylist={existingSoundIdsInPlaylist.has(s.id)}
                onToggleCheck={toggleSoundSelection}
              />
            ))}
          </div>

          {filteredSounds.length === 0 && (
            <div className="text-center py-6 text-notion-text-secondary text-sm">
              {t("music.noSoundsAll")}
            </div>
          )}
        </div>

        {/* Add Mode confirmation bar */}
        {isAddMode && (
          <div className="border-t border-notion-border px-4 py-3 bg-notion-bg-secondary">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-notion-text-secondary">
                {t("music.selectedCount", { count: selectedSoundIds.size })}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={exitAddMode}
                  className="px-3 py-1.5 text-sm text-notion-text-secondary hover:text-notion-text rounded-md hover:bg-notion-hover transition-colors"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={confirmAddSounds}
                  disabled={selectedSoundIds.size === 0}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-white bg-notion-accent hover:bg-notion-accent/90 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Check size={14} />
                  {t("music.addToPlaylist")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Preview bar */}
        {preview.previewingId && (
          <div className="border-t border-notion-border p-3 bg-notion-bg">
            <div className="flex items-center gap-3">
              <span className="text-sm text-notion-text truncate flex-1">
                {soundTagState.getDisplayName(preview.previewingId) ||
                  SOUND_TYPES.find((s) => s.id === preview.previewingId)
                    ?.label ||
                  audio.customSounds.find((s) => s.id === preview.previewingId)
                    ?.label ||
                  preview.previewingId}
              </span>
              <Volume2
                size={14}
                className="text-notion-text-secondary shrink-0"
              />
              <input
                type="range"
                min={0}
                max={100}
                value={preview.volume}
                onChange={(e) => preview.setVolume(Number(e.target.value))}
                className="w-24 h-1 accent-[--color-accent] cursor-pointer"
              />
              <input
                type="range"
                min={0}
                max={preview.duration}
                step={0.1}
                value={preview.currentTime}
                onChange={(e) => preview.seekTo(Number(e.target.value))}
                className="w-32 h-1 accent-[--color-text-secondary] cursor-pointer"
              />
              <span className="text-[10px] text-notion-text-secondary tabular-nums shrink-0">
                {formatSeekTime(preview.currentTime)} /{" "}
                {formatSeekTime(preview.duration)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Right Panel: Playlists */}
      <div className="flex-1 overflow-y-auto p-4">
        {rightPanelView === "list" ? (
          <PlaylistManager
            playlistData={audio.playlistData}
            activePlaylistId={selectedPlaylistId}
            onSelectPlaylist={handleSelectPlaylist}
          />
        ) : selectedPlaylistId ? (
          <PlaylistDetail
            playlistId={selectedPlaylistId}
            playlistData={audio.playlistData}
            player={audio.playlistPlayer}
            customSounds={audio.customSounds}
            onBack={handleBack}
            onRequestAddMode={handleRequestAddMode}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-notion-text-secondary text-sm">
            {t("playlist.selectPlaylist")}
          </div>
        )}
      </div>
    </div>
  );
}

function formatSeekTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
