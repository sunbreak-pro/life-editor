import { useState, useCallback, useEffect, useMemo } from "react";
import type { RoutineNode } from "../types/routine";
import { getDataService } from "../services";
import { logServiceError } from "../utils/logError";
import { generateId } from "../utils/generateId";

export function useRoutines() {
  const [routines, setRoutines] = useState<RoutineNode[]>([]);
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
    setRoutines((prev) => prev.filter((r) => r.id !== id));
    getDataService()
      .deleteRoutine(id)
      .catch((e) => logServiceError("Routines", "delete", e));
  }, []);

  return useMemo(
    () => ({
      routines,
      isLoading,
      createRoutine,
      updateRoutine,
      deleteRoutine,
    }),
    [routines, isLoading, createRoutine, updateRoutine, deleteRoutine],
  );
}
