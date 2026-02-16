import { useState, useCallback, useMemo } from "react";
import type { ScheduleItem } from "../types/schedule";
import type { RoutineTemplate } from "../types/schedule";
import type { RoutineNode } from "../types/routine";
import { getDataService } from "../services";
import { logServiceError } from "../utils/logError";
import { generateId } from "../utils/generateId";

function isTemplateApplicable(template: RoutineTemplate, date: Date): boolean {
  if (template.frequencyType === "daily") return true;
  return template.frequencyDays.includes(date.getDay());
}

export function useScheduleItems() {
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [currentDate, setCurrentDate] = useState(
    () =>
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`,
  );

  const loadItemsForDate = useCallback(async (date: string) => {
    try {
      const items = await getDataService().fetchScheduleItemsByDate(date);
      setScheduleItems(items);
    } catch (e) {
      logServiceError("ScheduleItems", "fetchByDate", e);
    }
  }, []);

  const createScheduleItem = useCallback(
    (date: string, title: string, startTime: string, endTime: string) => {
      const id = generateId("si");
      const now = new Date().toISOString();
      const optimistic: ScheduleItem = {
        id,
        date,
        title,
        startTime,
        endTime,
        completed: false,
        completedAt: null,
        routineId: null,
        templateId: null,
        createdAt: now,
        updatedAt: now,
      };
      setScheduleItems((prev) =>
        [...prev, optimistic].sort((a, b) =>
          a.startTime.localeCompare(b.startTime),
        ),
      );
      getDataService()
        .createScheduleItem(id, date, title, startTime, endTime)
        .catch((e) => logServiceError("ScheduleItems", "create", e));
      return id;
    },
    [],
  );

  const updateScheduleItem = useCallback(
    (
      id: string,
      updates: Partial<
        Pick<
          ScheduleItem,
          "title" | "startTime" | "endTime" | "completed" | "completedAt"
        >
      >,
    ) => {
      setScheduleItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, ...updates, updatedAt: new Date().toISOString() }
            : item,
        ),
      );
      getDataService()
        .updateScheduleItem(id, updates)
        .catch((e) => logServiceError("ScheduleItems", "update", e));
    },
    [],
  );

  const deleteScheduleItem = useCallback((id: string) => {
    setScheduleItems((prev) => prev.filter((item) => item.id !== id));
    getDataService()
      .deleteScheduleItem(id)
      .catch((e) => logServiceError("ScheduleItems", "delete", e));
  }, []);

  const toggleComplete = useCallback((id: string) => {
    setScheduleItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              completed: !item.completed,
              completedAt: !item.completed ? new Date().toISOString() : null,
            }
          : item,
      ),
    );
    getDataService()
      .toggleScheduleItemComplete(id)
      .catch((e) => logServiceError("ScheduleItems", "toggleComplete", e));
  }, []);

  const ensureTemplateItemsForDate = useCallback(
    async (
      date: string,
      templates: RoutineTemplate[],
      routines: RoutineNode[],
    ) => {
      const dateObj = new Date(date + "T00:00:00");
      const existing = await getDataService().fetchScheduleItemsByDate(date);
      const existingByRoutineId = new Map(
        existing
          .filter((i) => i.routineId)
          .map((i) => [i.routineId, i] as const),
      );
      const seenRoutineIds = new Set(existingByRoutineId.keys());

      const routineMap = new Map(routines.map((r) => [r.id, r]));
      const toCreate: Array<{
        id: string;
        date: string;
        title: string;
        startTime: string;
        endTime: string;
        routineId: string;
        templateId: string;
      }> = [];
      const toUpdate: Array<{
        id: string;
        title: string;
        startTime: string;
        endTime: string;
      }> = [];

      for (const template of templates) {
        if (!isTemplateApplicable(template, dateObj)) continue;
        for (const item of template.items) {
          const routine = routineMap.get(item.routineId);
          if (!routine) continue;

          const existingItem = existingByRoutineId.get(item.routineId);
          if (existingItem) {
            const newTitle = routine.title;
            const newStart = routine.startTime ?? "09:00";
            const newEnd = routine.endTime ?? "09:30";
            if (
              existingItem.title !== newTitle ||
              existingItem.startTime !== newStart ||
              existingItem.endTime !== newEnd
            ) {
              toUpdate.push({
                id: existingItem.id,
                title: newTitle,
                startTime: newStart,
                endTime: newEnd,
              });
            }
            continue;
          }

          if (seenRoutineIds.has(item.routineId)) continue;
          toCreate.push({
            id: generateId("si"),
            date,
            title: routine.title,
            startTime: routine.startTime ?? "09:00",
            endTime: routine.endTime ?? "09:30",
            routineId: routine.id,
            templateId: template.id,
          });
          seenRoutineIds.add(item.routineId);
        }
      }

      // Update existing items whose routine info changed
      if (toUpdate.length > 0) {
        for (const upd of toUpdate) {
          getDataService()
            .updateScheduleItem(upd.id, {
              title: upd.title,
              startTime: upd.startTime,
              endTime: upd.endTime,
            })
            .catch((e) => logServiceError("ScheduleItems", "update", e));
        }
        setScheduleItems((prev) =>
          prev
            .map((item) => {
              const upd = toUpdate.find((u) => u.id === item.id);
              return upd
                ? { ...item, ...upd, updatedAt: new Date().toISOString() }
                : item;
            })
            .sort((a, b) => a.startTime.localeCompare(b.startTime)),
        );
      }

      if (toCreate.length > 0) {
        try {
          const created =
            await getDataService().bulkCreateScheduleItems(toCreate);
          setScheduleItems((prev) =>
            [...prev, ...created].sort((a, b) =>
              a.startTime.localeCompare(b.startTime),
            ),
          );
        } catch (e) {
          logServiceError("ScheduleItems", "bulkCreate", e);
        }
      }
    },
    [],
  );

  const getRoutineCompletionRate = useCallback(
    (routineId: string): { completed: number; total: number } => {
      const items = scheduleItems.filter((i) => i.routineId === routineId);
      return {
        completed: items.filter((i) => i.completed).length,
        total: items.length,
      };
    },
    [scheduleItems],
  );

  return useMemo(
    () => ({
      scheduleItems,
      currentDate,
      setCurrentDate,
      loadItemsForDate,
      createScheduleItem,
      updateScheduleItem,
      deleteScheduleItem,
      toggleComplete,
      ensureTemplateItemsForDate,
      getRoutineCompletionRate,
    }),
    [
      scheduleItems,
      currentDate,
      loadItemsForDate,
      createScheduleItem,
      updateScheduleItem,
      deleteScheduleItem,
      toggleComplete,
      ensureTemplateItemsForDate,
      getRoutineCompletionRate,
    ],
  );
}
