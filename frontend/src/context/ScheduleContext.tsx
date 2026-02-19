import { createContext, useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import { useRoutines } from "../hooks/useRoutines";
import { useRoutineTagAssignments } from "../hooks/useRoutineTagAssignments";
import { useScheduleItems } from "../hooks/useScheduleItems";
import { useRoutineTags } from "../hooks/useRoutineTags";

type RoutinesState = ReturnType<typeof useRoutines>;
type TagAssignmentsState = ReturnType<typeof useRoutineTagAssignments>;
type ScheduleItemsState = ReturnType<typeof useScheduleItems>;
type RoutineTagsState = ReturnType<typeof useRoutineTags>;

export type ScheduleContextValue = RoutinesState &
  TagAssignmentsState &
  ScheduleItemsState &
  RoutineTagsState;

export const ScheduleContext = createContext<ScheduleContextValue | null>(null);

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const routinesState = useRoutines();
  const tagAssignmentsState = useRoutineTagAssignments();
  const scheduleItemsState = useScheduleItems();
  const routineTagsState = useRoutineTags();

  // Wrap deleteRoutine to also remove tag assignments
  const deleteRoutine = useCallback(
    (id: string) => {
      routinesState.deleteRoutine(id);
      tagAssignmentsState.removeRoutineAssignments(id);
    },
    [routinesState, tagAssignmentsState],
  );

  const value = useMemo<ScheduleContextValue>(
    () => ({
      ...routinesState,
      ...tagAssignmentsState,
      ...scheduleItemsState,
      ...routineTagsState,
      deleteRoutine,
    }),
    [
      routinesState,
      tagAssignmentsState,
      scheduleItemsState,
      routineTagsState,
      deleteRoutine,
    ],
  );

  return (
    <ScheduleContext.Provider value={value}>
      {children}
    </ScheduleContext.Provider>
  );
}
