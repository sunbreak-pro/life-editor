import { useCallback, useEffect, useMemo, useState } from "react";
import {
  logServiceError,
  useSyncDomains,
  useTranslation,
  type DataService,
  type ItemCreateEventPool,
  type ScheduleItem,
} from "@life-editor/shared";

/*
 * useExistingEventPool (#2406) — what the creation panel's event 「既存から選ぶ」
 * lists: every live event (`fetchEvents`: not trashed, not dismissed), newest
 * day first.
 *
 * A repeating series counts once. Its occurrences all read the same, so the
 * series is one row, standing for its latest occurrence. Events that merely
 * share a title stay separate rows: they are separate items, and may differ in
 * time and tags. Holidays are absent because they are computed, not stored.
 *
 * `fetchEvents` has no date bound and pages through the whole event history, so
 * it runs once the user asks for this source, not on every opening of the panel
 * (the note list next door is a far smaller read). The ask lasts one opening,
 * since the panel starts each opening back on 新規作成. The DataService is
 * injected (§3.1), and a list that could not be read says so rather than
 * claiming there are no events.
 */

export interface ExistingEventPoolApi {
  /** For `pools.events`. */
  eventPool: ItemCreateEventPool;
  /** The listed event behind a picked row. */
  findEvent: (id: string) => ScheduleItem | undefined;
}

/** One row per series, latest day first. Exported for its test. */
export function existingEventRows(events: readonly ScheduleItem[]) {
  const seenSeries = new Set<string>();
  return [...events]
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || a.title.localeCompare(b.title),
    )
    .filter((event) => {
      if (!event.routineId) return true;
      if (seenSeries.has(event.routineId)) return false;
      seenSeries.add(event.routineId);
      return true;
    });
}

export function useExistingEventPool({
  dataService,
  panelOpen,
  tagIdsOf,
}: {
  dataService: Pick<DataService, "fetchEvents">;
  /** The creation panel is open. Nothing is read while it is shut. */
  panelOpen: boolean;
  /** The tags an event shows, a repeat's series-level ones included. */
  tagIdsOf: (event: ScheduleItem) => string[];
}): ExistingEventPoolApi {
  const { t } = useTranslation();
  const syncVersion = useSyncDomains("schedule");
  const [wanted, setWanted] = useState(false);
  // Adjusted while rendering, as the panel's staged tags are.
  if (wanted && !panelOpen) setWanted(false);
  // null: not read yet. Kept across closes, like the note list.
  const [events, setEvents] = useState<ScheduleItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const active = panelOpen && wanted;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    dataService.fetchEvents().then(
      (rows) => {
        if (cancelled) return;
        setEvents(existingEventRows(rows));
        setFailed(false);
      },
      (e: unknown) => {
        logServiceError("Schedule", "list the existing events", e);
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [dataService, active, syncVersion]);

  const byId = useMemo(
    () => new Map((events ?? []).map((event) => [event.id, event])),
    [events],
  );
  const findEvent = useCallback((id: string) => byId.get(id), [byId]);
  const onOpen = useCallback(() => setWanted(true), []);

  const eventPool = useMemo<ItemCreateEventPool>(
    () => ({
      options: (events ?? []).map((event) => ({
        id: event.id,
        title: event.title,
      })),
      tagsOf: (id: string) => {
        const event = byId.get(id);
        return event ? tagIdsOf(event) : [];
      },
      onOpen,
      labels: {
        search: t("scheduleScreen.searchEvents"),
        // The picker draws this whenever the list is empty, so it answers why.
        empty: failed
          ? t("scheduleScreen.eventPickerError")
          : events === null
            ? t("common.loading")
            : t("scheduleScreen.eventPickerEmpty"),
        noMatch: t("scheduleScreen.eventPickerNoMatch"),
      },
    }),
    [events, byId, tagIdsOf, onOpen, failed, t],
  );

  return { eventPool, findEvent };
}
