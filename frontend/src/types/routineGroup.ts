import type { FrequencyType } from "./routine";

export interface RoutineGroup {
  id: string; // "rgroup-<uuid>"
  name: string;
  color: string;
  order: number;
  frequencyType: FrequencyType;
  frequencyDays: number[];
  frequencyInterval: number | null;
  frequencyStartDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RoutineGroupTagAssignment {
  groupId: string;
  tagId: number;
}
