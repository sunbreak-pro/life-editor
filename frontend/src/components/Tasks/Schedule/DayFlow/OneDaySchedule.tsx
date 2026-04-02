import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import type { TaskNode } from "../../../../types/taskTree";
import type { ScheduleItem } from "../../../../types/schedule";
import { useScheduleContext } from "../../../../hooks/useScheduleContext";
import { useAutoInProgress } from "../../../../hooks/useAutoInProgress";
import { useTaskTreeContext } from "../../../../hooks/useTaskTreeContext";
import { formatDateKey } from "../../../../utils/dateKey";
import { getDataService } from "../../../../services";
import { CompactDateNav } from "./CompactDateNav";
import { ScheduleTimeGrid } from "./ScheduleTimeGrid";
import { TaskSchedulePanel } from "../../../shared/TaskSchedulePanel";
import { TimeGridClickMenu } from "./TimeGridClickMenu";
import { RoutinePickerPanel } from "./RoutinePickerPanel";
import { NoteSchedulePanel } from "../../../shared/NoteSchedulePanel/NoteSchedulePanel";
import { RoutineDeleteConfirmDialog } from "./RoutineDeleteConfirmDialog";
import { RoutineEditDialog } from "../Routine/RoutineEditDialog";
import type { RoutineNode } from "../../../../types/routine";
import { RoutineTimeChangeDialog } from "./RoutineTimeChangeDialog";
import type { TabItem } from "../../../shared/SectionTabs";
import { TIME_GRID } from "../../../../constants/timeGrid";
import type { NoteNode } from "../../../../types/note";

export type DayFlowFilterTab =
  | "all"
  | "routine"
  | "tasks"
  | "events"
  | "daily"
  | "notes";

export const DAY_FLOW_FILTER_TABS: readonly TabItem<DayFlowFilterTab>[] = [
  { id: "all", labelKey: "dayFlow.filterAll" },
  { id: "routine", labelKey: "dayFlow.filterRoutine" },
  { id: "tasks", labelKey: "dayFlow.filterTasks" },
  { id: "events", labelKey: "dayFlow.filterEvents" },
];

interface OneDayScheduleProps {
  date: Date;
  tasksByDate: Map<string, TaskNode[]>;
  allTasksByDate: Map<string, TaskNode[]>;
  getTaskColor?: (taskId: string) => string | undefined;
  getFolderTag?: (taskId: string) => string;
  onUpdateTaskTime?: (
    taskId: string,
    scheduledAt: string,
    scheduledEndAt: string,
  ) => void;
  onPrevDate: () => void;
  onNextDate: () => void;
  onToday: () => void;
  filterTab: DayFlowFilterTab;
  onFilterTabChange: (tab: DayFlowFilterTab) => void;
  onToggleTaskStatus?: (taskId: string) => void;
  onUnscheduleTask?: (taskId: string) => void;
  onNavigateTask?: (taskId: string, e: React.MouseEvent) => void;
  onUpdateTaskTimeMemo?: (taskId: string, memo: string | null) => void;
  onDeleteTask?: (taskId: string) => void;
  onUpdateTaskTitle?: (taskId: string, title: string) => void;
  onStartTimer?: (task: TaskNode) => void;
  isDualColumn?: boolean;
  onToggleDualColumn?: () => void;
}

