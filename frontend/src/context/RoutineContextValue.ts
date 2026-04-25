import { createContext } from "react";
import type { useRoutines } from "../hooks/useRoutines";
import type { useRoutineGroups } from "../hooks/useRoutineGroups";
import type { useRoutineGroupAssignments } from "../hooks/useRoutineGroupAssignments";
import type { useRoutineGroupComputed } from "../hooks/useRoutineGroupComputed";

type RoutinesState = ReturnType<typeof useRoutines>;
type RoutineGroupsState = ReturnType<typeof useRoutineGroups>;
type RoutineGroupAssignmentsState = ReturnType<
  typeof useRoutineGroupAssignments
>;
type RoutineGroupComputedState = ReturnType<typeof useRoutineGroupComputed>;

export type RoutineContextValue = RoutinesState &
  RoutineGroupsState &
  RoutineGroupAssignmentsState &
  RoutineGroupComputedState;

export const RoutineContext = createContext<RoutineContextValue | null>(null);
