import { useState, useCallback } from "react";
import type { TaskNode, TaskStatus } from "../../../../types/taskTree";
import type { ScheduleItem } from "../../../../types/schedule";
import { useDayFlowColumn } from "../../../../hooks/useDayFlowColumn";
import { useScheduleContext } from "../../../../hooks/useScheduleContext";
import { useAutoInProgress } from "../../../../hooks/useAutoInProgress";
import { useTaskTreeContext } from "../../../../hooks/useTaskTreeContext";
import { getDataService } from "../../../../services";
import { CompactDateNav } from "./CompactDateNav";
import { ScheduleTimeGrid } from "./ScheduleTimeGrid";
import { TaskSchedulePanel } from "../../../shared/TaskSchedulePanel";
import { RoutineDeleteConfirmDialog } from "./RoutineDeleteConfirmDialog";
import { RoutineTimeChangeDialog } from "./RoutineTimeChangeDialog";
import { formatDateKey } from "../../../../utils/dateKey";
import {
  useRoleConversion,
  type ConversionRole,
  type ConversionSource,
} from "../../../../hooks/useRoleConversion";

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
  onDeleteTask?: (taskId: string) => void;
  onUpdateTaskTitle?: (taskId: string, title: string) => void;
  onStartTimer?: (task: TaskNode) => void;
  onToggleDualColumn?: () => void;
  onSetTaskStatus?: (taskId: string, status: TaskStatus) => void;
  onNavigateToEventsTab?: () => void;
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
  onDeleteTask,
  onUpdateTaskTitle,
  onStartTimer,
  onToggleDualColumn,
  onSetTaskStatus,
  onNavigateToEventsTab,
}: DualDayFlowLayoutProps) {
  const left = useDayFlowColumn({ initialDate: new Date() });
  const right = useDayFlowColumn({ initialDate: tomorrow() });

  // Cross-column refresh when same date
  const refreshOther = useCallback(
    (side: "left" | "right") => {
      if (left.dateKey === right.dateKey) {
        if (side === "left") right.refresh();
        else left.refresh();
      }
    },
    [left.dateKey, right.dateKey, left.refresh, right.refresh],
  );

  return (
    <div className="flex h-full gap-2 p-3">
      <DualColumn
        column={left}
        getTaskColor={getTaskColor}
        getFolderTag={getFolderTag}
        onUpdateTaskTime={onUpdateTaskTime}
        onToggleTaskStatus={onToggleTaskStatus}
        onUnscheduleTask={onUnscheduleTask}
        onNavigateTask={onNavigateTask}
        onUpdateTaskTimeMemo={onUpdateTaskTimeMemo}
        onDeleteTask={onDeleteTask}
        onUpdateTaskTitle={onUpdateTaskTitle}
        onStartTimer={onStartTimer}
        isDualColumn
        onToggleDualColumn={onToggleDualColumn}
        onMutate={() => refreshOther("left")}
      />
      <DualColumn
        column={right}
        getTaskColor={getTaskColor}
        getFolderTag={getFolderTag}
        onUpdateTaskTime={onUpdateTaskTime}
        onToggleTaskStatus={onToggleTaskStatus}
        onUnscheduleTask={onUnscheduleTask}
        onNavigateTask={onNavigateTask}
        onUpdateTaskTimeMemo={onUpdateTaskTimeMemo}
        onDeleteTask={onDeleteTask}
        onUpdateTaskTitle={onUpdateTaskTitle}
        onStartTimer={onStartTimer}
        onMutate={() => refreshOther("right")}
      />
    </div>
  );
}

interface DualColumnProps {
  column: ReturnType<typeof useDayFlowColumn>;
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
  onDeleteTask?: (taskId: string) => void;
  onUpdateTaskTitle?: (taskId: string, title: string) => void;
  onStartTimer?: (task: TaskNode) => void;
  isDualColumn?: boolean;
  onToggleDualColumn?: () => void;
  onMutate?: () => void;
}

