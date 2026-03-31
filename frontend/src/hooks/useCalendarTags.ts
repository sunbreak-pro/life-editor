import { useState, useCallback, useEffect, useMemo } from "react";
import type { CalendarTag } from "../types/calendarTag";
import { getDataService } from "../services";
import { logServiceError } from "../utils/logError";

export function useCalendarTags() {
  const [calendarTags, setCalendarTags] = useState<CalendarTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getDataService().fetchCalendarTags();
        if (!cancelled) {
          setCalendarTags(data);
          setIsLoading(false);
        }
      } catch (e) {
        logServiceError("CalendarTags", "fetch", e);
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const createCalendarTag = useCallback(
    async (name: string, color: string): Promise<CalendarTag> => {
      try {
        const tag = await getDataService().createCalendarTag(name, color);
        setCalendarTags((prev) => [...prev, tag]);
        return tag;
      } catch (e) {
        logServiceError("CalendarTags", "create", e);
        throw e;
      }
    },
    [],
  );

  const updateCalendarTag = useCallback(
    async (
      id: number,
      updates: Partial<Pick<CalendarTag, "name" | "color" | "order">>,
    ) => {
      setCalendarTags((p) =>
        p.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      );
      try {
        await getDataService().updateCalendarTag(id, updates);
      } catch (e) {
        logServiceError("CalendarTags", "update", e);
      }
    },
    [],
  );

  const deleteCalendarTag = useCallback(async (id: number) => {
    setCalendarTags((prev) => prev.filter((t) => t.id !== id));
    try {
      await getDataService().deleteCalendarTag(id);
    } catch (e) {
      logServiceError("CalendarTags", "delete", e);
    }
  }, []);

  return useMemo(
    () => ({
      calendarTags,
      isLoading,
      createCalendarTag,
      updateCalendarTag,
      deleteCalendarTag,
    }),
    [
      calendarTags,
      isLoading,
      createCalendarTag,
      updateCalendarTag,
      deleteCalendarTag,
    ],
  );
}
