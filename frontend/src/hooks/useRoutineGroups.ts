import { useState, useCallback, useEffect, useMemo } from "react";
import type { RoutineGroup } from "../types/routineGroup";
import { getDataService } from "../services";
import { logServiceError } from "../utils/logError";
import { useUndoRedo } from "../components/shared/UndoRedo";

export function useRoutineGroups() {
  const { push } = useUndoRedo();
  const [routineGroups, setRoutineGroups] = useState<RoutineGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getDataService().fetchRoutineGroups();
        if (!cancelled) {
          setRoutineGroups(data);
          setIsLoading(false);
        }
      } catch (e) {
        logServiceError("RoutineGroups", "fetch", e);
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const createRoutineGroup = useCallback(
    async (id: string, name: string, color: string): Promise<RoutineGroup> => {
      const optimistic: RoutineGroup = {
        id,
        name,
        color,
        order: routineGroups.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setRoutineGroups((prev) => [...prev, optimistic]);
      try {
        const group = await getDataService().createRoutineGroup(
          id,
          name,
          color,
        );
        setRoutineGroups((prev) => prev.map((g) => (g.id === id ? group : g)));

        push("routine", {
          label: "createRoutineGroup",
          undo: async () => {
            setRoutineGroups((prev) => prev.filter((g) => g.id !== group.id));
            try {
              await getDataService().deleteRoutineGroup(group.id);
            } catch (e) {
              logServiceError("RoutineGroups", "undoCreate", e);
            }
          },
          redo: async () => {
            try {
              const restored = await getDataService().createRoutineGroup(
                id,
                name,
                color,
              );
              setRoutineGroups((prev) => [...prev, restored]);
            } catch (e) {
              logServiceError("RoutineGroups", "redoCreate", e);
            }
          },
        });

        return group;
      } catch (e) {
        logServiceError("RoutineGroups", "create", e);
        setRoutineGroups((prev) => prev.filter((g) => g.id !== id));
        throw e;
      }
    },
    [routineGroups.length, push],
  );

  const updateRoutineGroup = useCallback(
    async (
      id: string,
      updates: Partial<Pick<RoutineGroup, "name" | "color" | "order">>,
    ) => {
      const prev = routineGroups.find((g) => g.id === id);
      setRoutineGroups((p) =>
        p.map((g) => (g.id === id ? { ...g, ...updates } : g)),
      );
      try {
        await getDataService().updateRoutineGroup(id, updates);
      } catch (e) {
        logServiceError("RoutineGroups", "update", e);
      }

      if (prev) {
        const prevValues: typeof updates = {};
        if ("name" in updates) prevValues.name = prev.name;
        if ("color" in updates) prevValues.color = prev.color;
        if ("order" in updates) prevValues.order = prev.order;

        push("routine", {
          label: "updateRoutineGroup",
          undo: async () => {
            setRoutineGroups((p) =>
              p.map((g) => (g.id === id ? { ...g, ...prevValues } : g)),
            );
            try {
              await getDataService().updateRoutineGroup(id, prevValues);
            } catch (e) {
              logServiceError("RoutineGroups", "undoUpdate", e);
            }
          },
          redo: async () => {
            setRoutineGroups((p) =>
              p.map((g) => (g.id === id ? { ...g, ...updates } : g)),
            );
            try {
              await getDataService().updateRoutineGroup(id, updates);
            } catch (e) {
              logServiceError("RoutineGroups", "redoUpdate", e);
            }
          },
        });
      }
    },
    [routineGroups, push],
  );

  const deleteRoutineGroup = useCallback(
    async (id: string) => {
      const target = routineGroups.find((g) => g.id === id);
      setRoutineGroups((prev) => prev.filter((g) => g.id !== id));
      try {
        await getDataService().deleteRoutineGroup(id);
      } catch (e) {
        logServiceError("RoutineGroups", "delete", e);
      }

      if (target) {
        push("routine", {
          label: "deleteRoutineGroup",
          undo: async () => {
            try {
              const restored = await getDataService().createRoutineGroup(
                target.id,
                target.name,
                target.color,
              );
              setRoutineGroups((prev) => [...prev, restored]);
            } catch (e) {
              logServiceError("RoutineGroups", "undoDelete", e);
            }
          },
          redo: async () => {
            setRoutineGroups((prev) => prev.filter((g) => g.id !== id));
            try {
              await getDataService().deleteRoutineGroup(id);
            } catch (e) {
              logServiceError("RoutineGroups", "redoDelete", e);
            }
          },
        });
      }
    },
    [routineGroups, push],
  );

  return useMemo(
    () => ({
      routineGroups,
      isLoading: isLoading,
      createRoutineGroup,
      updateRoutineGroup,
      deleteRoutineGroup,
    }),
    [
      routineGroups,
      isLoading,
      createRoutineGroup,
      updateRoutineGroup,
      deleteRoutineGroup,
    ],
  );
}
