import { ipcMain } from "electron";
import { loggedHandler } from "./handlerUtil";
import type { SoundRepository } from "../database/soundRepository";

export function registerSoundHandlers(repo: SoundRepository): void {
  ipcMain.handle(
    "db:sound:fetchSettings",
    loggedHandler("Sound", "fetchSettings", () => repo.fetchSettings()),
  );

  ipcMain.handle(
    "db:sound:updateSetting",
    loggedHandler(
      "Sound",
      "updateSetting",
      (_event, soundType: string, volume: number, enabled: boolean) =>
        repo.updateSetting(soundType, volume, enabled),
    ),
  );

  ipcMain.handle(
    "db:sound:fetchPresets",
    loggedHandler("Sound", "fetchPresets", () => repo.fetchPresets()),
  );

  ipcMain.handle(
    "db:sound:createPreset",
    loggedHandler(
      "Sound",
      "createPreset",
      (_event, name: string, settingsJson: string) =>
        repo.createPreset(name, settingsJson),
    ),
  );

  ipcMain.handle(
    "db:sound:deletePreset",
    loggedHandler("Sound", "deletePreset", (_event, id: number) =>
      repo.deletePreset(id),
    ),
  );

  // Sound tags
  ipcMain.handle(
    "db:sound:fetchAllSoundTags",
    loggedHandler("Sound", "fetchAllSoundTags", () => repo.fetchAllSoundTags()),
  );

  ipcMain.handle(
    "db:sound:createSoundTag",
    loggedHandler(
      "Sound",
      "createSoundTag",
      (_event, name: string, color: string) => repo.createSoundTag(name, color),
    ),
  );

  ipcMain.handle(
    "db:sound:updateSoundTag",
    loggedHandler(
      "Sound",
      "updateSoundTag",
      (
        _event,
        id: number,
        name?: string,
        color?: string,
        textColor?: string | null,
      ) => repo.updateSoundTag(id, name, color, textColor),
    ),
  );

  ipcMain.handle(
    "db:sound:deleteSoundTag",
    loggedHandler("Sound", "deleteSoundTag", (_event, id: number) =>
      repo.deleteSoundTag(id),
    ),
  );

  ipcMain.handle(
    "db:sound:fetchTagsForSound",
    loggedHandler("Sound", "fetchTagsForSound", (_event, soundId: string) =>
      repo.fetchTagsForSound(soundId),
    ),
  );

  ipcMain.handle(
    "db:sound:setTagsForSound",
    loggedHandler(
      "Sound",
      "setTagsForSound",
      (_event, soundId: string, tagIds: number[]) =>
        repo.setTagsForSound(soundId, tagIds),
    ),
  );

  ipcMain.handle(
    "db:sound:fetchAllSoundTagAssignments",
    loggedHandler("Sound", "fetchAllSoundTagAssignments", () =>
      repo.fetchAllSoundTagAssignments(),
    ),
  );

  // Sound display meta
  ipcMain.handle(
    "db:sound:fetchAllSoundDisplayMeta",
    loggedHandler("Sound", "fetchAllSoundDisplayMeta", () =>
      repo.fetchAllSoundDisplayMeta(),
    ),
  );

  ipcMain.handle(
    "db:sound:updateSoundDisplayMeta",
    loggedHandler(
      "Sound",
      "updateSoundDisplayMeta",
      (_event, soundId: string, displayName: string) =>
        repo.updateSoundDisplayMeta(soundId, displayName),
    ),
  );

  // Workscreen selections
  ipcMain.handle(
    "db:sound:fetchWorkscreenSelections",
    loggedHandler("Sound", "fetchWorkscreenSelections", () =>
      repo.fetchWorkscreenSelections(),
    ),
  );

  ipcMain.handle(
    "db:sound:setWorkscreenSelections",
    loggedHandler(
      "Sound",
      "setWorkscreenSelections",
      (_event, soundIds: string[]) => repo.setWorkscreenSelections(soundIds),
    ),
  );
}
