import type { SupabaseClient } from "@supabase/supabase-js";
import type { AudioDataService } from "./DataService";
import type { SoundSettings } from "../types/sound";
import {
  SOUND_SETTINGS_COLUMNS,
  rowToSoundSettings,
  soundSettingsToUpsert,
  type SoundSettingsRow,
} from "./audioMapper";
import { fetchAllPages } from "./postgrestFetchAll";
import { requireSingleRow } from "./postgrestSingle";

/*
 * SupabaseAudioService (W3-A). I/O layer over the independent audio tables
 * (0018): sound_settings (one row per preset ambient sound). The two
 * sound-queue tables have no code since #2757. Pure mapping lives in audioMapper.ts. `user_id` is never
 * written (DB default auth.uid()); RLS scopes every read.
 *
 * SCOPE: preset ambient sounds only (user 2026-06-10). Custom-sound blob /
 * sound_presets / sound_tags / display_meta / workscreen methods are NOT
 * implemented here and stay throw-stubs (not routed by the Proxy).
 */
export class SupabaseAudioService implements AudioDataService {
  constructor(private readonly client: SupabaseClient) {}

  // -------------------------------------------------------------------------
  // Sound settings (preset ambient sounds)
  // -------------------------------------------------------------------------

  async fetchSoundSettings(): Promise<SoundSettings[]> {
    const rows = await fetchAllPages<SoundSettingsRow>(
      (from, to) =>
        this.client
          .from("sound_settings")
          .select(SOUND_SETTINGS_COLUMNS)
          .order("id")
          .range(from, to),
      "fetchSoundSettings failed",
    );
    return rows.map(rowToSoundSettings);
  }

  /**
   * Upsert one preset sound's volume/enabled state. Keyed by
   * (user_id, sound_type) UNIQUE (0018). The conflict target is `sound_type`
   * within the user's scope — RLS prevents touching other users' rows.
   */
  async updateSoundSetting(
    soundType: string,
    volume: number,
    enabled: boolean,
  ): Promise<SoundSettings> {
    const now = new Date().toISOString();
    const row = soundSettingsToUpsert(soundType, volume, enabled, now);
    const data = await requireSingleRow<SoundSettingsRow>(
      this.client
        .from("sound_settings")
        .upsert(row, { onConflict: "user_id,sound_type" })
        .select(SOUND_SETTINGS_COLUMNS)
        .single(),
      `updateSoundSetting (type=${soundType}) failed`,
    );
    return rowToSoundSettings(data);
  }

  // -------------------------------------------------------------------------
  // Storage assets (W3-C)
  // -------------------------------------------------------------------------

  /**
   * Public URL of an object in the `sounds` bucket. `getPublicUrl` is a pure
   * client-side string build (no network), so this resolves immediately; the
   * Promise wrapper just satisfies the async DataService contract. An object
   * that hasn't been uploaded yet still returns a well-formed URL (it 404s
   * only when actually fetched) — callers must not depend on file existence.
   */
  async getSoundAssetUrl(objectName: string): Promise<string> {
    return this.client.storage.from("sounds").getPublicUrl(objectName).data
      .publicUrl;
  }
}

export const PHASE2_AUDIO_METHOD_NAMES = [
  "fetchSoundSettings",
  "updateSoundSetting",
  "getSoundAssetUrl",
] as const;

export type AudioMethodName = (typeof PHASE2_AUDIO_METHOD_NAMES)[number];

export const PHASE2_AUDIO_METHODS: ReadonlySet<string> = new Set(
  PHASE2_AUDIO_METHOD_NAMES,
);
