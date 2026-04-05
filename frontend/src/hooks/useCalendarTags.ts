import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { CalendarTag } from "../types/calendarTag";
import { getDataService } from "../services";
import { logServiceError } from "../utils/logError";
import { useUndoRedo } from "../components/shared/UndoRedo";

export function useCalendarTags() {
  const [calendarTags, setCalendarTags] = useState<CalendarTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { push } = useUndoRedo();
  const tagsRef = useRef(calendarTags);
  useEffect(() => {
    tagsRef.current = calendarTags;
  }, [calendarTags]);

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

        let currentId = tag.id;
        push("calendar", {
          label: "createCalendarTag",
          undo: async () => {
            setCalendarTags((prev) => prev.filter((t) => t.id !== currentId));
            await getDataService()
              .deleteCalendarTag(currentId)
              .catch((e) => logServiceError("CalendarTags", "undoCreate", e));
          },
          redo: async () => {
            const restored = await getDataService().createCalendarTag(
              name,
              color,
            );
            currentId = restored.id;
            setCalendarTags((prev) => [...prev, restored]);
          },
        });

        return tag;
      } catch (e) {
        logServiceError("CalendarTags", "create", e);
        throw e;
      }
    },
    [push],
  );

  const updateCalendarTag = useCallback(
    async (
      id: number,
      updates: Partial<Pick<CalendarTag, "name" | "color" | "order">>,
    ) => {
      const prev = tagsRef.current.find((t) => t.id === id);
      setCalendarTags((p) =>
        p.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      );
      try {
        await getDataService().updateCalendarTag(id, updates);
      } catch (e) {
        logServiceError("CalendarTags", "update", e);
        if (prev) {
          setCalendarTags((p) => p.map((t) => (t.id === id ? prev : t)));
        }
        return;
      }

      if (prev) {
        const prevValues: typeof updates = {};
        for (const key of Object.keys(updates) as Array<keyof typeof updates>) {
          (prevValues as Record<string, unknown>)[key] = prev[key];
        }
        push("calendar", {
          label: "updateCalendarTag",
          undo: () => {
            setCalendarTags((p) =>
              p.map((t) => (t.id === id ? { ...t, ...prevValues } : t)),
            );
            getDataService()
              .updateCalendarTag(id, prevValues)
              .catch((e) => logServiceError("CalendarTags", "undoUpdate", e));
          },
          redo: () => {
            setCalendarTags((p) =>
              p.map((t) => (t.id === id ? { ...t, ...updates } : t)),
            );
            getDataService()
              .updateCalendarTag(id, updates)
              .catch((e) => logServiceError("CalendarTags", "redoUpdate", e));
          },
        });
      }
    },
    [push],
  );

  const deleteCalendarTag = useCallback(
    async (id: number) => {
      const prev = tagsRef.current.find((t) => t.id === id);
      setCalendarTags((p) => p.filter((t) => t.id !== id));
      try {
        await getDataService().deleteCalendarTag(id);
      } catch (e) {
        logServiceError("CalendarTags", "delete", e);
        if (prev) {
          setCalendarTags((p) => [...p, prev]);
        }
        return;
      }

      if (prev) {
        let currentId = id;
        push("calendar", {
          label: "deleteCalendarTag",
          undo: async () => {
            const restored = await getDataService().createCalendarTag(
              prev.name,
              prev.color,
            );
            currentId = restored.id;
            setCalendarTags((p) => [...p, restored]);
          },
          redo: async () => {
            setCalendarTags((p) => p.filter((t) => t.id !== currentId));
            await getDataService()
              .deleteCalendarTag(currentId)
              .catch((e) => logServiceError("CalendarTags", "redoDelete", e));
          },
        });
      }
    },
    [push],
  );

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
