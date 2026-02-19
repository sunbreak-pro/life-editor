import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

const ALLOWED_CHANNELS = new Set([
  // Tasks
  "db:tasks:fetchTree",
  "db:tasks:fetchDeleted",
  "db:tasks:create",
  "db:tasks:update",
  "db:tasks:syncTree",
  "db:tasks:softDelete",
  "db:tasks:restore",
  "db:tasks:permanentDelete",
  // Timer
  "db:timer:fetchSettings",
  "db:timer:updateSettings",
  "db:timer:startSession",
  "db:timer:endSession",
  "db:timer:fetchSessions",
  "db:timer:fetchSessionsByTaskId",
  "db:timer:fetchPomodoroPresets",
  "db:timer:createPomodoroPreset",
  "db:timer:updatePomodoroPreset",
  "db:timer:deletePomodoroPreset",
  // Sound
  "db:sound:fetchSettings",
  "db:sound:updateSetting",
  "db:sound:fetchPresets",
  "db:sound:createPreset",
  "db:sound:deletePreset",
  "db:sound:fetchAllSoundTags",
  "db:sound:createSoundTag",
  "db:sound:updateSoundTag",
  "db:sound:deleteSoundTag",
  "db:sound:fetchTagsForSound",
  "db:sound:setTagsForSound",
  "db:sound:fetchAllSoundTagAssignments",
  "db:sound:fetchAllSoundDisplayMeta",
  "db:sound:updateSoundDisplayMeta",
  "db:sound:fetchWorkscreenSelections",
  "db:sound:setWorkscreenSelections",
  // Memo
  "db:memo:fetchAll",
  "db:memo:fetchByDate",
  "db:memo:upsert",
  "db:memo:delete",
  "db:memo:fetchDeleted",
  "db:memo:restore",
  "db:memo:permanentDelete",
  // Notes
  "db:notes:fetchAll",
  "db:notes:fetchDeleted",
  "db:notes:create",
  "db:notes:update",
  "db:notes:softDelete",
  "db:notes:restore",
  "db:notes:permanentDelete",
  "db:notes:search",
  // Routines
  "db:routines:fetchAll",
  "db:routines:create",
  "db:routines:update",
  "db:routines:delete",
  "db:routines:fetchDeleted",
  "db:routines:softDelete",
  "db:routines:restore",
  "db:routines:permanentDelete",
  // Routine Tags
  "db:routineTags:fetchAll",
  "db:routineTags:create",
  "db:routineTags:update",
  "db:routineTags:delete",
  "db:routineTags:fetchTagsForRoutine",
  "db:routineTags:setTagsForRoutine",
  "db:routineTags:fetchAllAssignments",
  // Schedule Items
  "db:scheduleItems:fetchByDate",
  "db:scheduleItems:fetchByDateRange",
  "db:scheduleItems:create",
  "db:scheduleItems:update",
  "db:scheduleItems:delete",
  "db:scheduleItems:toggleComplete",
  "db:scheduleItems:bulkCreate",
  // Playlists
  "db:playlists:fetchAll",
  "db:playlists:create",
  "db:playlists:update",
  "db:playlists:delete",
  "db:playlists:fetchItems",
  "db:playlists:fetchAllItems",
  "db:playlists:addItem",
  "db:playlists:removeItem",
  "db:playlists:reorderItems",
  // Custom Sound
  "db:customSound:fetchMetas",
  "db:customSound:save",
  "db:customSound:load",
  "db:customSound:delete",
  "db:customSound:fetchDeleted",
  "db:customSound:restore",
  "db:customSound:permanentDelete",
  // AI
  "ai:advice",
  "ai:fetchSettings",
  "ai:updateSettings",

  // Calendars
  "db:calendars:fetchAll",
  "db:calendars:create",
  "db:calendars:update",
  "db:calendars:delete",
  // Data I/O
  "data:export",
  "data:import",
  "data:reset",
  // App
  "app:migrateFromLocalStorage",
  // Diagnostics
  "diagnostics:fetchLogs",
  "diagnostics:openLogFolder",
  "diagnostics:exportLogs",
  "diagnostics:fetchMetrics",
  "diagnostics:resetMetrics",
  "diagnostics:fetchSystemInfo",
  // Updater
  "updater:checkForUpdates",
  "updater:downloadUpdate",
  "updater:installUpdate",
]);

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
    if (!ALLOWED_CHANNELS.has(channel)) {
      return Promise.reject(new Error(`IPC channel not allowed: ${channel}`));
    }
    return ipcRenderer.invoke(channel, ...args) as Promise<T>;
  },
  onMenuAction(callback: (action: string) => void): () => void {
    const handler = (_event: IpcRendererEvent, action: string) =>
      callback(action);
    ipcRenderer.on("menu:action", handler);
    return () => {
      ipcRenderer.removeListener("menu:action", handler);
    };
  },
  onUpdaterStatus(
    callback: (status: { event: string; data?: unknown }) => void,
  ): () => void {
    const handler = (
      _event: IpcRendererEvent,
      status: { event: string; data?: unknown },
    ) => callback(status);
    ipcRenderer.on("updater:status", handler);
    return () => {
      ipcRenderer.removeListener("updater:status", handler);
    };
  },
});
