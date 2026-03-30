import { useState } from "react";
import { Check, StickyNote, Trash2 } from "lucide-react";
import type { ScheduleItem } from "../../../../types/schedule";
import { InlineMemoInput } from "./InlineMemoInput";
import { useSwipeAction } from "../../../../hooks/useSwipeAction";

interface DragHandlers {
  onMouseDown: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
}

interface ScheduleItemBlockProps {
  item: ScheduleItem;
  top: number;
  height: number;
  left?: string;
  width?: string;
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
  onShowPreview?: (
    item: ScheduleItem,
    position: { x: number; y: number },
  ) => void;
  onContextMenu?: (
    item: ScheduleItem,
    position: { x: number; y: number },
  ) => void;
}

function formatTimeRange(start: string, end: string): string {
  return `${start} - ${end}`;
}

const ACTION_WIDTH = 88;

export function ScheduleItemBlock({
  item,
  top,
  height,
  left,
  width,
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
  onShowPreview,
  onContextMenu,
}: ScheduleItemBlockProps) {
  const isCompact = height < 36;
  const isTiny = height < 28;
  const [showInlineMemo, setShowInlineMemo] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const { isOpen, translateX, isScrolling, close, containerRef } =
    useSwipeAction({ actionWidth: ACTION_WIDTH });

  const hoveredHeight = isTiny && isHovered ? 40 : Math.max(height, 28);

  return (
    <div
      ref={containerRef}
      className="absolute overflow-hidden"
      style={{
        top,
        left: left ?? 4,
        right: hasTaskOverlap && !left ? "40%" : !left ? 4 : undefined,
        width: width ?? undefined,
        height: hoveredHeight,
        zIndex: isHovered ? 40 : isNext ? 15 : 10,
      }}
    >
      {/* Action panel behind */}
      {(isOpen || translateX < 0) && (
        <div
          className="absolute top-0 right-0 h-full flex items-center gap-1 px-1"
          style={{ width: ACTION_WIDTH }}
        >
          {onUpdateMemo && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                close();
                setShowInlineMemo(true);
              }}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 h-[calc(100%-4px)] rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
            >
              <StickyNote size={14} />
              <span className="text-[8px] leading-none">Memo</span>
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                close();
                if (item.routineId && onRequestRoutineDelete) {
                  onRequestRoutineDelete(item, e);
                } else {
                  onDelete(item.id);
                }
              }}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 h-[calc(100%-4px)] rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              <Trash2 size={14} />
              <span className="text-[8px] leading-none">Del</span>
            </button>
          )}
        </div>
      )}

      {/* Main content (slides) */}
      <div
        className={`h-full rounded-md overflow-hidden cursor-pointer group ${
          item.completed
            ? "opacity-40"
            : isNext
              ? "ring-2 ring-notion-accent ring-offset-1 ring-offset-notion-bg"
              : ""
        }`}
        style={{
          transform: `translateX(${translateX}px)`,
          transition:
            translateX === 0 || translateX === -ACTION_WIDTH
              ? "transform 0.2s ease-out"
              : undefined,
          backgroundColor: item.completed
            ? "rgba(34, 197, 94, 0.08)"
            : item.routineId
              ? "var(--color-schedule-routine-bg, #EBF0FE)"
              : "var(--color-schedule-other-bg, #F1F2F4)",
          borderLeft: `3px solid ${
            item.completed
              ? "#22c55e"
              : item.routineId
                ? "var(--color-notion-accent)"
                : "var(--color-notion-text-secondary)"
          }`,
          opacity: isDragging ? 0.4 : undefined,
          boxShadow: isHovered
            ? "0 4px 12px rgba(0,0,0,0.15)"
            : translateX < 0
              ? "4px 0 8px rgba(0,0,0,0.1)"
              : undefined,
        }}
        onClick={(e) => {
          if (isDragging) return;
          if (hasMovedRef?.current) return;
          if (isScrolling) return;
          if (isOpen) {
            close();
            return;
          }
          e.stopPropagation();
          if (onShowPreview) {
            onShowPreview(item, { x: e.clientX, y: e.clientY });
          } else {
            onToggleComplete(item.id);
          }
        }}
        onMouseDown={(e) => {
          if (!isOpen) dragHandlers?.onMouseDown(e);
        }}
        onTouchStart={(e) => {
          if (!isOpen) dragHandlers?.onTouchStart(e);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu?.(item, { x: e.clientX, y: e.clientY });
        }}
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
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-0.5">
              <span
                className={`font-medium truncate relative ${isCompact ? "text-[10px]" : "text-xs"} ${
                  item.completed
                    ? "text-notion-text-secondary"
                    : "text-notion-text"
                }`}
              >
                {item.title}
                {item.completed && (
                  <span className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-notion-text-secondary pointer-events-none" />
                )}
              </span>
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
    </div>
  );
}
