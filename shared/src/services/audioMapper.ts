import type { SoundSettings } from "../types/sound";

/*
 * Pure Row <-> domain mappers for the W3-A independent audio tables
 * (0018_timer_audio_tables.sql): `sound_settings` (one row per preset ambient
 * sound type). The two sound-queue tables of 0018 stay in the DB with no
 * reader or writer: no screen ever used them, so their code went in #2757.
 *
 * SCOPE: preset ambient sounds only (user 2026-06-10). No custom-sound blob /
 * sound_presets / sound_tags / display_meta / workscreen tables — those
 * DataService methods stay throw-stubs.
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