function DualColumn({
  column,
  getTaskColor,
  getFolderTag,
  onUpdateTaskTime,
  onToggleTaskStatus,
  onUnscheduleTask,
  onNavigateTask,
  onUpdateTaskTimeMemo,
  onDeleteTask,
  onUpdateTaskTitle,
  onStartTimer,
  isDualColumn,
  onToggleDualColumn,
  onMutate,
}: DualColumnProps) {
  const { updateRoutine, updateScheduleItem, routines } = useScheduleContext();
  const { addNode, updateNode } = useTaskTreeContext();
  const { convert, canConvert } = useRoleConversion();

  const getDisabledRoles = (source: ConversionSource): ConversionRole[] => {
    const roles: ConversionRole[] = ["task", "event", "note", "daily"];
    return roles.filter((r) => !canConvert(source, r));
  };

  // Auto-set NOT_STARTED tasks to IN_PROGRESS for today
  useAutoInProgress(column.filteredDayTasks, column.isToday);

  const [createPopover, setCreatePopover] = useState<{
    startTime: string;
    endTime: string;
    position: { x: number; y: number };
  } | null>(null);

  const [routineDeleteTarget, setRoutineDeleteTarget] = useState<{
    item: ScheduleItem;
    position: { x: number; y: number };
  } | null>(null);

  const [routineTimeChange, setRoutineTimeChange] = useState<{
    itemId: string;
    routineId: string;
    routineTitle: string;
    startTime: string;
    endTime: string;
    prevStartTime: string;
    prevEndTime: string;
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
    onMutate?.();
  }, [routineDeleteTarget, column, onMutate]);

  const handleArchiveRoutine = useCallback(() => {
    if (!routineDeleteTarget?.item.routineId) return;
    updateRoutine(routineDeleteTarget.item.routineId, { isArchived: true });
    column.deleteScheduleItem(routineDeleteTarget.item.id);
    setRoutineDeleteTarget(null);
    onMutate?.();
  }, [routineDeleteTarget, updateRoutine, column, onMutate]);

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
    onMutate?.();
  };

  const handleUpdateScheduleItemTime = (
    id: string,
    startTime: string,
    endTime: string,
  ) => {
    const item = column.filteredScheduleItems.find((i) => i.id === id);
    column.updateScheduleItem(id, { startTime, endTime });
    onMutate?.();
    // If this is a routine item, show confirmation dialog
    if (item?.routineId) {
      const routine = routines.find((r) => r.id === item.routineId);
      if (routine) {
        setRoutineTimeChange({
          itemId: id,
          routineId: routine.id,
          routineTitle: routine.title,
          startTime,
          endTime,
          prevStartTime: item.startTime,
          prevEndTime: item.endTime,
        });
      }
    }
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
    onMutate?.();
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
        routineGroups={column.routineGroups}
        selectedFilterGroupIds={column.selectedFilterGroupIds}
        onSelectedFilterGroupIdsChange={column.setSelectedFilterGroupIds}
      />
      <div className="flex-1 overflow-y-auto">
        <ScheduleTimeGrid
          date={column.date}
          scheduleItems={column.filteredScheduleItems}
          tasks={column.filteredDayTasks}
          onToggleComplete={(id) => {
            column.toggleComplete(id);
            onMutate?.();
          }}
          onCreateItem={handleCreateItem}
          getTaskColor={getTaskColor}
          getFolderTag={getFolderTag}
          onUpdateMemo={handleUpdateMemo}
          onUpdateScheduleItemTime={handleUpdateScheduleItemTime}
          onUpdateScheduleItemTitle={(id, title) =>
            updateScheduleItem(id, { title })
          }
          onUpdateTaskTime={handleUpdateTaskTime}
          externalScroll
          onToggleTaskStatus={onToggleTaskStatus}
          onDeleteScheduleItem={(id) => {
            column.deleteScheduleItem(id);
            onMutate?.();
          }}
          onRequestRoutineDelete={handleRequestRoutineDelete}
          onUnscheduleTask={onUnscheduleTask}
          onNavigateTask={onNavigateTask}
          onUpdateTaskTimeMemo={onUpdateTaskTimeMemo}
          onDeleteTask={onDeleteTask}
          onUpdateTaskTitle={onUpdateTaskTitle}
          onStartTimer={onStartTimer}
          routineGroups={column.routineGroups}
          groupForRoutine={column.groupForRoutine}
          onDuplicateScheduleItem={(id) => {
            const item = column.filteredScheduleItems.find((i) => i.id === id);
            if (item) {
              column.createScheduleItem(
                item.title,
                item.startTime,
                item.endTime,
              );
              onMutate?.();
            }
          }}
          onConvertScheduleItemRole={(item, targetRole) => {
            const source: ConversionSource = {
              role: "event",
              scheduleItem: item,
              date: item.date,
            };
            convert(source, targetRole);
            onMutate?.();
          }}
          getDisabledRolesForScheduleItem={(item) =>
            getDisabledRoles({
              role: "event",
              scheduleItem: item,
              date: item.date,
            })
          }
          onConvertTaskRole={(task, targetRole) => {
            const taskDate = task.scheduledAt
              ? formatDateKey(new Date(task.scheduledAt))
              : column.dateKey;
            const source: ConversionSource = {
              role: "task",
              task,
              date: taskDate,
            };
            convert(source, targetRole);
            onMutate?.();
          }}
          getDisabledRolesForTask={(task) => {
            const taskDate = task.scheduledAt
              ? formatDateKey(new Date(task.scheduledAt))
              : column.dateKey;
            return getDisabledRoles({
              role: "task",
              task,
              date: taskDate,
            });
          }}
          onUpdateScheduleItemDate={(id, newDate) => {
            updateScheduleItem(id, { date: newDate });
            onMutate?.();
          }}
          onUpdateScheduleItemAllDay={(id, isAllDay) => {
            updateScheduleItem(id, { isAllDay });
            onMutate?.();
          }}
          onUpdateTaskAllDay={(taskId, isAllDay) => {
            updateNode(taskId, { isAllDay });
            onMutate?.();
          }}
          onSetTaskStatus={onSetTaskStatus}
          onNavigateToEventsTab={onNavigateToEventsTab}
        />
      </div>

      {createPopover && (
        <TaskSchedulePanel
          position={createPopover.position}
          defaultStartTime={createPopover.startTime}
          defaultEndTime={createPopover.endTime}
          date={column.date}
          existingTaskIds={column.existingTaskIds}
          onSelectExistingTask={(task, schedule) => {
            updateNode(task.id, {
              scheduledAt: schedule.scheduledAt,
              scheduledEndAt: schedule.scheduledEndAt,
              isAllDay: schedule.isAllDay,
            });
            onMutate?.();
          }}
          onCreateNewTask={(title, parentId, schedule) => {
            addNode("task", parentId, title, {
              scheduledAt: schedule.scheduledAt,
              scheduledEndAt: schedule.scheduledEndAt,
              isAllDay: schedule.isAllDay,
            });
            onMutate?.();
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

      {routineTimeChange && (
        <RoutineTimeChangeDialog
          routineTitle={routineTimeChange.routineTitle}
          newStartTime={routineTimeChange.startTime}
          newEndTime={routineTimeChange.endTime}
          onThisOnly={() => setRoutineTimeChange(null)}
          onApplyToRoutine={() => {
            updateRoutine(routineTimeChange.routineId, {
              startTime: routineTimeChange.startTime,
              endTime: routineTimeChange.endTime,
            });
            getDataService()
              .updateFutureScheduleItemsByRoutine(
                routineTimeChange.routineId,
                {
                  startTime: routineTimeChange.startTime,
                  endTime: routineTimeChange.endTime,
                },
                column.dateKey,
              )
              .catch(() => {});
            setRoutineTimeChange(null);
          }}
          onCancel={() => {
            column.updateScheduleItem(routineTimeChange.itemId, {
              startTime: routineTimeChange.prevStartTime,
              endTime: routineTimeChange.prevEndTime,
            });
            setRoutineTimeChange(null);
          }}
        />
      )}
    </div>
  );
}
