import { normalizeDesktopView } from "../utils/calendarView";
import type { DesktopCalendarView } from "../utils/calendarView";
import { useLocalStorage } from "./useLocalStorage";

/*
 * Schedule initial-view preference (#1174). One persisted key:
 *   - `life-editor-schedule-initial-view` = "day" | "week" | "month" — the
 *     Desktop calendar view the Schedule section opens on.
 *
 * Same shape as the startup-section pref (§216): a PURE resolver the host uses
 * to SEED `useState` on first render, plus a Settings-side hook for the write
 * side. Seeding rather than syncing is deliberate — `view` is live state the
 * header's switcher owns for the rest of the session, so the pref is only ever
 * read once, at the moment the section mounts. Changing it therefore applies
 * to the NEXT visit to Schedule, which is what "initial view" means.
 *
 * The stored string is run through `normalizeDesktopView`, so a hand-edited or
 * retired value ("list" / "time" from the Mobile option set #467) resolves to
 * something drawable instead of leaving the calendar blank. Narrow widths pin
 * the effective view to "month" regardless (#878) — this pref is the Desktop
 * choice, exactly like the `view` state it seeds.
 */
export const SCHEDULE_INITIAL_VIEW_STORAGE_KEY =
  "life-editor-schedule-initial-view";

/**
 * The choices, in the order the Settings card offers them. Exported so the
 * host builds its segment from the same list the resolver accepts — a fourth
 * view would otherwise have to be added in two places.
 */
export const SCHEDULE_INITIAL_VIEWS = ["day", "week", "month"] as const;

/** Fallback when nothing valid is stored — the historical hard-coded default. */
export const DEFAULT_SCHEDULE_INITIAL_VIEW: DesktopCalendarView = "week";

/**
 * Resolve the calendar view Schedule opens on (pure; reads localStorage).
 * Anything unreadable or unrecognised falls back to the default.
 */
export function resolveInitialCalendarView(): DesktopCalendarView {
  try {
    const stored = localStorage.getItem(SCHEDULE_INITIAL_VIEW_STORAGE_KEY);
    if (stored === null) return DEFAULT_SCHEDULE_INITIAL_VIEW;
    return normalizeDesktopView(stored);
  } catch {
    return DEFAULT_SCHEDULE_INITIAL_VIEW;
  }
}

/** Settings-side read/write of the Schedule initial view (value + setter). */
export function useScheduleInitialViewPref(): {
  initialView: DesktopCalendarView;
  setInitialView: (view: DesktopCalendarView) => void;
} {
  const [initialView, setInitialView] = useLocalStorage<DesktopCalendarView>(
    SCHEDULE_INITIAL_VIEW_STORAGE_KEY,
    DEFAULT_SCHEDULE_INITIAL_VIEW,
    {
      serialize: (v) => v,
      deserialize: normalizeDesktopView,
    },
  );
  return { initialView, setInitialView };
}
