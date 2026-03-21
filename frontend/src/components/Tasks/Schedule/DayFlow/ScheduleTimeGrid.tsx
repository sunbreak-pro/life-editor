import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import type { TaskNode } from "../../../../types/taskTree";
import type { ScheduleItem } from "../../../../types/schedule";
import type { RoutineGroup } from "../../../../types/routineGroup";
import { TIME_GRID } from "../../../../constants/timeGrid";
import { TimeGridTaskBlock } from "../Calendar/TimeGridTaskBlock";
import { TaskPreviewPopup } from "../Calendar/TaskPreviewPopup";
import { ScheduleItemBlock } from "./ScheduleItemBlock";
import { ScheduleItemPreviewPopup } from "./ScheduleItemPreviewPopup";
import { GroupFrame } from "./GroupFrame";
import { formatDateKey } from "../../../../utils/dateKey";
import { useTimeGridDrag } from "../../../../hooks/useTimeGridDrag";
import {
  minutesToTimeString,
  topToMinutes,
  timeToMinutes,
} from "../../../../utils/timeGridUtils";

const HOURS = Array.from(
  { length: TIME_GRID.END_HOUR - TIME_GRID.START_HOUR },
  (_, i) => i + TIME_GRID.START_HOUR,
);
const GUTTER_WIDTH = 52;

type UnifiedItemKind = "schedule" | "task";

interface UnifiedItem {
  id: string;
  kind: UnifiedItemKind;
  top: number;
  height: number;
  column: number;
  totalColumns: number;
  scheduleItem?: ScheduleItem;
  task?: TaskNode;
}

function formatHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}

interface ComputedGroupFrame {
  groupId: string;
  groupName: string;
  groupColor: string;
  top: number;
  height: number;
}

function rangesOverlap(
  aTop: number,
  aHeight: number,
  bTop: number,
  bHeight: number,
): boolean {
  return aTop < bTop + bHeight && aTop + aHeight > bTop;
}

