import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import type { TaskNode } from "../../../../types/taskTree";
import type { ScheduleItem } from "../../../../types/schedule";
import { TIME_GRID } from "../../../../constants/timeGrid";
import { TimeGridTaskBlock } from "../Calendar/TimeGridTaskBlock";
import { ScheduleItemBlock } from "./ScheduleItemBlock";
import { formatDateKey } from "../../../../utils/dateKey";
import { useTimeGridDrag } from "../../../../hooks/useTimeGridDrag";

const HOURS = Array.from(
  { length: TIME_GRID.END_HOUR - TIME_GRID.START_HOUR },
  (_, i) => i + TIME_GRID.START_HOUR,
);
const GUTTER_WIDTH = 52;

interface PositionedTask {
  task: TaskNode;
  top: number;
  height: number;
  column: number;
  totalColumns: number;
  overlapsRoutine: boolean;
}

interface PositionedScheduleItem {
  item: ScheduleItem;
  top: number;
  height: number;
  hasTaskOverlap: boolean;
}

function formatHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTimeString(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(totalMinutes, 24 * 60));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function topToMinutes(top: number): number {
  return (top / TIME_GRID.SLOT_HEIGHT) * 60 + TIME_GRID.START_HOUR * 60;
}

function rangesOverlap(
  aTop: number,
  aHeight: number,
  bTop: number,
  bHeight: number,
): boolean {
  return aTop < bTop + bHeight && aTop + aHeight > bTop;
}

function layoutTasksWithOverlap(
  tasks: TaskNode[],
  dayDate: Date,
  positionedItems: { top: number; height: number }[],
): PositionedTask[] {
  const positioned: PositionedTask[] = tasks.map((task) => {
    const dayStart = new Date(dayDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayDate);
    dayEnd.setHours(24, 0, 0, 0);

    const taskStart = task.scheduledAt ? new Date(task.scheduledAt) : dayStart;
    const taskEnd = task.scheduledEndAt
      ? new Date(task.scheduledEndAt)
      : new Date(
          taskStart.getTime() + (task.workDurationMinutes ?? 25) * 60000,
        );

    const clampedStart = taskStart < dayStart ? dayStart : taskStart;
    const clampedEnd = taskEnd > dayEnd ? dayEnd : taskEnd;

    const top =
      (clampedStart.getHours() - TIME_GRID.START_HOUR) * TIME_GRID.SLOT_HEIGHT +
      (clampedStart.getMinutes() / 60) * TIME_GRID.SLOT_HEIGHT;
    const durationMinutes = Math.max(
      (clampedEnd.getTime() - clampedStart.getTime()) / 60000,
      0,
    );
    const height = Math.max((durationMinutes / 60) * TIME_GRID.SLOT_HEIGHT, 20);
    return {
      task,
      top,
      height,
      column: 0,
      totalColumns: 1,
      overlapsRoutine: false,
    };
  });

  positioned.sort((a, b) => a.top - b.top);

  // Group overlapping tasks
  const groups: PositionedTask[][] = [];
  for (const item of positioned) {
    let placed = false;
    for (const group of groups) {
      const overlaps = group.some((g) =>
        rangesOverlap(item.top, item.height, g.top, g.height),
      );
      if (overlaps) {
        item.column = group.length;
        group.push(item);
        placed = true;
        break;
      }
    }
    if (!placed) {
      item.column = 0;
      groups.push([item]);
    }
  }

  for (const group of groups) {
    const total = Math.min(group.length, 5);
    for (const item of group) {
      item.totalColumns = total;
    }
  }

  // Check overlap with schedule items
  for (const pt of positioned) {
    pt.overlapsRoutine = positionedItems.some((pi) =>
      rangesOverlap(pt.top, pt.height, pi.top, pi.height),
    );
  }

  // Propagate within groups: if any task in group overlaps, whole group overlaps
  for (const group of groups) {
    if (group.some((t) => t.overlapsRoutine)) {
      for (const t of group) {
        t.overlapsRoutine = true;
      }
    }
  }

  return positioned;
}

function layoutScheduleItems(items: ScheduleItem[]): PositionedScheduleItem[] {
  return items.map((item) => {
    const startMin = timeToMinutes(item.startTime);
    const endMin = timeToMinutes(item.endTime);
    const top = (startMin / 60 - TIME_GRID.START_HOUR) * TIME_GRID.SLOT_HEIGHT;
    const height = Math.max(
      ((endMin - startMin) / 60) * TIME_GRID.SLOT_HEIGHT,
      20,
    );
    return { item, top, height, hasTaskOverlap: false };
  });
}

