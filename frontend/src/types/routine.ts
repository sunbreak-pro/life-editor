export interface RoutineNode {
  id: string;
  title: string;
  startTime: string | null; // "HH:MM"
  endTime: string | null; // "HH:MM"
  isArchived: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}
