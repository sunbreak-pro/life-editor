import { createContext } from "react";
import type { CustomSoundMeta } from "../types/customSound";
import type { PlaylistPlayerResult } from "../hooks/usePlaylistPlayer";
import type { PlaylistDataResult } from "../hooks/usePlaylistData";

export interface AudioContextValue {
  customSounds: CustomSoundMeta[];
  addSound: (file: File) => Promise<{ error?: string; id?: string }>;
  removeSound: (id: string) => Promise<void>;
  updateCustomSoundLabel: (id: string, label: string) => Promise<void>;
  reloadCustomSounds: () => Promise<void>;
  soundSources: Record<string, string>;
  timerPlaylistId: string | null;
  setTimerPlaylistId: (id: string | null) => void;
  playlistPlayer: PlaylistPlayerResult;
  playlistData: PlaylistDataResult;
  getDisplayName: (soundId: string) => string | undefined;
}

export const AudioContext = createContext<AudioContextValue | null>(null);
