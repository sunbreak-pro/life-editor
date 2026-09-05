import { dateFromKey } from "./scheduleGridLayout";
import type { ScheduleItem } from "../types/schedule";

/*
 * Which event reminders are due right now (#1374) — the whole decision as a
 * pure function, so it is testable in node with no React and no jsdom.
 *
 * A SWEEP, not a timer per event. The host calls `dueReminders` once a minute
 * off the same clock the calendar already ticks (useMinuteClock), which is the
 * shape TimerContext settled on for the same reasons:
 *   - a `setTimeout` has to be re-armed on every Realtime bump (any schedule
 *     write, including the app's own), so it needs a fired-set to avoid
 *     double-firing anyway — at which point the timeout is a second mechanism
 *     buying nothing;
 *   - Chromium clamps background timers and a machine sleep drops the fire
 *     outright, while a sweep that compares `Date.now()` re-derives the right
 *     answer after any sleep, throttle or clock change.
 *
 * CATCH-UP RULE: a reminder that came due while the app was closed fires IF
 * the event has not started yet (`due <= now && now < start`), and evaporates
 * silently once it has. "It is about to start" is the whole message — telling
 * someone at 14:10 that a 14:00 meeting was about to begin changes nothing,
 * and the Schedule screen already shows it. The window is self-bounding (the
 * widest lead offered is 60 minutes), so there is no "how far back" constant
 * and no persisted "last swept at": open the app at 09:52 and the 10:00 event
 * whose reminder was due at 09:50 still tells you, while last night's do not
 * arrive as a wall of toasts.
 *
 * DEDUPE: the key is `${id}@${dueInstantMs}`. The same row always mints the
 * same key, so a re-render or a re-sync is a no-op; two different days can
 * never collide; and moving the event or changing its lead time mints a NEW
 * key, which is correct — that is a different instant to be reminded about.
 */

/** Lead times the UI offers, in minutes, in the order it offers them. */
export const REMINDER_LEAD_CHOICES = [5, 10, 15, 30, 60] as const;

/** What a new event gets when the user has not chosen otherwise. */
export const DEFAULT_REMINDER_LEAD_MINUTES = 10;

export interface ReminderDue {
  /** The event's id. */
  id: string;
  title: string;
  /** "HH:MM" — the event's own start, for the notification body. */
  startTime: string;
  /** Dedupe key; see the header. */
  key: string;
}

/** Dedupe key for one row at one due instant. */
export function reminderKey(id: string, dueMs: number): string {
  return `${id}@${dueMs}`;
}

/**
 * The instant this item's reminder is due, in ms, or null when the row cannot
 * have one: no offset set, all-day (no clock time to lead), no start time, or
 * already deleted / skipped.
 *
 * Local time throughout (`dateFromKey`), the same helper the grid geometry
 * uses, so the comparison never crosses a UTC boundary.
 */
export function reminderDueAt(item: ScheduleItem): number | null {
  if (item.reminderOffset == null) return null;
  if (item.isAllDay) return null;
  if (!item.startTime) return null;
  if (item.isDeleted || item.isDismissed) return null;
  const start = dateFromKey(item.date, item.startTime).getTime();
  if (!Number.isFinite(start)) return null;
  return start - item.reminderOffset * 60_000;
}

/**
 * The reminders to raise on this sweep: due, not yet started, and not already
 * in `fired`.
 */
export function dueReminders(
  items: readonly ScheduleItem[],
  now: Date,
  fired: ReadonlySet<string>,
): ReminderDue[] {
  const nowMs = now.getTime();
  const out: ReminderDue[] = [];
  for (const item of items) {
    const due = reminderDueAt(item);
    if (due === null) continue;
    if (nowMs < due) continue;
    const startMs = dateFromKey(item.date, item.startTime).getTime();
    // Already begun — see the catch-up rule in the header.
    if (nowMs >= startMs) continue;
    const key = reminderKey(item.id, due);
    if (fired.has(key)) continue;
    out.push({ id: item.id, title: item.title, startTime: item.startTime, key });
  }
  return out;
}
