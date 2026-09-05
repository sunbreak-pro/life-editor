import { useEffect, useState } from "react";
import {
  getDataService,
  logServiceError,
  totalWorkMinutesForItem,
  useSyncDomains,
} from "@life-editor/shared";

/*
 * Logged work time for the selected event (#1375).
 *
 * The Work timer can be started against a calendar entry since 0029, and the
 * event's own editor is where "how long did this actually take" belongs — the
 * replacement for the completion pill #1373 removed. Read-only: the number is
 * derived from `timer_sessions` every time, so there is no second copy of it on
 * the event to drift.
 *
 * Its own read rather than a prop drilled from CalendarTab: the calendar does
 * not fetch sessions for any other reason, and pulling the whole log on every
 * grid render to serve one panel would cost far more than the one filtered
 * request this makes when a panel opens. Hosts may call `getDataService()`
 * (§6.4); the pane underneath stays pure and receives a finished string.
 *
 * `getDataService()` THROWS synchronously when the app has no Supabase config,
 * so the call sits inside the effect's try — the same shape SettingsScreen uses.
 * A failure yields null, which the caller renders the same as "nothing logged"
 * rather than as a confident zero.
 */
export function useEventWorkTime(eventId: string | null): number | null {
  /*
   * The result carries the id it belongs to, and "which event is this for" is
   * DERIVED from comparing that id against the current one — the same trick
   * `useDomainLoad` uses, and for the same reason. Clearing on a switch by
   * writing `setMinutes(null)` in the effect body would be a state write during
   * an effect (an extra render pass, and the `set-state-in-effect` rule turned
   * off for this file) that changes the timing by nothing at all: either way
   * the panel shows "nothing logged" until the new read lands. Without the
   * guard in SOME form, switching from an event with logged time to one with
   * none would keep showing the previous event's number — the worst possible
   * moment to be wrong about it.
   */
  const [loaded, setLoaded] = useState<{
    id: string;
    minutes: number | null;
  } | null>(null);
  // The log is its own Sync domain (#993), so this follows `sessions` alone —
  // an event edit does not change the time already logged against it.
  const syncVersion = useSyncDomains("sessions");

  useEffect(() => {
    if (eventId === null) return;
    let cancelled = false;
    void (async () => {
      try {
        const sessions = await getDataService().fetchSessionsByEventId(eventId);
        if (!cancelled) {
          setLoaded({
            id: eventId,
            minutes: totalWorkMinutesForItem(sessions, eventId),
          });
        }
      } catch (e) {
        // null, not 0: a failed read means "we cannot say", and the caller
        // renders that the same as "nothing logged" rather than asserting an
        // hour that may well exist.
        if (!cancelled) setLoaded({ id: eventId, minutes: null });
        logServiceError("Schedule", "fetchSessionsByEventId", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, syncVersion]);

  return loaded !== null && loaded.id === eventId ? loaded.minutes : null;
}
