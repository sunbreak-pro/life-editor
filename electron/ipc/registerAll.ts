import log from "../logger";
import { ipcMain } from "electron";
import type Database from "better-sqlite3";
import { createTaskRepository } from "../database/taskRepository";
import { createTimerRepository } from "../database/timerRepository";
import { createSoundRepository } from "../database/soundRepository";
import { createMemoRepository } from "../database/memoRepository";
import { registerTaskHandlers } from "./taskHandlers";
import { registerTimerHandlers } from "./timerHandlers";
import { registerSoundHandlers } from "./soundHandlers";
import { registerMemoHandlers } from "./memoHandlers";
import { registerAppHandlers } from "./appHandlers";
import { createNoteRepository } from "../database/noteRepository";
import { createCustomSoundRepository } from "../database/customSoundRepository";
import { registerCustomSoundHandlers } from "./customSoundHandlers";
import { registerNoteHandlers } from "./noteHandlers";

import { createCalendarRepository } from "../database/calendarRepository";
import { registerCalendarHandlers } from "./calendarHandlers";
import { registerDataIOHandlers } from "./dataIOHandlers";
import { registerDiagnosticsHandlers } from "./diagnosticsHandlers";
import { registerUpdaterHandlers } from "./updaterHandlers";
import { createPomodoroPresetRepository } from "../database/pomodoroPresetRepository";
import { registerPomodoroPresetHandlers } from "./pomodoroPresetHandlers";
import { createRoutineRepository } from "../database/routineRepository";
import { registerRoutineHandlers } from "./routineHandlers";
import { createRoutineTagRepository } from "../database/routineTagRepository";
import { registerRoutineTagHandlers } from "./routineTagHandlers";
import { createScheduleItemRepository } from "../database/scheduleItemRepository";
import { registerScheduleItemHandlers } from "./scheduleItemHandlers";
import { createPlaylistRepository } from "../database/playlistRepository";
import { registerPlaylistHandlers } from "./playlistHandlers";
import { createWikiTagRepository } from "../database/wikiTagRepository";
import { registerWikiTagHandlers } from "./wikiTagHandlers";
import { createWikiTagConnectionRepository } from "../database/wikiTagConnectionRepository";
import { registerWikiTagConnectionHandlers } from "./wikiTagConnectionHandlers";
import { createWikiTagGroupRepository } from "../database/wikiTagGroupRepository";
import { registerWikiTagGroupHandlers } from "./wikiTagGroupHandlers";
import { createNoteConnectionRepository } from "../database/noteConnectionRepository";
import { registerNoteConnectionHandlers } from "./noteConnectionHandlers";
import { createTimeMemoRepository } from "../database/timeMemoRepository";
import { registerTimeMemoHandlers } from "./timeMemoHandlers";
import { createPaperBoardRepository } from "../database/paperBoardRepository";
import { registerPaperBoardHandlers } from "./paperBoardHandlers";
import { createRoutineGroupRepository } from "../database/routineGroupRepository";
import { registerRoutineGroupHandlers } from "./routineGroupHandlers";
import { createCalendarTagRepository } from "../database/calendarTagRepository";
import { registerCalendarTagHandlers } from "./calendarTagHandlers";
import { createAttachmentRepository } from "../database/attachmentRepository";
import { registerAttachmentHandlers } from "./attachmentHandlers";
import { registerShellHandlers } from "./shellHandlers";
import { createDatabaseRepository } from "../database/databaseRepository";
import { registerDatabaseHandlers } from "./databaseHandlers";
import { createAppSettingsRepository } from "../database/appSettingsRepository";
import { registerSettingsHandlers } from "./settingsHandlers";
import { registerSystemHandlers } from "./systemHandlers";
import { wrapHandler } from "./ipcMetrics";

