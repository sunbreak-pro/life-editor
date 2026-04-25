import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { RoutineNode, FrequencyType } from "../types/routine";
import { getDataService } from "../services";
import { logServiceError } from "../utils/logError";
import { generateId } from "../utils/generateId";
import { useUndoRedo } from "../components/shared/UndoRedo";
import { useSyncContext } from "./useSyncContext";

export function useRoutines() {
  const { syncVersion } = useSyncContext();
  const { push } = useUndoRedo();
  const [routines, setRoutines] = useState<RoutineNode[]>([]);
  const [deletedRoutines, setDeletedRoutines] = useState<RoutineNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const routinesRef = useRef(routines);
  useEffect(() => {
    routinesRef.current = routines;
  }, [routines]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getDataService().fetchAllRoutines();
        if (!cancelled) {
          setRoutines(data);
          setIsLoading(false);
        }
      } catch (e) {
        logServiceError("Routines", "fetch", e);
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [syncVersion]);

  const createRoutine = useCallback(
    (
      title: string,
      startTime?: string,
      endTime?: string,
      frequencyType?: FrequencyType,
      frequencyDays?: number[],
      frequencyInterval?: number | null,
      frequencyStartDate?: string | null,
      reminderEnabled?: boolean,
      reminderOffset?: number,
    ) => {
      const id = generateId("routine");
      const now = new Date().toISOString();
      const optimistic: RoutineNode = {
        id,
        title,
        startTime: startTime ?? null,
        endTime: endTime ?? null,
        isArchived: false,
        isVisible: true,
        isDeleted: false,
        deletedAt: null,
        order: routines.length,
        frequencyType: frequencyType ?? "daily",
        frequencyDays: frequencyDays ?? [],
        frequencyInterval: frequencyInterval ?? null,
        frequencyStartDate: frequencyStartDate ?? null,
        reminderEnabled,
        reminderOffset,
        createdAt: now,
        updatedAt: now,
      };
      setRoutines((prev) => [...prev, optimistic]);
      getDataService()
        .createRoutine(
          id,
          title,
          startTime,
          endTime,
          frequencyType,
          frequencyDays,
          frequencyInterval,
          frequencyStartDate,
          reminderEnabled,
          reminderOffset,
        )
        .catch((e) => logServiceError("Routines", "create", e));

      push("routine", {
        label: "createRoutine",
        undo: () => {
          setRoutines((prev) => prev.filter((r) => r.id !== id));
          getDataService()
            .softDeleteRoutine(id)
            .catch((e) => logServiceError("Routines", "undoCreate", e));
        },
        redo: () => {
          setRoutines((prev) => [...prev, optimistic]);
          getDataService()
            .restoreRoutine(id)
            .catch((e) => logServiceError("Routines", "redoCreate", e));
        },
      });

      return id;
    },
    [routines.length, push],
  );

  const updateRoutine = useCallback(
    (
      id: string,
      updates: Partial<
        Pick<
          RoutineNode,
          | "title"
          | "startTime"
          | "endTime"
          | "isArchived"
          | "isVisible"
          | "order"
          | "frequencyType"
          | "frequencyDays"
          | "frequencyInterval"
          | "frequencyStartDate"
          | "reminderEnabled"
          | "reminderOffset"
        >
      >,
      options?: { skipUndo?: boolean },
    ) => {
      const prev = routinesRef.current.find((r) => r.id === id);
      setRoutines((p) =>
        p.map((r) =>
          r.id === id
            ? { ...r, ...updates, updatedAt: new Date().toISOString() }
            : r,
        ),
      );
      getDataService()
        .updateRoutine(id, updates)
        .catch((e) => logServiceError("Routines", "update", e));

      if (prev && !options?.skipUndo) {
        const prevValues: typeof updates = {};
        for (const key of Object.keys(updates) as Array<keyof typeof updates>) {
          (prevValues as Record<string, unknown>)[key] = prev[key];
        }
        push("routine", {
          label: "updateRoutine",
          undo: () => {
            setRoutines((p) =>
              p.map((r) =>
                r.id === id
                  ? { ...r, ...prevValues, updatedAt: new Date().toISOString() }
                  : r,
              ),
            );
            getDataService()
              .updateRoutine(id, prevValues)
              .catch((e) => logServiceError("Routines", "undoUpdate", e));
          },
          redo: () => {
            setRoutines((p) =>
              p.map((r) =>
                r.id === id
                  ? { ...r, ...updates, updatedAt: new Date().toISOString() }
                  : r,
              ),
            );
            getDataService()
              .updateRoutine(id, updates)
              .catch((e) => logServiceError("Routines", "redoUpdate", e));
          },
        });
      }
    },
    [push],
  );

  const deleteRoutine = useCallback(
    async (
      id: string,
      options?: { skipUndo?: boolean },
    ): Promise<{ deletedScheduleItemIds: string[] }> => {
      const target = routinesRef.current.find((r) => r.id === id);
      if (target) {
        const deleted: RoutineNode = {
          ...target,
          isDeleted: true,
          deletedAt: new Date().toISOString(),
        };
        setDeletedRoutines((d) => [deleted, ...d]);
      }
      setRoutines((prev) => prev.filter((r) => r.id !== id));

      let result: { deletedScheduleItemIds: string[] } = {
        deletedScheduleItemIds: [],
      };
      try {
        result = await getDataService().softDeleteRoutine(id);
      } catch (e) {
        logServiceError("Routines", "softDelete", e);
      }

      if (target && !options?.skipUndo) {
        push("routine", {
          label: "deleteRoutine",
          undo: () => {
            setRoutines((prev) => [...prev, target]);
            setDeletedRoutines((prev) => prev.filter((r) => r.id !== id));
            getDataService()
              .restoreRoutine(id)
              .catch((e) => logServiceError("Routines", "undoDelete", e));
          },
          redo: () => {
            setRoutines((prev) => prev.filter((r) => r.id !== id));
            setDeletedRoutines((prev) => {
              const redoDeleted: RoutineNode = {
                ...target,
                isDeleted: true,
                deletedAt: new Date().toISOString(),
              };
              return [redoDeleted, ...prev];
            });
            getDataService()
              .softDeleteRoutine(id)
              .catch((e) => logServiceError("Routines", "redoDelete", e));
          },
        });
      }

      return result;
    },
    [push],
  );

  const loadDeletedRoutines = useCallback(async () => {
    try {
      const data = await getDataService().fetchDeletedRoutines();
      setDeletedRoutines(data);
    } catch (e) {
      logServiceError("Routines", "fetchDeleted", e);
    }
  }, []);

  const restoreRoutine = useCallback(
    (id: string) => {
      const target = deletedRoutines.find((r) => r.id === id);
      if (target) {
        const restored: RoutineNode = {
          ...target,
          isDeleted: false,
          deletedAt: null,
        };
        setRoutines((r) => [...r, restored]);
      }
      setDeletedRoutines((prev) => prev.filter((r) => r.id !== id));
      getDataService()
        .restoreRoutine(id)
        .catch((e) => logServiceError("Routines", "restore", e));
    },
    [deletedRoutines],
  );

  const permanentDeleteRoutine = useCallback((id: string) => {
    setDeletedRoutines((prev) => prev.filter((r) => r.id !== id));
    getDataService()
      .permanentDeleteRoutine(id)
      .catch((e) => logServiceError("Routines", "permanentDelete", e));
  }, []);

  return useMemo(
    () => ({
      routines,
      deletedRoutines,
      isLoading,
      createRoutine,
      updateRoutine,
      deleteRoutine,
      loadDeletedRoutines,
      restoreRoutine,
      permanentDeleteRoutine,
    }),
    [
      routines,
      deletedRoutines,
      isLoading,
      createRoutine,
      updateRoutine,
      deleteRoutine,
      loadDeletedRoutines,
      restoreRoutine,
      permanentDeleteRoutine,
    ],
  );
}
