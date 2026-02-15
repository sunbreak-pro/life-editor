import { useState, useCallback, useEffect, useMemo } from "react";
import type { CalendarNode } from "../types/calendar";
import { getDataService } from "../services";
import { STORAGE_KEYS } from "../constants/storageKeys";
import { generateId } from "../utils/generateId";
import { useLocalStorage } from "./useLocalStorage";

const nullableStringOptions = {
  serialize: (v: string | null) => v ?? "",
  deserialize: (raw: string) => raw || null,
};

export function useCalendars() {
  const [calendars, setCalendars] = useState<CalendarNode[]>([]);
  const [activeCalendarId, setActiveCalendarId] = useLocalStorage<
    string | null
  >(STORAGE_KEYS.ACTIVE_CALENDAR_ID, null, nullableStringOptions);

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
  }, []);

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
      return cal;
    },
    [],
  );

  const updateCalendar = useCallback(
    async (
      id: string,
      updates: Partial<Pick<CalendarNode, "title" | "folderId" | "order">>,
    ) => {
      const updated = await getDataService().updateCalendar(id, updates);
      setCalendars((prev) => prev.map((c) => (c.id === id ? updated : c)));
    },
    [],
  );

  const deleteCalendar = useCallback(
    async (id: string) => {
      await getDataService().deleteCalendar(id);
      setCalendars((prev) => prev.filter((c) => c.id !== id));
      if (activeCalendarId === id) {
        setActiveCalendarId(null);
      }
    },
    [activeCalendarId, setActiveCalendarId],
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
