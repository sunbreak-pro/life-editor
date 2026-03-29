import { useState, useRef } from "react";
import { Repeat, ListTodo, FileText } from "lucide-react";
import type { CalendarItem } from "../../../../types/calendarItem";
import { CalendarItemChip } from "./CalendarItemChip";
import { useClickOutside } from "../../../../hooks/useClickOutside";

interface DayCellProps {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  items: CalendarItem[];
  onSelectItem: (item: CalendarItem, event: React.MouseEvent) => void;
  onOpenRoutineManagement?: () => void;
  onCreateTask?: (date: Date, event: React.MouseEvent) => void;
  onCreateNote?: (date: Date, event: React.MouseEvent) => void;
  getTaskColor?: (taskId: string) => string | undefined;
  routineCompletion?: { completed: number; total: number };
  onDateSelect?: (date: Date) => void;
}

const MAX_VISIBLE_ITEMS = 2;

export function DayCell({
  date,
  isCurrentMonth,
  isToday,
  items,
  onSelectItem,
  onOpenRoutineManagement,
  onCreateTask,
  onCreateNote,
  getTaskColor,
  routineCompletion,
  onDateSelect,
}: DayCellProps) {
  const visibleItems = items.slice(0, MAX_VISIBLE_ITEMS);
  const hiddenItems = items.slice(MAX_VISIBLE_ITEMS);
  const remainingCount = hiddenItems.length;

  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const closeMore = () => setShowMore(false);
  useClickOutside(moreRef, closeMore, showMore);

  const cellBg = isCurrentMonth ? "bg-notion-bg" : "bg-notion-bg-secondary/50";
  const dateColor = isToday
    ? "w-6 h-6 flex items-center justify-center rounded-full bg-notion-accent text-white font-bold"
    : isCurrentMonth
      ? "text-notion-text"
      : "text-notion-text-secondary/50";

  return (
    <div
      className={`group min-h-30 border border-notion-border p-1.5 flex flex-col ${cellBg}`}
    >
      <div className="flex items-center justify-between mb-1">
        <button
          onClick={() => onDateSelect?.(date)}
          className={`text-xs ${dateColor} hover:opacity-80 transition-opacity`}
        >
          {date.getDate()}
        </button>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {onOpenRoutineManagement && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenRoutineManagement();
              }}
              className="w-5.5 h-5.5 flex items-center justify-center rounded hover:bg-notion-hover text-notion-text-secondary"
              title="Routine"
            >
              <Repeat size={12} />
            </button>
          )}
          {onCreateTask && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCreateTask(date, e);
              }}
              className="w-5.5 h-5.5 flex items-center justify-center rounded hover:bg-notion-hover text-notion-text-secondary"
              title="Task"
            >
              <ListTodo size={12} />
            </button>
          )}
          {onCreateNote && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCreateNote(date, e);
              }}
              className="w-5.5 h-5.5 flex items-center justify-center rounded hover:bg-notion-hover text-notion-text-secondary"
              title="Note / Daily"
            >
              <FileText size={12} />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 space-y-0.5">
        {visibleItems.map((item) => (
          <CalendarItemChip
            key={item.id}
            item={item}
            onClick={(e) => onSelectItem(item, e)}
            taskColor={
              item.type === "task" ? getTaskColor?.(item.id) : undefined
            }
          />
        ))}
        {remainingCount === 1 && (
          <CalendarItemChip
            key={hiddenItems[0].id}
            item={hiddenItems[0]}
            onClick={(e) => onSelectItem(hiddenItems[0], e)}
            taskColor={
              hiddenItems[0].type === "task"
                ? getTaskColor?.(hiddenItems[0].id)
                : undefined
            }
          />
        )}
        {remainingCount >= 2 && (
          <div className="relative" ref={moreRef}>
            <button
              className="text-xs text-notion-text-secondary px-1 hover:text-notion-text transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setShowMore(!showMore);
              }}
            >
              +{remainingCount} more
            </button>
            {showMore && (
              <div className="absolute left-0 top-full mt-1 z-50 w-48 bg-notion-bg border border-notion-border rounded-lg shadow-lg py-1">
                {hiddenItems.map((item) => (
                  <CalendarItemChip
                    key={item.id}
                    item={item}
                    onClick={(e) => {
                      onSelectItem(item, e);
                      setShowMore(false);
                    }}
                    taskColor={
                      item.type === "task" ? getTaskColor?.(item.id) : undefined
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {routineCompletion && routineCompletion.total > 0 && (
        <div className="mt-auto pt-1">
          <div className="flex items-center gap-1">
            <div className="flex-1 h-1 bg-emerald-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 rounded-full transition-all"
                style={{
                  width: `${(routineCompletion.completed / routineCompletion.total) * 100}%`,
                }}
              />
            </div>
            <span className="text-[10px] text-emerald-500 tabular-nums shrink-0">
              {routineCompletion.completed}/{routineCompletion.total}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
