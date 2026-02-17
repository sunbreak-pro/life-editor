import type { TaskNode } from "../../../../types/taskTree";
import type { MemoNode } from "../../../../types/memo";
import type { NoteNode } from "../../../../types/note";
import { DayCell } from "./DayCell";
import { formatDateKey } from "../../../../hooks/useCalendar";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface MonthlyViewProps {
  days: { date: Date; isCurrentMonth: boolean }[];
  tasksByDate: Map<string, TaskNode[]>;
  onSelectTask: (taskId: string, event: React.MouseEvent) => void;
  onCreateTask?: (date: Date, event: React.MouseEvent) => void;
  getTaskColor?: (taskId: string) => string | undefined;
  getFolderTag?: (taskId: string) => string;
  memosByDate?: Map<string, MemoNode>;
  getRoutineCompletion?: (date: string) => { completed: number; total: number };
  calendarMode?: "tasks" | "memo";
  notesByDate?: Map<string, NoteNode[]>;
  onMemoChipClick?: (date: string, e: React.MouseEvent) => void;
  onNoteChipClick?: (noteId: string, e: React.MouseEvent) => void;
}

export function MonthlyView({
  days,
  tasksByDate,
  onSelectTask,
  onCreateTask,
  getTaskColor,
  getFolderTag,
  memosByDate,
  getRoutineCompletion,
  calendarMode,
  notesByDate,
  onMemoChipClick,
  onNoteChipClick,
}: MonthlyViewProps) {
  const today = new Date();
  const todayKey = formatDateKey(today);

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map((name) => (
          <div
            key={name}
            className="text-xs font-medium text-notion-text-secondary text-center py-2"
          >
            {name}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const key = formatDateKey(day.date);
          return (
            <DayCell
              key={i}
              date={day.date}
              isCurrentMonth={day.isCurrentMonth}
              isToday={key === todayKey}
              tasks={tasksByDate.get(key) ?? []}
              onSelectTask={onSelectTask}
              onCreateTask={onCreateTask}
              getTaskColor={getTaskColor}
              getFolderTag={getFolderTag}
              memo={memosByDate?.get(key)}
              routineCompletion={getRoutineCompletion?.(key)}
              calendarMode={calendarMode}
              notes={notesByDate?.get(key)}
              onMemoChipClick={onMemoChipClick}
              onNoteChipClick={onNoteChipClick}
            />
          );
        })}
      </div>
    </div>
  );
}
