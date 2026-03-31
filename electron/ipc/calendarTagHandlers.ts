import { query, mutation } from "./handlerUtil";
import type { CalendarTagRepository } from "../database/calendarTagRepository";
import type { CalendarTag } from "../types";

export function registerCalendarTagHandlers(repo: CalendarTagRepository): void {
  query("db:calendarTags:fetchAll", "CalendarTags", "fetchAll", () => {
    return repo.fetchAll();
  });

  mutation(
    "db:calendarTags:create",
    "CalendarTags",
    "create",
    "calendarTag",
    "create",
    (_event, name: string, color: string) => {
      return repo.create(name, color);
    },
    (_args, result) => (result as { id?: number })?.id,
  );

  mutation(
    "db:calendarTags:update",
    "CalendarTags",
    "update",
    "calendarTag",
    "update",
    (
      _event,
      id: number,
      updates: Partial<
        Pick<CalendarTag, "name" | "color" | "textColor" | "order">
      >,
    ) => {
      return repo.update(id, updates);
    },
  );

  mutation(
    "db:calendarTags:delete",
    "CalendarTags",
    "delete",
    "calendarTag",
    "delete",
    (_event, id: number) => {
      repo.delete(id);
    },
  );

  mutation(
    "db:calendarTags:setTagsForScheduleItem",
    "CalendarTags",
    "setTagsForScheduleItem",
    "calendarTag",
    "bulk",
    (_event, scheduleItemId: string, tagIds: number[]) => {
      repo.setTagsForScheduleItem(scheduleItemId, tagIds);
    },
  );

  query(
    "db:calendarTags:fetchAllAssignments",
    "CalendarTags",
    "fetchAllAssignments",
    () => {
      return repo.fetchAllAssignments();
    },
  );
}
