import { query } from "./handlerUtil";
import type { SoundRepository } from "../database/soundRepository";

export function registerSoundHandlers(repo: SoundRepository): void {
  query("db:sound:fetchSettings", "Sound", "fetchSettings", () =>
    repo.fetchSettings(),
  );

  query(
    "db:sound:updateSetting",
    "Sound",
    "updateSetting",
    (_event, soundType: string, volume: number, enabled: boolean) =>
      repo.updateSetting(soundType, volume, enabled),
  );

  query("db:sound:fetchPresets", "Sound", "fetchPresets", () =>
    repo.fetchPresets(),
  );

  query(
    "db:sound:createPreset",
    "Sound",
    "createPreset",
    (_event, name: string, settingsJson: string) =>
      repo.createPreset(name, settingsJson),
  );

  query(
    "db:sound:deletePreset",
    "Sound",
    "deletePreset",
    (_event, id: number) => repo.deletePreset(id),
  );

  // Sound tags
  query("db:sound:fetchAllSoundTags", "Sound", "fetchAllSoundTags", () =>
    repo.fetchAllSoundTags(),
  );

  query(
    "db:sound:createSoundTag",
    "Sound",
    "createSoundTag",
    (_event, name: string, color: string) => repo.createSoundTag(name, color),
  );

  query(
    "db:sound:updateSoundTag",
    "Sound",
    "updateSoundTag",
    (
      _event,
      id: number,
      name?: string,
      color?: string,
      textColor?: string | null,
    ) => repo.updateSoundTag(id, name, color, textColor),
  );

  query(
    "db:sound:deleteSoundTag",
    "Sound",
    "deleteSoundTag",
    (_event, id: number) => repo.deleteSoundTag(id),
  );

  query(
    "db:sound:fetchTagsForSound",
    "Sound",
    "fetchTagsForSound",
    (_event, soundId: string) => repo.fetchTagsForSound(soundId),
  );

  query(
    "db:sound:setTagsForSound",
    "Sound",
    "setTagsForSound",
    (_event, soundId: string, tagIds: number[]) =>
      repo.setTagsForSound(soundId, tagIds),
  );

  query(
    "db:sound:fetchAllSoundTagAssignments",
    "Sound",
    "fetchAllSoundTagAssignments",
    () => repo.fetchAllSoundTagAssignments(),
  );

  // Sound display meta
  query(
    "db:sound:fetchAllSoundDisplayMeta",
    "Sound",
    "fetchAllSoundDisplayMeta",
    () => repo.fetchAllSoundDisplayMeta(),
  );

  query(
    "db:sound:updateSoundDisplayMeta",
    "Sound",
    "updateSoundDisplayMeta",
    (_event, soundId: string, displayName: string) =>
      repo.updateSoundDisplayMeta(soundId, displayName),
  );

  // Workscreen selections
  query(
    "db:sound:fetchWorkscreenSelections",
    "Sound",
    "fetchWorkscreenSelections",
    () => repo.fetchWorkscreenSelections(),
  );

  query(
    "db:sound:setWorkscreenSelections",
    "Sound",
    "setWorkscreenSelections",
    (_event, soundIds: string[]) => repo.setWorkscreenSelections(soundIds),
  );
}
