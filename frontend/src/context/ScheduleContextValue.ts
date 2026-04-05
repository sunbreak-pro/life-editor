import type { useRoutines } from "../hooks/useRoutines";
import type { useRoutineTagAssignments } from "../hooks/useRoutineTagAssignments";
import type { useScheduleItems } from "../hooks/useScheduleItems";
import type { useRoutineTags } from "../hooks/useRoutineTags";
import type { useRoutineGroups } from "../hooks/useRoutineGroups";
import type { useRoutineGroupTagAssignments } from "../hooks/useRoutineGroupTagAssignments";
import type { useRoutineGroupComputed } from "../hooks/useRoutineGroupComputed";
import type { useCalendarTags } from "../hooks/useCalendarTags";
import type { useCalendarTagAssignments } from "../hooks/useCalendarTagAssignments";

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

/** @deprecated Use RoutineContextValue, ScheduleItemsContextValue, or CalendarTagsContextValue instead. */
export type ScheduleContextValue = RoutinesState &
  TagAssignmentsState &
  ScheduleItemsState &
  RoutineTagsState &
  RoutineGroupsState &
  RoutineGroupTagAssignmentsState &
  RoutineGroupComputedState &
  CalendarTagsState &
  CalendarTagAssignmentsState;
