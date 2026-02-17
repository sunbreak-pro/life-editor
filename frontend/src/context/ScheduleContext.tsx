import { createContext, useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import { useRoutines } from "../hooks/useRoutines";
import { useRoutineTemplates } from "../hooks/useRoutineTemplates";
import { useScheduleItems } from "../hooks/useScheduleItems";
import { useRoutineTags } from "../hooks/useRoutineTags";

type RoutinesState = ReturnType<typeof useRoutines>;
type TemplatesState = ReturnType<typeof useRoutineTemplates>;
type ScheduleItemsState = ReturnType<typeof useScheduleItems>;
type RoutineTagsState = ReturnType<typeof useRoutineTags>;

export type ScheduleContextValue = RoutinesState &
  TemplatesState &
  ScheduleItemsState &
  RoutineTagsState;

export const ScheduleContext = createContext<ScheduleContextValue | null>(null);

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const routinesState = useRoutines();
  const templatesState = useRoutineTemplates();
  const scheduleItemsState = useScheduleItems();
  const routineTagsState = useRoutineTags();

  // Wrap deleteRoutine to also remove routine from all templates
  const deleteRoutine = useCallback(
    (id: string) => {
      routinesState.deleteRoutine(id);
      templatesState.removeRoutineFromAllTemplates(id);
    },
    [routinesState.deleteRoutine, templatesState.removeRoutineFromAllTemplates],
  );

  // Wrap updateRoutine: when tagId is set, auto-add routine to all templates with same tagId
  const updateRoutine: RoutinesState["updateRoutine"] = useCallback(
    (id, updates) => {
      routinesState.updateRoutine(id, updates);
      if (updates.tagId != null) {
        const routine = routinesState.routines.find((r) => r.id === id);
        for (const tmpl of templatesState.templates) {
          if (tmpl.tagId === updates.tagId) {
            const alreadyHas = tmpl.items.some((i) => i.routineId === id);
            if (!alreadyHas) {
              templatesState.addTemplateItem(
                tmpl.id,
                id,
                routine?.startTime ?? null,
                routine?.endTime ?? null,
              );
            }
          }
        }
      }
    },
    [
      routinesState.updateRoutine,
      routinesState.routines,
      templatesState.templates,
      templatesState.addTemplateItem,
    ],
  );

  const value = useMemo<ScheduleContextValue>(
    () => ({
      ...routinesState,
      ...templatesState,
      ...scheduleItemsState,
      ...routineTagsState,
      deleteRoutine,
      updateRoutine,
    }),
    [
      routinesState,
      templatesState,
      scheduleItemsState,
      routineTagsState,
      deleteRoutine,
      updateRoutine,
    ],
  );

  return (
    <ScheduleContext.Provider value={value}>
      {children}
    </ScheduleContext.Provider>
  );
}
