import { useState, useMemo } from "react";
import { Volume2, Headphones, Search, X, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SectionTabs, type TabItem } from "../shared/SectionTabs";
import { useAudioContext } from "../../hooks/useAudioContext";
import { useSoundTags } from "../../hooks/useSoundTags";
import { useAudioFileUpload } from "../../hooks/useAudioFileUpload";
import { usePreviewAudio } from "../../hooks/usePreviewAudio";
import { SOUND_TYPES } from "../../constants/sounds";
import { SoundTagManager } from "../Music/SoundTagManager";
import { SoundTagFilter } from "../Music/SoundTagFilter";
import { MusicSoundItem } from "../Music/MusicSoundItem";
import { PlaylistManager } from "../Music/PlaylistManager";
import { PlaylistDetail } from "../Music/PlaylistDetail";

type MusicTab = "sounds" | "playlists";

const MUSIC_TABS: readonly TabItem<MusicTab>[] = [
  { id: "sounds", labelKey: "playlist.tabSounds", icon: Volume2 },
  { id: "playlists", labelKey: "playlist.tabPlaylists", icon: Headphones },
];

export function WorkMusicContent() {
  const { t } = useTranslation();
  const audio = useAudioContext();
  const soundTagState = useSoundTags();
  const preview = usePreviewAudio();
  const [activeTab, setActiveTab] = useState<MusicTab>("sounds");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(
    audio.playlistPlayer.activePlaylistId,
  );

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
    <>
      <SectionTabs
        tabs={MUSIC_TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <div className="flex-1 overflow-y-auto mt-6">
        {activeTab === "sounds" && (
          <div className="max-w-4xl mx-auto w-full p-6">
            {/* Sound Tag Manager */}
            <div className="mb-6">
              <SoundTagManager soundTagState={soundTagState} />
            </div>

            {/* Search */}
            <div className="relative mb-3">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-notion-text-secondary"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("music.searchSounds")}
                className="w-full pl-9 pr-8 py-2 text-sm rounded-md bg-notion-bg-secondary border border-notion-border text-notion-text placeholder:text-notion-text-secondary focus:outline-none focus:border-notion-accent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-notion-text-secondary hover:text-notion-text"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Tag filter */}
            <div className="mb-4">
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
                  previewingId={preview.previewingId}
                  onTogglePreview={preview.togglePreview}
                />
              ))}
            </div>

            {allSoundsList.length === 0 && (
              <div className="text-center py-6 text-notion-text-secondary text-sm">
                {t("music.noSoundsAll")}
              </div>
            )}

            {/* Add custom sound */}
            <button
              onClick={handleAddCustomSound}
              className="mt-4 w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md border border-dashed border-notion-border text-sm text-notion-text-secondary hover:text-notion-text hover:border-notion-accent/50 transition-colors"
            >
              <Plus size={14} />
              {t("music.addCustomSound")}
            </button>

            {/* Shared preview control */}
            {preview.previewingId && (
              <div className="sticky bottom-0 bg-notion-bg border-t border-notion-border p-3 mt-4 rounded-b-lg">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-notion-text truncate flex-1">
                    {soundTagState.getDisplayName(preview.previewingId) ||
                      SOUND_TYPES.find((s) => s.id === preview.previewingId)
                        ?.label ||
                      audio.customSounds.find(
                        (s) => s.id === preview.previewingId,
                      )?.label ||
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
        )}

        {activeTab === "playlists" && (
          <div className="flex h-full">
            <div className="w-64 shrink-0 border-r border-notion-border p-3">
              <PlaylistManager
                playlistData={audio.playlistData}
                activePlaylistId={selectedPlaylistId}
                onSelectPlaylist={setSelectedPlaylistId}
              />
            </div>
            <div className="flex-1 p-6">
              {selectedPlaylistId ? (
                <PlaylistDetail
                  playlistId={selectedPlaylistId}
                  playlistData={audio.playlistData}
                  player={audio.playlistPlayer}
                  customSounds={audio.customSounds}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-notion-text-secondary text-sm">
                  {t("playlist.selectPlaylist")}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function formatSeekTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
