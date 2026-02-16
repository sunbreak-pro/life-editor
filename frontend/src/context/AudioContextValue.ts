import { createContext } from "react";
import type { CustomSoundMeta } from "../types/customSound";
import type { PlaylistPlayerResult } from "../hooks/usePlaylistPlayer";
import type { PlaylistDataResult } from "../hooks/usePlaylistData";

export interface AudioContextValue {
  customSounds: CustomSoundMeta[];
  addSound: (file: File) => Promise<{ error?: string }>;
  removeSound: (id: string) => Promise<void>;
  soundSources: Record<string, string>;
  timerPlaylistId: string | null;
  setTimerPlaylistId: (id: string | null) => void;
  playlistPlayer: PlaylistPlayerResult;
  playlistData: PlaylistDataResult;
}

export const AudioContext = createContext<AudioContextValue | null>(null);