export function OneDaySchedule({
  date,
  tasksByDate,
  allTasksByDate,
  getTaskColor,
  getFolderTag,
  onUpdateTaskTime,
  onPrevDate,
  onNextDate,
  onToday,
  filterTab,
  onFilterTabChange,
  onToggleTaskStatus,
  onUnscheduleTask,
  onNavigateTask,
  onUpdateTaskTimeMemo,
  onDeleteTask,
  onUpdateTaskTitle,
  onStartTimer,
  isDualColumn,
  onToggleDualColumn,
}: OneDayScheduleProps) {
  const {
    scheduleItems,
    loadItemsForDate,
    toggleComplete,
    routines,
    routineTags,
    tagAssignments,
    ensureRoutineItemsForDate,
    updateScheduleItem,
    deleteScheduleItem,
    dismissScheduleItem,
    refreshRoutineStats,
    updateRoutine,
    routineGroups,
    routinesByGroup,
    groupForRoutine,
    createScheduleItem,
    skipNextSync,
    setTagsForRoutine,
    createRoutineTag,
    cleanupNonMatchingScheduleItems,
  } = useScheduleContext();
  const { addNode, updateNode } = useTaskTreeContext();
  const dateKey = formatDateKey(date);
  const isToday = dateKey === formatDateKey(new Date());
  const [selectedFilterTagIds, setSelectedFilterTagIds] = useState<number[]>(
    [],
  );
  const [selectedFilterGroupIds, setSelectedFilterGroupIds] = useState<
    string[]
  >([]);
  const [editRoutineDialog, setEditRoutineDialog] =
    useState<RoutineNode | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const routineTagMap = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const [routineId, tagIds] of tagAssignments) {
      map.set(routineId, tagIds);
    }
    return map;
  }, [tagAssignments]);
  const [clickMenu, setClickMenu] = useState<{
    startTime: string;
    endTime: string;
    position: { x: number; y: number };
  } | null>(null);
  const [createPopover, setCreatePopover] = useState<{
    startTime: string;
    endTime: string;
    position: { x: number; y: number };
  } | null>(null);
  const [routinePicker, setRoutinePicker] = useState<{
    startTime: string;
    endTime: string;
    position: { x: number; y: number };
  } | null>(null);
  const [notePicker, setNotePicker] = useState<{
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
    dismissScheduleItem(routineDeleteTarget.item.id);
    setRoutineDeleteTarget(null);
  }, [routineDeleteTarget, dismissScheduleItem]);

  const handleArchiveRoutine = useCallback(() => {
    if (!routineDeleteTarget?.item.routineId) return;
    updateRoutine(routineDeleteTarget.item.routineId, { isArchived: true });
    deleteScheduleItem(routineDeleteTarget.item.id);
    setRoutineDeleteTarget(null);
  }, [routineDeleteTarget, updateRoutine, deleteScheduleItem]);

  // Load schedule items when date changes
  useEffect(() => {
    loadItemsForDate(dateKey);
  }, [dateKey, loadItemsForDate]);

  // Auto-insert routine items when date/routines/tags change
  useEffect(() => {
    if (routines.length > 0) {
      ensureRoutineItemsForDate(
        dateKey,
        routines,
        tagAssignments,
        groupForRoutine,
      );
    }
  }, [
    dateKey,
    routines,
    tagAssignments,
    groupForRoutine,
    ensureRoutineItemsForDate,
  ]);

  // Load routine stats on mount and when routines change
  useEffect(() => {
    if (routines.length > 0) {
      refreshRoutineStats(routines);
    }
  }, [routines, refreshRoutineStats]);

  // Scroll to current time on mount
  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date();
      const scrollTo = Math.max(
        0,
        (now.getHours() - 1) * TIME_GRID.SLOT_HEIGHT,
      );
      scrollRef.current.scrollTop = scrollTo;
    }
  }, []);

  const dayTasks = useMemo(
    () => tasksByDate.get(dateKey) ?? [],
    [tasksByDate, dateKey],
  );

  const allDayTasks = useMemo(
    () => allTasksByDate.get(dateKey) ?? [],
    [allTasksByDate, dateKey],
  );

  // Auto-set NOT_STARTED tasks to IN_PROGRESS for today
  useAutoInProgress(dayTasks, isToday);

  // Filtered data based on active filter tab
  const filteredScheduleItems = useMemo(() => {
    let items = scheduleItems;
    switch (filterTab) {
      case "routine":
        items = items.filter((i) => i.routineId !== null);
        break;
      case "events":
        items = items.filter((i) => i.routineId === null);
        break;
      case "tasks":
        return [];
    }
    if (selectedFilterTagIds.length > 0) {
      items = items.filter((i) => {
        if (!i.routineId) return false;
        const rTagIds = routineTagMap.get(i.routineId) ?? [];
        return selectedFilterTagIds.some((id) => rTagIds.includes(id));
      });
    }
    // Group filter: show items whose routines belong to selected groups
    if (selectedFilterGroupIds.length > 0) {
      items = items.filter((i) => {
        if (!i.routineId) return false;
        const group = groupForRoutine.get(i.routineId);
        return group ? selectedFilterGroupIds.includes(group.id) : false;
      });
    }
    return items;
  }, [
    scheduleItems,
    filterTab,
    selectedFilterTagIds,
    routineTagMap,
    selectedFilterGroupIds,
    groupForRoutine,
  ]);

  const filteredDayTasks = useMemo(() => {
    if (filterTab === "routine" || filterTab === "events") return [];
    return allDayTasks;
  }, [allDayTasks, filterTab]);

  // Task IDs already scheduled for this date (for task picker exclusion)
  const existingTaskIds = useMemo(() => {
    const ids = new Set<string>();
    for (const task of dayTasks) {
      ids.add(task.id);
    }
    for (const task of allDayTasks) {
      ids.add(task.id);
    }
    return ids;
  }, [dayTasks, allDayTasks]);

  const handleCreateItem = (
    startTime: string,
    endTime: string,
    e: React.MouseEvent,
  ) => {
    setClickMenu({
      startTime,
      endTime,
      position: { x: e.clientX, y: e.clientY },
    });
  };

  const handleSelectRoutineForSchedule = useCallback(
    (
      routine: {
        id: string;
        title: string;
        startTime?: string | null;
        endTime?: string | null;
      },
      startTime: string,
      endTime: string,
    ) => {
      const st = routine.startTime ?? startTime;
      const et = routine.endTime ?? endTime;
      createScheduleItem(dateKey, routine.title, st, et, routine.id);
      setRoutinePicker(null);
    },
    [dateKey, createScheduleItem],
  );

  const handleSelectGroupForSchedule = useCallback(
    (
      _group: { id: string },
      members: Array<{
        id: string;
        title: string;
        startTime?: string | null;
        endTime?: string | null;
      }>,
      startTime: string,
      endTime: string,
    ) => {
      for (const routine of members) {
        const st = routine.startTime ?? startTime;
        const et = routine.endTime ?? endTime;
        createScheduleItem(dateKey, routine.title, st, et, routine.id);
      }
      setRoutinePicker(null);
    },
    [dateKey, createScheduleItem],
  );

  const handleSelectExistingNote = useCallback(
    (note: NoteNode, startTime: string, endTime: string) => {
      createScheduleItem(
        dateKey,
        note.title || "Note",
        startTime,
        endTime,
        undefined,
        undefined,
        note.id,
      );
      setNotePicker(null);
    },
    [dateKey, createScheduleItem],
  );

  const handleCreateNewNote = useCallback(
    async (title: string, startTime: string, endTime: string) => {
      const { getDataService } = await import("../../../../services");
      const noteId = `note-${crypto.randomUUID()}`;
      await getDataService().createNote(noteId, title);
      createScheduleItem(
        dateKey,
        title,
        startTime,
        endTime,
        undefined,
        undefined,
        noteId,
      );
      setNotePicker(null);
    },
    [dateKey, createScheduleItem],
  );

  const handleUpdateMemo = (id: string, memo: string | null) => {
    updateScheduleItem(id, { memo });
  };

  const handleUpdateScheduleItemTime = (
    id: string,
    startTime: string,
    endTime: string,
  ) => {
    const item = filteredScheduleItems.find((i) => i.id === id);
    updateScheduleItem(id, { startTime, endTime });
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
    // Convert HH:MM to ISO date time strings for the current date
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const startDate = new Date(date);
    startDate.setHours(sh, sm, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(eh, em, 0, 0);
    onUpdateTaskTime?.(taskId, startDate.toISOString(), endDate.toISOString());
  };

  return (
    <div className="flex flex-col h-full">
      <CompactDateNav
        date={date}
        isToday={isToday}
        onPrevDate={onPrevDate}
        onNextDate={onNextDate}
        onToday={onToday}
        filterTab={filterTab}
        onFilterTabChange={onFilterTabChange}
        selectedFilterTagIds={selectedFilterTagIds}
        onSelectedFilterTagIdsChange={setSelectedFilterTagIds}
        routineTags={routineTags}
        isDualColumn={isDualColumn}
        onToggleDualColumn={onToggleDualColumn}
        routineGroups={routineGroups}
        selectedFilterGroupIds={selectedFilterGroupIds}
        onSelectedFilterGroupIdsChange={setSelectedFilterGroupIds}
      />

      {/* Main content - TimeGrid + MemoColumn in shared scroll container */}
      <div className="flex-1 min-h-0 p-3">
        <div className="border border-notion-border rounded-lg overflow-hidden bg-notion-bg h-full">
          <div ref={scrollRef} className="overflow-y-auto h-full">
            <ScheduleTimeGrid
              date={date}
              scheduleItems={filteredScheduleItems}
              tasks={filteredDayTasks}
              onToggleComplete={toggleComplete}
              onCreateItem={handleCreateItem}
              getTaskColor={getTaskColor}
              getFolderTag={getFolderTag}
              onUpdateMemo={handleUpdateMemo}
              onUpdateScheduleItemTime={handleUpdateScheduleItemTime}
              onUpdateTaskTime={handleUpdateTaskTime}
              externalScroll
              onToggleTaskStatus={onToggleTaskStatus}
              onDeleteScheduleItem={deleteScheduleItem}
              onRequestRoutineDelete={handleRequestRoutineDelete}
              onUnscheduleTask={onUnscheduleTask}
              onNavigateTask={onNavigateTask}
              onUpdateTaskTimeMemo={onUpdateTaskTimeMemo}
              onDeleteTask={onDeleteTask}
              onUpdateTaskTitle={onUpdateTaskTitle}
              onStartTimer={onStartTimer}
              routineGroups={routineGroups}
              groupForRoutine={groupForRoutine}
              onEditRoutine={(routineId) => {
                const routine = routines.find((r) => r.id === routineId);
                if (routine) setEditRoutineDialog(routine);
              }}
              onDuplicateScheduleItem={(id) => {
                const item = filteredScheduleItems.find((i) => i.id === id);
                if (item) {
                  createScheduleItem(
                    dateKey,
                    item.title,
                    item.startTime,
                    item.endTime,
                    item.routineId ?? undefined,
                    undefined,
                    item.noteId ?? undefined,
                  );
                }
              }}
            />
          </div>
        </div>

        {/* 3-step click menu */}
        {clickMenu && (
          <TimeGridClickMenu
            position={clickMenu.position}
            onSelectRoutine={() => {
              setRoutinePicker(clickMenu);
              setClickMenu(null);
            }}
            onSelectTask={() => {
              setCreatePopover(clickMenu);
              setClickMenu(null);
            }}
            onSelectNote={() => {
              setNotePicker(clickMenu);
              setClickMenu(null);
            }}
            onClose={() => setClickMenu(null)}
          />
        )}

        {/* Routine picker */}
        {routinePicker && (
          <RoutinePickerPanel
            position={routinePicker.position}
            defaultStartTime={routinePicker.startTime}
            defaultEndTime={routinePicker.endTime}
            routines={routines}
            routineGroups={routineGroups}
            routinesByGroup={routinesByGroup}
            onSelectRoutine={handleSelectRoutineForSchedule}
            onSelectGroup={handleSelectGroupForSchedule}
            onClose={() => setRoutinePicker(null)}
          />
        )}

        {/* Note picker */}
        {notePicker && (
          <NoteSchedulePanel
            position={notePicker.position}
            defaultStartTime={notePicker.startTime}
            defaultEndTime={notePicker.endTime}
            date={date}
            onSelectExistingNote={handleSelectExistingNote}
            onCreateNewNote={handleCreateNewNote}
            onClose={() => setNotePicker(null)}
          />
        )}

        {/* Task schedule panel */}
        {createPopover && (
          <TaskSchedulePanel
            position={createPopover.position}
            defaultStartTime={createPopover.startTime}
            defaultEndTime={createPopover.endTime}
            date={date}
            existingTaskIds={existingTaskIds}
            onSelectExistingTask={(task, schedule) => {
              updateNode(task.id, {
                scheduledAt: schedule.scheduledAt,
                scheduledEndAt: schedule.scheduledEndAt,
                isAllDay: schedule.isAllDay,
              });
            }}
            onCreateNewTask={(title, parentId, schedule) => {
              addNode("task", parentId, title, {
                scheduledAt: schedule.scheduledAt,
                scheduledEndAt: schedule.scheduledEndAt,
                isAllDay: schedule.isAllDay,
              });
            }}
            onClose={() => setCreatePopover(null)}
          />
        )}

        {/* Routine delete confirmation */}
        {routineDeleteTarget && (
          <RoutineDeleteConfirmDialog
            title={routineDeleteTarget.item.title}
            position={routineDeleteTarget.position}
            onDismissOnly={handleDismissOnly}
            onArchiveRoutine={handleArchiveRoutine}
            onCancel={() => setRoutineDeleteTarget(null)}
          />
        )}

        {/* Routine time change confirmation */}
        {routineTimeChange && (
          <RoutineTimeChangeDialog
            routineTitle={routineTimeChange.routineTitle}
            newStartTime={routineTimeChange.startTime}
            newEndTime={routineTimeChange.endTime}
            onThisOnly={() => setRoutineTimeChange(null)}
            onApplyToRoutine={() => {
              skipNextSync();
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
                  dateKey,
                )
                .catch(() => {});
              setRoutineTimeChange(null);
            }}
            onCancel={() => {
              updateScheduleItem(routineTimeChange.itemId, {
                startTime: routineTimeChange.prevStartTime,
                endTime: routineTimeChange.prevEndTime,
              });
              setRoutineTimeChange(null);
            }}
          />
        )}

        {editRoutineDialog && (
          <RoutineEditDialog
            routine={editRoutineDialog}
            tags={routineTags}
            initialTagIds={tagAssignments.get(editRoutineDialog.id) ?? []}
            onSubmit={(
              title,
              startTime,
              endTime,
              tagIds,
              frequencyType,
              frequencyDays,
              frequencyInterval,
              frequencyStartDate,
            ) => {
              skipNextSync();
              updateRoutine(editRoutineDialog.id, {
                title,
                startTime,
                endTime,
                frequencyType,
                frequencyDays,
                frequencyInterval,
                frequencyStartDate,
              });
              if (tagIds !== undefined) {
                setTagsForRoutine(editRoutineDialog.id, tagIds);
              }
              if (
                frequencyType !== editRoutineDialog.frequencyType ||
                JSON.stringify(frequencyDays) !==
                  JSON.stringify(editRoutineDialog.frequencyDays) ||
                frequencyInterval !== editRoutineDialog.frequencyInterval ||
                frequencyStartDate !== editRoutineDialog.frequencyStartDate
              ) {
                const updatedRoutine = {
                  ...editRoutineDialog,
                  title,
                  startTime: startTime ?? editRoutineDialog.startTime,
                  endTime: endTime ?? editRoutineDialog.endTime,
                  frequencyType:
                    frequencyType ?? editRoutineDialog.frequencyType,
                  frequencyDays:
                    frequencyDays ?? editRoutineDialog.frequencyDays,
                  frequencyInterval:
                    frequencyInterval !== undefined
                      ? frequencyInterval
                      : editRoutineDialog.frequencyInterval,
                  frequencyStartDate:
                    frequencyStartDate !== undefined
                      ? frequencyStartDate
                      : editRoutineDialog.frequencyStartDate,
                };
                cleanupNonMatchingScheduleItems(updatedRoutine);
              }
              setEditRoutineDialog(null);
            }}
            onCreateTag={createRoutineTag}
            onClose={() => setEditRoutineDialog(null)}
          />
        )}
      </div>
    </div>
  );
}
