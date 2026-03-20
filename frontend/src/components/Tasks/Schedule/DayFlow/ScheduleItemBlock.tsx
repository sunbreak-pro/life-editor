import { useState } from "react";
import { Check, StickyNote, X } from "lucide-react";
import type { ScheduleItem } from "../../../../types/schedule";
import { InlineMemoInput } from "./InlineMemoInput";

interface DragHandlers {
  onMouseDown: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
}

interface ScheduleItemBlockProps {
  item: ScheduleItem;
  top: number;
  height: number;
  isNext: boolean;
  onToggleComplete: (id: string) => void;
  onUpdateMemo?: (id: string, memo: string | null) => void;
  onDelete?: (id: string) => void;
  onRequestRoutineDelete?: (item: ScheduleItem, e: React.MouseEvent) => void;
  dragHandlers?: DragHandlers;
  resizeTopHandlers?: DragHandlers;
  resizeBottomHandlers?: DragHandlers;
  isDragging?: boolean;
  hasTaskOverlap?: boolean;
  hasMovedRef?: React.RefObject<boolean>;
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
  onUpdateMemo,
  onDelete,
  onRequestRoutineDelete,
  dragHandlers,
  resizeTopHandlers,
  resizeBottomHandlers,
  isDragging,
  hasTaskOverlap,
  hasMovedRef,
}: ScheduleItemBlockProps) {
  const isCompact = height < 36;
  const isTiny = height < 24;
  const [showInlineMemo, setShowInlineMemo] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const hasMemo = !!item.memo;

  const hoveredHeight = isTiny && isHovered ? 40 : Math.max(height, 20);

  return (
    <div
      className={`absolute rounded-md overflow-hidden cursor-pointer group ${
        item.completed
          ? "opacity-40"
          : isNext
            ? "ring-2 ring-notion-accent ring-offset-1 ring-offset-notion-bg"
            : ""
      }`}
      style={{
        top,
        left: 4,
        right: hasTaskOverlap ? "40%" : 4,
        height: hoveredHeight,
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
        zIndex: isHovered ? 40 : isNext ? 15 : 10,
        opacity: isDragging ? 0.4 : undefined,
        boxShadow: isHovered ? "0 4px 12px rgba(0,0,0,0.15)" : undefined,
        transform: isHovered ? "scale(1.02)" : undefined,
        transformOrigin: "left top",
        transition: "box-shadow 0.15s, transform 0.15s, height 0.15s",
      }}
      onClick={(e) => {
        if (isDragging) return;
        if (hasMovedRef?.current) return;
        e.stopPropagation();
        onToggleComplete(item.id);
      }}
      onMouseDown={dragHandlers?.onMouseDown}
      onTouchStart={dragHandlers?.onTouchStart}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Resize handle - top */}
      <div
        className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 z-10"
        onMouseDown={(e) => {
          e.stopPropagation();
          resizeTopHandlers?.onMouseDown(e);
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          resizeTopHandlers?.onTouchStart(e);
        }}
      />

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
            <div className="flex items-center gap-0.5">
              <span
                className={`font-medium truncate ${isCompact ? "text-[10px]" : "text-xs"} ${
                  item.completed
                    ? "line-through text-notion-text-secondary"
                    : "text-notion-text"
                }`}
              >
                {item.title}
              </span>
              {onUpdateMemo && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowInlineMemo(true);
                  }}
                  className={`shrink-0 p-0.5 rounded transition-colors ${
                    hasMemo
                      ? "text-notion-accent"
                      : "text-notion-text-secondary/40"
                  }`}
                >
                  <StickyNote size={15} />
                </button>
              )}
            </div>
            {showInlineMemo && onUpdateMemo && (
              <InlineMemoInput
                value={item.memo ?? ""}
                onSave={(val) => onUpdateMemo(item.id, val)}
                onClose={() => setShowInlineMemo(false)}
              />
            )}
            {!showInlineMemo && !isCompact && (
              <div className="text-[10px] text-notion-text-secondary truncate">
                {formatTimeRange(item.startTime, item.endTime)}
              </div>
            )}
          </div>
          {/* Memo clear + Delete buttons */}
          <div className="flex items-center shrink-0 mt-0.5 gap-0.5">
            {onUpdateMemo && hasMemo && (
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
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (item.routineId && onRequestRoutineDelete) {
                    onRequestRoutineDelete(item, e);
                  } else {
                    onDelete(item.id);
                  }
                }}
                className="p-0.5 rounded text-notion-text-secondary/60 hover:text-red-500 transition-all"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Resize handle - bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 z-10"
        onMouseDown={(e) => {
          e.stopPropagation();
          resizeBottomHandlers?.onMouseDown(e);
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          resizeBottomHandlers?.onTouchStart(e);
        }}
      />
    </div>
  );
}
