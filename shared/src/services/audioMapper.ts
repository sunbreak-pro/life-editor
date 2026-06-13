import type { SoundSettings } from "../types/sound";
import type { Playlist, PlaylistItem, RepeatMode } from "../types/playlist";

/*
 * Pure Row <-> domain mappers for the W3-A independent audio tables
 * (0018_timer_audio_tables.sql): `sound_settings` (one row per preset ambient
 * sound type), `playlists`, `playlist_items`.
 *
 * SCOPE: preset ambient sounds only (user 2026-06-10). No custom-sound blob /
 * sound_presets / sound_tags / display_meta / workscreen tables — those
 * DataService methods stay throw-stubs. `sound_id` on playlist_items is a
 * preset enum string owned by the UI (no FK).
 *
 * These are independent tables (no items_meta split, no version). DB-Q2: each
 * `*UpdatesToPatch` ALWAYS emits `updated_at`. `now` is injected so mappers
 * stay pure. 0018 is the SSOT for column types; keep in lockstep.
 */

// ---------------------------------------------------------------------------
// 1. sound_settings
// ---------------------------------------------------------------------------

/** Row shape of `public.sound_settings`. */
export interface SoundSettingsRow {
  id: number;
  user_id: string;
  sound_type: string;
  volume: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export const SOUND_SETTINGS_COLUMNS =
  "id, user_id, sound_type, volume, enabled, created_at, updated_at";

export function rowToSoundSettings(row: SoundSettingsRow): SoundSettings {
  return {
    id: row.id,
    soundType: row.sound_type,
    volume: row.volume,
    enabled: row.enabled,
    updatedAt: new Date(row.updated_at),
  };
}

/** Writable subset for upserting a single sound's volume/enabled state. */
export interface SoundSettingsUpsertRow {
  sound_type: string;
  volume: number;
  enabled: boolean;
  updated_at: string;
}

/**
 * Build the upsert row for one preset sound. Keyed by (user_id, sound_type)
 * UNIQUE (0018). DB-Q2: `updated_at` ALWAYS set. `now` injected (pure).
 */
export function soundSettingsToUpsert(
  soundType: string,
  volume: number,
  enabled: boolean,
  now: string,
): SoundSettingsUpsertRow {
  return {
    sound_type: soundType,
    volume,
    enabled,
    updated_at: now,
  };
}

// ---------------------------------------------------------------------------
// 2. playlists
// ---------------------------------------------------------------------------

/** Row shape of `public.playlists`. */
export interface PlaylistRow {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
  repeat_mode: RepeatMode;
  is_shuffle: boolean;
  created_at: string;
  updated_at: string;
}

export const PLAYLIST_COLUMNS =
  "id, user_id, name, sort_order, repeat_mode, is_shuffle, " +
  "created_at, updated_at";

const REPEAT_MODES: ReadonlySet<string> = new Set(["off", "one", "all"]);

/** Narrow a DB `repeat_mode` value to the RepeatMode union. */
export function toRepeatMode(value: string): RepeatMode {
  if (REPEAT_MODES.has(value)) return value as RepeatMode;
  throw new Error(
    `playlists: invalid repeat_mode "${value}" (expected off|one|all)`,
  );
}

export function rowToPlaylist(row: PlaylistRow): Playlist {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    repeatMode: toRepeatMode(row.repeat_mode),
    isShuffle: row.is_shuffle,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Writable subset for INSERT on playlists. */
export interface PlaylistInsertRow {
  id: string;
  name: string;
}

export function playlistToInsert(id: string, name: string): PlaylistInsertRow {
  return { id, name };
}

export type PlaylistUpdatePatch = Partial<{
  name: string;
  sort_order: number;
  repeat_mode: RepeatMode;
  is_shuffle: boolean;
  updated_at: string;
}>;

/**
 * Build a snake_case PATCH for playlists. Only present keys emitted. DB-Q2:
 * `updated_at` ALWAYS set. `now` injected (pure).
 */
export function playlistUpdatesToPatch(
  updates: Partial<
    Pick<Playlist, "name" | "sortOrder" | "repeatMode" | "isShuffle">
  >,
  now: string,
): PlaylistUpdatePatch {
  const patch: PlaylistUpdatePatch = { updated_at: now };
  if ("name" in updates && updates.name !== undefined) patch.name = updates.name;
  if ("sortOrder" in updates && updates.sortOrder !== undefined)
    patch.sort_order = updates.sortOrder;
  if ("repeatMode" in updates && updates.repeatMode !== undefined)
    patch.repeat_mode = updates.repeatMode;
  if ("isShuffle" in updates && updates.isShuffle !== undefined)
    patch.is_shuffle = updates.isShuffle;
  return patch;
}

// ---------------------------------------------------------------------------
// 3. playlist_items
// ---------------------------------------------------------------------------

/** Row shape of `public.playlist_items`. */
export interface PlaylistItemRow {
  id: string;
  user_id: string;
  playlist_id: string;
  sound_id: string;
  sort_order: number;
  created_at: string;
}

export const PLAYLIST_ITEM_COLUMNS =
  "id, user_id, playlist_id, sound_id, sort_order, created_at";

export function rowToPlaylistItem(row: PlaylistItemRow): PlaylistItem {
  return {
    id: row.id,
    playlistId: row.playlist_id,
    soundId: row.sound_id,
    sortOrder: row.sort_order,
  };
}

/** Writable subset for INSERT on playlist_items. */
export interface PlaylistItemInsertRow {
  id: string;
  playlist_id: string;
  sound_id: string;
  sort_order: number;
}

export function playlistItemToInsert(
  id: string,
  playlistId: string,
  soundId: string,
  sortOrder: number,
): PlaylistItemInsertRow {
  return {
    id,
    playlist_id: playlistId,
    sound_id: soundId,
    sort_order: sortOrder,
  };
}
