import type { ScheduleItem } from "../types/schedule";
import type { DataService } from "../services/DataService";
import { logServiceError } from "../utils/logError";
import { resolveDefaultReminderMinutes } from "./useReminderPrefs";

/*
 * The create-time reminder (#1374), shared by every path that creates an
 * event (#1950).
 *
 * Schedule's create (useScheduleItemsCRUD) resolved the Settings default and
 * wrote it onto the row; the morning paper's create called the DataService
 * directly and did neither, so an event booked from the paper never reminded.
 * The decision and the write now live here and both paths call them — a
 * create surface that skips this is the bug, not a variant.
 */

/**
 * The reminder a new event is born with, or null for none.
 *
 * An all-day row has no clock time to lead, so it never gets one however the
 * pref is set. Otherwise the caller's value wins (null included), and the
 * Settings default fills in when the caller said nothing.
 */
export function resolveCreateReminderOffset(
  isAllDay: boolean,
  requested?: number | null,
): number | null {
  if (isAllDay) return null;
  return requested !== undefined ? requested : resolveDefaultReminderMinutes();
}

/**
 * Write the resolved reminder onto a row that has just been created.
 *
 * A follow-up patch rather than another positional argument on the create
 * signature every call site and the Supabase service share. Skipped when there
 * is no reminder, so the common path is still one write.
 *
 * Never rejects: the row already exists here, so a failed patch means "saved
 * without a reminder", not "create failed". A caller that let it fall through
 * to its own catch would report a failure for an event that is on the
 * calendar.
 */
export function applyCreateReminder(
  ds: DataService,
  saved: ScheduleItem,
  reminderOffset: number | null,
): Promise<ScheduleItem> {
  if (reminderOffset === null) return Promise.resolve(saved);
  return Promise.resolve()
    .then(() => ds.updateScheduleItem(saved.id, { reminderOffset }))
    .catch((e: unknown) => {
      logServiceError("ScheduleItems", "createReminder", e);
      return saved;
    });
}
