import { useCallback, useMemo } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  ListMusic,
  Music,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { SOUND_TYPES } from "../../constants/sounds";
import type { PlaylistPlayerResult } from "../../hooks/usePlaylistPlayer";
import type { PlaylistDataResult } from "../../hooks/usePlaylistData";
import type { CustomSoundMeta } from "../../types/customSound";
import type { RepeatMode } from "../../types/playlist";

interface PlaylistPlayerBarProps {
  player: PlaylistPlayerResult;
  playlistData: PlaylistDataResult;
  customSounds: CustomSoundMeta[];
  getDisplayName?: (soundId: string) => string | undefined;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function RepeatIcon({ mode }: { mode: RepeatMode }) {
  if (mode === "one") return <Repeat1 size={14} />;
  return <Repeat size={14} />;
}

export function PlaylistPlayerBar({
  player,
  playlistData,
  customSounds,
  getDisplayName,
}: PlaylistPlayerBarProps) {
  const { t } = useTranslation();

  const activePlaylist = playlistData.playlists.find(
    (p) => p.id === player.activePlaylistId,
  );
  const currentTrack = player.activePlaylistItems[player.currentTrackIndex];

  const resolveTrackName = useCallback(
    (soundId: string): string => {
      const displayName = getDisplayName?.(soundId);
      if (displayName) return displayName;
      const builtIn = SOUND_TYPES.find((s) => s.id === soundId);
      if (builtIn) return builtIn.label;
      const custom = customSounds.find((s) => s.id === soundId);
      if (custom) return custom.label;
      return soundId;
    },
    [getDisplayName, customSounds],
  );

  const trackName = useMemo(() => {
    if (!currentTrack) return t("playlist.noTrack");
    return resolveTrackName(currentTrack.soundId);
  }, [currentTrack, t, resolveTrackName]);

  const progress =
    player.duration > 0 ? (player.currentTime / player.duration) * 100 : 0;

  if (!player.activePlaylistId) {
    return (
      <div className="text-center py-4 text-md text-notion-text-secondary">
        {t("playlist.selectPlaylist")}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Track info */}
      <div className="flex items-center gap-2">
        <Music size={14} className="text-notion-text-secondary shrink-0" />
        <span className="text-md text-notion-text truncate flex-1">
          {trackName}
        </span>
        <span className="text-xs text-notion-text-secondary tabular-nums">
          {formatTime(player.currentTime)} / {formatTime(player.duration)}
        </span>
      </div>

      {/* Seek bar */}
      <div
        className="relative h-1 bg-notion-bg-secondary rounded-full cursor-pointer group"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = Math.max(
            0,
            Math.min(1, (e.clientX - rect.left) / rect.width),
          );
          player.seekTo(ratio * player.duration);
        }}
      >
        <div
          className="absolute inset-y-0 left-0 bg-notion-accent rounded-full transition-[width] duration-100"
          style={{ width: `${progress}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-notion-accent rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `calc(${progress}% - 5px)` }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={player.prev}
            className="p-1.5 text-notion-text-secondary hover:text-notion-text rounded-md transition-colors"
          >
            <SkipBack size={14} />
          </button>

          <button
            onClick={player.isPlaying ? player.pause : player.play}
            className="p-2 bg-notion-accent text-white rounded-full hover:bg-notion-accent/90 transition-colors"
          >
            {player.isPlaying ? <Pause size={14} /> : <Play size={14} />}
          </button>

          <button
            onClick={player.next}
            className="p-1.5 text-notion-text-secondary hover:text-notion-text rounded-md transition-colors"
          >
            <SkipForward size={14} />
          </button>
        </div>

        <div className="flex items-center gap-1">
          {/* Shuffle */}
          <button
            onClick={player.toggleShuffle}
            className={`p-1.5 rounded-md transition-colors ${
              player.isShuffle
                ? "text-notion-accent"
                : "text-notion-text-secondary hover:text-notion-text"
            }`}
            title={t("playlist.shuffle")}
          >
            <Shuffle size={14} />
          </button>

          {/* Repeat */}
          <button
            onClick={player.toggleRepeatMode}
            className={`p-1.5 rounded-md transition-colors ${
              player.repeatMode !== "off"
                ? "text-notion-accent"
                : "text-notion-text-secondary hover:text-notion-text"
            }`}
            title={t("playlist.repeat")}
          >
            <RepeatIcon mode={player.repeatMode} />
          </button>

          {/* Playlist selector */}
          {playlistData.playlists.length > 1 && (
            <div className="relative">
              <select
                value={player.activePlaylistId || ""}
                onChange={(e) =>
                  player.setActivePlaylistId(e.target.value || null)
                }
                className="appearance-none pl-6 pr-2 py-1 text-md bg-transparent text-notion-text-secondary hover:text-notion-text rounded-md cursor-pointer outline-none"
              >
                {playlistData.playlists.map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.name}
                  </option>
                ))}
              </select>
              <ListMusic
                size={12}
                className="absolute left-1.5 top-1/2 -translate-y-1/2 text-notion-text-secondary pointer-events-none"
              />
            </div>
          )}

          {/* Volume */}
          <div className="flex items-center gap-1 ml-1">
            <Volume2 size={14} className="text-notion-text-secondary" />
            <input
              type="range"
              min={0}
              max={100}
              value={player.volume}
              onChange={(e) => player.setVolume(Number(e.target.value))}
              className="w-16 h-1 accent-notion-accent"
            />
          </div>
        </div>
      </div>

      {/* Full track list */}
      {activePlaylist && player.activePlaylistItems.length > 0 && (
        <div className="mt-2 pt-2 border-t border-notion-border">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[12px] text-notion-text-secondary font-medium">
              {activePlaylist.name}
            </span>
            <span className="text-[12px] text-notion-text-secondary">
              {player.activePlaylistItems.length} {t("playlist.tracks")}
            </span>
          </div>
          <div className="space-y-0.5 max-h-32 overflow-y-auto border border-notion-border px-2 py-1 rounded-md">
            {player.activePlaylistItems.map((item, index) => {
              const isCurrent = index === player.currentTrackIndex;
              return (
                <button
                  key={item.id}
                  onClick={() => player.jumpToTrack(index)}
                  className={`w-full flex items-center gap-3 px-2 py-1 text-xs rounded transition-colors ${
                    isCurrent
                      ? "bg-notion-accent/10 text-notion-accent font-medium"
                      : "text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover"
                  }`}
                >
                  {isCurrent ? (
                    <Music size={10} className="shrink-0 text-notion-accent" />
                  ) : (
                    <span className="w-2.5 text-center text-[12px] shrink-0">
                      {index + 1}
                    </span>
                  )}
                  <span className="truncate text-left">
                    {resolveTrackName(item.soundId)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
