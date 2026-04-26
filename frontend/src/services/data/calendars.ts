import type { CalendarNode } from "../../types/calendar";
import type { CalendarTag } from "../../types/calendarTag";
import { tauriInvoke } from "../bridge";

export const calendarsApi = {
  fetchCalendars(): Promise<CalendarNode[]> {
    return tauriInvoke("db_calendars_fetch_all");
  },
  createCalendar(
    id: string,
    title: string,
    folderId: string,
  ): Promise<CalendarNode> {
    return tauriInvoke("db_calendars_create", {
      id,
      title,
      folderId,
    });
  },
  updateCalendar(
    id: string,
    updates: Partial<Pick<CalendarNode, "title" | "folderId" | "order">>,
  ): Promise<CalendarNode> {
    return tauriInvoke("db_calendars_update", { id, updates });
  },
  deleteCalendar(id: string): Promise<void> {
    return tauriInvoke("db_calendars_delete", { id });
  },
  fetchCalendarTags(): Promise<CalendarTag[]> {
    return tauriInvoke("db_calendar_tags_fetch_all");
  },
  createCalendarTag(name: string, color: string): Promise<CalendarTag> {
    return tauriInvoke("db_calendar_tags_create", { name, color });
  },
  updateCalendarTag(
    id: number,
    updates: Partial<
      Pick<CalendarTag, "name" | "color" | "textColor" | "order">
    >,
  ): Promise<CalendarTag> {
    return tauriInvoke("db_calendar_tags_update", { id, updates });
  },
  deleteCalendarTag(id: number): Promise<void> {
    return tauriInvoke("db_calendar_tags_delete", { id });
  },
  fetchAllCalendarTagAssignments(): Promise<
    Array<{
      entityType: "task" | "schedule_item";
      entityId: string;
      tagId: number;
    }>
  > {
    return tauriInvoke("db_calendar_tags_fetch_all_assignments");
  },
  setTagForEntity(
    entityType: "task" | "schedule_item",
    entityId: string,
    tagId: number | null,
  ): Promise<void> {
    return tauriInvoke("db_calendar_tags_set_tag_for_entity", {
      entityType,
      entityId,
      tagId,
    });
  },
  setTagsForScheduleItem(
    scheduleItemId: string,
    tagIds: number[],
  ): Promise<void> {
    return tauriInvoke("db_calendar_tags_set_tags_for_schedule_item", {
      scheduleItemId,
      tagIds,
    });
  },
};
