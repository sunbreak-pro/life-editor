import type { RoutineGroup } from "../../../../types/routineGroup";
import type { ScheduleItem } from "../../../../types/schedule";
import type { TaskNode } from "../../../../types/taskTree";
import { TIME_GRID } from "../../../../constants/timeGrid";
import { shouldRoutineRunOnDate } from "../../../../utils/routineFrequency";
import {
  minutesToTimeString,
  timeToMinutes,
  topToMinutes,
} from "../../../../utils/timeGridUtils";

export const HOURS = Array.from(
  { length: TIME_GRID.END_HOUR - TIME_GRID.START_HOUR },
  (_, i) => i + TIME_GRID.START_HOUR,
);
export const GUTTER_WIDTH = 52;
export const MIN_ITEM_HEIGHT = 28;
export const GROUP_HEADER_HEIGHT = 28;

export type UnifiedItemKind = "schedule" | "task";

export interface UnifiedItem {
  id: string;
  kind: UnifiedItemKind;
  top: number;
  height: number;
  column: number;
  totalColumns: number;
  scheduleItem?: ScheduleItem;
  task?: TaskNode;
}

export interface ComputedGroupFrame {
  groupId: string;
  groupName: string;
  groupColor: string;
  top: number;
  height: number;
  itemCount: number;
  timeRange: string;
}

export function rangesOverlap(
  aTop: number,
  aHeight: number,
  bTop: number,
  bHeight: number,
): boolean {
  return aTop < bTop + bHeight && aTop + aHeight > bTop;
}

export function layoutAllItems(
  scheduleItems: ScheduleItem[],
  tasks: TaskNode[],
  dayDate: Date,
): UnifiedItem[] {
  const items: UnifiedItem[] = [];

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

  items.sort((a, b) => a.top - b.top || a.height - b.height);

  const columnEnds: number[] = [];
  const groupIndex: number[] = new Array(items.length);
  const groups: number[][] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const itemEnd = item.top + item.height;

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

    let foundGroup = -1;
    for (let j = i - 1; j >= 0; j--) {
      const prev = items[j];
      if (prev.top + prev.height <= item.top) continue;
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

export function computeGroupFrames(
  unifiedItems: UnifiedItem[],
  routineGroups: RoutineGroup[] | undefined,
  groupForRoutine: Map<string, RoutineGroup[]> | undefined,
  dateKey: string,
): ComputedGroupFrame[] {
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
}

export function detectRoutineTaskSplit(
  unifiedItems: UnifiedItem[],
  groupFrames: ComputedGroupFrame[],
): boolean {
  if (groupFrames.length === 0) return false;
  return unifiedItems.some((item) => {
    if (item.kind === "schedule" && item.scheduleItem?.routineId) return false;
    return groupFrames.some((gf) =>
      rangesOverlap(
        item.top,
        item.height,
        gf.top + GROUP_HEADER_HEIGHT,
        gf.height - GROUP_HEADER_HEIGHT,
      ),
    );
  });
}

export function adjustItemsForRoutineSplit(
  unifiedItems: UnifiedItem[],
  hasRoutineTaskSplit: boolean,
  groupForRoutine: Map<string, RoutineGroup[]> | undefined,
  groupFrames: ComputedGroupFrame[],
): UnifiedItem[] {
  if (!hasRoutineTaskSplit || !groupForRoutine) return unifiedItems;

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
    if (groupedRoutineIds.has(item.id)) {
      const peers = unifiedItems.filter(
        (other) =>
          other.id !== item.id &&
          groupedRoutineIds.has(other.id) &&
          rangesOverlap(item.top, item.height, other.top, other.height),
      );
      const newTotal = peers.length + 1;
      const allPeers = [item, ...peers].sort((a, b) => a.column - b.column);
      const newColumn = allPeers.findIndex((p) => p.id === item.id);
      return { ...item, totalColumns: newTotal, column: newColumn };
    }

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
}
