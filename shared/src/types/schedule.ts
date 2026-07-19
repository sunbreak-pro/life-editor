export interface ScheduleItem {
  id: string;
  date: string;
  title: string;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  completed: boolean;
  completedAt: string | null;
  routineId: string | null;
  /** Generator origin day (events_payload.source_date). Differs from `date`
   *  when the user hand-moved a routine occurrence to another day — the
   *  generator's cleanup must treat such rows as user edits, never
   *  auto-delete them (#296). null / absent for manual events. */
  sourceDate?: string | null;
  templateId: string | null;
  memo: string | null;
  noteId: string | null;
  content: string | null;
  isDeleted?: boolean;
  deletedAt?: string | null;
  isDismissed?: boolean;
  isAllDay?: boolean;
  reminderEnabled?: boolean;
  reminderOffset?: number;
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
