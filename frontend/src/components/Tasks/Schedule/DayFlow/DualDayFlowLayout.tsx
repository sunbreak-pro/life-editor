import { useState, useRef, useCallback } from "react";
import type { TaskNode } from "../../../../types/taskTree";
import type { ScheduleItem } from "../../../../types/schedule";
import { useDayFlowColumn } from "../../../../hooks/useDayFlowColumn";
import { useScheduleContext } from "../../../../hooks/useScheduleContext";
import { CompactDateNav } from "./CompactDateNav";
import { ScheduleTimeGrid } from "./ScheduleTimeGrid";
import { TimeGridClickPanel } from "./TimeGridClickPanel";
import { RoutineDeleteConfirmDialog } from "./RoutineDeleteConfirmDialog";
import { TIME_GRID } from "../../../../constants/timeGrid";

interface DualDayFlowLayoutProps {
  getTaskColor?: (taskId: string) => string | undefined;
  getFolderTag?: (taskId: string) => string;
  onUpdateTaskTime?: (
    taskId: string,
    scheduledAt: string,
    scheduledEndAt: string,
  ) => void;
  onToggleTaskStatus?: (taskId: string) => void;
  onUnscheduleTask?: (taskId: string) => void;
  onNavigateTask?: (taskId: string, e: React.MouseEvent) => void;
  onUpdateTaskTimeMemo?: (taskId: string, memo: string | null) => void;
  onToggleDualColumn?: () => void;
}

function tomorrow(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d;
}

export function DualDayFlowLayout({
  getTaskColor,
  getFolderTag,
  onUpdateTaskTime,
  onToggleTaskStatus,
  onUnscheduleTask,
  onNavigateTask,
  onUpdateTaskTimeMemo,
  onToggleDualColumn,
}: DualDayFlowLayoutProps) {
  const left = useDayFlowColumn({ initialDate: new Date() });
  const right = useDayFlowColumn({ initialDate: tomorrow() });

  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef(false);

  const handleLeftScroll = useCallback(() => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    requestAnimationFrame(() => {
      if (rightScrollRef.current && leftScrollRef.current) {
        rightScrollRef.current.scrollTop = leftScrollRef.current.scrollTop;
      }
      isSyncingRef.current = false;
    });
  }, []);

  const handleRightScroll = useCallback(() => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    requestAnimationFrame(() => {
      if (leftScrollRef.current && rightScrollRef.current) {
        leftScrollRef.current.scrollTop = rightScrollRef.current.scrollTop;
      }
      isSyncingRef.current = false;
    });
  }, []);

  return (
    <div className="flex h-full gap-2 p-3">
      <DualColumn
        column={left}
        scrollRef={leftScrollRef}
        onScroll={handleLeftScroll}
        getTaskColor={getTaskColor}
        getFolderTag={getFolderTag}
        onUpdateTaskTime={onUpdateTaskTime}
        onToggleTaskStatus={onToggleTaskStatus}
        onUnscheduleTask={onUnscheduleTask}
        onNavigateTask={onNavigateTask}
        onUpdateTaskTimeMemo={onUpdateTaskTimeMemo}
        isDualColumn
        onToggleDualColumn={onToggleDualColumn}
      />
      <DualColumn
        column={right}
        scrollRef={rightScrollRef}
        onScroll={handleRightScroll}
        getTaskColor={getTaskColor}
        getFolderTag={getFolderTag}
        onUpdateTaskTime={onUpdateTaskTime}
        onToggleTaskStatus={onToggleTaskStatus}
        onUnscheduleTask={onUnscheduleTask}
        onNavigateTask={onNavigateTask}
        onUpdateTaskTimeMemo={onUpdateTaskTimeMemo}
      />
    </div>
  );
}

interface DualColumnProps {
  column: ReturnType<typeof useDayFlowColumn>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  getTaskColor?: (taskId: string) => string | undefined;
  getFolderTag?: (taskId: string) => string;
  onUpdateTaskTime?: (
    taskId: string,
    scheduledAt: string,
    scheduledEndAt: string,
  ) => void;
  onToggleTaskStatus?: (taskId: string) => void;
  onUnscheduleTask?: (taskId: string) => void;
  onNavigateTask?: (taskId: string, e: React.MouseEvent) => void;
  onUpdateTaskTimeMemo?: (taskId: string, memo: string | null) => void;
  isDualColumn?: boolean;
  onToggleDualColumn?: () => void;
}

