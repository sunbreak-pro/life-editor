// "group" (V69) defers daily/weekdays/interval to the routine's assigned
// RoutineGroups. Multiple group memberships OR'd together — the routine
// fires on any day satisfied by at least one of its groups.
export type FrequencyType = "daily" | "weekdays" | "interval" | "group";

export interface RoutineNode {
  id: string;
  title: string;
  startTime: string | null; // "HH:MM"
  endTime: string | null; // "HH:MM"
  isArchived: boolean;
  isVisible: boolean;
  isDeleted: boolean;
  deletedAt: string | null;
  order: number;
  frequencyType: FrequencyType;
  frequencyDays: number[]; // [0=Sun, 1=Mon, ..., 6=Sat]
  frequencyInterval: number | null;
  frequencyStartDate: string | null; // "YYYY-MM-DD"
  reminderEnabled?: boolean;
  reminderOffset?: number;
  createdAt: string;
  updatedAt: string;
  // V69: Group memberships. Populated by joining routine_group_assignments.
  // Only meaningful when frequencyType === "group", but kept on every node so
  // the EditRoutine dialog can recover the list when toggling between types.
  groupIds?: string[];
}
