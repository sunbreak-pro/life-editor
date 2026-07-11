import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { CalendarNode } from "../types/calendar";
import type { DataService } from "../services/DataService";
import { logServiceError } from "../utils/logError";
import { generateId } from "../utils/generateId";
import { useSyncContext } from "./useSyncContext";

/**
 * Behaviour-preserving port of the Tauri calendars hook
 * (frontend/src/hooks/useCalendars.ts) into one shared API hook — same
 * shape as useRoutinesAPI / useScheduleItemsAPI. Host dependencies are
 * injected, not imported (CLAUDE.md §6.4): `getDataService()` singleton
 * → `options.dataService`.
 *
 * `calendars` sync class: VERSIONED but PHYSICAL-delete (S4-0: 0006
 * deliberately omits is_deleted — the frontend never soft-deletes a
 * calendar; `deleteCalendar` is a hard DELETE). There is therefore NO
 * trash / restore path here (unlike routines / schedule_items).
 *
 * Must sit inside a Sync Provider (reads `useSyncContext`). Calendar is
 * enabled on Mobile too (frontend MobileProviders keeps CalendarProvider
 * — only CalendarTags is in the Mobile 省略 list, CLAUDE.md §2), so this
 * uses the plain Pattern A (no Optional variant).
 *
 * Scope (S4-6): calendars CRUD only.
 */

export interface UseCalendarsAPIOptions {
  dataService: DataService;
}

export function useCalendarsAPI(options: UseCalendarsAPIOptions) {
  const ds = options.dataService;
  const { syncVersion } = useSyncContext();

  const [calendars, setCalendars] = useState<CalendarNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const calendarsRef = useRef(calendars);
  useEffect(() => {
    calendarsRef.current = calendars;
  }, [calendars]);

  // Initial load + every syncVersion bump (mirrors routines/notes).
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      try {
        const list = await ds.fetchCalendars();
        if (cancelled) return;
        setCalendars(list);
      } catch (e) {
        logServiceError("Calendars", "fetch", e);
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load calendars");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ds, syncVersion]);

  const createCalendar = useCallback(
    (title: string, tagId: string): string => {
      const id = generateId("calendar");
      const now = new Date().toISOString();
      const optimistic: CalendarNode = {
        id,
        title,
        tagId,
        order: calendarsRef.current.length,
        createdAt: now,
        updatedAt: now,
      };
      setCalendars((prev) => [...prev, optimistic]);
      ds.createCalendar(id, title, tagId)
        .then((saved) =>
          setCalendars((prev) => prev.map((c) => (c.id === id ? saved : c))),
        )
        .catch((e) => {
          logServiceError("Calendars", "create", e);
          setCalendars((prev) => prev.filter((c) => c.id !== id));
        });
      return id;
    },
    [ds],
  );

  const updateCalendar = useCallback(
    (
      id: string,
      updates: Partial<Pick<CalendarNode, "title" | "tagId" | "order">>,
    ) => {
      setCalendars((p) =>
        p.map((c) =>
          c.id === id
            ? { ...c, ...updates, updatedAt: new Date().toISOString() }
            : c,
        ),
      );
      ds.updateCalendar(id, updates)
        .then((saved) =>
          setCalendars((prev) => prev.map((c) => (c.id === id ? saved : c))),
        )
        .catch((e) => logServiceError("Calendars", "update", e));
    },
    [ds],
  );

  // Physical delete (S4-0: calendars has no is_deleted — no trash path).
  const deleteCalendar = useCallback(
    (id: string) => {
      setCalendars((prev) => prev.filter((c) => c.id !== id));
      ds.deleteCalendar(id).catch((e) =>
        logServiceError("Calendars", "delete", e),
      );
    },
    [ds],
  );

  return useMemo(
    () => ({
      calendars,
      isLoading,
      error,
      createCalendar,
      updateCalendar,
      deleteCalendar,
    }),
    [
      calendars,
      isLoading,
      error,
      createCalendar,
      updateCalendar,
      deleteCalendar,
    ],
  );
}
