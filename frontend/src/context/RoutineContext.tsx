import { useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import { useRoutines } from "../hooks/useRoutines";
import { useRoutineGroups } from "../hooks/useRoutineGroups";
import { useRoutineGroupAssignments } from "../hooks/useRoutineGroupAssignments";
import { useRoutineGroupComputed } from "../hooks/useRoutineGroupComputed";
import { useUndoRedo } from "../components/shared/UndoRedo";
import { RoutineContext } from "./RoutineContextValue";
import type { RoutineContextValue } from "./RoutineContextValue";

export function RoutineProvider({ children }: { children: ReactNode }) {
  const routinesState = useRoutines();
  const routineGroupsState = useRoutineGroups();
  const routineGroupAssignmentsState = useRoutineGroupAssignments();
  const routineGroupComputedState = useRoutineGroupComputed({
    routineGroups: routineGroupsState.routineGroups,
    routines: routinesState.routines,
    routineGroupAssignments:
      routineGroupAssignmentsState.routineGroupAssignments,
  });
  const { push } = useUndoRedo();

  // Wrap deleteRoutine so undo restores both the routine and its prior Group
  // memberships. Without preserving prevGroupIds, undoing a delete would
  // silently leave the routine ungrouped.
  const deleteRoutine = useCallback(
    async (id: string): Promise<{ deletedScheduleItemIds: string[] }> => {
      const target = routinesState.routines.find((r) => r.id === id);
      const prevGroupIds =
        routineGroupAssignmentsState.routineGroupAssignments.get(id) ?? [];

      const result = await routinesState.deleteRoutine(id, { skipUndo: true });
      routineGroupAssignmentsState.removeRoutineAssignments(id);

      if (target) {
        push("routine", {
          label: "deleteRoutine",
          undo: () => {
            routinesState.restoreRoutine(id);
            if (prevGroupIds.length > 0) {
              routineGroupAssignmentsState.setGroupsForRoutine(
                id,
                prevGroupIds,
              );
            }
          },
          redo: () => {
            void routinesState.deleteRoutine(id, { skipUndo: true });
            routineGroupAssignmentsState.removeRoutineAssignments(id);
          },
        });
      }

      return result;
    },
    [routinesState, routineGroupAssignmentsState, push],
  );

  const value = useMemo<RoutineContextValue>(
    () => ({
      ...routinesState,
      ...routineGroupsState,
      ...routineGroupAssignmentsState,
      ...routineGroupComputedState,
      deleteRoutine,
    }),
    [
      routinesState,
      routineGroupsState,
      routineGroupAssignmentsState,
      routineGroupComputedState,
      deleteRoutine,
    ],
  );

  return (
    <RoutineContext.Provider value={value}>{children}</RoutineContext.Provider>
  );
}
