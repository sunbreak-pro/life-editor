import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import type { TaskNode, TaskStatus } from "../../../../types/taskTree";
import type { ScheduleItem } from "../../../../types/schedule";
import type { RoutineGroup } from "../../../../types/routineGroup";
import type { ConversionRole } from "../../../../hooks/useRoleConversion";
import { TIME_GRID } from "../../../../constants/timeGrid";
import { TimeGridTaskBlock } from "../shared/TimeGridTaskBlock";
import { TaskPreviewPopup } from "../Calendar/TaskPreviewPopup";
import { ScheduleItemBlock } from "./ScheduleItemBlock";
import { ScheduleItemPreviewPopup } from "./ScheduleItemPreviewPopup";
import { GroupFrame } from "./GroupFrame";
import { GroupContextMenu } from "./GroupContextMenu";
import { TimeGridContextMenu } from "./TimeGridContextMenu";
import { formatDateKey } from "../../../../utils/dateKey";
import { shouldRoutineRunOnDate } from "../../../../utils/routineFrequency";
import { useTimeGridDrag } from "../../../../hooks/useTimeGridDrag";
import {
  formatTime,
  formatHour,
  minutesToTimeString,
  topToMinutes,
  timeToMinutes,
  snapTimeFromPosition,
} from "../../../../utils/timeGridUtils";

const HOURS = Array.from(
  { length: TIME_GRID.END_HOUR - TIME_GRID.START_HOUR },
  (_, i) => i + TIME_GRID.START_HOUR,
);
const GUTTER_WIDTH = 52;
const MIN_ITEM_HEIGHT = 28;

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

const GROUP_HEADER_HEIGHT = 28;

interface ComputedGroupFrame {
  groupId: string;
  groupName: string;
  groupColor: string;
  top: number;
  height: number;
  itemCount: number;
  timeRange: string;
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

