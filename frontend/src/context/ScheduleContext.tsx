import { createContext, useCallback, useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { useRoutines } from "../hooks/useRoutines";
import { useRoutineTagAssignments } from "../hooks/useRoutineTagAssignments";
import { useScheduleItems } from "../hooks/useScheduleItems";
import { useRoutineTags } from "../hooks/useRoutineTags";
import { useRoutineGroups } from "../hooks/useRoutineGroups";
import { useRoutineGroupTagAssignments } from "../hooks/useRoutineGroupTagAssignments";
import { useRoutineGroupComputed } from "../hooks/useRoutineGroupComputed";
import { useCalendarTags } from "../hooks/useCalendarTags";
import { useCalendarTagAssignments } from "../hooks/useCalendarTagAssignments";
import { useUndoRedo } from "../components/shared/UndoRedo";

type RoutinesState = ReturnType<typeof useRoutines>;
type TagAssignmentsState = ReturnType<typeof useRoutineTagAssignments>;
type ScheduleItemsState = ReturnType<typeof useScheduleItems>;
type RoutineTagsState = ReturnType<typeof useRoutineTags>;
type RoutineGroupsState = ReturnType<typeof useRoutineGroups>;
type RoutineGroupTagAssignmentsState = ReturnType<
  typeof useRoutineGroupTagAssignments
>;
type RoutineGroupComputedState = ReturnType<typeof useRoutineGroupComputed>;
type CalendarTagsState = ReturnType<typeof useCalendarTags>;
type CalendarTagAssignmentsState = ReturnType<typeof useCalendarTagAssignments>;

export type ScheduleContextValue = RoutinesState &
  TagAssignmentsState &
  ScheduleItemsState &
  RoutineTagsState &
  RoutineGroupsState &
  RoutineGroupTagAssignmentsState &
  RoutineGroupComputedState &
  CalendarTagsState &
  CalendarTagAssignmentsState;

export const ScheduleContext = createContext<ScheduleContextValue | null>(null);

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const routinesState = useRoutines();
  const tagAssignmentsState = useRoutineTagAssignments();
  const scheduleItemsState = useScheduleItems();
  const routineTagsState = useRoutineTags();
  const routineGroupsState = useRoutineGroups();
  const routineGroupTagAssignmentsState = useRoutineGroupTagAssignments();
  const calendarTagsState = useCalendarTags();
  const calendarTagAssignmentsState = useCalendarTagAssignments();
  const routineGroupComputedState = useRoutineGroupComputed({
    routineGroups: routineGroupsState.routineGroups,
    routines: routinesState.routines,
    groupTagAssignments: routineGroupTagAssignmentsState.groupTagAssignments,
    tagAssignments: tagAssignmentsState.tagAssignments,
  });
  const { push } = useUndoRedo();

  // Wrap deleteRoutine to also remove tag assignments + push composite undo
  const deleteRoutine = useCallback(
    (id: string) => {
      const target = routinesState.routines.find((r) => r.id === id);
      const prevTagIds = tagAssignmentsState.tagAssignments.get(id) ?? [];

      routinesState.deleteRoutine(id);
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
            routinesState.deleteRoutine(id);
            tagAssignmentsState.removeRoutineAssignments(id);
          },
        });
      }
    },
    [routinesState, tagAssignmentsState, push],
  );

  // Sync schedule items when routine times change
  useEffect(() => {
    if (routinesState.routines.length > 0) {
      scheduleItemsState.syncScheduleItemsWithRoutines(routinesState.routines);
    }
  }, [
    routinesState.routines,
    scheduleItemsState.syncScheduleItemsWithRoutines,
  ]);

  // Backfill missed routine items on startup
  const backfillDoneRef = useRef(false);
  useEffect(() => {
    if (
      backfillDoneRef.current ||
      routinesState.isLoading ||
      routinesState.routines.length === 0
    )
      return;
    backfillDoneRef.current = true;
    scheduleItemsState.backfillMissedRoutineItems(
      routinesState.routines,
      tagAssignmentsState.tagAssignments,
    );
  }, [
    routinesState.routines,
    routinesState.isLoading,
    tagAssignmentsState.tagAssignments,
    scheduleItemsState.backfillMissedRoutineItems,
  ]);

  const value = useMemo<ScheduleContextValue>(
    () => ({
      ...routinesState,
      ...tagAssignmentsState,
      ...scheduleItemsState,
      ...routineTagsState,
      ...routineGroupsState,
      ...routineGroupTagAssignmentsState,
      ...routineGroupComputedState,
      ...calendarTagsState,
      ...calendarTagAssignmentsState,
      deleteRoutine,
    }),
    [
      routinesState,
      tagAssignmentsState,
      scheduleItemsState,
      routineTagsState,
      routineGroupsState,
      routineGroupTagAssignmentsState,
      routineGroupComputedState,
      calendarTagsState,
      calendarTagAssignmentsState,
      deleteRoutine,
    ],
  );

  return (
    <ScheduleContext.Provider value={value}>
      {children}
    </ScheduleContext.Provider>
  );
}
