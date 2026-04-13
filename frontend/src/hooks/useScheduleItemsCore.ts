import { useState, useCallback, useRef, useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { ScheduleItem } from "../types/schedule";
import { getDataService } from "../services";
import { logServiceError } from "../utils/logError";
import { generateId } from "../utils/generateId";
import { useUndoRedo } from "../components/shared/UndoRedo";
import { formatDateKey } from "../utils/dateKey";
import type { ScheduleItemsCoreHandles } from "./useScheduleItemsRoutineSync";

export function useScheduleItemsCore(
  setEvents: Dispatch<SetStateAction<ScheduleItem[]>>,
) {
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [scheduleItemsVersion, setScheduleItemsVersion] = useState(0);
  const bumpVersion = useCallback(
    () => setScheduleItemsVersion((v) => v + 1),
    [],
  );
  const [currentDate, setCurrentDate] = useState(
    () =>
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`,
  );
  const { push } = useUndoRedo();
  const scheduleItemsRef = useRef(scheduleItems);
  useEffect(() => {
    scheduleItemsRef.current = scheduleItems;
  }, [scheduleItems]);

  const [monthlyScheduleItems, setMonthlyScheduleItems] = useState<
    ScheduleItem[]
  >([]);

  // ---- Internal list helpers ----
  const applyToLists = useCallback(
    (
      updater: (prev: ScheduleItem[]) => ScheduleItem[],
      includeEvents = false,
    ) => {
      setScheduleItems(updater);
      setMonthlyScheduleItems(updater);
      if (includeEvents) setEvents(updater);
    },
    [setEvents],
  );

  const addToLists = useCallback(
    (item: ScheduleItem) => {
      applyToLists((prev) =>
        [...prev, item].sort((a, b) => a.startTime.localeCompare(b.startTime)),
      );
    },
    [applyToLists],
  );

  const removeFromLists = useCallback(
    (id: string) => {
      applyToLists((prev) => prev.filter((item) => item.id !== id));
    },
    [applyToLists],
  );

  // ---- Loading ----
  const loadItemsForDate = useCallback(async (date: string) => {
    try {
      const items = await getDataService().fetchScheduleItemsByDate(date);
      setScheduleItems(items);
    } catch (e) {
      logServiceError("ScheduleItems", "fetchByDate", e);
    }
  }, []);

  const loadScheduleItemsForMonth = useCallback(
    async (year: number, month: number) => {
      const firstDay = new Date(year, month, 1);
      const startDayOfWeek = firstDay.getDay();
      const gridStart = new Date(year, month, 1 - startDayOfWeek);
      const gridEnd = new Date(gridStart);
      gridEnd.setDate(gridEnd.getDate() + 41);

      const startDate = formatDateKey(gridStart);
      const endDate = formatDateKey(gridEnd);
      try {
        const items = await getDataService().fetchScheduleItemsByDateRange(
          startDate,
          endDate,
        );
        setMonthlyScheduleItems(items);
      } catch (e) {
        logServiceError("ScheduleItems", "loadScheduleItemsForMonth", e);
      }
    },
    [],
  );

  // ---- CRUD ----
  const createScheduleItem = useCallback(
    (
      date: string,
      title: string,
      startTime: string,
      endTime: string,
      routineId?: string,
      templateId?: string,
      noteId?: string,
      isAllDay?: boolean,
      content?: string,
      options?: { skipUndo?: boolean },
    ): string => {
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
        routineId: routineId ?? null,
        templateId: templateId ?? null,
        memo: null,
        noteId: noteId ?? null,
        content: content ?? null,
        isAllDay: isAllDay ?? false,
        createdAt: now,
        updatedAt: now,
      };
      addToLists(optimistic);
      getDataService()
        .createScheduleItem(
          id,
          date,
          title,
          startTime,
          endTime,
          routineId,
          templateId,
          noteId,
          isAllDay,
          content,
        )
        .catch((e) => logServiceError("ScheduleItems", "create", e));

      if (!options?.skipUndo) {
        push("scheduleItem", {
          label: "createScheduleItem",
          undo: () => {
            removeFromLists(id);
            getDataService()
              .deleteScheduleItem(id)
              .catch((e) => logServiceError("ScheduleItems", "undoCreate", e));
          },
          redo: () => {
            addToLists(optimistic);
            getDataService()
              .createScheduleItem(
                id,
                date,
                title,
                startTime,
                endTime,
                routineId,
                templateId,
                noteId,
                isAllDay,
                content,
              )
              .catch((e) => logServiceError("ScheduleItems", "redoCreate", e));
          },
        });
      }

      bumpVersion();
      return id;
    },
    [push, bumpVersion, addToLists, removeFromLists],
  );

  const updateScheduleItem = useCallback(
    (
      id: string,
      updates: Partial<
        Pick<
          ScheduleItem,
          | "title"
          | "startTime"
          | "endTime"
          | "completed"
          | "completedAt"
          | "memo"
          | "content"
          | "date"
          | "isAllDay"
        >
      >,
    ) => {
      const prev = scheduleItemsRef.current.find((item) => item.id === id);
      const dateChanged = updates.date && prev && updates.date !== prev.date;
      const applyUpdate = (item: ScheduleItem) =>
        item.id === id
          ? { ...item, ...updates, updatedAt: new Date().toISOString() }
          : item;
      const applyRevert = (item: ScheduleItem) =>
        prev && item.id === id
          ? { ...item, ...prev, updatedAt: new Date().toISOString() }
          : item;
      if (dateChanged) {
        removeFromLists(id);
      } else {
        applyToLists((p) => p.map(applyUpdate));
      }
      getDataService()
        .updateScheduleItem(id, updates)
        .catch((e) => logServiceError("ScheduleItems", "update", e));

      if (prev) {
        const prevValues: typeof updates = {};
        for (const key of Object.keys(updates) as Array<keyof typeof updates>) {
          (prevValues as Record<string, unknown>)[key] = prev[key];
        }
        push("scheduleItem", {
          label: "updateScheduleItem",
          undo: () => {
            if (dateChanged) {
              const reverted = {
                ...prev,
                updatedAt: new Date().toISOString(),
              };
              applyToLists((p) => [...p, reverted]);
            } else {
              applyToLists((p) => p.map(applyRevert));
            }
            getDataService()
              .updateScheduleItem(id, prevValues)
              .catch((e) => logServiceError("ScheduleItems", "undoUpdate", e));
          },
          redo: () => {
            if (dateChanged) {
              removeFromLists(id);
            } else {
              applyToLists((p) => p.map(applyUpdate));
            }
            getDataService()
              .updateScheduleItem(id, updates)
              .catch((e) => logServiceError("ScheduleItems", "redoUpdate", e));
          },
        });
      }
      bumpVersion();
    },
    [push, bumpVersion, applyToLists, removeFromLists],
  );

  const deleteScheduleItem = useCallback(
    (id: string, options?: { skipUndo?: boolean }) => {
      const target = scheduleItemsRef.current.find((item) => item.id === id);
      removeFromLists(id);
      getDataService()
        .deleteScheduleItem(id)
        .catch((e) => logServiceError("ScheduleItems", "delete", e));

      if (target && !options?.skipUndo) {
        push("scheduleItem", {
          label: "deleteScheduleItem",
          undo: () => {
            addToLists(target);
            getDataService()
              .createScheduleItem(
                target.id,
                target.date,
                target.title,
                target.startTime,
                target.endTime,
                target.routineId ?? undefined,
                target.templateId ?? undefined,
                target.noteId ?? undefined,
                target.isAllDay,
                target.content ?? undefined,
              )
              .then(() => {
                const extra: Record<string, unknown> = {};
                if (target.memo) extra.memo = target.memo;
                if (target.completed) {
                  extra.completed = target.completed;
                  extra.completedAt = target.completedAt;
                }
                if (Object.keys(extra).length > 0) {
                  getDataService()
                    .updateScheduleItem(target.id, extra)
                    .catch((e) =>
                      logServiceError("ScheduleItems", "undoDeleteExtra", e),
                    );
                }
              })
              .catch((e) => logServiceError("ScheduleItems", "undoDelete", e));
          },
          redo: () => {
            removeFromLists(id);
            getDataService()
              .deleteScheduleItem(id)
              .catch((e) => logServiceError("ScheduleItems", "redoDelete", e));
          },
        });
      }
      bumpVersion();
    },
    [push, bumpVersion, addToLists, removeFromLists],
  );

  const toggleComplete = useCallback(
    (id: string) => {
      const item = scheduleItemsRef.current.find((i) => i.id === id);
      const wasCompleted = item?.completed ?? false;

      const toggleMapper = (completed: boolean) => (prev: ScheduleItem[]) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...i,
                completed,
                completedAt: completed ? new Date().toISOString() : null,
              }
            : i,
        );

      applyToLists(toggleMapper(!wasCompleted), true);
      getDataService()
        .toggleScheduleItemComplete(id)
        .catch((e) => logServiceError("ScheduleItems", "toggleComplete", e));

      push("scheduleItem", {
        label: "toggleComplete",
        undo: () => {
          applyToLists(toggleMapper(wasCompleted), true);
          getDataService()
            .toggleScheduleItemComplete(id)
            .catch((e) => logServiceError("ScheduleItems", "undoToggle", e));
        },
        redo: () => {
          applyToLists(toggleMapper(!wasCompleted), true);
          getDataService()
            .toggleScheduleItemComplete(id)
            .catch((e) => logServiceError("ScheduleItems", "redoToggle", e));
        },
      });
      bumpVersion();
    },
    [push, bumpVersion, applyToLists],
  );

  const dismissScheduleItem = useCallback(
    (id: string) => {
      const target = scheduleItemsRef.current.find((item) => item.id === id);
      removeFromLists(id);
      getDataService()
        .dismissScheduleItem(id)
        .catch((e) => logServiceError("ScheduleItems", "dismiss", e));

      if (target) {
        push("scheduleItem", {
          label: "dismissScheduleItem",
          undo: () => {
            addToLists(target);
            getDataService()
              .undismissScheduleItem(target.id)
              .catch((e) => logServiceError("ScheduleItems", "undoDismiss", e));
          },
          redo: () => {
            removeFromLists(id);
            getDataService()
              .dismissScheduleItem(id)
              .catch((e) => logServiceError("ScheduleItems", "redoDismiss", e));
          },
        });
      }
      bumpVersion();
    },
    [push, bumpVersion, addToLists, removeFromLists],
  );

  const undismissScheduleItem = useCallback(
    async (id: string) => {
      try {
        await getDataService().undismissScheduleItem(id);
      } catch (e) {
        logServiceError("ScheduleItems", "undismiss", e);
        return;
      }
      try {
        const items =
          await getDataService().fetchScheduleItemsByDate(currentDate);
        setScheduleItems(items);
      } catch {
        // ignore
      }
      bumpVersion();
    },
    [currentDate, bumpVersion],
  );

  // ---- Soft delete (Trash) ----
  const [deletedScheduleItems, setDeletedScheduleItems] = useState<
    ScheduleItem[]
  >([]);

  const loadDeletedScheduleItems = useCallback(async () => {
    try {
      const items = await getDataService().fetchDeletedScheduleItems();
      setDeletedScheduleItems(items);
    } catch (e) {
      logServiceError("ScheduleItems", "fetchDeleted", e);
    }
  }, []);

  const softDeleteScheduleItem = useCallback(
    (id: string, options?: { skipUndo?: boolean }) => {
      const target = scheduleItemsRef.current.find((item) => item.id === id);
      removeFromLists(id);

      if (target) {
        const deleted: ScheduleItem = {
          ...target,
          isDeleted: true,
          deletedAt: new Date().toISOString(),
        };
        setDeletedScheduleItems((prev) => [deleted, ...prev]);
      }

      getDataService()
        .softDeleteScheduleItem(id)
        .catch((e) => logServiceError("ScheduleItems", "softDelete", e));

      if (target && !options?.skipUndo) {
        push("scheduleItem", {
          label: "softDeleteScheduleItem",
          undo: () => {
            addToLists(target);
            setDeletedScheduleItems((prev) =>
              prev.filter((item) => item.id !== id),
            );
            getDataService()
              .restoreScheduleItem(id)
              .catch((e) =>
                logServiceError("ScheduleItems", "undoSoftDelete", e),
              );
          },
          redo: () => {
            removeFromLists(id);
            if (target) {
              setDeletedScheduleItems((prev) => [
                {
                  ...target,
                  isDeleted: true,
                  deletedAt: new Date().toISOString(),
                },
                ...prev,
              ]);
            }
            getDataService()
              .softDeleteScheduleItem(id)
              .catch((e) =>
                logServiceError("ScheduleItems", "redoSoftDelete", e),
              );
          },
        });
      }
      bumpVersion();
    },
    [push, bumpVersion, addToLists, removeFromLists],
  );

  const restoreScheduleItem = useCallback(
    (id: string) => {
      const target = deletedScheduleItems.find((item) => item.id === id);
      setDeletedScheduleItems((prev) => prev.filter((item) => item.id !== id));
      if (target) {
        const restored: ScheduleItem = {
          ...target,
          isDeleted: false,
          deletedAt: null,
        };
        addToLists(restored);
      }
      getDataService()
        .restoreScheduleItem(id)
        .catch((e) => logServiceError("ScheduleItems", "restore", e));
      bumpVersion();
    },
    [deletedScheduleItems, addToLists, bumpVersion],
  );

  const permanentDeleteScheduleItem = useCallback((id: string) => {
    setDeletedScheduleItems((prev) => prev.filter((item) => item.id !== id));
    getDataService()
      .permanentDeleteScheduleItem(id)
      .catch((e) => logServiceError("ScheduleItems", "permanentDelete", e));
  }, []);

  // ---- Handles for sub-hooks ----
  const _handles: ScheduleItemsCoreHandles = {
    scheduleItemsRef,
    setScheduleItems,
    setMonthlyScheduleItems,
    bumpVersion,
  };

  return {
    // State
    scheduleItems,
    currentDate,
    setCurrentDate,
    monthlyScheduleItems,
    scheduleItemsVersion,
    // CRUD
    loadItemsForDate,
    loadScheduleItemsForMonth,
    createScheduleItem,
    updateScheduleItem,
    deleteScheduleItem,
    softDeleteScheduleItem,
    dismissScheduleItem,
    undismissScheduleItem,
    toggleComplete,
    // Trash
    deletedScheduleItems,
    loadDeletedScheduleItems,
    restoreScheduleItem,
    permanentDeleteScheduleItem,
    // Internal
    _handles,
  } as const;
}