interface ScheduleTimeGridProps {
  date: Date;
  scheduleItems: ScheduleItem[];
  tasks: TaskNode[];
  onToggleComplete: (id: string) => void;
  onCreateItem: (
    startTime: string,
    endTime: string,
    e: React.MouseEvent,
  ) => void;
  getTaskColor?: (taskId: string) => string | undefined;
  getFolderTag?: (taskId: string) => string;
  onUpdateMemo?: (id: string, memo: string | null) => void;
  onUpdateScheduleItemTime?: (
    id: string,
    startTime: string,
    endTime: string,
  ) => void;
  onUpdateTaskTime?: (
    taskId: string,
    scheduledAt: string,
    scheduledEndAt: string,
  ) => void;
  externalScroll?: boolean;
  onToggleTaskStatus?: (taskId: string) => void;
  onDeleteScheduleItem?: (id: string) => void;
  onUnscheduleTask?: (taskId: string) => void;
  onNavigateTask?: (taskId: string, e: React.MouseEvent) => void;
  onUpdateTaskTimeMemo?: (taskId: string, memo: string | null) => void;
}

export function ScheduleTimeGrid({
  date,
  scheduleItems,
  tasks,
  onToggleComplete,
  onCreateItem,
  getTaskColor,
  getFolderTag,
  onUpdateMemo,
  onUpdateScheduleItemTime,
  onUpdateTaskTime,
  externalScroll,
  onToggleTaskStatus,
  onDeleteScheduleItem,
  onUnscheduleTask,
  onNavigateTask,
  onUpdateTaskTimeMemo,
}: ScheduleTimeGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const mainColumnRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const todayKey = formatDateKey(new Date());
  const dateKey = formatDateKey(date);
  const isToday = dateKey === todayKey;
  const totalHeight =
    (TIME_GRID.END_HOUR - TIME_GRID.START_HOUR) * TIME_GRID.SLOT_HEIGHT;

  const handleDragEnd = useCallback(
    (payload: {
      itemId: string;
      itemType: "schedule" | "task";
      newStartTime: string;
      newEndTime: string;
    }) => {
      if (payload.itemType === "schedule") {
        onUpdateScheduleItemTime?.(
          payload.itemId,
          payload.newStartTime,
          payload.newEndTime,
        );
      } else {
        onUpdateTaskTime?.(
          payload.itemId,
          payload.newStartTime,
          payload.newEndTime,
        );
      }
    },
    [onUpdateScheduleItemTime, onUpdateTaskTime],
  );

  const { dragState, getDragHandlers, hasMovedRef } = useTimeGridDrag({
    containerRef: mainColumnRef,
    onDragEnd: handleDragEnd,
  });

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Only scroll to current time when managing own scroll
  useEffect(() => {
    if (!externalScroll && scrollRef.current) {
      const now = new Date();
      const scrollTo = Math.max(
        0,
        (now.getHours() - 1) * TIME_GRID.SLOT_HEIGHT,
      );
      scrollRef.current.scrollTop = scrollTo;
    }
  }, [externalScroll]);

  // Layout schedule items first
  const positionedItems = useMemo(
    () => layoutScheduleItems(scheduleItems),
    [scheduleItems],
  );

  // Layout tasks with overlap detection against schedule items
  const positionedTasks = useMemo(() => {
    const timeTasks = tasks.filter((t) => t.scheduledAt && !t.isAllDay);
    return layoutTasksWithOverlap(timeTasks, date, positionedItems);
  }, [tasks, date, positionedItems]);

  // Mark schedule items that overlap with any task
  const enrichedItems = useMemo(() => {
    return positionedItems.map((pi) => ({
      ...pi,
      hasTaskOverlap: positionedTasks.some((pt) =>
        rangesOverlap(pt.top, pt.height, pi.top, pi.height),
      ),
    }));
  }, [positionedItems, positionedTasks]);

  const nextItemId = useMemo(() => {
    const sorted = [...scheduleItems].sort((a, b) =>
      a.startTime.localeCompare(b.startTime),
    );
    return sorted.find((i) => !i.completed)?.id ?? null;
  }, [scheduleItems]);

  const currentTimeTop =
    (currentTime.getHours() - TIME_GRID.START_HOUR) * TIME_GRID.SLOT_HEIGHT +
    (currentTime.getMinutes() / 60) * TIME_GRID.SLOT_HEIGHT;

  const handleColumnClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragState.isDragging) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const rawHour = y / TIME_GRID.SLOT_HEIGHT + TIME_GRID.START_HOUR;
    const hour = Math.floor(rawHour);
    const snappedMinute = Math.round(((rawHour % 1) * 60) / 15) * 15;
    const finalMinute = snappedMinute >= 60 ? 0 : snappedMinute;
    const finalHour = snappedMinute >= 60 ? hour + 1 : hour;

    const startTime = `${String(finalHour).padStart(2, "0")}:${String(finalMinute).padStart(2, "0")}`;
    const endHour = finalHour + 1;
    const endTime = `${String(Math.min(endHour, 23)).padStart(2, "0")}:${String(finalMinute).padStart(2, "0")}`;

    onCreateItem(startTime, endTime, e);
  };

  // Preview time labels
  const previewStartTime = dragState.isDragging
    ? minutesToTimeString(topToMinutes(dragState.previewTop))
    : "";
  const previewEndTime = dragState.isDragging
    ? minutesToTimeString(
        topToMinutes(dragState.previewTop + dragState.previewHeight),
      )
    : "";

  const gridContent = (
    <div className="flex relative" style={{ height: totalHeight }}>
      {/* Time gutter */}
      <div style={{ width: GUTTER_WIDTH }} className="shrink-0 relative">
        {HOURS.map((hour) => (
          <div
            key={hour}
            className="absolute right-2 text-[10px] text-notion-text-secondary -translate-y-1/2"
            style={{
              top: (hour - TIME_GRID.START_HOUR) * TIME_GRID.SLOT_HEIGHT,
            }}
          >
            {hour > 0 && formatHour(hour)}
          </div>
        ))}
      </div>

      {/* Main column */}
      <div
        ref={mainColumnRef}
        className="flex-1 relative border-l border-notion-border cursor-pointer"
        onClick={handleColumnClick}
      >
        {/* Hour grid lines */}
        {HOURS.map((hour) => (
          <div
            key={hour}
            className="absolute w-full border-t border-notion-border/50"
            style={{
              top: (hour - TIME_GRID.START_HOUR) * TIME_GRID.SLOT_HEIGHT,
            }}
          />
        ))}

        {/* Current time indicator */}
        {isToday && (
          <div
            className="absolute w-full z-30 pointer-events-none"
            style={{ top: currentTimeTop }}
          >
            <div className="flex items-center">
              <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
              <div className="flex-1 h-0.5 bg-red-500" />
            </div>
          </div>
        )}

        {/* Task blocks */}
        <div className="opacity-70">
          {positionedTasks.map((p) => (
            <TimeGridTaskBlock
              key={p.task.id}
              task={p.task}
              top={p.top}
              height={p.height}
              left={
                p.overlapsRoutine
                  ? `${60 + (p.column / p.totalColumns) * 40}%`
                  : `${(p.column / p.totalColumns) * 100}%`
              }
              width={
                p.overlapsRoutine
                  ? `${(1 / p.totalColumns) * 40}%`
                  : `${(1 / p.totalColumns) * 100}%`
              }
              color={getTaskColor?.(p.task.id)}
              tag={getFolderTag?.(p.task.id)}
              dragHandlers={getDragHandlers(
                p.task.id,
                "task",
                p.top,
                p.height,
                "move",
              )}
              resizeTopHandlers={getDragHandlers(
                p.task.id,
                "task",
                p.top,
                p.height,
                "resize-top",
              )}
              resizeBottomHandlers={getDragHandlers(
                p.task.id,
                "task",
                p.top,
                p.height,
                "resize-bottom",
              )}
              isDragging={
                dragState.isDragging && dragState.itemId === p.task.id
              }
              onToggleTaskStatus={onToggleTaskStatus}
              onUnschedule={onUnscheduleTask}
              onNavigate={onNavigateTask}
              hasMovedRef={hasMovedRef}
              onUpdateTimeMemo={onUpdateTaskTimeMemo}
            />
          ))}
        </div>

        {/* Schedule item blocks */}
        {enrichedItems.map((p) => (
          <ScheduleItemBlock
            key={p.item.id}
            item={p.item}
            top={p.top}
            height={p.height}
            isNext={p.item.id === nextItemId}
            onToggleComplete={onToggleComplete}
            onUpdateMemo={onUpdateMemo}
            onDelete={onDeleteScheduleItem}
            dragHandlers={getDragHandlers(
              p.item.id,
              "schedule",
              p.top,
              p.height,
              "move",
            )}
            resizeTopHandlers={getDragHandlers(
              p.item.id,
              "schedule",
              p.top,
              p.height,
              "resize-top",
            )}
            resizeBottomHandlers={getDragHandlers(
              p.item.id,
              "schedule",
              p.top,
              p.height,
              "resize-bottom",
            )}
            isDragging={dragState.isDragging && dragState.itemId === p.item.id}
            hasTaskOverlap={p.hasTaskOverlap}
            hasMovedRef={hasMovedRef}
          />
        ))}

        {/* Drag ghost preview */}
        {dragState.isDragging && (
          <div
            className="absolute left-1 right-1 rounded-md border-2 border-dashed border-notion-accent/50 bg-notion-accent/10 z-50 pointer-events-none"
            style={{
              top: dragState.previewTop,
              height: dragState.previewHeight,
            }}
          >
            <span className="text-[10px] text-notion-accent px-1">
              {previewStartTime} - {previewEndTime}
            </span>
          </div>
        )}
      </div>
    </div>
  );

  if (externalScroll) {
    return gridContent;
  }

  return (
    <div className="border h-full border-notion-border rounded-lg overflow-hidden bg-notion-bg flex-1">
      <div ref={scrollRef} className="overflow-y-auto h-full relative">
        {gridContent}
      </div>
    </div>
  );
}
