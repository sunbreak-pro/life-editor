export interface Playlist {
  id: string;
  name: string;
  sortOrder: number;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlaylistItem {
  id: string;
  playlistId: string;
  soundId: string;
  sortOrder: number;
}

export type RepeatMode = "off" | "one" | "all";
