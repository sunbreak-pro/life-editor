import type { TaskNode } from "../../../../types/taskTree";
import { DayCell } from "./DayCell";
import { formatDateKey } from "../../../../hooks/useCalendar";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface WeeklyViewProps {
  days: { date: Date; isCurrentMonth: boolean }[];
  tasksByDate: Map<string, TaskNode[]>;
  onSelectTask: (taskId: string) => void;
}

export function WeeklyView({
  days,
  tasksByDate,
  onSelectTask,
}: WeeklyViewProps) {
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
            />
          );
        })}
      </div>
    </div>
  );
}
