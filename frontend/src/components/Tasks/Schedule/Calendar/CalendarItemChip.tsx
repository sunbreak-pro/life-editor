import {
  CheckSquare,
  BookOpen,
  StickyNote,
  CalendarClock,
  Repeat,
  Layers,
} from "lucide-react";
import type { CalendarItem } from "../../../../types/calendarItem";
import { CALENDAR_ITEM_COLORS } from "../../../../types/calendarItem";
import { getTextColorForBg } from "../../../../constants/folderColors";

interface CalendarItemChipProps {
  item: CalendarItem;
  onClick: (e: React.MouseEvent) => void;
  taskColor?: string;
}

export function CalendarItemChip({
  item,
  onClick,
  taskColor,
}: CalendarItemChipProps) {
  if (item.type === "task" && item.task) {
    const isDone = item.task.status === "DONE";
    const color = taskColor;
    const textColor = color ? getTextColorForBg(color) : undefined;

    return (
      <button
        onClick={onClick}
        className={`w-full text-left px-1.5 py-1 rounded text-xs truncate transition-colors flex items-center gap-1 ${
          isDone
            ? "text-notion-text-secondary line-through bg-notion-hover/50"
            : color
              ? "hover:opacity-80"
              : "text-notion-text bg-notion-accent/10 hover:bg-notion-accent/20"
        }`}
        style={
          !isDone && color
            ? { backgroundColor: color, color: textColor }
            : undefined
        }
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
}
