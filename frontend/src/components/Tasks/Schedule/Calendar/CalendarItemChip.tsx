import { memo } from "react";
import {
  CheckSquare,
  BookOpen,
  StickyNote,
  CalendarClock,
  Repeat,
  Layers,
  Sparkles,
} from "lucide-react";
import type { CalendarItem } from "../../../../types/calendarItem";
import { CALENDAR_ITEM_COLORS } from "../../../../types/calendarItem";

interface CalendarItemChipProps {
  item: CalendarItem;
  onSelectItem: (item: CalendarItem, e: React.MouseEvent) => void;
}

export const CalendarItemChip = memo(function CalendarItemChip({
  item,
  onSelectItem,
}: CalendarItemChipProps) {
  const onClick = (e: React.MouseEvent) => onSelectItem(item, e);
  if (item.type === "holiday") {
    return (
      <div
        className="w-full text-left px-1.5 py-1 rounded text-xs truncate flex items-center gap-1"
        style={{
          backgroundColor: `${CALENDAR_ITEM_COLORS.holiday}15`,
          color: CALENDAR_ITEM_COLORS.holiday,
        }}
      >
        <Sparkles size={10} className="shrink-0" />
        <span className="truncate">{item.title}</span>
      </div>
    );
  }

  if (item.type === "task" && item.task) {
    const isDone = item.task.status === "DONE";

    return (
      <button
        onClick={onClick}
        className={`w-full text-left px-1.5 py-1 rounded text-xs truncate transition-colors flex items-center gap-1 ${
          isDone
            ? "text-notion-text-secondary line-through bg-notion-hover/50"
            : "text-notion-text bg-notion-accent/10 hover:bg-notion-accent/20"
        }`}
      >
        <CheckSquare size={10} className="shrink-0" />
        <span className="truncate">{item.title}</span>
      </button>
    );
  }

  // Routine Group
  if (item.type === "routineGroup" && item.routineGroup) {
    const groupColor = item.color;
    const count = item.groupScheduleItems?.length ?? 0;

    return (
      <button
        onClick={onClick}
        className="w-full text-left px-1.5 py-1 rounded text-xs truncate transition-colors flex items-center gap-1 hover:opacity-80"
        style={{ backgroundColor: `${groupColor}30`, color: groupColor }}
      >
        <Layers size={10} className="shrink-0" />
        <span className="truncate">
          {item.title}
          {count > 0 && <span className="ml-1 opacity-70">({count})</span>}
        </span>
      </button>
    );
  }

  // Event (schedule item)
  if (item.type === "event" && item.scheduleItem) {
    const isCompleted = item.scheduleItem.completed;
    const isRoutine = item.scheduleItem.routineId !== null;
    const eventColor = isRoutine
      ? CALENDAR_ITEM_COLORS.routine
      : CALENDAR_ITEM_COLORS.event;
    const Icon = isRoutine ? Repeat : CalendarClock;

    return (
      <button
        onClick={onClick}
        className={`w-full text-left px-1.5 py-1 rounded text-xs truncate transition-colors flex items-center gap-1 hover:opacity-80 ${
          isCompleted ? "line-through opacity-60" : ""
        }`}
        style={{ backgroundColor: `${eventColor}20`, color: eventColor }}
      >
        <Icon size={10} className="shrink-0" />
        <span className="truncate">{item.title}</span>
      </button>
    );
  }

  // Daily or Note
  const dotColor =
    item.type === "daily"
      ? CALENDAR_ITEM_COLORS.daily
      : CALENDAR_ITEM_COLORS.note;

  const Icon = item.type === "daily" ? BookOpen : StickyNote;

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-1.5 py-1 rounded text-xs truncate transition-colors flex items-center gap-1 hover:opacity-80"
      style={{ backgroundColor: `${dotColor}20`, color: dotColor }}
    >
      <Icon size={10} className="shrink-0" />
      <span className="truncate">{item.title}</span>
    </button>
  );
});