function layoutAllItems(
  scheduleItems: ScheduleItem[],
  tasks: TaskNode[],
  dayDate: Date,
): UnifiedItem[] {
  const items: UnifiedItem[] = [];

  // Convert schedule items
  for (const si of scheduleItems) {
    const startMin = timeToMinutes(si.startTime);
    const endMin = timeToMinutes(si.endTime);
    const top = (startMin / 60 - TIME_GRID.START_HOUR) * TIME_GRID.SLOT_HEIGHT;
    const height = Math.max(
      ((endMin - startMin) / 60) * TIME_GRID.SLOT_HEIGHT,
      20,
    );
    items.push({
      id: si.id,
      kind: "schedule",
      top,
      height,
      column: 0,
      totalColumns: 1,
      scheduleItem: si,
    });
  }

  // Convert tasks
  const dayStart = new Date(dayDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayDate);
  dayEnd.setHours(24, 0, 0, 0);

  for (const task of tasks.filter((t) => t.scheduledAt && !t.isAllDay)) {
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
    items.push({
      id: task.id,
      kind: "task",
      top,
      height,
      column: 0,
      totalColumns: 1,
      task,
    });
  }

  // Sort by top (start time), then by height descending (earlier end = shorter = left)
  items.sort((a, b) => a.top - b.top || a.height - b.height);

  // Greedy column assignment + overlap group detection in single pass
  const columnEnds: number[] = [];
  // Track which group each item belongs to
  const groupIndex: number[] = new Array(items.length);
  const groups: number[][] = []; // arrays of item indices

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const itemEnd = item.top + item.height;

    // Assign column
    let placed = false;
    for (let col = 0; col < columnEnds.length; col++) {
      if (item.top >= columnEnds[col]) {
        item.column = col;
        columnEnds[col] = itemEnd;
        placed = true;
        break;
      }
    }
    if (!placed) {
      item.column = columnEnds.length;
      columnEnds.push(itemEnd);
    }

    // Find overlapping group by checking previous items
    let foundGroup = -1;
    for (let j = i - 1; j >= 0; j--) {
      const prev = items[j];
      if (prev.top + prev.height <= item.top) continue;
      // Overlaps with prev
      foundGroup = groupIndex[j];
      break;
    }

    if (foundGroup >= 0) {
      groups[foundGroup].push(i);
      groupIndex[i] = foundGroup;
    } else {
      groupIndex[i] = groups.length;
      groups.push([i]);
    }
  }

  // Set totalColumns per group
  for (const group of groups) {
    let maxCol = 0;
    for (const idx of group) {
      if (items[idx].column > maxCol) maxCol = items[idx].column;
    }
    const totalColumns = maxCol + 1;
    for (const idx of group) {
      items[idx].totalColumns = totalColumns;
    }
  }

  return items;
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
  onRequestRoutineDelete?: (item: ScheduleItem, e: React.MouseEvent) => void;
  onUnscheduleTask?: (taskId: string) => void;
  onNavigateTask?: (taskId: string, e: React.MouseEvent) => void;
  onUpdateTaskTimeMemo?: (taskId: string, memo: string | null) => void;
  onDeleteTask?: (taskId: string) => void;
  onUpdateTaskTitle?: (taskId: string, title: string) => void;
  onStartTimer?: (task: TaskNode) => void;
  enablePreview?: boolean;
  // Group visualization
  routineGroups?: RoutineGroup[];
  groupForRoutine?: Map<string, RoutineGroup>;
  onGroupDragEnd?: (groupId: string, offsetMinutes: number) => void;
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
  onRequestRoutineDelete,
  onUnscheduleTask,
  onNavigateTask,
  onUpdateTaskTimeMemo,
  onDeleteTask,
  onUpdateTaskTitle,
  onStartTimer,
  enablePreview,
  routineGroups,
  groupForRoutine,
  onGroupDragEnd,
}: ScheduleTimeGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const mainColumnRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Preview popup state
  const [taskPreview, setTaskPreview] = useState<{
    task: TaskNode;
    position: { x: number; y: number };
  } | null>(null);
  const [schedulePreview, setSchedulePreview] = useState<{
    item: ScheduleItem;
    position: { x: number; y: number };
  } | null>(null);

  const handleShowTaskPreview = useCallback(
    (task: TaskNode, position: { x: number; y: number }) => {
      setSchedulePreview(null);
      setTaskPreview({ task, position });
    },
    [],
  );

  const handleShowSchedulePreview = useCallback(
    (item: ScheduleItem, position: { x: number; y: number }) => {
      setTaskPreview(null);
      setSchedulePreview({ item, position });
    },
    [],
  );
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

  // Unified layout for all items (schedule + tasks)
  const unifiedItems = useMemo(
    () => layoutAllItems(scheduleItems, tasks, date),
    [scheduleItems, tasks, date],
  );

  // Compute group frames from unified items
  const groupFrames = useMemo<ComputedGroupFrame[]>(() => {
    if (!routineGroups?.length || !groupForRoutine) return [];
    const frames = new Map<
      string,
      { group: RoutineGroup; minTop: number; maxBottom: number }
    >();
    for (const item of unifiedItems) {
      if (item.kind !== "schedule" || !item.scheduleItem?.routineId) continue;
      const group = groupForRoutine.get(item.scheduleItem.routineId);
      if (!group) continue;
      const bottom = item.top + item.height;
      const existing = frames.get(group.id);
      if (existing) {
        existing.minTop = Math.min(existing.minTop, item.top);
        existing.maxBottom = Math.max(existing.maxBottom, bottom);
      } else {
        frames.set(group.id, { group, minTop: item.top, maxBottom: bottom });
      }
    }
    return Array.from(frames.values()).map(({ group, minTop, maxBottom }) => ({
      groupId: group.id,
      groupName: group.name,
      groupColor: group.color,
      top: minTop,
      height: maxBottom - minTop,
    }));
  }, [unifiedItems, routineGroups, groupForRoutine]);

  // Check if tasks overlap with any group frame
  const hasRoutineTaskSplit = useMemo(() => {
    if (groupFrames.length === 0) return false;
    return unifiedItems.some((item) => {
      if (item.kind !== "task") return false;
      return groupFrames.some((gf) =>
        rangesOverlap(item.top, item.height, gf.top, gf.height),
      );
    });
  }, [unifiedItems, groupFrames]);

  const routineColumnRatio = hasRoutineTaskSplit ? 0.6 : 1.0;

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
    if (hasMovedRef.current) return;

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
        className="flex-1 relative border-l border-notion-border cursor-default"
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

        {/* Group frames (behind items) */}
        {groupFrames.map((gf) => (
          <GroupFrame
            key={gf.groupId}
            groupName={gf.groupName}
            groupColor={gf.groupColor}
            top={gf.top}
            height={gf.height}
            left={hasRoutineTaskSplit ? "2px" : undefined}
            width={
              hasRoutineTaskSplit
                ? `calc(${routineColumnRatio * 100}% - 4px)`
                : undefined
            }
            onMouseDown={
              onGroupDragEnd
                ? (e) => {
                    e.stopPropagation();
                    // Group drag is handled by parent via callback
                  }
                : undefined
            }
          />
        ))}

        {/* Unified item blocks */}
        {unifiedItems.map((item) => {
          // Column separation: routine items in left column, tasks in right column
          let colLeft: string;
          let colWidth: string;

          if (
            hasRoutineTaskSplit &&
            item.kind === "schedule" &&
            item.scheduleItem?.routineId &&
            groupForRoutine?.has(item.scheduleItem.routineId)
          ) {
            // Routine in group → left column
            const baseWidth = routineColumnRatio;
            colLeft =
              item.totalColumns === 1
                ? "4px"
                : `calc(${(item.column / item.totalColumns) * baseWidth * 100}% + 2px)`;
            colWidth =
              item.totalColumns === 1
                ? `calc(${baseWidth * 100}% - 8px)`
                : `calc(${(baseWidth / item.totalColumns) * 100}% - 4px)`;
          } else if (
            hasRoutineTaskSplit &&
            item.kind === "task" &&
            groupFrames.some((gf) =>
              rangesOverlap(item.top, item.height, gf.top, gf.height),
            )
          ) {
            // Task overlapping group → right column
            const taskWidth = 1 - routineColumnRatio;
            colLeft = `calc(${routineColumnRatio * 100}% + 2px)`;
            colWidth = `calc(${taskWidth * 100}% - 4px)`;
          } else {
            colLeft =
              item.totalColumns === 1
                ? "4px"
                : `calc(${(item.column / item.totalColumns) * 100}% + 2px)`;
            colWidth =
              item.totalColumns === 1
                ? "calc(100% - 8px)"
                : `calc(${(1 / item.totalColumns) * 100}% - 4px)`;
          }

          if (item.kind === "task" && item.task) {
            return (
              <TimeGridTaskBlock
                key={item.task.id}
                task={item.task}
                top={item.top}
                height={item.height}
                left={colLeft}
                width={colWidth}
                color={getTaskColor?.(item.task.id)}
                tag={getFolderTag?.(item.task.id)}
                dragHandlers={getDragHandlers(
                  item.task.id,
                  "task",
                  item.top,
                  item.height,
                  "move",
                )}
                resizeTopHandlers={getDragHandlers(
                  item.task.id,
                  "task",
                  item.top,
                  item.height,
                  "resize-top",
                )}
                resizeBottomHandlers={getDragHandlers(
                  item.task.id,
                  "task",
                  item.top,
                  item.height,
                  "resize-bottom",
                )}
                isDragging={
                  dragState.isDragging && dragState.itemId === item.task.id
                }
                onToggleTaskStatus={onToggleTaskStatus}
                onUnschedule={onUnscheduleTask}
                onNavigate={onNavigateTask}
                hasMovedRef={hasMovedRef}
                onUpdateTimeMemo={onUpdateTaskTimeMemo}
                onShowPreview={
                  enablePreview ? handleShowTaskPreview : undefined
                }
              />
            );
          }

          if (item.kind === "schedule" && item.scheduleItem) {
            return (
              <ScheduleItemBlock
                key={item.scheduleItem.id}
                item={item.scheduleItem}
                top={item.top}
                height={item.height}
                left={colLeft}
                width={colWidth}
                isNext={item.scheduleItem.id === nextItemId}
                onToggleComplete={onToggleComplete}
                onUpdateMemo={onUpdateMemo}
                onDelete={onDeleteScheduleItem}
                onRequestRoutineDelete={onRequestRoutineDelete}
                dragHandlers={getDragHandlers(
                  item.scheduleItem.id,
                  "schedule",
                  item.top,
                  item.height,
                  "move",
                )}
                resizeTopHandlers={getDragHandlers(
                  item.scheduleItem.id,
                  "schedule",
                  item.top,
                  item.height,
                  "resize-top",
                )}
                resizeBottomHandlers={getDragHandlers(
                  item.scheduleItem.id,
                  "schedule",
                  item.top,
                  item.height,
                  "resize-bottom",
                )}
                isDragging={
                  dragState.isDragging &&
                  dragState.itemId === item.scheduleItem.id
                }
                hasMovedRef={hasMovedRef}
                onShowPreview={
                  enablePreview ? handleShowSchedulePreview : undefined
                }
              />
            );
          }

          return null;
        })}

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

  const previewPopups = enablePreview && (
    <>
      {taskPreview && (
        <TaskPreviewPopup
          task={taskPreview.task}
          position={taskPreview.position}
          color={getTaskColor?.(taskPreview.task.id)}
          onOpenDetail={() => {
            const taskId = taskPreview.task.id;
            setTaskPreview(null);
            onNavigateTask?.(taskId, {} as React.MouseEvent);
          }}
          onStartTimer={
            onStartTimer
              ? () => {
                  const task = taskPreview.task;
                  setTaskPreview(null);
                  onStartTimer(task);
                }
              : undefined
          }
          onDelete={() => {
            const taskId = taskPreview.task.id;
            setTaskPreview(null);
            onDeleteTask?.(taskId);
          }}
          onClearSchedule={() => {
            const taskId = taskPreview.task.id;
            setTaskPreview(null);
            onUnscheduleTask?.(taskId);
          }}
          onUpdateTitle={
            onUpdateTaskTitle
              ? (title) => onUpdateTaskTitle(taskPreview.task.id, title)
              : undefined
          }
          onClose={() => setTaskPreview(null)}
        />
      )}
      {schedulePreview && (
        <ScheduleItemPreviewPopup
          item={schedulePreview.item}
          position={schedulePreview.position}
          onToggleComplete={() => {
            onToggleComplete(schedulePreview.item.id);
            setSchedulePreview(null);
          }}
          onUpdateMemo={
            onUpdateMemo
              ? (memo) => {
                  onUpdateMemo(schedulePreview.item.id, memo);
                }
              : undefined
          }
          onDelete={() => {
            const item = schedulePreview.item;
            setSchedulePreview(null);
            if (item.routineId && onRequestRoutineDelete) {
              onRequestRoutineDelete(item, {} as React.MouseEvent);
            } else {
              onDeleteScheduleItem?.(item.id);
            }
          }}
          onClose={() => setSchedulePreview(null)}
        />
      )}
    </>
  );

  if (externalScroll) {
    return (
      <>
        {gridContent}
        {previewPopups}
      </>
    );
  }

  return (
    <div className="border h-full border-notion-border rounded-lg overflow-hidden bg-notion-bg flex-1">
      <div ref={scrollRef} className="overflow-y-auto h-full relative">
        {gridContent}
      </div>
      {previewPopups}
    </div>
  );
}
