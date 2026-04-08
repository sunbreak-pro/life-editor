import { query, mutation } from "./handlerUtil";
import type { AppSettingsRepository } from "../database/appSettingsRepository";

export function registerSettingsHandlers(repo: AppSettingsRepository): void {
  query("settings:get", "Settings", "get", (_event, key: string) =>
    repo.get(key),
  );

  query("settings:getAll", "Settings", "getAll", () => repo.getAll());

  mutation(
    "settings:set",
    "Settings",
    "set",
    "settings",
    "update",
    (_event, key: string, value: string) => repo.set(key, value),
    (args) => args[1] as string,
  );

  mutation(
    "settings:remove",
    "Settings",
    "remove",
    "settings",
    "delete",
    (_event, key: string) => repo.remove(key),
    (args) => args[1] as string,
  );
}