  // Convert schedule items (exclude all-day items)
  for (const si of scheduleItems.filter((s) => !s.isAllDay)) {
    const startMin = timeToMinutes(si.startTime);
    const endMin = timeToMinutes(si.endTime);
    const top = (startMin / 60 - TIME_GRID.START_HOUR) * TIME_GRID.SLOT_HEIGHT;
    const height = Math.max(
      ((endMin - startMin) / 60) * TIME_GRID.SLOT_HEIGHT,
      MIN_ITEM_HEIGHT,
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
    const height = Math.max(
      (durationMinutes / 60) * TIME_GRID.SLOT_HEIGHT,
      MIN_ITEM_HEIGHT,
    );
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
  onUpdateScheduleItemTitle?: (id: string, title: string) => void;
  onUpdateTaskTime?: (
    taskId: string,
    scheduledAt: string,
    scheduledEndAt: string,
  ) => void;
  externalScroll?: boolean;
  onToggleTaskStatus?: (taskId: string) => void;
  onDeleteScheduleItem?: (id: string) => void;
  onRequestRoutineDelete?: (
    item: ScheduleItem,
    position: { x: number; y: number },
  ) => void;
  onUnscheduleTask?: (taskId: string) => void;
  onNavigateTask?: (taskId: string, e: React.MouseEvent) => void;
  onUpdateTaskTimeMemo?: (taskId: string, memo: string | null) => void;
  onDeleteTask?: (taskId: string) => void;
  onUpdateTaskTitle?: (taskId: string, title: string) => void;
  onStartTimer?: (task: TaskNode) => void;
  // Group visualization
  routineGroups?: RoutineGroup[];
  groupForRoutine?: Map<string, RoutineGroup[]>;
  onGroupDragEnd?: (groupId: string, offsetMinutes: number) => void;
  onEditRoutine?: (routineId: string) => void;
  onEditGroup?: (groupId: string) => void;
  onDeleteGroup?: (groupId: string, dismissToday: boolean) => void;
  // Context menu actions
  onDuplicateScheduleItem?: (id: string) => void;
  // Role conversion
  onConvertScheduleItemRole?: (
    item: ScheduleItem,
    targetRole: ConversionRole,
  ) => void;
  getDisabledRolesForScheduleItem?: (item: ScheduleItem) => ConversionRole[];
  onConvertTaskRole?: (task: TaskNode, targetRole: ConversionRole) => void;
  getDisabledRolesForTask?: (task: TaskNode) => ConversionRole[];
  // Date / all-day
  onUpdateScheduleItemDate?: (id: string, date: string) => void;
  onUpdateScheduleItemAllDay?: (id: string, isAllDay: boolean) => void;
  onUpdateTaskAllDay?: (taskId: string, isAllDay: boolean) => void;
  onSetTaskStatus?: (taskId: string, status: TaskStatus) => void;
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
  onUpdateScheduleItemTitle,
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
  routineGroups,
  groupForRoutine,
  onGroupDragEnd,
  onEditRoutine,
  onEditGroup,
  onDeleteGroup,
  onDuplicateScheduleItem,
  onConvertScheduleItemRole,
  getDisabledRolesForScheduleItem,
  onConvertTaskRole,
  getDisabledRolesForTask,
  onUpdateScheduleItemDate,
  onUpdateScheduleItemAllDay,
  onUpdateTaskAllDay,
  onSetTaskStatus,
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

  // Resolve live schedule item from props (not snapshot) for immediate updates
  const liveSchedulePreviewItem = schedulePreview
    ? (scheduleItems.find((si) => si.id === schedulePreview.item.id) ??
      schedulePreview.item)
    : null;

  // Active memo item state (for context menu "Add memo")
  const [activeMemoItemId, setActiveMemoItemId] = useState<string | null>(null);

  // Group context menu state
  const [groupContextMenu, setGroupContextMenu] = useState<{
    position: { x: number; y: number };
    groupId: string;
  } | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    position: { x: number; y: number };
    itemId: string;
    itemType: "schedule" | "task";
  } | null>(null);

  const contextScheduleItem =
    contextMenu?.itemType === "schedule"
      ? scheduleItems.find((i) => i.id === contextMenu.itemId)
      : undefined;
  const contextTask =
    contextMenu?.itemType === "task"
      ? tasks.find((t) => t.id === contextMenu.itemId)
      : undefined;

  const handleContextMenuExtend15 = useCallback(() => {
    if (!contextMenu) return;
    if (contextMenu.itemType === "schedule" && contextScheduleItem) {
      const endMin = timeToMinutes(contextScheduleItem.endTime) + 15;
      const newEnd = minutesToTimeString(Math.min(endMin, 24 * 60));
      onUpdateScheduleItemTime?.(
        contextMenu.itemId,
        contextScheduleItem.startTime,
        newEnd,
      );
    } else if (contextMenu.itemType === "task" && contextTask?.scheduledAt) {
      const startDate = new Date(contextTask.scheduledAt);
      const endDate = contextTask.scheduledEndAt
        ? new Date(contextTask.scheduledEndAt)
        : new Date(startDate.getTime() + 25 * 60000);
      endDate.setMinutes(endDate.getMinutes() + 15);
      onUpdateTaskTime?.(
        contextMenu.itemId,
        formatTime(startDate.getHours(), startDate.getMinutes()),
        formatTime(endDate.getHours(), endDate.getMinutes()),
      );
    }
  }, [
    contextMenu,
    contextScheduleItem,
    contextTask,
    onUpdateScheduleItemTime,
    onUpdateTaskTime,
  ]);

  const handleContextMenuShrink15 = useCallback(() => {
    if (!contextMenu) return;
    if (contextMenu.itemType === "schedule" && contextScheduleItem) {
      const startMin = timeToMinutes(contextScheduleItem.startTime);
      const endMin = timeToMinutes(contextScheduleItem.endTime);
      const newEndMin = Math.max(endMin - 15, startMin + 15);
      onUpdateScheduleItemTime?.(
        contextMenu.itemId,
        contextScheduleItem.startTime,
        minutesToTimeString(newEndMin),
      );
    } else if (contextMenu.itemType === "task" && contextTask?.scheduledAt) {
      const startDate = new Date(contextTask.scheduledAt);
      const endDate = contextTask.scheduledEndAt
        ? new Date(contextTask.scheduledEndAt)
        : new Date(startDate.getTime() + 25 * 60000);
      endDate.setMinutes(endDate.getMinutes() - 15);
      if (endDate.getTime() - startDate.getTime() < 15 * 60000) {
        endDate.setTime(startDate.getTime() + 15 * 60000);
      }
      onUpdateTaskTime?.(
        contextMenu.itemId,
        formatTime(startDate.getHours(), startDate.getMinutes()),
        formatTime(endDate.getHours(), endDate.getMinutes()),
      );
    }
  }, [
    contextMenu,
    contextScheduleItem,
    contextTask,
    onUpdateScheduleItemTime,
    onUpdateTaskTime,
  ]);

  const handleContextMenuCopyTime = useCallback(() => {
    if (!contextMenu) return;
    let timeStr = "";
    if (contextMenu.itemType === "schedule" && contextScheduleItem) {
      timeStr = `${contextScheduleItem.startTime} - ${contextScheduleItem.endTime}`;
    } else if (contextMenu.itemType === "task" && contextTask?.scheduledAt) {
      const start = new Date(contextTask.scheduledAt);
      const end = contextTask.scheduledEndAt
        ? new Date(contextTask.scheduledEndAt)
        : start;
      const fmt = (d: Date) => formatTime(d.getHours(), d.getMinutes());
      timeStr = `${fmt(start)} - ${fmt(end)}`;
    }
    if (timeStr) navigator.clipboard.writeText(timeStr);
  }, [contextMenu, contextScheduleItem, contextTask]);

  const handleContextMenuDuplicate = useCallback(() => {
    if (!contextMenu) return;
    if (contextMenu.itemType === "schedule" && contextScheduleItem) {
      onDuplicateScheduleItem?.(contextMenu.itemId);
    }
  }, [contextMenu, contextScheduleItem, onDuplicateScheduleItem]);

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
      { group: RoutineGroup; minTop: number; maxBottom: number; count: number }
    >();
    for (const item of unifiedItems) {
      if (item.kind !== "schedule" || !item.scheduleItem?.routineId) continue;
      const groups = groupForRoutine.get(item.scheduleItem.routineId);
      const group = groups?.find(
        (g) =>
          g.isVisible &&
          shouldRoutineRunOnDate(
            g.frequencyType,
            g.frequencyDays,
            g.frequencyInterval,
            g.frequencyStartDate,
            dateKey,
          ),
      );
      if (!group) continue;
      const bottom = item.top + item.height;
      const existing = frames.get(group.id);
      if (existing) {
        existing.minTop = Math.min(existing.minTop, item.top);
        existing.maxBottom = Math.max(existing.maxBottom, bottom);
        existing.count += 1;
      } else {
        frames.set(group.id, {
          group,
          minTop: item.top,
          maxBottom: bottom,
          count: 1,
        });
      }
    }
    return Array.from(frames.values()).map(
      ({ group, minTop, maxBottom, count }) => {
        const startStr = minutesToTimeString(topToMinutes(minTop));
        const endStr = minutesToTimeString(topToMinutes(maxBottom));
        return {
          groupId: group.id,
          groupName: group.name,
          groupColor: group.color,
          top: minTop - GROUP_HEADER_HEIGHT,
          height: maxBottom - minTop + GROUP_HEADER_HEIGHT + 4,
          itemCount: count,
          timeRange: `${startStr} - ${endStr}`,
        };
      },
    );
  }, [unifiedItems, routineGroups, groupForRoutine]);

  // Check if any non-routine item (task or event) overlaps with a group frame
  const hasRoutineTaskSplit = useMemo(() => {
    if (groupFrames.length === 0) return false;
    return unifiedItems.some((item) => {
      // Grouped routine items don't trigger the split
      if (item.kind === "schedule" && item.scheduleItem?.routineId)
        return false;
      return groupFrames.some((gf) =>
        rangesOverlap(
          item.top,
          item.height,
          gf.top + GROUP_HEADER_HEIGHT,
          gf.height - GROUP_HEADER_HEIGHT,
        ),
      );
    });
  }, [unifiedItems, groupFrames]);

  const routineColumnRatio = hasRoutineTaskSplit ? 0.6 : 1.0;

  // Fix totalColumns for items affected by routine-task split
  // Grouped routines should only divide columns among themselves (not with external tasks/events)
  // Tasks and events overlapping group frames go to the right column
  const adjustedItems = useMemo(() => {
    if (!hasRoutineTaskSplit || !groupForRoutine) return unifiedItems;

    // Collect IDs of grouped routine items
    const groupedRoutineIds = new Set<string>();
    for (const item of unifiedItems) {
      if (
        item.kind === "schedule" &&
        item.scheduleItem?.routineId &&
        groupForRoutine.has(item.scheduleItem.routineId)
      ) {
        groupedRoutineIds.add(item.id);
      }
    }

    // Collect IDs of tasks AND events that overlap with group frames (these go to the right column)
    const rightColumnIds = new Set<string>();
    for (const item of unifiedItems) {
      if (groupedRoutineIds.has(item.id)) continue;
      if (
        groupFrames.some((gf) =>
          rangesOverlap(
            item.top,
            item.height,
            gf.top + GROUP_HEADER_HEIGHT,
            gf.height - GROUP_HEADER_HEIGHT,
          ),
        )
      ) {
        rightColumnIds.add(item.id);
      }
    }

    return unifiedItems.map((item) => {
      // Grouped routine: only count overlapping grouped-routine peers for totalColumns
      if (groupedRoutineIds.has(item.id)) {
        const peers = unifiedItems.filter(
          (other) =>
            other.id !== item.id &&
            groupedRoutineIds.has(other.id) &&
            rangesOverlap(item.top, item.height, other.top, other.height),
        );
        const newTotal = peers.length + 1;
        // Re-assign sequential column among peers
        const allPeers = [item, ...peers].sort((a, b) => a.column - b.column);
        const newColumn = allPeers.findIndex((p) => p.id === item.id);
        return { ...item, totalColumns: newTotal, column: newColumn };
      }

      // Right-column item (task or event overlapping group): count peers in right column
      if (rightColumnIds.has(item.id)) {
        const peers = unifiedItems.filter(
          (other) =>
            other.id !== item.id &&
            rightColumnIds.has(other.id) &&
            rangesOverlap(item.top, item.height, other.top, other.height),
        );
        const newTotal = peers.length + 1;
        const allPeers = [item, ...peers].sort((a, b) => a.column - b.column);
        const newColumn = allPeers.findIndex((p) => p.id === item.id);
        return { ...item, totalColumns: newTotal, column: newColumn };
      }

      // Non-grouped event not overlapping group: count overlaps with non-right-column items
      if (item.kind === "schedule" && !groupedRoutineIds.has(item.id)) {
        const peers = unifiedItems.filter(
          (other) =>
            other.id !== item.id &&
            !groupedRoutineIds.has(other.id) &&
            !rightColumnIds.has(other.id) &&
            rangesOverlap(item.top, item.height, other.top, other.height),
        );
        const newTotal = peers.length + 1;
        const allPeers = [item, ...peers].sort((a, b) => a.column - b.column);
        const newColumn = allPeers.findIndex((p) => p.id === item.id);
        return { ...item, totalColumns: newTotal, column: newColumn };
      }

      return item;
    });
  }, [unifiedItems, hasRoutineTaskSplit, groupForRoutine, groupFrames]);

  const nextItemId = useMemo(() => {
    const sorted = [...scheduleItems].sort((a, b) =>
      a.startTime.localeCompare(b.startTime),
    );
    return sorted.find((i) => !i.completed)?.id ?? null;
  }, [scheduleItems]);

  const currentTimeTop =
    (currentTime.getHours() - TIME_GRID.START_HOUR) * TIME_GRID.SLOT_HEIGHT +
    (currentTime.getMinutes() / 60) * TIME_GRID.SLOT_HEIGHT;

  const handleColumnContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (dragState.isDragging) return;
    if (hasMovedRef.current) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const snapped = snapTimeFromPosition(
      y,
      TIME_GRID.SLOT_HEIGHT,
      TIME_GRID.START_HOUR,
    );

    const startTime = formatTime(snapped.hour, snapped.minute);
    const endHour = Math.min(snapped.hour + 1, 23);
    const endTime = formatTime(endHour, snapped.minute);

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
        onContextMenu={handleColumnContextMenu}
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
            itemCount={gf.itemCount}
            timeRange={gf.timeRange}
            headerHeight={GROUP_HEADER_HEIGHT}
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
            onClick={onEditGroup ? () => onEditGroup(gf.groupId) : undefined}
            onHeaderContextMenu={
              onEditGroup || onDeleteGroup
                ? (e) => {
                    setGroupContextMenu({
                      position: { x: e.clientX, y: e.clientY },
                      groupId: gf.groupId,
                    });
                  }
                : undefined
            }
          />
        ))}

        {/* Unified item blocks */}
        {adjustedItems.map((item) => {
          // Column separation: routine items in left column, tasks/events in right column
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
            !(
              item.kind === "schedule" &&
              item.scheduleItem?.routineId &&
              groupForRoutine?.has(item.scheduleItem.routineId)
            ) &&
            groupFrames.some((gf) =>
              rangesOverlap(
                item.top,
                item.height,
                gf.top + GROUP_HEADER_HEIGHT,
                gf.height - GROUP_HEADER_HEIGHT,
              ),
            )
          ) {
            // Task or event overlapping group → right column with subdivision
            const rightWidth = 1 - routineColumnRatio;
            colLeft =
              item.totalColumns === 1
                ? `calc(${routineColumnRatio * 100}% + 2px)`
                : `calc(${routineColumnRatio * 100}% + ${(item.column / item.totalColumns) * rightWidth * 100}% + 2px)`;
            colWidth =
              item.totalColumns === 1
                ? `calc(${rightWidth * 100}% - 4px)`
                : `calc(${(rightWidth / item.totalColumns) * 100}% - 4px)`;
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
                activeMemoItemId={activeMemoItemId}
                onClearActiveMemo={() => setActiveMemoItemId(null)}
                onContextMenu={(task, position) =>
                  setContextMenu({
                    position,
                    itemId: task.id,
                    itemType: "task",
                  })
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
                activeMemoItemId={activeMemoItemId}
                onClearActiveMemo={() => setActiveMemoItemId(null)}
                onContextMenu={(si, position) =>
                  setContextMenu({
                    position,
                    itemId: si.id,
                    itemType: "schedule",
                  })
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

  const previewPopups = (
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
          onToggleStatus={
            onToggleTaskStatus
              ? () => onToggleTaskStatus(taskPreview.task.id)
              : undefined
          }
          onSetStatus={
            onSetTaskStatus
              ? (status) => onSetTaskStatus(taskPreview.task.id, status)
              : undefined
          }
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
          onUpdateSchedule={
            onUpdateTaskTime
              ? (scheduledAt, scheduledEndAt) =>
                  onUpdateTaskTime(
                    taskPreview.task.id,
                    scheduledAt,
                    scheduledEndAt ?? scheduledAt,
                  )
              : undefined
          }
          onConvertRole={
            onConvertTaskRole
              ? (targetRole) => onConvertTaskRole(taskPreview.task, targetRole)
              : undefined
          }
          disabledRoles={
            getDisabledRolesForTask
              ? getDisabledRolesForTask(taskPreview.task)
              : undefined
          }
          onUpdateAllDay={
            onUpdateTaskAllDay
              ? (isAllDay) => {
                  onUpdateTaskAllDay(taskPreview.task.id, isAllDay);
                  setTaskPreview(null);
                }
              : undefined
          }
          onUpdateTimeMemo={
            onUpdateTaskTimeMemo
              ? (memo) => onUpdateTaskTimeMemo(taskPreview.task.id, memo)
              : undefined
          }
          onClose={() => setTaskPreview(null)}
        />
      )}
      {schedulePreview && liveSchedulePreviewItem && (
        <ScheduleItemPreviewPopup
          item={liveSchedulePreviewItem}
          position={schedulePreview.position}
          onToggleComplete={() => {
            onToggleComplete(schedulePreview.item.id);
            setSchedulePreview(null);
          }}
          onEditRoutine={
            liveSchedulePreviewItem.routineId && onEditRoutine
              ? () => onEditRoutine(liveSchedulePreviewItem.routineId!)
              : undefined
          }
          onDelete={() => {
            const item = liveSchedulePreviewItem;
            const previewPos = schedulePreview.position;
            setSchedulePreview(null);
            if (item.routineId && onRequestRoutineDelete) {
              onRequestRoutineDelete(item, previewPos);
            } else {
              onDeleteScheduleItem?.(item.id);
            }
          }}
          onUpdateTime={
            onUpdateScheduleItemTime
              ? (startTime, endTime) =>
                  onUpdateScheduleItemTime(
                    schedulePreview.item.id,
                    startTime,
                    endTime,
                  )
              : undefined
          }
          onUpdateMemo={onUpdateMemo}
          onConvertRole={
            onConvertScheduleItemRole && !liveSchedulePreviewItem.routineId
              ? (targetRole) =>
                  onConvertScheduleItemRole(liveSchedulePreviewItem, targetRole)
              : undefined
          }
          disabledRoles={
            getDisabledRolesForScheduleItem &&
            !liveSchedulePreviewItem.routineId
              ? getDisabledRolesForScheduleItem(liveSchedulePreviewItem)
              : undefined
          }
          onUpdateDate={
            onUpdateScheduleItemDate
              ? (date) =>
                  onUpdateScheduleItemDate(schedulePreview.item.id, date)
              : undefined
          }
          onUpdateAllDay={
            onUpdateScheduleItemAllDay
              ? (isAllDay) => {
                  onUpdateScheduleItemAllDay(schedulePreview.item.id, isAllDay);
                  setSchedulePreview(null);
                }
              : undefined
          }
          onUpdateTitle={
            onUpdateScheduleItemTitle
              ? (title) =>
                  onUpdateScheduleItemTitle(schedulePreview.item.id, title)
              : undefined
          }
          onClose={() => setSchedulePreview(null)}
        />
      )}
    </>
  );

  const contextMenuPopup = contextMenu &&
    (contextScheduleItem || contextTask) && (
      <TimeGridContextMenu
        position={contextMenu.position}
        itemType={contextMenu.itemType}
        isCompleted={
          contextMenu.itemType === "schedule"
            ? !!contextScheduleItem?.completed
            : contextTask?.status === "DONE"
        }
        isRoutine={!!contextScheduleItem?.routineId}
        onToggleComplete={() => {
          if (contextMenu.itemType === "schedule") {
            onToggleComplete(contextMenu.itemId);
          } else {
            onToggleTaskStatus?.(contextMenu.itemId);
          }
        }}
        onEdit={() => {
          // Trigger preview popup for editing
          if (contextMenu.itemType === "schedule" && contextScheduleItem) {
            setSchedulePreview({
              item: contextScheduleItem,
              position: contextMenu.position,
            });
          } else if (contextMenu.itemType === "task" && contextTask) {
            setTaskPreview({
              task: contextTask,
              position: contextMenu.position,
            });
          }
        }}
        onDelete={() => {
          if (contextMenu.itemType === "schedule") {
            if (contextScheduleItem?.routineId && onRequestRoutineDelete) {
              onRequestRoutineDelete(contextScheduleItem, contextMenu.position);
            } else {
              onDeleteScheduleItem?.(contextMenu.itemId);
            }
          } else {
            onDeleteTask?.(contextMenu.itemId);
          }
        }}
        onAddMemo={() => {
          if (contextMenu.itemType === "schedule") {
            onUpdateMemo?.(contextMenu.itemId, "");
          } else {
            onUpdateTaskTimeMemo?.(contextMenu.itemId, "");
          }
          setActiveMemoItemId(contextMenu.itemId);
        }}
        onExtend15={handleContextMenuExtend15}
        onShrink15={handleContextMenuShrink15}
        onCopyTime={handleContextMenuCopyTime}
        onDuplicate={handleContextMenuDuplicate}
        onClose={() => setContextMenu(null)}
      />
    );

  const groupContextMenuPopup = groupContextMenu && (
    <GroupContextMenu
      position={groupContextMenu.position}
      onEdit={
        onEditGroup
          ? () => {
              onEditGroup(groupContextMenu.groupId);
              setGroupContextMenu(null);
            }
          : undefined
      }
      onDismissToday={
        onDeleteGroup
          ? () => {
              onDeleteGroup(groupContextMenu.groupId, true);
              setGroupContextMenu(null);
            }
          : undefined
      }
      onDeleteGroup={
        onDeleteGroup
          ? () => {
              onDeleteGroup(groupContextMenu.groupId, false);
              setGroupContextMenu(null);
            }
          : undefined
      }
      onClose={() => setGroupContextMenu(null)}
    />
  );

  if (externalScroll) {
    return (
      <>
        {gridContent}
        {previewPopups}
        {contextMenuPopup}
        {groupContextMenuPopup}
      </>
    );
  }

  return (
    <div className="border h-full border-notion-border rounded-lg overflow-hidden bg-notion-bg flex-1">
      <div ref={scrollRef} className="overflow-y-auto h-full relative">
        {gridContent}
      </div>
      {previewPopups}
      {contextMenuPopup}
      {groupContextMenuPopup}
    </div>
  );
}
