import { useEffect, useMemo, useRef, useCallback } from "react";
import type { TaskNode, TaskStatus } from "../../../../types/taskTree";
import type { ScheduleItem } from "../../../../types/schedule";
import { useScheduleContext } from "../../../../hooks/useScheduleContext";
import { useAutoInProgress } from "../../../../hooks/useAutoInProgress";
import { useTaskTreeContext } from "../../../../hooks/useTaskTreeContext";
import { formatDateKey } from "../../../../utils/dateKey";
import { getDataService } from "../../../../services";
import { logServiceError } from "../../../../utils/logError";
import { CompactDateNav } from "./CompactDateNav";
import { ScheduleTimeGrid } from "./ScheduleTimeGrid";
import { TaskSchedulePanel } from "../../../shared/TaskSchedulePanel";
import { TimeGridClickMenu } from "./TimeGridClickMenu";
import { RoutineDeleteConfirmDialog } from "./RoutineDeleteConfirmDialog";
import { RoutineEditDialog } from "../Routine/RoutineEditDialog";
import { RoutineGroupEditDialog } from "../Routine/RoutineGroupEditDialog";
import type { RoutineNode } from "../../../../types/routine";
import type { RoutineGroup } from "../../../../types/routineGroup";
import { RoutineTimeChangeDialog } from "../shared/RoutineTimeChangeDialog";
import { TaskPreviewPopup } from "../Calendar/TaskPreviewPopup";
import { ScheduleItemPreviewPopup } from "./ScheduleItemPreviewPopup";
import { RoutinePickerPanel } from "./RoutinePickerPanel";
import { NoteSchedulePanel } from "../../../shared/NoteSchedulePanel/NoteSchedulePanel";
import { TIME_GRID } from "../../../../constants/timeGrid";
import type { NoteNode } from "../../../../types/note";
import { useDayFlowFilters } from "./useDayFlowFilters";
import { useDayFlowDialogs } from "./useDayFlowDialogs";
import { DAY_FLOW_FILTER_TABS, type DayFlowFilterTab } from "./dayFlowFilters";
import {
  CalendarClock,
  CalendarMinus,
  CheckCircle2,
  CheckSquare,
  Pencil,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useRoleConversion,
  type ConversionRole,
  type ConversionSource,
} from "../../../../hooks/useRoleConversion";
import { useUndoRedo } from "../../../shared/UndoRedo";

