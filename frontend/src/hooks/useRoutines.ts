import { useState, useCallback, useEffect, useMemo } from "react";
import type { RoutineNode } from "../types/routine";
import { getDataService } from "../services";
import { logServiceError } from "../utils/logError";
import { generateId } from "../utils/generateId";

export function useRoutines() {
  const [routines, setRoutines] = useState<RoutineNode[]>([]);
  const [deletedRoutines, setDeletedRoutines] = useState<RoutineNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
  }, []);

  const createRoutine = useCallback(
    (title: string, startTime?: string, endTime?: string) => {
      const id = generateId("routine");
      const now = new Date().toISOString();
      const optimistic: RoutineNode = {
        id,
        title,
        startTime: startTime ?? null,
        endTime: endTime ?? null,
        isArchived: false,
        isDeleted: false,
        deletedAt: null,
        order: routines.length,
        createdAt: now,
        updatedAt: now,
      };
      setRoutines((prev) => [...prev, optimistic]);
      getDataService()
        .createRoutine(id, title, startTime, endTime)
        .catch((e) => logServiceError("Routines", "create", e));
      return id;
    },
    [routines.length],
  );

  const updateRoutine = useCallback(
    (
      id: string,
      updates: Partial<
        Pick<
          RoutineNode,
          "title" | "startTime" | "endTime" | "isArchived" | "order"
        >
      >,
    ) => {
      setRoutines((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, ...updates, updatedAt: new Date().toISOString() }
            : r,
        ),
      );
      getDataService()
        .updateRoutine(id, updates)
        .catch((e) => logServiceError("Routines", "update", e));
    },
    [],
  );

  const deleteRoutine = useCallback((id: string) => {
    setRoutines((prev) => {
      const target = prev.find((r) => r.id === id);
      if (target) {
        const deleted: RoutineNode = {
          ...target,
          isDeleted: true,
          deletedAt: new Date().toISOString(),
        };
        setDeletedRoutines((d) => [deleted, ...d]);
      }
      return prev.filter((r) => r.id !== id);
    });
    getDataService()
      .softDeleteRoutine(id)
      .catch((e) => logServiceError("Routines", "softDelete", e));
  }, []);

  const loadDeletedRoutines = useCallback(async () => {
    try {
      const data = await getDataService().fetchDeletedRoutines();
      setDeletedRoutines(data);
    } catch (e) {
      logServiceError("Routines", "fetchDeleted", e);
    }
  }, []);

  const restoreRoutine = useCallback((id: string) => {
    setDeletedRoutines((prev) => {
      const target = prev.find((r) => r.id === id);
      if (target) {
        const restored: RoutineNode = {
          ...target,
          isDeleted: false,
          deletedAt: null,
        };
        setRoutines((r) => [...r, restored]);
      }
      return prev.filter((r) => r.id !== id);
    });
    getDataService()
      .restoreRoutine(id)
      .catch((e) => logServiceError("Routines", "restore", e));
  }, []);

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
