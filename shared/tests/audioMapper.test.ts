import { describe, it, expect } from "vitest";
import {
  rowToSoundSettings,
  soundSettingsToUpsert,
  rowToPlaylist,
  playlistToInsert,
  playlistUpdatesToPatch,
  toRepeatMode,
  rowToPlaylistItem,
  playlistItemToInsert,
  type SoundSettingsRow,
  type PlaylistRow,
  type PlaylistItemRow,
} from "../src/services/audioMapper";

const USER = "00000000-0000-0000-0000-000000000000";
const NOW = "2026-06-10T12:00:00.000Z";

function soundRow(overrides: Partial<SoundSettingsRow> = {}): SoundSettingsRow {
  return {
    id: 2,
    user_id: USER,
    sound_type: "rain",
    volume: 70,
    enabled: true,
    created_at: "2026-06-10T10:00:00.000Z",
    updated_at: "2026-06-10T11:00:00.000Z",
    ...overrides,
  };
}

function playlistRow(overrides: Partial<PlaylistRow> = {}): PlaylistRow {
  return {
    id: "playlist-abc",
    user_id: USER,
    name: "Focus",
    sort_order: 1,
    repeat_mode: "all",
    is_shuffle: false,
    created_at: "2026-06-10T08:00:00.000Z",
    updated_at: "2026-06-10T09:00:00.000Z",
    ...overrides,
  };
}

function itemRow(overrides: Partial<PlaylistItemRow> = {}): PlaylistItemRow {
  return {
    id: "pitem-1",
    user_id: USER,
    playlist_id: "playlist-abc",
    sound_id: "rain",
    sort_order: 0,
    created_at: "2026-06-10T08:00:00.000Z",
    ...overrides,
  };
}

describe("audioMapper — sound_settings", () => {
  it("maps a row to SoundSettings with a Date updatedAt", () => {
    const s = rowToSoundSettings(soundRow());
    expect(s.id).toBe(2);
    expect(s.soundType).toBe("rain");
    expect(s.volume).toBe(70);
    expect(s.enabled).toBe(true);
    expect(s.updatedAt).toBeInstanceOf(Date);
    expect(s.updatedAt.toISOString()).toBe("2026-06-10T11:00:00.000Z");
  });

  it("upsert row carries updated_at and the conflict key fields", () => {
    const row = soundSettingsToUpsert("waves", 40, false, NOW);
    expect(row).toEqual({
      sound_type: "waves",
      volume: 40,
      enabled: false,
      updated_at: NOW,
    });
  });
});

describe("audioMapper — playlists", () => {
  it("maps row -> Playlist (snake/camel)", () => {
    const p = rowToPlaylist(playlistRow());
    expect(p.id).toBe("playlist-abc");
    expect(p.sortOrder).toBe(1);
    expect(p.repeatMode).toBe("all");
    expect(p.isShuffle).toBe(false);
    expect(p.createdAt).toBe("2026-06-10T08:00:00.000Z");
  });

  it("insert row carries only id + name (defaults DB-side)", () => {
    expect(playlistToInsert("playlist-x", "New")).toEqual({
      id: "playlist-x",
      name: "New",
    });
  });

  it("update patch bumps updated_at and maps present keys", () => {
    const patch = playlistUpdatesToPatch(
      { name: "Renamed", repeatMode: "one", isShuffle: true },
      NOW,
    );
    expect(patch.updated_at).toBe(NOW);
    expect(patch.name).toBe("Renamed");
    expect(patch.repeat_mode).toBe("one");
    expect(patch.is_shuffle).toBe(true);
    expect(patch.sort_order).toBeUndefined();
  });

  it("toRepeatMode rejects unknown values", () => {
    expect(toRepeatMode("off")).toBe("off");
    expect(() => toRepeatMode("loop")).toThrow(/invalid repeat_mode/);
  });
});

describe("audioMapper — playlist_items", () => {
  it("roundtrips row -> domain -> insert", () => {
    const item = rowToPlaylistItem(itemRow());
    expect(item).toEqual({
      id: "pitem-1",
      playlistId: "playlist-abc",
      soundId: "rain",
      sortOrder: 0,
    });

    const ins = playlistItemToInsert(
      item.id,
      item.playlistId,
      item.soundId,
      item.sortOrder,
    );
    expect(ins).toEqual({
      id: "pitem-1",
      playlist_id: "playlist-abc",
      sound_id: "rain",
      sort_order: 0,
    });
  });
});
