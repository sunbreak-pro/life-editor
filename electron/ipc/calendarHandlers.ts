import { query, mutation } from "./handlerUtil";
import type { CalendarRepository } from "../database/calendarRepository";

export function registerCalendarHandlers(repo: CalendarRepository): void {
  query("db:calendars:fetchAll", "Calendars", "fetchAll", () =>
    repo.fetchAll(),
  );

  mutation(
    "db:calendars:create",
    "Calendars",
    "create",
    "calendar",
    "create",
    (_event, id: string, title: string, folderId: string) =>
      repo.create(id, title, folderId),
  );

  mutation(
    "db:calendars:update",
    "Calendars",
    "update",
    "calendar",
    "update",
    (
      _event,
      id: string,
      updates: { title?: string; folderId?: string; order?: number },
    ) => repo.update(id, updates),
  );

  mutation(
    "db:calendars:delete",
    "Calendars",
    "delete",
    "calendar",
    "delete",
    (_event, id: string) => {
      repo.delete(id);
    },
  );
}
