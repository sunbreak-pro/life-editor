import type { FrequencyType } from "./routine";

export interface RoutineGroup {
  id: string; // "rgroup-<uuid>"
  name: string;
  color: string;
  isVisible: boolean;
  order: number;
  frequencyType: FrequencyType;
  frequencyDays: number[];
  frequencyInterval: number | null;
  frequencyStartDate: string | null;
  createdAt: string;
  updatedAt: string;
}

// V69: junction row for Routine ↔ RoutineGroup membership.
// Soft-delete carried in `isDeleted`/`deletedAt` so unassign replicates via
// Cloud Sync. UI consumers should ignore is_deleted=true rows.
export interface RoutineGroupAssignment {
  id: string; // "rga-<uuid>"
  routineId: string;
  groupId: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  deletedAt: string | null;
}
