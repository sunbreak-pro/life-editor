import type { RoutineNode } from "../../types/routine";
import type {
  RoutineGroup,
  RoutineGroupAssignment,
} from "../../types/routineGroup";
import { tauriInvoke } from "../bridge";

export const routinesApi = {
  fetchAllRoutines(): Promise<RoutineNode[]> {
    return tauriInvoke("db_routines_fetch_all");
  },
  createRoutine(
    id: string,
    title: string,
    startTime?: string,
    endTime?: string,
    frequencyType?: string,
    frequencyDays?: number[],
    frequencyInterval?: number | null,
    frequencyStartDate?: string | null,
    reminderEnabled?: boolean,
    reminderOffset?: number,
  ): Promise<RoutineNode> {
    return tauriInvoke("db_routines_create", {
      id,
      title,
      startTime,
      endTime,
      frequencyType,
      frequencyDays,
      frequencyInterval,
      frequencyStartDate,
      reminderEnabled,
      reminderOffset,
    });
  },
  updateRoutine(
    id: string,
    updates: Partial<
      Pick<
        RoutineNode,
        | "title"
        | "startTime"
        | "endTime"
        | "isArchived"
        | "isVisible"
        | "order"
        | "frequencyType"
        | "frequencyDays"
        | "frequencyInterval"
        | "frequencyStartDate"
        | "reminderEnabled"
        | "reminderOffset"
      >
    >,
  ): Promise<RoutineNode> {
    return tauriInvoke("db_routines_update", { id, updates });
  },
  deleteRoutine(id: string): Promise<void> {
    return tauriInvoke("db_routines_delete", { id });
  },
  fetchDeletedRoutines(): Promise<RoutineNode[]> {
    return tauriInvoke("db_routines_fetch_deleted");
  },
  async softDeleteRoutine(
    id: string,
  ): Promise<{ deletedScheduleItemIds: string[] }> {
    const ids = await tauriInvoke<string[]>("db_routines_soft_delete", { id });
    return { deletedScheduleItemIds: ids };
  },
  restoreRoutine(id: string): Promise<void> {
    return tauriInvoke("db_routines_restore", { id });
  },
  permanentDeleteRoutine(id: string): Promise<void> {
    return tauriInvoke("db_routines_permanent_delete", { id });
  },
  fetchRoutineGroups(): Promise<RoutineGroup[]> {
    return tauriInvoke("db_routine_groups_fetch_all");
  },
  createRoutineGroup(
    id: string,
    name: string,
    color: string,
    frequencyType?: string,
    frequencyDays?: number[],
    frequencyInterval?: number | null,
    frequencyStartDate?: string | null,
  ): Promise<RoutineGroup> {
    return tauriInvoke("db_routine_groups_create", {
      id,
      name,
      color,
      frequencyType,
      frequencyDays,
      frequencyInterval,
      frequencyStartDate,
    });
  },
  updateRoutineGroup(
    id: string,
    updates: Partial<
      Pick<
        RoutineGroup,
        | "name"
        | "color"
        | "isVisible"
        | "order"
        | "frequencyType"
        | "frequencyDays"
        | "frequencyInterval"
        | "frequencyStartDate"
      >
    >,
  ): Promise<RoutineGroup> {
    return tauriInvoke("db_routine_groups_update", { id, updates });
  },
  deleteRoutineGroup(id: string): Promise<void> {
    return tauriInvoke("db_routine_groups_delete", { id });
  },
  fetchAllRoutineGroupAssignments(): Promise<RoutineGroupAssignment[]> {
    return tauriInvoke("db_routine_group_assignments_fetch_all");
  },
  setGroupsForRoutine(routineId: string, groupIds: string[]): Promise<void> {
    return tauriInvoke("db_routine_group_assignments_set_for_routine", {
      routineId,
      groupIds,
    });
  },
};
