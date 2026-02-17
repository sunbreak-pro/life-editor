export interface ScheduleItem {
  id: string;
  date: string;
  title: string;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  completed: boolean;
  completedAt: string | null;
  routineId: string | null;
  templateId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TemplateFrequencyType = "daily" | "custom";

export interface RoutineTemplate {
  id: string;
  name: string;
  frequencyType: TemplateFrequencyType;
  frequencyDays: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  order: number;
  items: RoutineTemplateItem[];
  createdAt: string;
  updatedAt: string;
}

export interface RoutineTemplateItem {
  id: number;
  templateId: string;
  routineId: string;
  position: number;
  startTime: string | null;
  endTime: string | null;
}

export interface RoutineStats {
  totalCompletedDays: number;
  currentStreak: number;
  longestStreak: number;
  recentDays: Array<{
    date: string;
    completionRate: number;
    completed: number;
    total: number;
  }>;
  perRoutineRates: Array<{
    routineId: string;
    routineTitle: string;
    completionRate: number;
    completedCount: number;
    totalCount: number;
  }>;
  monthlyHeatmap: Array<{
    date: string;
    completionRate: number;
  }>;
  overallRate: number;
}
