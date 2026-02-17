import { Check } from "lucide-react";
import type { ScheduleItem } from "../../../../types/schedule";

interface ScheduleItemBlockProps {
  item: ScheduleItem;
  top: number;
  height: number;
  isNext: boolean;
  onToggleComplete: (id: string) => void;
  onClick: (id: string) => void;
}

function formatTimeRange(start: string, end: string): string {
  return `${start} - ${end}`;
}

export function ScheduleItemBlock({
  item,
  top,
  height,
  isNext,
  onToggleComplete,
  onClick,
}: ScheduleItemBlockProps) {
  const isCompact = height < 36;

  return (
    <div
      className={`absolute left-1 right-1 rounded-md overflow-hidden transition-all cursor-pointer group ${
        item.completed
          ? "opacity-40"
          : isNext
            ? "ring-2 ring-notion-accent ring-offset-1 ring-offset-notion-bg"
            : ""
      }`}
      style={{
        top,
        height: Math.max(height, 20),
        backgroundColor: item.completed
          ? "var(--color-notion-hover)"
          : item.routineId
            ? "var(--color-notion-accent-muted, rgba(37, 99, 235, 0.08))"
            : "rgba(156, 163, 175, 0.08)",
        borderLeft: `3px solid ${
          item.completed
            ? "var(--color-notion-text-secondary)"
            : item.routineId
              ? "var(--color-notion-accent)"
              : "var(--color-notion-text-secondary)"
        }`,
        zIndex: isNext ? 15 : 10,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick(item.id);
      }}
    >
      <div className="flex items-start gap-1.5 px-1.5 py-0.5 h-full">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleComplete(item.id);
          }}
          className={`shrink-0 mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
            item.completed
              ? "bg-notion-text-secondary border-notion-text-secondary"
              : "border-notion-accent hover:bg-notion-accent/10"
          }`}
        >
          {item.completed && <Check size={10} className="text-white" />}
        </button>
        <div className="flex-1 min-w-0">
          <div
            className={`font-medium truncate ${isCompact ? "text-[10px]" : "text-xs"} ${
              item.completed
                ? "line-through text-notion-text-secondary"
                : "text-notion-text"
            }`}
          >
            {item.title}
          </div>
          {!isCompact && (
            <div className="text-[10px] text-notion-text-secondary truncate">
              {formatTimeRange(item.startTime, item.endTime)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
