import { useEffect, useState } from "react";
import {
  addDaysKey,
  dueReminders,
  getDesktopNotificationBridge,
  resolveRemindersEnabled,
  todayDateKey,
  useMinuteClock,
  useSyncDomains,
  useToast,
  useTranslation,
  type DataService,
  type ScheduleItem,
} from "@life-editor/shared";

/*
 * Headless event-reminder sweep (#1374) — the third `return null` bridge in
 * the global Provider chain, beside MaterialsCountsBridge.
 *
 * GLOBAL, not section-layer, on purpose: ScheduleItemsProvider is mounted
 * inside the Schedule section body and torn down the moment you navigate away
 * (web/src/sectionDescriptors.tsx). A reminder wired to it would stop firing
 * as soon as the user opened Notes — which is most of the time a reminder is
 * worth having.
 *
 * A SWEEP once a minute rather than a setTimeout per event; the reasoning
 * lives with the pure decision in shared/src/utils/reminderSchedule.ts.
 *
 * NOT gated on isNativeMobile(). The gate is one layer down and already
 * there: getDesktopNotificationBridge() returns null off Electron, so the
 * Capacitor shell and the public Web get the in-app toast and nothing else —
 * exactly CLAUDE.md §2's "OS notification is Desktop-only". A Provider-level
 * mobile gate would silently kill the IN-APP reminder on a phone too.
 */

/*
 * The fired ledger, at MODULE scope rather than in a useRef.
 *
 * "Once per page load" is a page-scoped fact, and StrictMode remounts every
 * component on mount in dev — a ref would be discarded and the same reminder
 * would toast twice, in exactly the build a reviewer checks the DoD's
 * no-duplicates clause in. The cost is a module singleton, kept in this file
 * and never exported from shared/.
 *
 * Values are the ms the key fired at, so the map can be pruned rather than
 * growing for the life of the session.
 */
const FIRED = new Map<string, number>();

/** Tests only — the module singleton has to be resettable between cases. */
export function __resetReminderLedger(): void {
  FIRED.clear();
}

const PRUNE_AFTER_MS = 24 * 60 * 60 * 1000;

export function ScheduleReminderBridge({
  dataService: ds,
}: {
  dataService: DataService;
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { now } = useMinuteClock();
  const scheduleVersion = useSyncDomains("schedule");
  const [items, setItems] = useState<ScheduleItem[]>([]);

  const dayKey = todayDateKey();

  /*
   * Today AND tomorrow: a 00:20 event with a 30-minute lead is due at 23:50
   * TODAY, so a today-only window would never see it. Refetched on a Realtime
   * schedule bump and on the day rollover — nothing else moves the row set.
   */
  useEffect(() => {
    let cancelled = false;
    void ds
      .fetchScheduleItemsByDateRange(dayKey, addDaysKey(dayKey, 1))
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      // A failed refetch keeps the last known rows: a transient blip must not
      // silently disarm every reminder until the next bump.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [ds, dayKey, scheduleVersion]);

  useEffect(() => {
    if (!resolveRemindersEnabled()) return;
    const nowMs = now.getTime();
    for (const due of dueReminders(items, now, new Set(FIRED.keys()))) {
      FIRED.set(due.key, nowMs);
      const body = t("schedule.reminderToast", {
        title: due.title,
        time: due.startTime,
      });
      showToast("info", body, { durationMs: 10_000 });
      // Fire-and-forget with a catch: an absent bridge (Web / Capacitor) or a
      // rejecting one (permission denied) degrades to the toast alone, which
      // is the DoD's graceful-degradation clause.
      void getDesktopNotificationBridge()
        ?.notify({ title: due.title, body })
        .catch(() => undefined);
    }
    for (const [key, firedAt] of FIRED) {
      if (nowMs - firedAt > PRUNE_AFTER_MS) FIRED.delete(key);
    }
  }, [items, now, t, showToast]);

  return null;
}
