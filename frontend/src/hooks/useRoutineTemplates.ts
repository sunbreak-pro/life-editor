import { useState, useCallback, useEffect, useMemo } from "react";
import type { RoutineTemplate } from "../types/schedule";
import { getDataService } from "../services";
import { logServiceError } from "../utils/logError";
import { generateId } from "../utils/generateId";

export function useRoutineTemplates() {
  const [templates, setTemplates] = useState<RoutineTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getDataService().fetchRoutineTemplates();
        if (!cancelled) {
          setTemplates(data);
          setIsLoading(false);
        }
      } catch (e) {
        logServiceError("RoutineTemplates", "fetch", e);
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const createTemplate = useCallback(
    (
      name: string,
      frequencyType: string = "daily",
      frequencyDays: number[] = [],
    ) => {
      const id = generateId("tmpl");
      const now = new Date().toISOString();
      const optimistic: RoutineTemplate = {
        id,
        name,
        frequencyType: frequencyType as RoutineTemplate["frequencyType"],
        frequencyDays,
        order: templates.length,
        items: [],
        createdAt: now,
        updatedAt: now,
      };
      setTemplates((prev) => [...prev, optimistic]);
      getDataService()
        .createRoutineTemplate(id, name, frequencyType, frequencyDays)
        .then((t) => {
          setTemplates((prev) => prev.map((p) => (p.id === id ? t : p)));
        })
        .catch((e) => logServiceError("RoutineTemplates", "create", e));
      return id;
    },
    [templates.length],
  );

  const updateTemplate = useCallback(
    (
      id: string,
      updates: Partial<
        Pick<
          RoutineTemplate,
          "name" | "frequencyType" | "frequencyDays" | "order"
        >
      >,
    ) => {
      setTemplates((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      );
      getDataService()
        .updateRoutineTemplate(id, updates)
        .catch((e) => logServiceError("RoutineTemplates", "update", e));
    },
    [],
  );

  const deleteTemplate = useCallback((id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    getDataService()
      .deleteRoutineTemplate(id)
      .catch((e) => logServiceError("RoutineTemplates", "delete", e));
  }, []);

  const addTemplateItem = useCallback(
    (templateId: string, routineId: string) => {
      setTemplates((prev) =>
        prev.map((t) => {
          if (t.id !== templateId) return t;
          if (t.items.some((i) => i.routineId === routineId)) return t;
          return {
            ...t,
            items: [
              ...t.items,
              {
                id: -1,
                templateId,
                routineId,
                position: t.items.length,
              },
            ],
          };
        }),
      );
      getDataService()
        .addRoutineTemplateItem(templateId, routineId)
        .catch((e) => logServiceError("RoutineTemplates", "addItem", e));
    },
    [],
  );

  const removeTemplateItem = useCallback(
    (templateId: string, routineId: string) => {
      setTemplates((prev) =>
        prev.map((t) => {
          if (t.id !== templateId) return t;
          return {
            ...t,
            items: t.items.filter((i) => i.routineId !== routineId),
          };
        }),
      );
      getDataService()
        .removeRoutineTemplateItem(templateId, routineId)
        .catch((e) => logServiceError("RoutineTemplates", "removeItem", e));
    },
    [],
  );

  const reorderTemplateItems = useCallback(
    (templateId: string, routineIds: string[]) => {
      setTemplates((prev) =>
        prev.map((t) => {
          if (t.id !== templateId) return t;
          const newItems = routineIds.map((rid, i) => ({
            id: t.items.find((it) => it.routineId === rid)?.id ?? -1,
            templateId,
            routineId: rid,
            position: i,
          }));
          return { ...t, items: newItems };
        }),
      );
      getDataService()
        .reorderRoutineTemplateItems(templateId, routineIds)
        .catch((e) => logServiceError("RoutineTemplates", "reorderItems", e));
    },
    [],
  );

  return useMemo(
    () => ({
      templates,
      isLoading,
      createTemplate,
      updateTemplate,
      deleteTemplate,
      addTemplateItem,
      removeTemplateItem,
      reorderTemplateItems,
    }),
    [
      templates,
      isLoading,
      createTemplate,
      updateTemplate,
      deleteTemplate,
      addTemplateItem,
      removeTemplateItem,
      reorderTemplateItems,
    ],
  );
}
