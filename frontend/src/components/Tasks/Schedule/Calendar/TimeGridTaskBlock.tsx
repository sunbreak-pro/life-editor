import { useState } from "react";
import { ArrowUpRight, Check, StickyNote, X } from "lucide-react";
import type { TaskNode } from "../../../../types/taskTree";
import { getTextColorForBg } from "../../../../constants/folderColors";
import { formatTimeRangeCompact } from "../../../../utils/formatSchedule";
import { InlineMemoInput } from "../DayFlow/InlineMemoInput";
import { useSwipeAction } from "../../../../hooks/useSwipeAction";

interface DragHandlers {
  onMouseDown: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
}

interface TimeGridTaskBlockProps {
  task: TaskNode;
  top: number;
  height: number;
  left: string;
  width: string;
  color?: string;
  tag?: string;
  dragHandlers?: DragHandlers;
  resizeTopHandlers?: DragHandlers;
  resizeBottomHandlers?: DragHandlers;
  isDragging?: boolean;
  onToggleTaskStatus?: (taskId: string) => void;
  onUnschedule?: (taskId: string) => void;
  onNavigate?: (taskId: string, e: React.MouseEvent) => void;
  hasMovedRef?: React.RefObject<boolean>;
  onUpdateTimeMemo?: (taskId: string, memo: string | null) => void;
  onShowPreview?: (task: TaskNode, position: { x: number; y: number }) => void;
}

const ACTION_WIDTH = 108;

export function TimeGridTaskBlock({
  task,
  top,
  height,
  left,
  width,
  color,
  dragHandlers,
  resizeTopHandlers,
  resizeBottomHandlers,
  isDragging,
  onToggleTaskStatus,
  onUnschedule,
  onNavigate,
  hasMovedRef,
  onUpdateTimeMemo,
  onShowPreview,
}: TimeGridTaskBlockProps) {
  const isCompleted = task.status === "DONE";
  const bgColor = isCompleted ? "rgba(156,163,175,0.15)" : (color ?? "#E0E7FF");
  const textColor = isCompleted
    ? "#9CA3AF"
    : color
      ? getTextColorForBg(color)
      : "#4338CA";
  const borderColor = isCompleted ? "#9CA3AF" : textColor;
  const isCompact = height < 40;
  const isTiny = height < 24;
  const hasTimeMemo = !!task.timeMemo;
  const [showInlineMemo, setShowInlineMemo] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const { isOpen, translateX, isScrolling, close, containerRef } =
    useSwipeAction({ actionWidth: ACTION_WIDTH });

  const hoveredHeight = isTiny && isHovered ? 40 : Math.max(height, 20);

  return (
    <div
      ref={containerRef}
      className="absolute overflow-hidden"
      style={{
        top,
        left,
        width,
        height: hoveredHeight,
        zIndex: isHovered ? 40 : 10,
      }}
    >
      {/* Action panel behind */}
      {(isOpen || translateX < 0) && (
        <div
          className="absolute top-0 right-0 h-full flex items-stretch"
          style={{ width: ACTION_WIDTH }}
        >
          {onUpdateTimeMemo && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                close();
                setShowInlineMemo(true);
              }}
              className="flex-1 flex items-center justify-center bg-blue-500 text-white hover:bg-blue-600 transition-colors"
            >
              <StickyNote size={16} />
            </button>
          )}
          {onNavigate && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                close();
                onNavigate(task.id, e);
              }}
              className="flex-1 flex items-center justify-center bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
            >
              <ArrowUpRight size={16} />
            </button>
          )}
          {onUnschedule && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                close();
                onUnschedule(task.id);
              }}
              className="flex-1 flex items-center justify-center bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}

      {/* Main content (slides) */}
      <div
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
            onShowPreview(task, { x: e.clientX, y: e.clientY });
          } else {
            onToggleTaskStatus?.(task.id);
          }
        }}
        onMouseDown={(e) => {
          if (!isOpen) dragHandlers?.onMouseDown(e);
        }}
        onTouchStart={(e) => {
          if (!isOpen) dragHandlers?.onTouchStart(e);
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`h-full rounded-md overflow-hidden cursor-pointer text-left group ${
          isCompleted ? "opacity-50" : "opacity-70"
        }`}
        style={{
          transform: `translateX(${translateX}px)`,
          transition:
            translateX === 0 || translateX === -ACTION_WIDTH
              ? "transform 0.2s ease-out"
              : undefined,
          backgroundColor: bgColor,
          borderLeft: `3px solid ${borderColor}`,
          opacity: isDragging ? 0.4 : undefined,
          boxShadow: isHovered ? "0 4px 12px rgba(0,0,0,0.15)" : undefined,
        }}
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

        <div
          className="px-1.5 py-0.5 h-full flex items-start gap-0.5"
          style={{ color: textColor }}
        >
          {/* Checkbox */}
          {onToggleTaskStatus && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleTaskStatus(task.id);
              }}
              className={`shrink-0 mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                isCompleted
                  ? "bg-gray-400 border-gray-400"
                  : "border-current hover:bg-current/10"
              }`}
            >
              {isCompleted && <Check size={10} className="text-white" />}
            </button>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-0.5">
              <span
                className={`font-medium truncate ${isCompact ? "text-[10px]" : "text-xs"} ${
                  isCompleted ? "line-through text-gray-400" : ""
                }`}
              >
                {task.title}
              </span>
            </div>
            {showInlineMemo && onUpdateTimeMemo && (
              <InlineMemoInput
                value={task.timeMemo ?? ""}
                onSave={(val) => onUpdateTimeMemo(task.id, val)}
                onClose={() => setShowInlineMemo(false)}
              />
            )}
            {!showInlineMemo && !isCompact && task.scheduledAt && (
              <div className="text-[10px] truncate opacity-70">
                {formatTimeRangeCompact(task.scheduledAt, task.scheduledEndAt)}
              </div>
            )}
            {!showInlineMemo && isCompact && task.scheduledAt && (
              <span className="text-[9px] truncate opacity-60 ml-1">
                {formatTimeRangeCompact(task.scheduledAt, task.scheduledEndAt)}
              </span>
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
