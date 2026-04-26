import type { CustomSoundMeta } from "../../types/customSound";
import type {
  SoundDisplayMeta,
  SoundPreset,
  SoundSettings,
  SoundTag,
} from "../../types/sound";
import { tauriInvoke } from "../bridge";

export const soundApi = {
  fetchSoundSettings(): Promise<SoundSettings[]> {
    return tauriInvoke("db_sound_fetch_settings");
  },
  updateSoundSetting(
    soundType: string,
    volume: number,
    enabled: boolean,
  ): Promise<SoundSettings> {
    return tauriInvoke("db_sound_update_setting", {
      soundType,
      volume,
      enabled,
    });
  },
  fetchSoundPresets(): Promise<SoundPreset[]> {
    return tauriInvoke("db_sound_fetch_presets");
  },
  createSoundPreset(name: string, settingsJson: string): Promise<SoundPreset> {
    return tauriInvoke("db_sound_create_preset", {
      name,
      settingsJson,
    });
  },
  deleteSoundPreset(id: number): Promise<void> {
    return tauriInvoke("db_sound_delete_preset", { id });
  },
  fetchAllSoundTags(): Promise<SoundTag[]> {
    return tauriInvoke("db_sound_fetch_all_sound_tags");
  },
  createSoundTag(name: string, color: string): Promise<SoundTag> {
    return tauriInvoke("db_sound_create_sound_tag", { name, color });
  },
  updateSoundTag(
    id: number,
    updates: { name?: string; color?: string; textColor?: string | null },
  ): Promise<SoundTag> {
    return tauriInvoke("db_sound_update_sound_tag", { id, updates });
  },
  deleteSoundTag(id: number): Promise<void> {
    return tauriInvoke("db_sound_delete_sound_tag", { id });
  },
  fetchTagsForSound(soundId: string): Promise<SoundTag[]> {
    return tauriInvoke("db_sound_fetch_tags_for_sound", {
      soundId,
    });
  },
  setTagsForSound(soundId: string, tagIds: number[]): Promise<void> {
    return tauriInvoke("db_sound_set_tags_for_sound", {
      soundId,
      tagIds,
    });
  },
  fetchAllSoundTagAssignments(): Promise<
    Array<{ soundId: string; tagId: number }>
  > {
    return tauriInvoke("db_sound_fetch_all_sound_tag_assignments");
  },
  fetchAllSoundDisplayMeta(): Promise<SoundDisplayMeta[]> {
    return tauriInvoke("db_sound_fetch_all_sound_display_meta");
  },
  updateSoundDisplayMeta(soundId: string, displayName: string): Promise<void> {
    return tauriInvoke("db_sound_update_sound_display_meta", {
      soundId,
      displayName,
    });
  },
  fetchWorkscreenSelections(): Promise<
    Array<{ soundId: string; displayOrder: number }>
  > {
    return tauriInvoke("db_sound_fetch_workscreen_selections");
  },
  setWorkscreenSelections(soundIds: string[]): Promise<void> {
    return tauriInvoke("db_sound_set_workscreen_selections", {
      soundIds,
    });
  },
  async saveCustomSound(
    _id: string,
    data: ArrayBuffer,
    meta: CustomSoundMeta,
  ): Promise<void> {
    await tauriInvoke("db_custom_sound_save", {
      meta,
      data: Array.from(new Uint8Array(data)),
    });
  },
  loadCustomSound(id: string): Promise<ArrayBuffer | null> {
    return tauriInvoke("db_custom_sound_load", { id });
  },
  deleteCustomSound(id: string): Promise<void> {
    return tauriInvoke("db_custom_sound_delete", { id });
  },
  fetchCustomSoundMetas(): Promise<CustomSoundMeta[]> {
    return tauriInvoke("db_custom_sound_fetch_metas");
  },
  fetchDeletedCustomSounds(): Promise<CustomSoundMeta[]> {
    return tauriInvoke("db_custom_sound_fetch_deleted");
  },
  restoreCustomSound(id: string): Promise<void> {
    return tauriInvoke("db_custom_sound_restore", { id });
  },
  permanentDeleteCustomSound(id: string): Promise<void> {
    return tauriInvoke("db_custom_sound_permanent_delete", { id });
  },
  updateCustomSoundLabel(id: string, label: string): Promise<void> {
    return tauriInvoke("db_custom_sound_update_label", { id, label });
  },
};
