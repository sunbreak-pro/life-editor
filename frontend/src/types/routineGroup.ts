export interface RoutineGroup {
  id: string; // "rgroup-<uuid>"
  name: string;
  color: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface RoutineGroupTagAssignment {
  groupId: string;
  tagId: number;
}
