import { vi } from "vitest";
import type { DataService } from "../services/DataService";

export function createMockDataService(): DataService & {
  [K in keyof DataService]: ReturnType<typeof vi.fn>;
} {
  return {
    // Tasks
    fetchTaskTree: vi.fn().mockResolvedValue([]),
    fetchDeletedTasks: vi.fn().mockResolvedValue([]),
    createTask: vi.fn().mockImplementation((node) => Promise.resolve(node)),
    updateTask: vi
      .fn()
      .mockImplementation((_id, updates) => Promise.resolve(updates)),
    syncTaskTree: vi.fn().mockResolvedValue(undefined),
    softDeleteTask: vi.fn().mockResolvedValue(undefined),
    restoreTask: vi.fn().mockResolvedValue(undefined),
    permanentDeleteTask: vi.fn().mockResolvedValue(undefined),
    migrateTasksToBackend: vi.fn().mockResolvedValue(undefined),

    // Timer
    fetchTimerSettings: vi.fn().mockResolvedValue({
      id: 1,
      workDuration: 25,
      breakDuration: 5,
      longBreakDuration: 15,
      sessionsBeforeLongBreak: 4,
      updatedAt: new Date(),
    }),
    updateTimerSettings: vi.fn().mockImplementation((settings) =>
      Promise.resolve({
        id: 1,
        workDuration: 25,
        breakDuration: 5,
        longBreakDuration: 15,
        sessionsBeforeLongBreak: 4,
        updatedAt: new Date(),
        ...settings,
      }),
    ),
    startTimerSession: vi.fn().mockImplementation((sessionType, taskId) =>
      Promise.resolve({
        id: 1,
        taskId: taskId ?? null,
        sessionType,
        startedAt: new Date(),
        completedAt: null,
        duration: null,
        completed: false,
      }),
    ),
    endTimerSession: vi.fn().mockImplementation((id, duration, completed) =>
      Promise.resolve({
        id,
        taskId: null,
        sessionType: "WORK",
        startedAt: new Date(),
        completedAt: new Date(),
        duration,
        completed,
      }),
    ),
    fetchTimerSessions: vi.fn().mockResolvedValue([]),
    fetchSessionsByTaskId: vi.fn().mockResolvedValue([]),

    // Sound
    fetchSoundSettings: vi.fn().mockResolvedValue([]),
    updateSoundSetting: vi
      .fn()
      .mockImplementation((soundType, volume, enabled) =>
        Promise.resolve({
          id: 1,
          soundType,
          volume,
          enabled,
          updatedAt: new Date(),
        }),
      ),
    fetchSoundPresets: vi.fn().mockResolvedValue([]),
    createSoundPreset: vi.fn().mockImplementation((name, settingsJson) =>
      Promise.resolve({
        id: 1,
        name,
        settingsJson,
        createdAt: new Date(),
      }),
    ),
    deleteSoundPreset: vi.fn().mockResolvedValue(undefined),

    // Sound Tags
    fetchAllSoundTags: vi.fn().mockResolvedValue([]),
    createSoundTag: vi
      .fn()
      .mockImplementation((name, color) =>
        Promise.resolve({ id: 1, name, color }),
      ),
    updateSoundTag: vi
      .fn()
      .mockImplementation((id, updates) =>
        Promise.resolve({ id, name: "", color: "", ...updates }),
      ),
    deleteSoundTag: vi.fn().mockResolvedValue(undefined),
    fetchTagsForSound: vi.fn().mockResolvedValue([]),
    setTagsForSound: vi.fn().mockResolvedValue(undefined),
    fetchAllSoundTagAssignments: vi.fn().mockResolvedValue([]),
    fetchAllSoundDisplayMeta: vi.fn().mockResolvedValue([]),
    updateSoundDisplayMeta: vi.fn().mockResolvedValue(undefined),
    fetchWorkscreenSelections: vi.fn().mockResolvedValue([]),
    setWorkscreenSelections: vi.fn().mockResolvedValue(undefined),

    // Memo
    fetchAllMemos: vi.fn().mockResolvedValue([]),
    fetchMemoByDate: vi.fn().mockResolvedValue(null),
    upsertMemo: vi.fn().mockImplementation((date, content) =>
      Promise.resolve({
        id: `memo-${date}`,
        date,
        content,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    ),
    deleteMemo: vi.fn().mockResolvedValue(undefined),
    fetchDeletedMemos: vi.fn().mockResolvedValue([]),
    restoreMemo: vi.fn().mockResolvedValue(undefined),
    permanentDeleteMemo: vi.fn().mockResolvedValue(undefined),
    toggleMemoPin: vi.fn().mockResolvedValue({
      id: "memo-mock",
      date: "2026-01-01",
      content: "",
      isPinned: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    setMemoPassword: vi.fn().mockResolvedValue({
      id: "memo-mock",
      date: "2026-01-01",
      content: "",
      hasPassword: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    removeMemoPassword: vi.fn().mockResolvedValue({
      id: "memo-mock",
      date: "2026-01-01",
      content: "",
      hasPassword: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    verifyMemoPassword: vi.fn().mockResolvedValue(true),
    toggleMemoEditLock: vi.fn().mockResolvedValue({
      id: "memo-mock",
      date: "2026-01-01",
      content: "",
      isEditLocked: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),

    // Notes
    fetchAllNotes: vi.fn().mockResolvedValue([]),
    fetchDeletedNotes: vi.fn().mockResolvedValue([]),
    createNote: vi.fn().mockImplementation((id, title, parentId) =>
      Promise.resolve({
        id,
        title,
        content: "",
        parentId: parentId ?? null,
        isPinned: false,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    ),
    updateNote: vi.fn().mockImplementation((id, updates) =>
      Promise.resolve({
        id,
        title: "",
        content: "",
        isPinned: false,
        isDeleted: false,
        createdAt: "",
        updatedAt: new Date().toISOString(),
        ...updates,
      }),
    ),
    softDeleteNote: vi.fn().mockResolvedValue(undefined),
    restoreNote: vi.fn().mockResolvedValue(undefined),
    permanentDeleteNote: vi.fn().mockResolvedValue(undefined),
    searchNotes: vi.fn().mockResolvedValue([]),
    setNotePassword: vi.fn().mockResolvedValue({
      id: "note-mock",
      title: "",
      content: "",
      isPinned: false,
      hasPassword: true,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    removeNotePassword: vi.fn().mockResolvedValue({
      id: "note-mock",
      title: "",
      content: "",
      isPinned: false,
      hasPassword: false,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    verifyNotePassword: vi.fn().mockResolvedValue(true),
    toggleNoteEditLock: vi.fn().mockResolvedValue({
      id: "note-mock",
      title: "",
      content: "",
      isPinned: false,
      isEditLocked: true,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    createNoteFolder: vi.fn().mockResolvedValue({
      id: "notefolder-mock",
      type: "folder",
      title: "New Folder",
      content: "",
      parentId: null,
      order: 0,
      isPinned: false,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    syncNoteTree: vi.fn().mockResolvedValue(undefined),

    // Custom Sounds
    saveCustomSound: vi.fn().mockResolvedValue(undefined),
    loadCustomSound: vi.fn().mockResolvedValue(null),
    deleteCustomSound: vi.fn().mockResolvedValue(undefined),
    fetchCustomSoundMetas: vi.fn().mockResolvedValue([]),
    fetchDeletedCustomSounds: vi.fn().mockResolvedValue([]),
    restoreCustomSound: vi.fn().mockResolvedValue(undefined),
    permanentDeleteCustomSound: vi.fn().mockResolvedValue(undefined),

    // Calendars
    fetchCalendars: vi.fn().mockResolvedValue([]),
    createCalendar: vi.fn().mockImplementation((id, title, folderId) =>
      Promise.resolve({
        id,
        title,
        folderId,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    ),
    updateCalendar: vi
      .fn()
      .mockImplementation((id, updates) =>
        Promise.resolve({ id, title: "", folderId: "", order: 0, ...updates }),
      ),
    deleteCalendar: vi.fn().mockResolvedValue(undefined),

    // Pomodoro Presets
    fetchPomodoroPresets: vi.fn().mockResolvedValue([]),
    createPomodoroPreset: vi.fn().mockImplementation((preset) =>
      Promise.resolve({
        id: 1,
        createdAt: new Date().toISOString(),
        ...preset,
      }),
    ),
    updatePomodoroPreset: vi.fn().mockResolvedValue({}),
    deletePomodoroPreset: vi.fn().mockResolvedValue(undefined),

    // Routines
    fetchAllRoutines: vi.fn().mockResolvedValue([]),
    createRoutine: vi.fn().mockImplementation((id, title) =>
      Promise.resolve({
        id,
        title,
        startTime: null,
        endTime: null,
        isArchived: false,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    ),
    updateRoutine: vi.fn().mockResolvedValue({}),
    deleteRoutine: vi.fn().mockResolvedValue(undefined),
    fetchDeletedRoutines: vi.fn().mockResolvedValue([]),
    softDeleteRoutine: vi
      .fn()
      .mockResolvedValue({ deletedScheduleItemIds: [] }),
    restoreRoutine: vi.fn().mockResolvedValue(undefined),
    permanentDeleteRoutine: vi.fn().mockResolvedValue(undefined),

    // Routine Tags
    fetchAllRoutineTags: vi.fn().mockResolvedValue([]),
    createRoutineTag: vi
      .fn()
      .mockImplementation((name, color) =>
        Promise.resolve({ id: 1, name, color }),
      ),
    updateRoutineTag: vi
      .fn()
      .mockImplementation((id, updates) =>
        Promise.resolve({ id, name: "", color: "", ...updates }),
      ),
    deleteRoutineTag: vi.fn().mockResolvedValue(undefined),
    fetchAllRoutineTagAssignments: vi.fn().mockResolvedValue([]),
    setTagsForRoutine: vi.fn().mockResolvedValue(undefined),

    // Schedule Items
    fetchScheduleItemsByDate: vi.fn().mockResolvedValue([]),
    fetchScheduleItemsByDateRange: vi.fn().mockResolvedValue([]),
    createScheduleItem: vi
      .fn()
      .mockImplementation((id, date, title, startTime, endTime) =>
        Promise.resolve({
          id,
          date,
          title,
          startTime,
          endTime,
          completed: false,
          completedAt: null,
          routineId: null,
          templateId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      ),
    updateScheduleItem: vi.fn().mockResolvedValue({}),
    deleteScheduleItem: vi.fn().mockResolvedValue(undefined),
    softDeleteScheduleItem: vi.fn().mockResolvedValue(undefined),
    restoreScheduleItem: vi.fn().mockResolvedValue(undefined),
    permanentDeleteScheduleItem: vi.fn().mockResolvedValue(undefined),
    fetchDeletedScheduleItems: vi.fn().mockResolvedValue([]),
    toggleScheduleItemComplete: vi.fn().mockResolvedValue({}),
    bulkCreateScheduleItems: vi.fn().mockResolvedValue([]),

    // Playlists
    fetchPlaylists: vi.fn().mockResolvedValue([]),
    createPlaylist: vi.fn().mockImplementation((id, name) =>
      Promise.resolve({
        id,
        name,
        sortOrder: 0,
        repeatMode: "all",
        isShuffle: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    ),
    updatePlaylist: vi.fn().mockImplementation((id, updates) =>
      Promise.resolve({
        id,
        name: "Updated",
        sortOrder: 0,
        repeatMode: "all",
        isShuffle: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...updates,
      }),
    ),
    deletePlaylist: vi.fn().mockResolvedValue(undefined),
    fetchPlaylistItems: vi.fn().mockResolvedValue([]),
    fetchAllPlaylistItems: vi.fn().mockResolvedValue([]),
    addPlaylistItem: vi
      .fn()
      .mockImplementation((id, playlistId, soundId) =>
        Promise.resolve({ id, playlistId, soundId, sortOrder: 0 }),
      ),
    removePlaylistItem: vi.fn().mockResolvedValue(undefined),
    reorderPlaylistItems: vi.fn().mockResolvedValue(undefined),

    // Data I/O
    exportData: vi.fn().mockResolvedValue(true),
    importData: vi.fn().mockResolvedValue(true),
    resetData: vi.fn().mockResolvedValue(true),

    // Diagnostics
    fetchLogs: vi.fn().mockResolvedValue([]),
    openLogFolder: vi.fn().mockResolvedValue(undefined),
    exportLogs: vi.fn().mockResolvedValue(true),
    fetchMetrics: vi.fn().mockResolvedValue([]),
    resetMetrics: vi.fn().mockResolvedValue(true),
    fetchSystemInfo: vi.fn().mockResolvedValue({
      appVersion: "1.0.0",
      platform: "darwin",
      arch: "arm64",
      dbSizeBytes: 0,
      memoryUsage: { heapUsed: 0, heapTotal: 0, rss: 0 },
      tableCounts: {},
    }),

    // Updater
    checkForUpdates: vi.fn().mockResolvedValue(undefined),
    downloadUpdate: vi.fn().mockResolvedValue(undefined),
    installUpdate: vi.fn().mockResolvedValue(undefined),

    // Databases
    fetchAllDatabases: vi.fn().mockResolvedValue([]),
    fetchDatabaseFull: vi.fn().mockResolvedValue(undefined),
    createDatabase: vi.fn().mockResolvedValue({
      id: "db-mock",
      title: "Untitled",
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    updateDatabase: vi.fn().mockResolvedValue({
      id: "db-mock",
      title: "Updated",
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    softDeleteDatabase: vi.fn().mockResolvedValue(undefined),
    permanentDeleteDatabase: vi.fn().mockResolvedValue(undefined),
    addDatabaseProperty: vi.fn().mockResolvedValue({
      id: "prop-mock",
      databaseId: "db-mock",
      name: "Property",
      type: "text",
      order: 0,
      config: {},
      createdAt: new Date().toISOString(),
    }),
    updateDatabaseProperty: vi.fn().mockResolvedValue(undefined),
    removeDatabaseProperty: vi.fn().mockResolvedValue(undefined),
    addDatabaseRow: vi.fn().mockResolvedValue({
      id: "row-mock",
      databaseId: "db-mock",
      order: 0,
      createdAt: new Date().toISOString(),
    }),
    reorderDatabaseRows: vi.fn().mockResolvedValue(undefined),
    removeDatabaseRow: vi.fn().mockResolvedValue(undefined),
    upsertDatabaseCell: vi.fn().mockResolvedValue({
      id: "cell-mock",
      rowId: "row-mock",
      propertyId: "prop-mock",
      value: "",
    }),

    // App Settings
    getAppSetting: vi.fn().mockResolvedValue(null),
    setAppSetting: vi.fn().mockResolvedValue(undefined),
    getAllAppSettings: vi.fn().mockResolvedValue({}),
    removeAppSetting: vi.fn().mockResolvedValue(undefined),

    // Templates
    fetchAllTemplates: vi.fn().mockResolvedValue([]),
    fetchTemplateById: vi.fn().mockResolvedValue(undefined),
    createTemplate: vi.fn().mockImplementation((id, name) =>
      Promise.resolve({
        id,
        name,
        content: "",
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    ),
    updateTemplate: vi.fn().mockImplementation((id, updates) =>
      Promise.resolve({
        id,
        name: updates.name ?? "Template",
        content: updates.content ?? "",
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    ),
    softDeleteTemplate: vi.fn().mockResolvedValue(undefined),
    permanentDeleteTemplate: vi.fn().mockResolvedValue(undefined),

    // System Integration
    getAutoLaunch: vi.fn().mockResolvedValue(false),
    setAutoLaunch: vi.fn().mockResolvedValue(undefined),
    getStartMinimized: vi.fn().mockResolvedValue(false),
    setStartMinimized: vi.fn().mockResolvedValue(undefined),
    getTrayEnabled: vi.fn().mockResolvedValue(false),
    setTrayEnabled: vi.fn().mockResolvedValue(undefined),
    getGlobalShortcuts: vi.fn().mockResolvedValue({}),
    setGlobalShortcuts: vi.fn().mockResolvedValue(undefined),
    reregisterGlobalShortcuts: vi.fn().mockResolvedValue({ success: true }),
    updateTrayTimer: vi.fn().mockResolvedValue(undefined),

    // Reminders
    getReminderSettings: vi.fn().mockResolvedValue({}),
    setReminderSettings: vi.fn().mockResolvedValue(undefined),

    // Files
    selectFolder: vi.fn().mockResolvedValue(null),
    getFilesRootPath: vi.fn().mockResolvedValue(null),
    listDirectory: vi.fn().mockResolvedValue([]),
    getFileInfo: vi.fn().mockResolvedValue(null),
    readTextFile: vi.fn().mockResolvedValue(""),
    readFile: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    createDirectory: vi.fn().mockResolvedValue(undefined),
    createFile: vi.fn().mockResolvedValue(undefined),
    writeTextFile: vi.fn().mockResolvedValue(undefined),
    renameFile: vi.fn().mockResolvedValue(undefined),
    moveFile: vi.fn().mockResolvedValue(undefined),
    deleteFile: vi.fn().mockResolvedValue(undefined),
    openFileInSystem: vi.fn().mockResolvedValue(undefined),
    copyNoteToFile: vi.fn().mockResolvedValue("/mock/path/note.md"),
    copyMemoToFile: vi.fn().mockResolvedValue("/mock/path/memo.md"),
    convertFileToTiptap: vi.fn().mockResolvedValue({
      title: "Mock",
      content: '{"type":"doc","content":[{"type":"paragraph"}]}',
    }),
    syncConfigure: vi.fn().mockResolvedValue(true),
    syncTrigger: vi
      .fn()
      .mockResolvedValue({ pushed: 0, pulled: 0, timestamp: "" }),
    syncGetStatus: vi.fn().mockResolvedValue({
      enabled: false,
      lastSyncedAt: null,
      deviceId: null,
      url: null,
    }),
    syncDisconnect: vi.fn().mockResolvedValue(undefined),
    syncFullDownload: vi
      .fn()
      .mockResolvedValue({ pushed: 0, pulled: 0, timestamp: "" }),
  };
}
