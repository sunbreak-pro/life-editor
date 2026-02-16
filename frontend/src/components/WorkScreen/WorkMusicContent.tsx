import { useState, useMemo } from "react";
import { Volume2, Headphones, Search, X, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SectionTabs, type TabItem } from "../shared/SectionTabs";
import { SortDropdown } from "../shared/SortDropdown";
import { useAudioContext } from "../../hooks/useAudioContext";
import { useSoundTags } from "../../hooks/useSoundTags";
import { useAudioFileUpload } from "../../hooks/useAudioFileUpload";
import { usePreviewAudio } from "../../hooks/usePreviewAudio";
import { SOUND_TYPES } from "../../constants/sounds";
import { sortSounds, type SoundSortMode } from "../../utils/sortSounds";
import { SoundTagManager } from "../Music/SoundTagManager";
import { MusicSoundItem } from "../Music/MusicSoundItem";
import { PlaylistManager } from "../Music/PlaylistManager";
import { PlaylistDetail } from "../Music/PlaylistDetail";

const SOUND_SORT_OPTIONS: readonly SoundSortMode[] = [
  "default",
  "name",
  "custom-first",
];

type MusicTab = "soundsManagement" | "playlists";

const MUSIC_TABS: readonly TabItem<MusicTab>[] = [
  { id: "soundsManagement", labelKey: "playlist.tabSounds", icon: Volume2 },
  { id: "playlists", labelKey: "playlist.tabPlaylists", icon: Headphones },
];

export function WorkMusicContent() {
  const { t } = useTranslation();
  const audio = useAudioContext();
  const soundTagState = useSoundTags();
  const preview = usePreviewAudio();
  const [activeTab, setActiveTab] = useState<MusicTab>("soundsManagement");
  const [untaggedSearch, setUntaggedSearch] = useState("");
  const [taggedSearch, setTaggedSearch] = useState("");
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(
    audio.playlistPlayer.activePlaylistId,
  );
  const [untaggedSortMode, setUntaggedSortMode] =
    useState<SoundSortMode>("default");
  const [taggedSortMode, setTaggedSortMode] =
    useState<SoundSortMode>("default");

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

  const untaggedSounds = useMemo(() => {
    let filtered = allItems.filter(
      (s) => soundTagState.getTagsForSound(s.id).length === 0,
    );
    const search = untaggedSearch.toLowerCase().trim();
    if (search) {
      filtered = filtered.filter((s) => {
        const displayName = soundTagState.getDisplayName(s.id) || s.label;
        return displayName.toLowerCase().includes(search);
      });
    }
    return sortSounds(filtered, untaggedSortMode, soundTagState.getDisplayName);
  }, [allItems, untaggedSearch, untaggedSortMode, soundTagState]);

  const taggedSounds = useMemo(() => {
    let filtered = allItems.filter(
      (s) => soundTagState.getTagsForSound(s.id).length > 0,
    );
    const search = taggedSearch.toLowerCase().trim();
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
    return sortSounds(filtered, taggedSortMode, soundTagState.getDisplayName);
  }, [allItems, taggedSearch, taggedSortMode, soundTagState]);

  const handleAddCustomSound = useAudioFileUpload(audio.addSound);

  return (
    <>
      <SectionTabs
        tabs={MUSIC_TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <div className="flex-1 overflow-y-auto mt-6">
        {activeTab === "soundsManagement" && (
          <div className="max-w-5xl mx-auto w-full p-6">
            {/* Sound Tag Manager */}
            <div className="mb-6">
              <SoundTagManager soundTagState={soundTagState} />
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left: Untagged sounds */}
              <div className="border border-notion-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-notion-text">
                    {t("music.untaggedSounds")}{" "}
                    <span className="text-notion-text-secondary font-normal">
                      ({untaggedSounds.length})
                    </span>
                  </h3>
                  <SortDropdown<SoundSortMode>
                    sortMode={untaggedSortMode}
                    onSortChange={setUntaggedSortMode}
                    options={SOUND_SORT_OPTIONS}
                    labelMap={soundSortLabelMap}
                    defaultMode="default"
                  />
                </div>

                <div className="relative mb-3">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-notion-text-secondary"
                  />
                  <input
                    type="text"
                    value={untaggedSearch}
                    onChange={(e) => setUntaggedSearch(e.target.value)}
                    placeholder={t("music.searchByName")}
                    className="w-full pl-9 pr-8 py-2 text-sm rounded-md bg-notion-bg-secondary border border-notion-border text-notion-text placeholder:text-notion-text-secondary focus:outline-none focus:border-notion-accent"
                  />
                  {untaggedSearch && (
                    <button
                      onClick={() => setUntaggedSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-notion-text-secondary hover:text-notion-text"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="space-y-0.5">
                  {untaggedSounds.map((s) => (
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

                {untaggedSounds.length === 0 && (
                  <div className="text-center py-6 text-notion-text-secondary text-sm">
                    {t("music.noSoundsAll")}
                  </div>
                )}

                <button
                  onClick={handleAddCustomSound}
                  className="mt-4 w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md border border-dashed border-notion-border text-sm text-notion-text-secondary hover:text-notion-text hover:border-notion-accent/50 transition-colors"
                >
                  <Plus size={14} />
                  {t("music.addCustomSound")}
                </button>
              </div>

              {/* Right: Tagged sounds */}
              <div className="border border-notion-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-notion-text">
                    {t("music.taggedSounds")}{" "}
                    <span className="text-notion-text-secondary font-normal">
                      ({taggedSounds.length})
                    </span>
                  </h3>
                  <SortDropdown<SoundSortMode>
                    sortMode={taggedSortMode}
                    onSortChange={setTaggedSortMode}
                    options={SOUND_SORT_OPTIONS}
                    labelMap={soundSortLabelMap}
                    defaultMode="default"
                  />
                </div>

                <div className="relative mb-3">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-notion-text-secondary"
                  />
                  <input
                    type="text"
                    value={taggedSearch}
                    onChange={(e) => setTaggedSearch(e.target.value)}
                    placeholder={t("music.searchByNameOrTag")}
                    className="w-full pl-9 pr-8 py-2 text-sm rounded-md bg-notion-bg-secondary border border-notion-border text-notion-text placeholder:text-notion-text-secondary focus:outline-none focus:border-notion-accent"
                  />
                  {taggedSearch && (
                    <button
                      onClick={() => setTaggedSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-notion-text-secondary hover:text-notion-text"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="space-y-0.5">
                  {taggedSounds.map((s) => (
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

                {taggedSounds.length === 0 && (
                  <div className="text-center py-6 text-notion-text-secondary text-sm">
                    {t("music.noTaggedSounds")}
                  </div>
                )}
              </div>
            </div>

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