function DualColumn({
  column,
  scrollRef,
  onScroll,
  getTaskColor,
  getFolderTag,
  onUpdateTaskTime,
  onToggleTaskStatus,
  onUnscheduleTask,
  onNavigateTask,
  onUpdateTaskTimeMemo,
  isDualColumn,
  onToggleDualColumn,
}: DualColumnProps) {
  const { updateRoutine } = useScheduleContext();
  const [createPopover, setCreatePopover] = useState<{
    startTime: string;
    endTime: string;
    position: { x: number; y: number };
  } | null>(null);

  const [routineDeleteTarget, setRoutineDeleteTarget] = useState<{
    item: ScheduleItem;
    position: { x: number; y: number };
  } | null>(null);

  const handleRequestRoutineDelete = useCallback(
    (item: ScheduleItem, e: React.MouseEvent) => {
      setRoutineDeleteTarget({
        item,
        position: { x: e.clientX, y: e.clientY },
      });
    },
    [],
  );

  const handleDismissOnly = useCallback(() => {
    if (!routineDeleteTarget) return;
    column.dismissScheduleItem(routineDeleteTarget.item.id);
    setRoutineDeleteTarget(null);
  }, [routineDeleteTarget, column]);

  const handleArchiveRoutine = useCallback(() => {
    if (!routineDeleteTarget?.item.routineId) return;
    updateRoutine(routineDeleteTarget.item.routineId, { isArchived: true });
    column.deleteScheduleItem(routineDeleteTarget.item.id);
    setRoutineDeleteTarget(null);
  }, [routineDeleteTarget, updateRoutine, column]);

  const handleCreateItem = (
    startTime: string,
    endTime: string,
    e: React.MouseEvent,
  ) => {
    setCreatePopover({
      startTime,
      endTime,
      position: { x: e.clientX, y: e.clientY },
    });
  };

  const handleUpdateMemo = (id: string, memo: string | null) => {
    column.updateScheduleItem(id, { memo });
  };

  const handleUpdateScheduleItemTime = (
    id: string,
    startTime: string,
    endTime: string,
  ) => {
    column.updateScheduleItem(id, { startTime, endTime });
  };

  const handleUpdateTaskTime = (
    taskId: string,
    startTime: string,
    endTime: string,
  ) => {
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const startDate = new Date(column.date);
    startDate.setHours(sh, sm, 0, 0);
    const endDate = new Date(column.date);
    endDate.setHours(eh, em, 0, 0);
    onUpdateTaskTime?.(taskId, startDate.toISOString(), endDate.toISOString());
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 border border-notion-border rounded-lg overflow-hidden bg-notion-bg">
      <CompactDateNav
        date={column.date}
        isToday={column.isToday}
        onPrevDate={column.goToPrev}
        onNextDate={column.goToNext}
        onToday={column.goToToday}
        filterTab={column.filterTab}
        onFilterTabChange={column.setFilterTab}
        selectedFilterTagIds={column.selectedFilterTagIds}
        onSelectedFilterTagIdsChange={column.setSelectedFilterTagIds}
        routineTags={column.routineTags}
        isDualColumn={isDualColumn}
        onToggleDualColumn={onToggleDualColumn}
      />
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        onScroll={onScroll}
      >
        <ScheduleTimeGrid
          date={column.date}
          scheduleItems={column.filteredScheduleItems}
          tasks={column.filteredDayTasks}
          onToggleComplete={column.toggleComplete}
          onCreateItem={handleCreateItem}
          getTaskColor={getTaskColor}
          getFolderTag={getFolderTag}
          onUpdateMemo={handleUpdateMemo}
          onUpdateScheduleItemTime={handleUpdateScheduleItemTime}
          onUpdateTaskTime={handleUpdateTaskTime}
          externalScroll
          onToggleTaskStatus={onToggleTaskStatus}
          onDeleteScheduleItem={column.deleteScheduleItem}
          onRequestRoutineDelete={handleRequestRoutineDelete}
          onUnscheduleTask={onUnscheduleTask}
          onNavigateTask={onNavigateTask}
          onUpdateTaskTimeMemo={onUpdateTaskTimeMemo}
        />
      </div>

      {createPopover && (
        <TimeGridClickPanel
          position={createPopover.position}
          defaultStartTime={createPopover.startTime}
          defaultEndTime={createPopover.endTime}
          date={column.date}
          existingTaskIds={column.existingTaskIds}
          onCreateScheduleItem={(title, startTime, endTime) => {
            column.createScheduleItem(title, startTime, endTime);
          }}
          onClose={() => setCreatePopover(null)}
        />
      )}

      {routineDeleteTarget && (
        <RoutineDeleteConfirmDialog
          title={routineDeleteTarget.item.title}
          position={routineDeleteTarget.position}
          onDismissOnly={handleDismissOnly}
          onArchiveRoutine={handleArchiveRoutine}
          onCancel={() => setRoutineDeleteTarget(null)}
        />
      )}
    </div>
  );
}
