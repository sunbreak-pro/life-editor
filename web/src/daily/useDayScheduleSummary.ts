import { useEffect, useMemo, useState } from "react";
import {
  useSyncDomains,
  type DailyEveningScheduleEntry,
  type DataService,
  type ScheduleItem,
} from "@life-editor/shared";

/*
 * The selected day's schedule, compacted for the Daily tab's evening card
 * (#1046). Read-only: the card is a look back at the day, not a place to
 * work the list — completing / editing stays on Schedule and the papers.
 *
 * DataService is optional because DailyView's own `dataService` prop is (it
 * arrived for the "[[" link pool): without it the card simply has no
 * schedule block. Re-fetches on the schedule domain's Realtime bumps
 * (rules/frontend.md §Sync).
 */
export function useDayScheduleSummary(
  ds: DataService | undefined,
  date: string,
): DailyEveningScheduleEntry[] {
  const syncVersion = useSyncDomains("schedule");
  // The loaded rows carry the date they answer for, so switching days shows
  // an empty block until the new day resolves — never the previous day's
  // rows under the new day's heading.
  const [loaded, setLoaded] = useState<{
    date: string;
    items: ScheduleItem[];
  }>({ date, items: [] });

  useEffect(() => {
    if (ds === undefined) return;
    let cancelled = false;
    ds.fetchScheduleItemsByDate(date)
      .then((items) => {
        if (!cancelled) setLoaded({ date, items });
      })
      .catch((err: unknown) => {
        // A read for a passive summary: keep whatever was shown, no toast.
        console.error("[DailyView] day schedule fetch failed", err);
      });
    return () => {
      cancelled = true;
    };
  }, [ds, date, syncVersion]);

  return useMemo(() => {
    const items = loaded.date === date ? loaded.items : [];
    const mapped = items.map((item) => ({
      id: item.id,
      title: item.title,
      startTime: item.startTime,
      isAllDay: item.isAllDay === true,
      completed: item.completed,
    }));
    // All-day rows first, then by start time — the papers' reading order.
    return [
      ...mapped.filter((e) => e.isAllDay),
      ...mapped
        .filter((e) => !e.isAllDay)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    ];
  }, [loaded, date]);
}
