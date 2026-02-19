import { useEffect, useMemo, type ReactNode } from "react";
import { SOUND_TYPES } from "../constants/sounds";
import { STORAGE_KEYS } from "../constants/storageKeys";
import { useTimerContext } from "../hooks/useTimerContext";
import { useCustomSounds } from "../hooks/useCustomSounds";
import { usePlaylistData } from "../hooks/usePlaylistData";
import { usePlaylistPlayer } from "../hooks/usePlaylistPlayer";
import { useSoundTags } from "../hooks/useSoundTags";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { AudioContext, type AudioContextValue } from "./AudioContextValue";

export function AudioProvider({ children }: { children: ReactNode }) {
  const timer = useTimerContext();
  const { customSounds, blobUrls, addSound, removeSound, reloadSounds } =
    useCustomSounds();
  const { getDisplayName } = useSoundTags();

  const [timerPlaylistId, setTimerPlaylistId] = useLocalStorage<string | null>(
    STORAGE_KEYS.TIMER_PLAYLIST_ID,
    null,
    {
      serialize: (v: string | null) => v ?? "",
      deserialize: (raw: string) => raw || null,
    },
  );

  const soundSources = useMemo(() => {
    const sources: Record<string, string> = {};
    for (const s of SOUND_TYPES) {
      sources[s.id] = s.file;
    }
    for (const [id, url] of Object.entries(blobUrls)) {
      sources[id] = url;
    }
    return sources;
  }, [blobUrls]);

  const playlistData = usePlaylistData();
  const playlistShouldPlay = timer.isRunning && timerPlaylistId !== null;
  const playlistPlayer = usePlaylistPlayer(
    playlistData,
    soundSources,
    playlistShouldPlay,
  );

  // Sync timerPlaylistId to playlistPlayer's active playlist
  useEffect(() => {
    if (timer.isRunning && timerPlaylistId) {
      playlistPlayer.setActivePlaylistId(timerPlaylistId);
    }
  }, [timer.isRunning, timerPlaylistId]); // eslint-disable-line react-hooks/exhaustive-deps

  const value: AudioContextValue = useMemo(
    () => ({
      customSounds,
      addSound,
      removeSound,
      reloadCustomSounds: reloadSounds,
      soundSources,
      timerPlaylistId,
      setTimerPlaylistId,
      playlistPlayer,
      playlistData,
      getDisplayName,
    }),
    [
      customSounds,
      addSound,
      removeSound,
      reloadSounds,
      soundSources,
      timerPlaylistId,
      setTimerPlaylistId,
      playlistPlayer,
      playlistData,
      getDisplayName,
    ],
  );

  return (
    <AudioContext.Provider value={value}>{children}</AudioContext.Provider>
  );
}
