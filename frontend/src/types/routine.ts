export type FrequencyType = "daily" | "weekdays" | "interval";

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
}
