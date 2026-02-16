import { useEffect, useMemo, type ReactNode } from "react";
import { SOUND_TYPES } from "../constants/sounds";
import { STORAGE_KEYS } from "../constants/storageKeys";
import { useTimerContext } from "../hooks/useTimerContext";
import { useCustomSounds } from "../hooks/useCustomSounds";
import { usePlaylistData } from "../hooks/usePlaylistData";
import { usePlaylistPlayer } from "../hooks/usePlaylistPlayer";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { AudioContext, type AudioContextValue } from "./AudioContextValue";

export function AudioProvider({ children }: { children: ReactNode }) {
  const timer = useTimerContext();
  const { customSounds, blobUrls, addSound, removeSound } = useCustomSounds();

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
      soundSources,
      timerPlaylistId,
      setTimerPlaylistId,
      playlistPlayer,
      playlistData,
    }),
    [
      customSounds,
      addSound,
      removeSound,
      soundSources,
      timerPlaylistId,
      setTimerPlaylistId,
      playlistPlayer,
      playlistData,
    ],
  );

  return (
    <AudioContext.Provider value={value}>{children}</AudioContext.Provider>
  );
}
