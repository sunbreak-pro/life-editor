import { query, mutation } from "./handlerUtil";
import type { PomodoroPresetRepository } from "../database/pomodoroPresetRepository";

export function registerPomodoroPresetHandlers(
  repo: PomodoroPresetRepository,
): void {
  query("db:timer:fetchPomodoroPresets", "PomodoroPresets", "fetchAll", () => {
    return repo.fetchAll();
  });

  mutation(
    "db:timer:createPomodoroPreset",
    "PomodoroPresets",
    "create",
    "pomodoroPreset",
    "create",
    (_event, preset) => {
      return repo.create(preset);
    },
    (_args, result) => (result as { id?: number })?.id,
  );

  mutation(
    "db:timer:updatePomodoroPreset",
    "PomodoroPresets",
    "update",
    "pomodoroPreset",
    "update",
    (_event, id: number, updates) => {
      return repo.update(id, updates);
    },
  );

  mutation(
    "db:timer:deletePomodoroPreset",
    "PomodoroPresets",
    "delete",
    "pomodoroPreset",
    "delete",
    (_event, id: number) => {
      repo.delete(id);
    },
  );
}
