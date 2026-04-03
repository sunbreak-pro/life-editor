import type { CalendarItem } from "../../../../types/calendarItem";
import { DayCell } from "./DayCell";
import { formatDateKey } from "../../../../hooks/useCalendar";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_HEADER_COLORS: Record<number, string> = {
  0: "text-red-500 dark:text-red-400",
  6: "text-blue-500 dark:text-blue-400",
};

interface MonthlyViewProps {
  days: { date: Date; isCurrentMonth: boolean }[];
  itemsByDate: Map<string, CalendarItem[]>;
  onSelectItem: (item: CalendarItem, event: React.MouseEvent) => void;
  onOpenRoutineManagement?: () => void;
  onOpenCreateMenu?: (date: Date, event: React.MouseEvent) => void;
  getTaskColor?: (taskId: string) => string | undefined;
  getRoutineCompletion?: (date: string) => { completed: number; total: number };
  onDateSelect?: (date: Date) => void;
}

export function MonthlyView({
  days,
  itemsByDate,
  onSelectItem,
  onOpenRoutineManagement,
  onOpenCreateMenu,
  getTaskColor,
  getRoutineCompletion,
  onDateSelect,
}: MonthlyViewProps) {
  const today = new Date();
  const todayKey = formatDateKey(today);

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map((name, i) => (
          <div
            key={name}
            className={`text-xs font-medium text-center py-2 ${DAY_HEADER_COLORS[i] ?? "text-notion-text-secondary"}`}
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
              items={itemsByDate.get(key) ?? []}
              onSelectItem={onSelectItem}
              onOpenRoutineManagement={onOpenRoutineManagement}
              onOpenCreateMenu={onOpenCreateMenu}
              getTaskColor={getTaskColor}
              routineCompletion={getRoutineCompletion?.(key)}
              onDateSelect={onDateSelect}
            />
          );
        })}
      </div>
    </div>
  );
}
