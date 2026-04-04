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
  memo: string | null;
  noteId: string | null;
  content: string | null;
  isDismissed?: boolean;
  isAllDay?: boolean;
  createdAt: string;
  updatedAt: string;
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
