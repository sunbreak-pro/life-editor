import type { SupabaseClient } from "@supabase/supabase-js";
import type { SoundSettings } from "../types/sound";
import type { Playlist, PlaylistItem } from "../types/playlist";
import {
  SOUND_SETTINGS_COLUMNS,
  PLAYLIST_COLUMNS,
  PLAYLIST_ITEM_COLUMNS,
  rowToSoundSettings,
  rowToPlaylist,
  rowToPlaylistItem,
  soundSettingsToUpsert,
  playlistToInsert,
  playlistUpdatesToPatch,
  playlistItemToInsert,
  type SoundSettingsRow,
  type PlaylistRow,
  type PlaylistItemRow,
} from "./audioMapper";

/*
 * SupabaseAudioService (W3-A). I/O layer over the independent audio tables
 * (0018): sound_settings (one row per preset ambient sound), playlists,
 * playlist_items. Pure mapping lives in audioMapper.ts. `user_id` is never
 * written (DB default auth.uid()); RLS scopes every read.
 *
 * SCOPE: preset ambient sounds only (user 2026-06-10). Custom-sound blob /
 * sound_presets / sound_tags / display_meta / workscreen methods are NOT
 * implemented here and stay throw-stubs (not routed by the Proxy).
 */
export class SupabaseAudioService {
  constructor(private readonly client: SupabaseClient) {}

  // -------------------------------------------------------------------------
  // Sound settings (preset ambient sounds)
  // -------------------------------------------------------------------------

  async fetchSoundSettings(): Promise<SoundSettings[]> {
    const { data, error } = await this.client
      .from("sound_settings")
      .select(SOUND_SETTINGS_COLUMNS);
    if (error) throw new Error(`fetchSoundSettings failed: ${error.message}`);
    return (data ?? []).map((r) =>
      rowToSoundSettings(r as unknown as SoundSettingsRow),
    );
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
    const { data, error } = await this.client
      .from("sound_settings")
      .upsert(row, { onConflict: "user_id,sound_type" })
      .select(SOUND_SETTINGS_COLUMNS)
      .single();
    if (error)
      throw new Error(
        `updateSoundSetting (type=${soundType}) failed: ${error.message}`,
      );
    return rowToSoundSettings(data as unknown as SoundSettingsRow);
  }

  // -------------------------------------------------------------------------
  // Playlists
  // -------------------------------------------------------------------------

  async fetchPlaylists(): Promise<Playlist[]> {
    const { data, error } = await this.client
      .from("playlists")
      .select(PLAYLIST_COLUMNS)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(`fetchPlaylists failed: ${error.message}`);
    return (data ?? []).map((r) => rowToPlaylist(r as unknown as PlaylistRow));
  }

  async createPlaylist(id: string, name: string): Promise<Playlist> {
    const insert = playlistToInsert(id, name);
    const { data, error } = await this.client
      .from("playlists")
      .insert(insert)
      .select(PLAYLIST_COLUMNS)
      .single();
    if (error) throw new Error(`createPlaylist failed: ${error.message}`);
    return rowToPlaylist(data as unknown as PlaylistRow);
  }

  async updatePlaylist(
    id: string,
    updates: Partial<
      Pick<Playlist, "name" | "sortOrder" | "repeatMode" | "isShuffle">
    >,
  ): Promise<Playlist> {
    const now = new Date().toISOString();
    const patch = playlistUpdatesToPatch(updates, now);
    const { data, error } = await this.client
      .from("playlists")
      .update(patch)
      .eq("id", id)
      .select(PLAYLIST_COLUMNS)
      .single();
    if (error)
      throw new Error(`updatePlaylist (id=${id}) failed: ${error.message}`);
    return rowToPlaylist(data as unknown as PlaylistRow);
  }

  /** playlist_items are removed by the 0018 ON DELETE CASCADE FK. */
  async deletePlaylist(id: string): Promise<void> {
    const { error } = await this.client
      .from("playlists")
      .delete()
      .eq("id", id);
    if (error)
      throw new Error(`deletePlaylist (id=${id}) failed: ${error.message}`);
  }

  // -------------------------------------------------------------------------
  // Playlist items
  // -------------------------------------------------------------------------

  async fetchPlaylistItems(playlistId: string): Promise<PlaylistItem[]> {
    const { data, error } = await this.client
      .from("playlist_items")
      .select(PLAYLIST_ITEM_COLUMNS)
      .eq("playlist_id", playlistId)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(`fetchPlaylistItems failed: ${error.message}`);
    return (data ?? []).map((r) =>
      rowToPlaylistItem(r as unknown as PlaylistItemRow),
    );
  }

  async fetchAllPlaylistItems(): Promise<PlaylistItem[]> {
    const { data, error } = await this.client
      .from("playlist_items")
      .select(PLAYLIST_ITEM_COLUMNS)
      .order("sort_order", { ascending: true });
    if (error)
      throw new Error(`fetchAllPlaylistItems failed: ${error.message}`);
    return (data ?? []).map((r) =>
      rowToPlaylistItem(r as unknown as PlaylistItemRow),
    );
  }

  /**
   * Append an item to a playlist. `sort_order` is computed as max+1 within
   * the playlist so a new item lands at the end (legacy parity).
   */
  async addPlaylistItem(
    id: string,
    playlistId: string,
    soundId: string,
  ): Promise<PlaylistItem> {
    const { data: existing, error: readErr } = await this.client
      .from("playlist_items")
      .select("sort_order")
      .eq("playlist_id", playlistId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (readErr)
      throw new Error(`addPlaylistItem read failed: ${readErr.message}`);
    const nextOrder =
      ((existing as { sort_order: number } | null)?.sort_order ?? -1) + 1;

    const insert = playlistItemToInsert(id, playlistId, soundId, nextOrder);
    const { data, error } = await this.client
      .from("playlist_items")
      .insert(insert)
      .select(PLAYLIST_ITEM_COLUMNS)
      .single();
    if (error) throw new Error(`addPlaylistItem failed: ${error.message}`);
    return rowToPlaylistItem(data as unknown as PlaylistItemRow);
  }

  async removePlaylistItem(itemId: string): Promise<void> {
    const { error } = await this.client
      .from("playlist_items")
      .delete()
      .eq("id", itemId);
    if (error)
      throw new Error(`removePlaylistItem (id=${itemId}) failed: ${error.message}`);
  }

  /**
   * Reassign sort_order to match the given id order (index = sort_order).
   * Issued as one UPDATE per item — PostgREST has no batch-by-position
   * update, and the playlist length is small (legacy parity).
   */
  async reorderPlaylistItems(
    playlistId: string,
    itemIds: string[],
  ): Promise<void> {
    for (let i = 0; i < itemIds.length; i++) {
      const { error } = await this.client
        .from("playlist_items")
        .update({ sort_order: i })
        .eq("id", itemIds[i])
        .eq("playlist_id", playlistId);
      if (error)
        throw new Error(
          `reorderPlaylistItems (id=${itemIds[i]}) failed: ${error.message}`,
        );
    }
  }
}

export const PHASE2_AUDIO_METHODS: ReadonlySet<string> = new Set([
  "fetchSoundSettings",
  "updateSoundSetting",
  "fetchPlaylists",
  "createPlaylist",
  "updatePlaylist",
  "deletePlaylist",
  "fetchPlaylistItems",
  "fetchAllPlaylistItems",
  "addPlaylistItem",
  "removePlaylistItem",
  "reorderPlaylistItems",
]);
