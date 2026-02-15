import { ipcMain } from "electron";
import type { TaskRepository } from "../database/taskRepository";
import type { TimerRepository } from "../database/timerRepository";
import type { SoundRepository } from "../database/soundRepository";
import type { MemoRepository } from "../database/memoRepository";
import type { MigrationPayload } from "../types";
import { loggedHandler } from "./handlerUtil";

interface AppRepositories {
  tasks: TaskRepository;
  timer: TimerRepository;
  sound: SoundRepository;
  memo: MemoRepository;
}

export function registerAppHandlers(repos: AppRepositories): void {
  ipcMain.handle(
    "app:migrateFromLocalStorage",
    loggedHandler(
      "App",
      "migrateFromLocalStorage",
      (_event, payload: MigrationPayload) => {
        // Import tasks
        if (payload.tasks && payload.tasks.length > 0) {
          repos.tasks.syncTree(payload.tasks);
        }

        // Import timer settings
        if (payload.timerSettings) {
          repos.timer.updateSettings(payload.timerSettings);
        }

        // Import sound settings
        if (payload.soundSettings) {
          for (const s of payload.soundSettings) {
            repos.sound.updateSetting(s.soundType, s.volume, s.enabled);
          }
        }

        // Import memos
        if (payload.memos) {
          for (const m of payload.memos) {
            repos.memo.upsert(m.date, m.content);
          }
        }

        return { success: true };
      },
    ),
  );
}
