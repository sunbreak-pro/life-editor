import {
  DEFAULT_REMINDER_LEAD_MINUTES,
  REMINDER_LEAD_CHOICES,
} from "../utils/reminderSchedule";
import { useLocalStorage } from "./useLocalStorage";

/*
 * Event-reminder prefs (#1374) — the same resolver + hook shape as the
 * Schedule initial-view pref. Two persisted keys:
 *   - `life-editor-reminders-enabled` = "true" | "false" — the master switch.
 *   - `life-editor-reminder-default-minutes` = one of REMINDER_LEAD_CHOICES —
 *     what a NEWLY created event gets.
 *
 * The default is applied AT CREATE TIME, written onto the row, rather than
 * resolved at read time. Read-time inheritance would leave the DB unable to
 * tell "no reminder" from "not decided yet": changing the default here would
 * silently re-arm every past event that never had one. Writing it down makes
 * `events_payload.reminder_offset_min` the single source of truth, with NULL
 * meaning "no reminder" and nothing else.
 *
 * The switch is read by the sweep (the bridge) rather than gating the write,
 * so turning it off silences reminders without forgetting what each event was
 * set to.
 */

export const REMINDERS_ENABLED_STORAGE_KEY = "life-editor-reminders-enabled";
export const REMINDER_DEFAULT_MINUTES_STORAGE_KEY =
  "life-editor-reminder-default-minutes";

/** Resolve the master switch (pure; reads localStorage). Default ON. */
export function resolveRemindersEnabled(): boolean {
  try {
    return localStorage.getItem(REMINDERS_ENABLED_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

/** Parse a stored lead time, falling back when it is not one we offer. */
export function parseReminderLeadMinutes(raw: string | null): number {
  const n = Number(raw);
  return (REMINDER_LEAD_CHOICES as readonly number[]).includes(n)
    ? n
    : DEFAULT_REMINDER_LEAD_MINUTES;
}

/** Resolve the create-time default (pure; reads localStorage). */
export function resolveDefaultReminderMinutes(): number {
  try {
    return parseReminderLeadMinutes(
      localStorage.getItem(REMINDER_DEFAULT_MINUTES_STORAGE_KEY),
    );
  } catch {
    return DEFAULT_REMINDER_LEAD_MINUTES;
  }
}

/** Settings-side read/write of both prefs (values + setters). */
export function useReminderPrefs(): {
  remindersEnabled: boolean;
  setRemindersEnabled: (on: boolean) => void;
  defaultLeadMinutes: number;
  setDefaultLeadMinutes: (minutes: number) => void;
} {
  const [remindersEnabled, setRemindersEnabled] = useLocalStorage<boolean>(
    REMINDERS_ENABLED_STORAGE_KEY,
    true,
    {
      serialize: (v) => String(v),
      deserialize: (raw) => raw !== "false",
    },
  );
  const [defaultLeadMinutes, setDefaultLeadMinutes] = useLocalStorage<number>(
    REMINDER_DEFAULT_MINUTES_STORAGE_KEY,
    DEFAULT_REMINDER_LEAD_MINUTES,
    {
      serialize: (v) => String(v),
      deserialize: parseReminderLeadMinutes,
    },
  );
  return {
    remindersEnabled,
    setRemindersEnabled,
    defaultLeadMinutes,
    setDefaultLeadMinutes,
  };
}
