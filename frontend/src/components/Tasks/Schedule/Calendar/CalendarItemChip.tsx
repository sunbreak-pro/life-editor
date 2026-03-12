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
        {color && !isDone && (
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: textColor }}
          />
        )}
        <span className="truncate">{item.title}</span>
      </button>
    );
  }

  // Daily or Note
  const dotColor =
    item.type === "daily"
      ? CALENDAR_ITEM_COLORS.daily
      : CALENDAR_ITEM_COLORS.note;

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-1.5 py-1 rounded text-xs truncate transition-colors flex items-center gap-1 hover:opacity-80"
      style={{ backgroundColor: `${dotColor}20`, color: dotColor }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: dotColor }}
      />
      <span className="truncate">{item.title}</span>
    </button>
  );
}
