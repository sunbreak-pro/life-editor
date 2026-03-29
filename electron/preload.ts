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
  "db:memo:togglePin",
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
  // Routine Groups
  "db:routineGroups:fetchAll",
  "db:routineGroups:create",
  "db:routineGroups:update",
  "db:routineGroups:delete",
  "db:routineGroups:fetchAllTagAssignments",
  "db:routineGroups:setTagsForGroup",
  // Schedule Items
  "db:scheduleItems:fetchByDate",
  "db:scheduleItems:fetchByDateRange",
  "db:scheduleItems:create",
  "db:scheduleItems:update",
  "db:scheduleItems:delete",
  "db:scheduleItems:toggleComplete",
  "db:scheduleItems:bulkCreate",
  "db:scheduleItems:dismiss",
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
  // Wiki Tags
  "db:wikiTags:fetchAll",
  "db:wikiTags:search",
  "db:wikiTags:create",
  "db:wikiTags:update",
  "db:wikiTags:delete",
  "db:wikiTags:merge",
  "db:wikiTags:fetchForEntity",
  "db:wikiTags:setForEntity",
  "db:wikiTags:syncInline",
  "db:wikiTags:fetchAllAssignments",
  "db:wikiTags:createWithId",
  "db:wikiTags:restoreAssignment",
  // Wiki Tag Groups
  "db:wikiTagGroups:fetchAll",
  "db:wikiTagGroups:create",
  "db:wikiTagGroups:update",
  "db:wikiTagGroups:delete",
  "db:wikiTagGroups:fetchAllMembers",
  "db:wikiTagGroups:setMembers",
  "db:wikiTagGroups:addMember",
  "db:wikiTagGroups:removeMember",
  // Wiki Tag Connections
  "db:wikiTagConnections:fetchAll",
  "db:wikiTagConnections:create",
  "db:wikiTagConnections:delete",
  "db:wikiTagConnections:deleteByTagPair",
  // Note Connections
  "db:noteConnections:fetchAll",
  "db:noteConnections:create",
  "db:noteConnections:delete",
  "db:noteConnections:deleteByNotePair",
  // Time Memos
  "db:timeMemos:fetchByDate",
  "db:timeMemos:upsert",
  "db:timeMemos:delete",
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
  // Paper Boards
  "db:paperBoards:fetchAll",
  "db:paperBoards:fetchById",
  "db:paperBoards:fetchByNoteId",
  "db:paperBoards:create",
  "db:paperBoards:update",
  "db:paperBoards:delete",
  // Paper Nodes
  "db:paperNodes:fetchNodeCounts",
  "db:paperNodes:fetchByBoard",
  "db:paperNodes:create",
  "db:paperNodes:update",
  "db:paperNodes:bulkUpdatePositions",
  "db:paperNodes:delete",
  // Paper Edges
  "db:paperEdges:fetchByBoard",
  "db:paperEdges:create",
  "db:paperEdges:delete",
  // Terminal
  "terminal:create",
  "terminal:write",
  "terminal:resize",
  "terminal:destroy",
  "terminal:claudeState",
  // Server (mobile access)
  "server:getStatus",
  "server:enable",
  "server:disable",
  "server:regenerateToken",
  // Window
  "window:close",
  // Shell
  "shell:openExternal",
  "shell:openPath",
  // Attachments
  "attachment:save",
  "attachment:load",
  "attachment:delete",
  "attachment:fetchMetas",
  // Claude
  "claude:registerMcp",
  "claude:readClaudeMd",
  "claude:writeClaudeMd",
  "claude:listAvailableSkills",
  "claude:listInstalledSkills",
  "claude:installSkill",
  "claude:uninstallSkill",
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
  onTerminalData(
    callback: (sessionId: string, data: string) => void,
  ): () => void {
    const handler = (
      _event: IpcRendererEvent,
      sessionId: string,
      data: string,
    ) => callback(sessionId, data);
    ipcRenderer.on("terminal:data", handler);
    return () => {
      ipcRenderer.removeListener("terminal:data", handler);
    };
  },
  onClaudeStatus(
    callback: (sessionId: string, state: string) => void,
  ): () => void {
    const handler = (
      _event: IpcRendererEvent,
      sessionId: string,
      state: string,
    ) => callback(sessionId, state);
    ipcRenderer.on("terminal:claudeStatus", handler);
    return () => {
      ipcRenderer.removeListener("terminal:claudeStatus", handler);
    };
  },
});
