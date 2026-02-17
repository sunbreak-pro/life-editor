import { createContext, useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import { useRoutines } from "../hooks/useRoutines";
import { useRoutineTemplates } from "../hooks/useRoutineTemplates";
import { useScheduleItems } from "../hooks/useScheduleItems";

type RoutinesState = ReturnType<typeof useRoutines>;
type TemplatesState = ReturnType<typeof useRoutineTemplates>;
type ScheduleItemsState = ReturnType<typeof useScheduleItems>;

export type ScheduleContextValue = RoutinesState &
  TemplatesState &
  ScheduleItemsState;

export const ScheduleContext = createContext<ScheduleContextValue | null>(null);

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const routinesState = useRoutines();
  const templatesState = useRoutineTemplates();
  const scheduleItemsState = useScheduleItems();

  // Wrap deleteRoutine to also remove routine from all templates (Improvement 4)
  const deleteRoutine = useCallback(
    (id: string) => {
      routinesState.deleteRoutine(id);
      templatesState.removeRoutineFromAllTemplates(id);
    },
    [routinesState.deleteRoutine, templatesState.removeRoutineFromAllTemplates],
  );

  const value = useMemo<ScheduleContextValue>(
    () => ({
      ...routinesState,
      ...templatesState,
      ...scheduleItemsState,
      deleteRoutine,
    }),
    [routinesState, templatesState, scheduleItemsState, deleteRoutine],
  );

  return (
    <ScheduleContext.Provider value={value}>
      {children}
    </ScheduleContext.Provider>
  );
}