export function registerAllHandlers(db: Database.Database): void {
  // Stable repos (V1-V5 tables) — safe to create eagerly
  const tasks = createTaskRepository(db);
  const timer = createTimerRepository(db);
  const memo = createMemoRepository(db);
  const notes = createNoteRepository(db);

  // Wrap ipcMain.handle to auto-instrument all handlers with metrics
  const originalHandle = ipcMain.handle.bind(ipcMain);
  ipcMain.handle = (channel: string, listener: any) => {
    return originalHandle(channel, wrapHandler(channel, listener));
  };

  // sound repo is shared between 'Sound' and 'App' registrations
  // to avoid double creation (and double failure if tables are missing)
  let soundRepo: ReturnType<typeof createSoundRepository> | null = null;
  function getSoundRepo() {
    if (!soundRepo) soundRepo = createSoundRepository(db);
    return soundRepo;
  }

  // sound (V7) repo is created inside closure
  // so that db.prepare() failures are caught per-module, not globally
  const registrations: [string, () => void][] = [
    ["Tasks", () => registerTaskHandlers(tasks)],
    ["Timer", () => registerTimerHandlers(timer)],
    ["Sound", () => registerSoundHandlers(getSoundRepo())],
    ["Memo", () => registerMemoHandlers(memo)],
    ["Notes", () => registerNoteHandlers(notes)],
    [
      "CustomSound",
      () => registerCustomSoundHandlers(createCustomSoundRepository()),
    ],

    ["Calendars", () => registerCalendarHandlers(createCalendarRepository(db))],
    [
      "App",
      () => registerAppHandlers({ tasks, timer, sound: getSoundRepo(), memo }),
    ],
    ["DataIO", () => registerDataIOHandlers(db)],
    ["Diagnostics", () => registerDiagnosticsHandlers(db)],
    ["Updater", () => registerUpdaterHandlers()],
    [
      "PomodoroPresets",
      () => registerPomodoroPresetHandlers(createPomodoroPresetRepository(db)),
    ],
    ["Routines", () => registerRoutineHandlers(createRoutineRepository(db))],
    [
      "RoutineTags",
      () => registerRoutineTagHandlers(createRoutineTagRepository(db)),
    ],
    [
      "ScheduleItems",
      () => registerScheduleItemHandlers(createScheduleItemRepository(db)),
    ],
    ["Playlists", () => registerPlaylistHandlers(createPlaylistRepository(db))],
    ["WikiTags", () => registerWikiTagHandlers(createWikiTagRepository(db))],
    [
      "WikiTagConnections",
      () =>
        registerWikiTagConnectionHandlers(
          createWikiTagConnectionRepository(db),
        ),
    ],
    [
      "WikiTagGroups",
      () => registerWikiTagGroupHandlers(createWikiTagGroupRepository(db)),
    ],
    [
      "NoteConnections",
      () => registerNoteConnectionHandlers(createNoteConnectionRepository(db)),
    ],
    ["TimeMemos", () => registerTimeMemoHandlers(createTimeMemoRepository(db))],
    [
      "PaperBoards",
      () => registerPaperBoardHandlers(createPaperBoardRepository(db)),
    ],
    [
      "RoutineGroups",
      () => registerRoutineGroupHandlers(createRoutineGroupRepository(db)),
    ],
    [
      "CalendarTags",
      () => registerCalendarTagHandlers(createCalendarTagRepository(db)),
    ],
    [
      "Attachments",
      () => registerAttachmentHandlers(createAttachmentRepository()),
    ],
    ["Shell", () => registerShellHandlers()],
    ["Databases", () => registerDatabaseHandlers(createDatabaseRepository(db))],
    [
      "AppSettings",
      () => {
        const repo = createAppSettingsRepository(db);
        registerSettingsHandlers(repo);
        registerSystemHandlers(repo);
      },
    ],
  ];

  for (const [name, register] of registrations) {
    try {
      register();
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e));
      log.error(
        `[IPC] Failed to register ${name} handlers: ${err.message}\n${err.stack}`,
      );
      if (err.message.includes("no such table")) {
        log.error(
          `[IPC] Hint: Table missing — check if migration ran. Current user_version: ${db.pragma("user_version", { simple: true })}`,
        );
      }
    }
  }

  // Restore original handle
  ipcMain.handle = originalHandle;
}
