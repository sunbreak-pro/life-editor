import { useState, useRef } from "react";
import { Check, StickyNote, X } from "lucide-react";
import type { ScheduleItem } from "../../../../types/schedule";
import { ScheduleItemMemoPopover } from "./ScheduleItemMemoPopover";

interface ScheduleItemBlockProps {
  item: ScheduleItem;
  top: number;
  height: number;
  isNext: boolean;
  onToggleComplete: (id: string) => void;
  onClick: (id: string) => void;
  onUpdateMemo?: (id: string, memo: string | null) => void;
  dragHandlers?: {
    onMouseDown: (e: React.MouseEvent) => void;
    onTouchStart: (e: React.TouchEvent) => void;
  };
  isDragging?: boolean;
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
  onUpdateMemo,
  dragHandlers,
  isDragging,
}: ScheduleItemBlockProps) {
  const isCompact = height < 36;
  const [showMemoPopover, setShowMemoPopover] = useState(false);
  const memoIconRef = useRef<HTMLButtonElement>(null);
  const hasMemo = !!item.memo;

  return (
    <>
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
            ? "rgba(34, 197, 94, 0.08)"
            : item.routineId
              ? "var(--color-notion-accent-muted, rgba(37, 99, 235, 0.08))"
              : "rgba(156, 163, 175, 0.08)",
          borderLeft: `3px solid ${
            item.completed
              ? "#22c55e"
              : item.routineId
                ? "var(--color-notion-accent)"
                : "var(--color-notion-text-secondary)"
          }`,
          zIndex: isNext ? 15 : 10,
          opacity: isDragging ? 0.4 : undefined,
        }}
        onClick={(e) => {
          if (isDragging) return;
          e.stopPropagation();
          onClick(item.id);
        }}
        onMouseDown={dragHandlers?.onMouseDown}
        onTouchStart={dragHandlers?.onTouchStart}
      >
        <div className="flex items-start gap-1.5 px-1.5 py-0.5 h-full">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleComplete(item.id);
            }}
            className={`shrink-0 mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
              item.completed
                ? "bg-green-500 border-green-500"
                : "border-notion-accent hover:bg-notion-accent/10"
            }`}
          >
            {item.completed && <Check size={10} className="text-white" />}
          </button>
          <div className="flex-1 min-w-0 flex items-start gap-0.5">
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
            {onUpdateMemo && (
              <div className="flex items-center shrink-0 mt-0.5">
                <button
                  ref={memoIconRef}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMemoPopover(true);
                  }}
                  className={`p-0.5 rounded transition-colors ${
                    hasMemo
                      ? "text-notion-accent"
                      : "text-notion-text-secondary/40 opacity-0 group-hover:opacity-100"
                  }`}
                >
                  <StickyNote size={12} />
                </button>
                {hasMemo && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateMemo(item.id, null);
                    }}
                    className="p-0.5 text-notion-text-secondary/60 hover:text-notion-text rounded transition-colors"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {showMemoPopover && memoIconRef.current && (
        <ScheduleItemMemoPopover
          anchorRect={memoIconRef.current.getBoundingClientRect()}
          initialValue={item.memo ?? ""}
          onSave={(value) => onUpdateMemo?.(item.id, value || null)}
          onClose={() => setShowMemoPopover(false)}
        />
      )}
    </>
  );
}
