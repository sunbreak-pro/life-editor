import { useState, useCallback, useEffect, useMemo } from "react";
import type { CalendarNode } from "../types/calendar";
import { getDataService } from "../services";
import { STORAGE_KEYS } from "../constants/storageKeys";
import { generateId } from "../utils/generateId";
import { useLocalStorage } from "./useLocalStorage";
import { useUndoRedo } from "../components/shared/UndoRedo";
import { useSyncContext } from "./useSyncContext";

const nullableStringOptions = {
  serialize: (v: string | null) => v ?? "",
  deserialize: (raw: string) => raw || null,
};

export function useCalendars() {
  const { syncVersion } = useSyncContext();
  const [calendars, setCalendars] = useState<CalendarNode[]>([]);
  const [activeCalendarId, setActiveCalendarId] = useLocalStorage<
    string | null
  >(STORAGE_KEYS.ACTIVE_CALENDAR_ID, null, nullableStringOptions);
  const { push } = useUndoRedo();

  // Initial fetch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getDataService().fetchCalendars();
        if (!cancelled) setCalendars(data);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [syncVersion]);

  // Derive a valid calendar ID (auto-reset if referenced calendar was deleted)
  const validActiveCalendarId = useMemo(() => {
    if (!activeCalendarId) return null;
    if (
      calendars.length > 0 &&
      !calendars.find((c) => c.id === activeCalendarId)
    )
      return null;
    return activeCalendarId;
  }, [activeCalendarId, calendars]);

  const activeCalendar = useMemo(() => {
    if (!validActiveCalendarId) return null;
    return calendars.find((c) => c.id === validActiveCalendarId) ?? null;
  }, [calendars, validActiveCalendarId]);

  const createCalendar = useCallback(
    async (title: string, folderId: string) => {
      const id = generateId("calendar");
      const cal = await getDataService().createCalendar(id, title, folderId);
      setCalendars((prev) => [...prev, cal]);

      push("calendar", {
        label: "createCalendar",
        undo: async () => {
          await getDataService().deleteCalendar(id);
          setCalendars((prev) => prev.filter((c) => c.id !== id));
        },
        redo: async () => {
          const restored = await getDataService().createCalendar(
            id,
            title,
            folderId,
          );
          setCalendars((prev) => [...prev, restored]);
        },
      });

      return cal;
    },
    [push],
  );

  const updateCalendar = useCallback(
    async (
      id: string,
      updates: Partial<Pick<CalendarNode, "title" | "folderId" | "order">>,
    ) => {
      const prev = calendars.find((c) => c.id === id);
      const updated = await getDataService().updateCalendar(id, updates);
      setCalendars((p) => p.map((c) => (c.id === id ? updated : c)));

      if (prev) {
        const prevValues: typeof updates = {};
        if ("title" in updates) prevValues.title = prev.title;
        if ("folderId" in updates) prevValues.folderId = prev.folderId;
        if ("order" in updates) prevValues.order = prev.order;

        push("calendar", {
          label: "updateCalendar",
          undo: async () => {
            const restored = await getDataService().updateCalendar(
              id,
              prevValues,
            );
            setCalendars((p) => p.map((c) => (c.id === id ? restored : c)));
          },
          redo: async () => {
            const reapplied = await getDataService().updateCalendar(
              id,
              updates,
            );
            setCalendars((p) => p.map((c) => (c.id === id ? reapplied : c)));
          },
        });
      }
    },
    [calendars, push],
  );

  const deleteCalendar = useCallback(
    async (id: string) => {
      const target = calendars.find((c) => c.id === id);
      await getDataService().deleteCalendar(id);
      setCalendars((prev) => prev.filter((c) => c.id !== id));
      if (activeCalendarId === id) {
        setActiveCalendarId(null);
      }

      if (target) {
        push("calendar", {
          label: "deleteCalendar",
          undo: async () => {
            const restored = await getDataService().createCalendar(
              target.id,
              target.title,
              target.folderId,
            );
            setCalendars((prev) => [...prev, restored]);
          },
          redo: async () => {
            await getDataService().deleteCalendar(id);
            setCalendars((prev) => prev.filter((c) => c.id !== id));
          },
        });
      }
    },
    [activeCalendarId, setActiveCalendarId, calendars, push],
  );

  const refreshCalendars = useCallback(async () => {
    try {
      const data = await getDataService().fetchCalendars();
      setCalendars(data);
    } catch {
      /* ignore */
    }
  }, []);

  return {
    calendars,
    activeCalendarId: validActiveCalendarId,
    activeCalendar,
    setActiveCalendarId,
    createCalendar,
    updateCalendar,
    deleteCalendar,
    refreshCalendars,
  };
}
