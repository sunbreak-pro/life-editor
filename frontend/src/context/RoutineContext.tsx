import { useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import { useRoutines } from "../hooks/useRoutines";
import { useRoutineTagAssignments } from "../hooks/useRoutineTagAssignments";
import { useRoutineTags } from "../hooks/useRoutineTags";
import { useRoutineGroups } from "../hooks/useRoutineGroups";
import { useRoutineGroupTagAssignments } from "../hooks/useRoutineGroupTagAssignments";
import { useRoutineGroupComputed } from "../hooks/useRoutineGroupComputed";
import { useUndoRedo } from "../components/shared/UndoRedo";
import { RoutineContext } from "./RoutineContextValue";
import type { RoutineContextValue } from "./RoutineContextValue";

export function RoutineProvider({ children }: { children: ReactNode }) {
  const routinesState = useRoutines();
  const tagAssignmentsState = useRoutineTagAssignments();
  const routineTagsState = useRoutineTags();
  const routineGroupsState = useRoutineGroups();
  const routineGroupTagAssignmentsState = useRoutineGroupTagAssignments();
  const routineGroupComputedState = useRoutineGroupComputed({
    routineGroups: routineGroupsState.routineGroups,
    routines: routinesState.routines,
    groupTagAssignments: routineGroupTagAssignmentsState.groupTagAssignments,
    tagAssignments: tagAssignmentsState.tagAssignments,
  });
  const { push } = useUndoRedo();

  // Wrap deleteRoutine to also remove tag assignments + push composite undo
  const deleteRoutine = useCallback(
    async (id: string): Promise<{ deletedScheduleItemIds: string[] }> => {
      const target = routinesState.routines.find((r) => r.id === id);
      const prevTagIds = tagAssignmentsState.tagAssignments.get(id) ?? [];

      const result = await routinesState.deleteRoutine(id, { skipUndo: true });
      tagAssignmentsState.removeRoutineAssignments(id);

      if (target) {
        push("routine", {
          label: "deleteRoutine",
          undo: () => {
            routinesState.restoreRoutine(id);
            if (prevTagIds.length > 0) {
              tagAssignmentsState.setTagsForRoutine(id, prevTagIds);
            }
          },
          redo: () => {
            void routinesState.deleteRoutine(id, { skipUndo: true });
            tagAssignmentsState.removeRoutineAssignments(id);
          },
        });
      }

      return result;
    },
    [routinesState, tagAssignmentsState, push],
  );

  const value = useMemo<RoutineContextValue>(
    () => ({
      ...routinesState,
      ...tagAssignmentsState,
      ...routineTagsState,
      ...routineGroupsState,
      ...routineGroupTagAssignmentsState,
      ...routineGroupComputedState,
      deleteRoutine,
    }),
    [
      routinesState,
      tagAssignmentsState,
      routineTagsState,
      routineGroupsState,
      routineGroupTagAssignmentsState,
      routineGroupComputedState,
      deleteRoutine,
    ],
  );

  return (
    <RoutineContext.Provider value={value}>{children}</RoutineContext.Provider>
  );
}
