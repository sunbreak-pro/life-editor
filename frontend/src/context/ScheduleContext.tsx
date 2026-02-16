import { createContext, useMemo } from "react";
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

  const value = useMemo<ScheduleContextValue>(
    () => ({
      ...routinesState,
      ...templatesState,
      ...scheduleItemsState,
    }),
    [routinesState, templatesState, scheduleItemsState],
  );

  return (
    <ScheduleContext.Provider value={value}>
      {children}
    </ScheduleContext.Provider>
  );
}
