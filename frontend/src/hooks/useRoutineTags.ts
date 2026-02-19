import { useState, useCallback, useEffect, useMemo } from "react";
import type { RoutineTag } from "../types/routineTag";
import { getDataService } from "../services";
import { logServiceError } from "../utils/logError";
import { useUndoRedo } from "../components/shared/UndoRedo";

export function useRoutineTags() {
  const { push } = useUndoRedo();
  const [routineTags, setRoutineTags] = useState<RoutineTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getDataService().fetchRoutineTags();
        if (!cancelled) {
          setRoutineTags(data);
          setIsLoading(false);
        }
      } catch (e) {
        logServiceError("RoutineTags", "fetch", e);
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const createRoutineTag = useCallback(
    async (name: string, color: string): Promise<RoutineTag> => {
      const optimistic: RoutineTag = {
        id: -1,
        name,
        color,
        order: routineTags.length,
      };
      setRoutineTags((prev) => [...prev, optimistic]);
      try {
        const tag = await getDataService().createRoutineTag(name, color);
        setRoutineTags((prev) =>
          prev.map((t) => (t.id === -1 && t.name === name ? tag : t)),
        );

        push("routine", {
          label: "createRoutineTag",
          undo: async () => {
            setRoutineTags((prev) => prev.filter((t) => t.id !== tag.id));
            try {
              await getDataService().deleteRoutineTag(tag.id);
            } catch (e) {
              logServiceError("RoutineTags", "undoCreate", e);
            }
          },
          redo: async () => {
            try {
              const restored = await getDataService().createRoutineTag(
                name,
                color,
              );
              setRoutineTags((prev) => [...prev, restored]);
            } catch (e) {
              logServiceError("RoutineTags", "redoCreate", e);
            }
          },
        });

        return tag;
      } catch (e) {
        logServiceError("RoutineTags", "create", e);
        setRoutineTags((prev) =>
          prev.filter((t) => !(t.id === -1 && t.name === name)),
        );
        throw e;
      }
    },
    [routineTags.length, push],
  );

  const updateRoutineTag = useCallback(
    async (
      id: number,
      updates: Partial<Pick<RoutineTag, "name" | "color" | "order">>,
    ) => {
      const prev = routineTags.find((t) => t.id === id);
      setRoutineTags((p) =>
        p.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      );
      try {
        await getDataService().updateRoutineTag(id, updates);
      } catch (e) {
        logServiceError("RoutineTags", "update", e);
      }

      if (prev) {
        const prevValues: typeof updates = {};
        if ("name" in updates) prevValues.name = prev.name;
        if ("color" in updates) prevValues.color = prev.color;
        if ("order" in updates) prevValues.order = prev.order;

        push("routine", {
          label: "updateRoutineTag",
          undo: async () => {
            setRoutineTags((p) =>
              p.map((t) => (t.id === id ? { ...t, ...prevValues } : t)),
            );
            try {
              await getDataService().updateRoutineTag(id, prevValues);
            } catch (e) {
              logServiceError("RoutineTags", "undoUpdate", e);
            }
          },
          redo: async () => {
            setRoutineTags((p) =>
              p.map((t) => (t.id === id ? { ...t, ...updates } : t)),
            );
            try {
              await getDataService().updateRoutineTag(id, updates);
            } catch (e) {
              logServiceError("RoutineTags", "redoUpdate", e);
            }
          },
        });
      }
    },
    [routineTags, push],
  );

  const deleteRoutineTag = useCallback(async (id: number) => {
    setRoutineTags((prev) => prev.filter((t) => t.id !== id));
    try {
      await getDataService().deleteRoutineTag(id);
    } catch (e) {
      logServiceError("RoutineTags", "delete", e);
    }
  }, []);

  return useMemo(
    () => ({
      routineTags,
      isLoading,
      createRoutineTag,
      updateRoutineTag,
      deleteRoutineTag,
    }),
    [
      routineTags,
      isLoading,
      createRoutineTag,
      updateRoutineTag,
      deleteRoutineTag,
    ],
  );
}
