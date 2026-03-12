import { useState, useRef } from "react";
import { ListTodo, FileText } from "lucide-react";
import type { CalendarItem } from "../../../../types/calendarItem";
import { CalendarItemChip } from "./CalendarItemChip";
import { useClickOutside } from "../../../../hooks/useClickOutside";

interface DayCellProps {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  items: CalendarItem[];
  onSelectItem: (item: CalendarItem, event: React.MouseEvent) => void;
  onCreateTask?: (date: Date, event: React.MouseEvent) => void;
  onCreateNote?: (date: Date, event: React.MouseEvent) => void;
  getTaskColor?: (taskId: string) => string | undefined;
  routineCompletion?: { completed: number; total: number };
}

const MAX_VISIBLE_ITEMS = 2;

export function DayCell({
  date,
  isCurrentMonth,
  isToday,
  items,
  onSelectItem,
  onCreateTask,
  onCreateNote,
  getTaskColor,
  routineCompletion,
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
      className={`group min-h-30 border border-notion-border p-1.5 ${cellBg}`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className={`text-xs ${dateColor}`}>{date.getDate()}</div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
      <div className="space-y-0.5">
        {routineCompletion && routineCompletion.total > 0 && (
          <div
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] truncate"
            style={{
              backgroundColor:
                routineCompletion.completed === routineCompletion.total
                  ? "#DCFCE7"
                  : "#F3F4F6",
              color:
                routineCompletion.completed === routineCompletion.total
                  ? "#16A34A"
                  : "#6B7280",
            }}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                routineCompletion.completed === routineCompletion.total
                  ? "bg-green-500"
                  : "bg-gray-400"
              }`}
            />
            <span className="truncate font-medium">
              {routineCompletion.completed}/{routineCompletion.total}
            </span>
          </div>
        )}
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
    </div>
  );
}
