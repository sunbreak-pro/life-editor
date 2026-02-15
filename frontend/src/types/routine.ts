export type TimeSlot = "morning" | "afternoon" | "evening" | "anytime";
export type FrequencyType = "daily" | "custom" | "timesPerWeek";

export interface RoutineNode {
  id: string;
  title: string;
  frequencyType: FrequencyType;
  frequencyDays: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  timesPerWeek?: number; // used when frequencyType === "timesPerWeek"
  timeSlot: TimeSlot;
  soundPresetId?: string;
  isArchived: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface RoutineLog {
  id: number;
  routineId: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  createdAt: string;
}

export interface RoutineStats {
  currentStreak: number;
  bestStreak: number;
  isAtRisk: boolean; // 1 day missed, streak will break if missed again
  last7Days: { date: string; completed: boolean; applicable: boolean }[];
  monthlySummaries: { month: string; completed: number; total: number }[];
  milestones: number[]; // achieved milestone day counts (7, 30, 100, 365)
}

export interface RoutineStack {
  id: string;
  name: string;
  order: number;
  items: RoutineStackItem[];
  createdAt: string;
  updatedAt: string;
}

export interface RoutineStackItem {
  id: number;
  stackId: string;
  routineId: string;
  position: number;
}

export interface HeatmapDay {
  date: string;
  completed: number;
  total: number;
  rate: number; // 0-1
}

export interface WeeklyRate {
  weekStart: string;
  rate: number; // 0-1
}
