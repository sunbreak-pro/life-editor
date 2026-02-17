export interface RoutineNode {
  id: string;
  title: string;
  startTime: string | null; // "HH:MM"
  endTime: string | null; // "HH:MM"
  isArchived: boolean;
  order: number;
  tagId: number | null;
  createdAt: string;
  updatedAt: string;
}