export { DAY_FLOW_FILTER_TABS, type DayFlowFilterTab };

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
  activeFilters: Set<DayFlowFilterTab>;
  onSetExclusiveFilter?: (tab: DayFlowFilterTab) => void;
  onToggleTaskStatus?: (taskId: string) => void;
  onUnscheduleTask?: (taskId: string) => void;
  onNavigateTask?: (taskId: string, e: React.MouseEvent) => void;
  onUpdateTaskTimeMemo?: (taskId: string, memo: string | null) => void;
  onDeleteTask?: (taskId: string) => void;
  onUpdateTaskTitle?: (taskId: string, title: string) => void;
  onStartTimer?: (task: TaskNode) => void;
  isDualColumn?: boolean;
  onToggleDualColumn?: () => void;
  onSetTaskStatus?: (taskId: string, status: TaskStatus) => void;
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
  activeFilters,
  onSetExclusiveFilter,
  onToggleTaskStatus,
  onUnscheduleTask,
  onNavigateTask,
  onUpdateTaskTimeMemo,
  onDeleteTask,
  onUpdateTaskTitle,
  onStartTimer,
  isDualColumn,
  onToggleDualColumn,
  onSetTaskStatus,
}: OneDayScheduleProps) {
  const {
    scheduleItems,
    loadItemsForDate,
    toggleComplete,
    routines,
    routineGroupAssignments,
    ensureRoutineItemsForDate,
    updateScheduleItem,
    softDeleteScheduleItem,
    dismissScheduleItem,
    refreshRoutineStats,
    updateRoutine,
    routineGroups,
    routinesByGroup,
    groupForRoutine,
    createScheduleItem,
    createRoutineGroup,
    setGroupsForRoutine,
    reconcileRoutineScheduleItems,
    updateRoutineGroup,
    deleteRoutineGroup,
    groupTimeRange,
  } = useScheduleContext();
  const { addNode, updateNode } = useTaskTreeContext();
  const { t } = useTranslation();
  const { convert, canConvert } = useRoleConversion();
  const { push } = useUndoRedo();
  const dateKey = formatDateKey(date);

  const getDisabledRoles = (source: ConversionSource): ConversionRole[] => {
    const roles: ConversionRole[] = ["task", "event", "note", "daily"];
    return roles.filter((r) => !canConvert(source, r));
  };
  const isToday = dateKey === formatDateKey(new Date());
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    editRoutineDialog,
    setEditRoutineDialog,
    editGroupDialog,
    setEditGroupDialog,
    allDayTaskPreview,
    setAllDayTaskPreview,
    allDaySchedulePreview,
    setAllDaySchedulePreview,
    clickMenu,
    setClickMenu,
    createPopover,
    setCreatePopover,
    routineDeleteTarget,
    setRoutineDeleteTarget,
    routineTimeChange,
    setRoutineTimeChange,
    routinePicker,
    setRoutinePicker,
    notePicker,
    setNotePicker,
    handleRequestRoutineDelete,
    handleDismissOnly,
    handleArchiveRoutine,
  } = useDayFlowDialogs({
    dismissScheduleItem,
    updateRoutine,
    softDeleteScheduleItem,
  });

  // Load schedule items when date changes
  useEffect(() => {
    loadItemsForDate(dateKey);
  }, [dateKey, loadItemsForDate]);

  // Auto-insert routine items when date/routines change
  useEffect(() => {
    if (routines.length > 0) {
      ensureRoutineItemsForDate(dateKey, routines, groupForRoutine);
    }
  }, [dateKey, routines, groupForRoutine, ensureRoutineItemsForDate]);

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

  const {
    selectedFilterGroupIds,
    setSelectedFilterGroupIds,
    filteredScheduleItems,
    filteredDayTasks,
    allDayTasks2,
    allDayScheduleItems,
    timedScheduleItems,
    hasAllDayItems,
  } = useDayFlowFilters({
    scheduleItems,
    allDayTasks,
    activeFilters,
    groupForRoutine,
  });

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
    [dateKey, createScheduleItem, setRoutinePicker],
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
    [dateKey, createScheduleItem, setRoutinePicker],
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
    [dateKey, createScheduleItem, setNotePicker],
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
    [dateKey, createScheduleItem, setNotePicker],
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
    // For routine items, defer the undo push until the dialog choice is made:
    // "this only" pushes a scheduleItem-scoped undo, "apply to routine" pushes
    // a grouped undo covering routine + all future items.
    const isRoutineItem = !!item?.routineId;
    updateScheduleItem(id, { startTime, endTime }, { skipUndo: isRoutineItem });
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
        filterTab={activeFilters.size === 1 ? [...activeFilters][0] : "all"}
        onFilterTabChange={(tab) => onSetExclusiveFilter?.(tab)}
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
            {hasAllDayItems && (
              <div className="sticky top-0 z-20 bg-notion-bg border-b border-notion-border px-2 py-1.5">
                <div className="text-[10px] text-notion-text-secondary uppercase tracking-wide font-medium mb-1">
                  {t("schedule.allDay", "All day")}
                </div>
                <div className="flex flex-wrap gap-1">
                  {allDayTasks2.map((task) => {
                    const isDone = task.status === "DONE";
                    return (
                      <div
                        key={task.id}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-notion-bg-secondary border border-notion-border/50 group max-w-[200px]"
                      >
                        <button
                          onClick={() => onToggleTaskStatus?.(task.id)}
                          className="shrink-0"
                        >
                          {isDone ? (
                            <CheckCircle2
                              size={14}
                              className="text-green-500"
                            />
                          ) : (
                            <CheckSquare
                              size={14}
                              className="text-notion-accent hover:text-green-500"
                            />
                          )}
                        </button>
                        <span
                          className={`text-xs truncate ${isDone ? "text-notion-text-secondary line-through" : "text-notion-text"}`}
                        >
                          {task.title}
                        </span>
                        <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setAllDayTaskPreview({
                                task,
                                position: {
                                  x: e.clientX,
                                  y: e.clientY,
                                },
                              });
                            }}
                            className="p-0.5 rounded hover:bg-notion-hover text-notion-text-secondary hover:text-notion-text"
                          >
                            <Pencil size={10} />
                          </button>
                          {onUnscheduleTask && (
                            <button
                              onClick={() => onUnscheduleTask(task.id)}
                              className="p-0.5 rounded hover:bg-notion-hover text-notion-text-secondary hover:text-red-500"
                            >
                              <CalendarMinus size={10} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {allDayScheduleItems.map((si) => (
                    <div
                      key={si.id}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-notion-accent/10 border border-notion-accent/20 group max-w-[200px]"
                    >
                      <button
                        onClick={() => toggleComplete(si.id)}
                        className="shrink-0"
                      >
                        {si.completed ? (
                          <CheckCircle2 size={14} className="text-green-500" />
                        ) : (
                          <CalendarClock
                            size={14}
                            className="text-notion-accent hover:text-green-500"
                          />
                        )}
                      </button>
                      <span
                        className={`text-xs truncate ${si.completed ? "text-notion-text-secondary line-through" : "text-notion-text"}`}
                      >
                        {si.title}
                      </span>
                      <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAllDaySchedulePreview({
                              item: si,
                              position: {
                                x: e.clientX,
                                y: e.clientY,
                              },
                            });
                          }}
                          className="p-0.5 rounded hover:bg-notion-hover text-notion-text-secondary hover:text-notion-text"
                        >
                          <Pencil size={10} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <ScheduleTimeGrid
              date={date}
              scheduleItems={timedScheduleItems}
              tasks={filteredDayTasks}
              onToggleComplete={toggleComplete}
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
              onDeleteScheduleItem={softDeleteScheduleItem}
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
              onEditGroup={(groupId) => {
                const group = routineGroups.find((g) => g.id === groupId);
                if (group) setEditGroupDialog(group);
              }}
              onDeleteGroup={(groupId, dismissToday) => {
                if (dismissToday) {
                  // Dismiss all schedule items in this group for today
                  const groupRoutineIds = new Set(
                    (routinesByGroup.get(groupId) ?? []).map((r) => r.id),
                  );
                  for (const item of filteredScheduleItems) {
                    if (item.routineId && groupRoutineIds.has(item.routineId)) {
                      dismissScheduleItem(item.id);
                    }
                  }
                } else {
                  deleteRoutineGroup(groupId);
                }
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
              onConvertScheduleItemRole={(item, targetRole) => {
                const source: ConversionSource = {
                  role: "event",
                  scheduleItem: item,
                  date: item.date,
                };
                convert(source, targetRole);
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
                  : dateKey;
                const source: ConversionSource = {
                  role: "task",
                  task,
                  date: taskDate,
                };
                convert(source, targetRole);
              }}
              getDisabledRolesForTask={(task) => {
                const taskDate = task.scheduledAt
                  ? formatDateKey(new Date(task.scheduledAt))
                  : dateKey;
                return getDisabledRoles({
                  role: "task",
                  task,
                  date: taskDate,
                });
              }}
              onUpdateScheduleItemDate={(id, newDate) =>
                updateScheduleItem(id, { date: newDate })
              }
              onUpdateScheduleItemAllDay={(id, isAllDay) =>
                updateScheduleItem(id, { isAllDay })
              }
              onUpdateTaskAllDay={(taskId, isAllDay) =>
                updateNode(taskId, { isAllDay })
              }
              onSetTaskStatus={onSetTaskStatus}
            />
          </div>
        </div>

        {/* Click menu */}
        {clickMenu && (
          <TimeGridClickMenu
            position={clickMenu.position}
            onSelectTask={() => {
              setCreatePopover({ ...clickMenu, defaultTab: "task" });
              setClickMenu(null);
            }}
            onSelectEvent={() => {
              setCreatePopover({ ...clickMenu, defaultTab: "event" });
              setClickMenu(null);
            }}
            onSelectRoutine={() => {
              setCreatePopover({ ...clickMenu, defaultTab: "routine" });
              setClickMenu(null);
            }}
            onSelectNote={() => {
              setNotePicker({
                startTime: clickMenu.startTime,
                endTime: clickMenu.endTime,
                position: clickMenu.position,
              });
              setClickMenu(null);
            }}
            onClose={() => setClickMenu(null)}
          />
        )}

        {/* Routine picker panel */}
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

        {/* Note picker panel */}
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

        {/* Unified schedule panel */}
        {createPopover && (
          <TaskSchedulePanel
            position={createPopover.position}
            defaultStartTime={createPopover.startTime}
            defaultEndTime={createPopover.endTime}
            defaultTab={createPopover.defaultTab}
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
            onCreateEvent={(title, startTime, endTime, memo) => {
              const id = createScheduleItem(dateKey, title, startTime, endTime);
              if (id && memo) {
                updateScheduleItem(id, { memo });
              }
              setCreatePopover(null);
            }}
            recentEvents={scheduleItems.filter((si) => !si.routineId)}
            onDuplicateEvent={(event) => {
              createScheduleItem(
                dateKey,
                event.title,
                event.startTime,
                event.endTime,
              );
              setCreatePopover(null);
            }}
            routines={routines}
            routineGroups={routineGroups}
            routinesByGroup={routinesByGroup}
            onSelectRoutine={(routine, startTime, endTime) => {
              handleSelectRoutineForSchedule(routine, startTime, endTime);
              setCreatePopover(null);
            }}
            onSelectGroup={(group, members, startTime, endTime) => {
              handleSelectGroupForSchedule(group, members, startTime, endTime);
              setCreatePopover(null);
            }}
            onCreateRoutine={async (title, startTime, endTime) => {
              const routineId = `routine-${crypto.randomUUID()}`;
              await getDataService().createRoutine(
                routineId,
                title,
                startTime,
                endTime,
              );
              createScheduleItem(dateKey, title, startTime, endTime, routineId);
              setCreatePopover(null);
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
            onThisOnly={() => {
              // The current-day item update was applied with skipUndo in
              // handleUpdateScheduleItemTime. Push the equivalent undo entry now.
              const change = routineTimeChange;
              push("scheduleItem", {
                label: "updateScheduleItem",
                undo: () => {
                  updateScheduleItem(
                    change.itemId,
                    {
                      startTime: change.prevStartTime,
                      endTime: change.prevEndTime,
                    },
                    { skipUndo: true },
                  );
                },
                redo: () => {
                  updateScheduleItem(
                    change.itemId,
                    {
                      startTime: change.startTime,
                      endTime: change.endTime,
                    },
                    { skipUndo: true },
                  );
                },
              });
              setRoutineTimeChange(null);
            }}
            onApplyToRoutine={async () => {
              const change = routineTimeChange;
              const fromDate = dateKey;
              // Snapshot future items BEFORE applying the routine update so
              // undo can revert each one to its pre-change time. Use the
              // current-day item's pre-drag values from `change` since the
              // optimistic update on local state has already advanced.
              let allItems: ScheduleItem[] = [];
              try {
                allItems = await getDataService().fetchScheduleItemsByRoutineId(
                  change.routineId,
                );
              } catch (e) {
                logServiceError("ScheduleItems", "fetchByRoutine", e);
              }
              const futureSnapshot = allItems
                .filter(
                  (i) => i.date >= fromDate && !i.completed && !i.isDeleted,
                )
                .map((i) => ({
                  id: i.id,
                  startTime:
                    i.id === change.itemId ? change.prevStartTime : i.startTime,
                  endTime:
                    i.id === change.itemId ? change.prevEndTime : i.endTime,
                }));

              const prevRoutine = routines.find(
                (r) => r.id === change.routineId,
              );
              const prevRoutineStart = prevRoutine?.startTime ?? "09:00";
              const prevRoutineEnd = prevRoutine?.endTime ?? "09:30";

              // Apply forward (no individual undo entries)
              updateRoutine(
                change.routineId,
                {
                  startTime: change.startTime,
                  endTime: change.endTime,
                },
                { skipUndo: true },
              );
              try {
                await getDataService().updateFutureScheduleItemsByRoutine(
                  change.routineId,
                  {
                    startTime: change.startTime,
                    endTime: change.endTime,
                  },
                  fromDate,
                );
              } catch (e) {
                logServiceError("ScheduleItems", "updateFutureByRoutine", e);
              }

              // Push a single grouped undo entry covering all 3 forward writes.
              push("routine", {
                label: "Apply routine time change",
                undo: async () => {
                  updateRoutine(
                    change.routineId,
                    {
                      startTime: prevRoutineStart,
                      endTime: prevRoutineEnd,
                    },
                    { skipUndo: true },
                  );
                  // Revert current-day item locally so the open view updates.
                  updateScheduleItem(
                    change.itemId,
                    {
                      startTime: change.prevStartTime,
                      endTime: change.prevEndTime,
                    },
                    { skipUndo: true },
                  );
                  // Revert each future item via direct IPC. They aren't in
                  // current local state lists for non-current dates, so a
                  // local list update isn't needed; the next loadItemsForDate
                  // / loadScheduleItemsForMonth will pick up the reverted DB.
                  for (const fi of futureSnapshot) {
                    if (fi.id === change.itemId) continue; // handled above
                    try {
                      await getDataService().updateScheduleItem(fi.id, {
                        startTime: fi.startTime,
                        endTime: fi.endTime,
                      });
                    } catch (e) {
                      logServiceError("ScheduleItems", "undoFutureRevert", e);
                    }
                  }
                },
                redo: async () => {
                  updateRoutine(
                    change.routineId,
                    {
                      startTime: change.startTime,
                      endTime: change.endTime,
                    },
                    { skipUndo: true },
                  );
                  updateScheduleItem(
                    change.itemId,
                    {
                      startTime: change.startTime,
                      endTime: change.endTime,
                    },
                    { skipUndo: true },
                  );
                  try {
                    await getDataService().updateFutureScheduleItemsByRoutine(
                      change.routineId,
                      {
                        startTime: change.startTime,
                        endTime: change.endTime,
                      },
                      fromDate,
                    );
                  } catch (e) {
                    logServiceError("ScheduleItems", "redoFutureUpdate", e);
                  }
                },
              });
              setRoutineTimeChange(null);
            }}
            onCancel={() => {
              // The drag was applied with skipUndo, so cancellation simply
              // reverts visually + in DB without a new undo entry.
              updateScheduleItem(
                routineTimeChange.itemId,
                {
                  startTime: routineTimeChange.prevStartTime,
                  endTime: routineTimeChange.prevEndTime,
                },
                { skipUndo: true },
              );
              setRoutineTimeChange(null);
            }}
          />
        )}

        {editRoutineDialog && (
          <RoutineEditDialog
            routine={editRoutineDialog}
            routineGroups={routineGroups}
            initialGroupIds={
              routineGroupAssignments.get(editRoutineDialog.id) ?? []
            }
            onSubmit={async (
              title,
              startTime,
              endTime,
              groupIds,
              frequencyType,
              frequencyDays,
              frequencyInterval,
              frequencyStartDate,
              reminderEnabled,
              reminderOffset,
            ) => {
              updateRoutine(editRoutineDialog.id, {
                title,
                startTime,
                endTime,
                frequencyType,
                frequencyDays,
                frequencyInterval,
                frequencyStartDate,
                reminderEnabled,
                reminderOffset,
              });
              setGroupsForRoutine(editRoutineDialog.id, groupIds);
              const freqChanged =
                frequencyType !== editRoutineDialog.frequencyType ||
                JSON.stringify(frequencyDays) !==
                  JSON.stringify(editRoutineDialog.frequencyDays) ||
                frequencyInterval !== editRoutineDialog.frequencyInterval ||
                frequencyStartDate !== editRoutineDialog.frequencyStartDate;
              if (freqChanged) {
                const updatedRoutine: RoutineNode = {
                  ...editRoutineDialog,
                  title,
                  startTime: startTime ?? editRoutineDialog.startTime,
                  endTime: endTime ?? editRoutineDialog.endTime,
                  frequencyType,
                  frequencyDays,
                  frequencyInterval,
                  frequencyStartDate,
                  groupIds,
                };
                const firstGroup = groupIds
                  .map((id) => routineGroups.find((g) => g.id === id))
                  .find((g): g is RoutineGroup => Boolean(g));
                await reconcileRoutineScheduleItems(updatedRoutine, firstGroup);
                await loadItemsForDate(dateKey);
              }
              setEditRoutineDialog(null);
            }}
            onCreateGroup={async (
              name,
              color,
              freqType,
              freqDays,
              freqInterval,
              freqStartDate,
            ) => {
              const id = `rgroup-${crypto.randomUUID()}`;
              return createRoutineGroup(
                id,
                name,
                color,
                freqType,
                freqDays,
                freqInterval,
                freqStartDate,
              );
            }}
            onClose={() => setEditRoutineDialog(null)}
          />
        )}

        {/* All-day task preview popup */}
        {allDayTaskPreview && (
          <TaskPreviewPopup
            task={allDayTaskPreview.task}
            position={allDayTaskPreview.position}
            color={getTaskColor?.(allDayTaskPreview.task.id)}
            folderTag={getFolderTag?.(allDayTaskPreview.task.id)}
            onOpenDetail={() => {
              const taskId = allDayTaskPreview.task.id;
              setAllDayTaskPreview(null);
              onNavigateTask?.(taskId, {} as React.MouseEvent);
            }}
            onToggleStatus={
              onToggleTaskStatus
                ? () => onToggleTaskStatus(allDayTaskPreview.task.id)
                : undefined
            }
            onSetStatus={
              onSetTaskStatus
                ? (status) => onSetTaskStatus(allDayTaskPreview.task.id, status)
                : undefined
            }
            onStartTimer={
              onStartTimer
                ? () => {
                    const task = allDayTaskPreview.task;
                    setAllDayTaskPreview(null);
                    onStartTimer(task);
                  }
                : undefined
            }
            onDelete={() => {
              const taskId = allDayTaskPreview.task.id;
              setAllDayTaskPreview(null);
              onDeleteTask?.(taskId);
            }}
            onClearSchedule={() => {
              const taskId = allDayTaskPreview.task.id;
              setAllDayTaskPreview(null);
              onUnscheduleTask?.(taskId);
            }}
            onUpdateTitle={
              onUpdateTaskTitle
                ? (title) => onUpdateTaskTitle(allDayTaskPreview.task.id, title)
                : undefined
            }
            onUpdateSchedule={
              onUpdateTaskTime
                ? (scheduledAt, scheduledEndAt) =>
                    onUpdateTaskTime(
                      allDayTaskPreview.task.id,
                      scheduledAt,
                      scheduledEndAt ?? scheduledAt,
                    )
                : undefined
            }
            onUpdateAllDay={(isAllDay) => {
              updateNode(allDayTaskPreview.task.id, { isAllDay });
              setAllDayTaskPreview(null);
            }}
            onUpdateTimeMemo={
              onUpdateTaskTimeMemo
                ? (memo) =>
                    onUpdateTaskTimeMemo(allDayTaskPreview.task.id, memo)
                : undefined
            }
            onClose={() => setAllDayTaskPreview(null)}
          />
        )}

        {/* All-day schedule item preview popup */}
        {allDaySchedulePreview && (
          <ScheduleItemPreviewPopup
            item={allDaySchedulePreview.item}
            position={allDaySchedulePreview.position}
            onToggleComplete={() => {
              toggleComplete(allDaySchedulePreview.item.id);
              setAllDaySchedulePreview(null);
            }}
            onEditRoutine={
              allDaySchedulePreview.item.routineId
                ? () => {
                    const routine = routines.find(
                      (r) => r.id === allDaySchedulePreview.item.routineId,
                    );
                    setAllDaySchedulePreview(null);
                    if (routine) setEditRoutineDialog(routine);
                  }
                : undefined
            }
            onDelete={() => {
              const itemId = allDaySchedulePreview.item.id;
              setAllDaySchedulePreview(null);
              softDeleteScheduleItem(itemId);
            }}
            onUpdateTime={(startTime, endTime) =>
              handleUpdateScheduleItemTime(
                allDaySchedulePreview.item.id,
                startTime,
                endTime,
              )
            }
            onUpdateMemo={handleUpdateMemo}
            onUpdateDate={(newDate) =>
              updateScheduleItem(allDaySchedulePreview.item.id, {
                date: newDate,
              })
            }
            onUpdateAllDay={(isAllDay) => {
              updateScheduleItem(allDaySchedulePreview.item.id, { isAllDay });
              setAllDaySchedulePreview(null);
            }}
            onUpdateTitle={(title) =>
              updateScheduleItem(allDaySchedulePreview.item.id, { title })
            }
            onClose={() => setAllDaySchedulePreview(null)}
          />
        )}

        {editGroupDialog && (
          <RoutineGroupEditDialog
            group={editGroupDialog}
            memberRoutines={routinesByGroup.get(editGroupDialog.id) ?? []}
            groupTimeRange={groupTimeRange.get(editGroupDialog.id)}
            onSubmit={async (
              name,
              color,
              frequencyType,
              frequencyDays,
              frequencyInterval,
              frequencyStartDate,
            ) => {
              updateRoutineGroup(editGroupDialog.id, {
                name,
                color,
                frequencyType,
                frequencyDays,
                frequencyInterval,
                frequencyStartDate,
              });

              const freqChanged =
                frequencyType !== editGroupDialog.frequencyType ||
                JSON.stringify(frequencyDays) !==
                  JSON.stringify(editGroupDialog.frequencyDays) ||
                frequencyInterval !== editGroupDialog.frequencyInterval ||
                frequencyStartDate !== editGroupDialog.frequencyStartDate;
              if (freqChanged) {
                const updatedGroup = {
                  ...editGroupDialog,
                  name,
                  color,
                  frequencyType,
                  frequencyDays,
                  frequencyInterval,
                  frequencyStartDate,
                };
                const members = routinesByGroup.get(editGroupDialog.id) ?? [];
                for (const routine of members) {
                  await reconcileRoutineScheduleItems(routine, updatedGroup);
                }
                await loadItemsForDate(dateKey);
              }

              setEditGroupDialog(null);
            }}
            onUpdateRoutine={(id, updates) => updateRoutine(id, updates)}
            onClose={() => setEditGroupDialog(null)}
          />
        )}
      </div>
    </div>
  );
}
