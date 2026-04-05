import { createContext } from "react";
import type { useRoutines } from "../hooks/useRoutines";
import type { useRoutineTagAssignments } from "../hooks/useRoutineTagAssignments";
import type { useRoutineTags } from "../hooks/useRoutineTags";
import type { useRoutineGroups } from "../hooks/useRoutineGroups";
import type { useRoutineGroupTagAssignments } from "../hooks/useRoutineGroupTagAssignments";
import type { useRoutineGroupComputed } from "../hooks/useRoutineGroupComputed";

type RoutinesState = ReturnType<typeof useRoutines>;
type TagAssignmentsState = ReturnType<typeof useRoutineTagAssignments>;
type RoutineTagsState = ReturnType<typeof useRoutineTags>;
type RoutineGroupsState = ReturnType<typeof useRoutineGroups>;
type RoutineGroupTagAssignmentsState = ReturnType<
  typeof useRoutineGroupTagAssignments
>;
type RoutineGroupComputedState = ReturnType<typeof useRoutineGroupComputed>;

export type RoutineContextValue = RoutinesState &
  TagAssignmentsState &
  RoutineTagsState &
  RoutineGroupsState &
  RoutineGroupTagAssignmentsState &
  RoutineGroupComputedState;

export const RoutineContext = createContext<RoutineContextValue | null>(null);
