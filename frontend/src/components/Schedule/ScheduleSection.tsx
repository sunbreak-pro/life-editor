import { useState, useCallback, useMemo, useContext, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import type { TabItem } from "../shared/SectionTabs";
import { SectionHeader } from "../shared/SectionHeader";
import { LAYOUT } from "../../constants/layout";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { CalendarView } from "../Tasks/Schedule/Calendar/CalendarView";
import { OneDaySchedule } from "../Tasks/Schedule/DayFlow/OneDaySchedule";
import type { DayFlowFilterTab } from "../Tasks/Schedule/DayFlow/OneDaySchedule";
import { DualDayFlowLayout } from "../Tasks/Schedule/DayFlow/DualDayFlowLayout";
import { DayFlowSidebarContent } from "../Tasks/Schedule/DayFlow/DayFlowSidebarContent";
import type { CategoryProgress } from "../Tasks/Schedule/DayFlow/DayFlowSidebarContent";
import { ScheduleSidebarContent } from "./ScheduleSidebarContent";
import type { CalendarContentFilter } from "../../types/calendarItem";
import { useTaskTreeContext } from "../../hooks/useTaskTreeContext";
import { useCalendar } from "../../hooks/useCalendar";
import { useScheduleContext } from "../../hooks/useScheduleContext";
import { useMemoContext } from "../../hooks/useMemoContext";
import { useNoteContext } from "../../hooks/useNoteContext";
import { formatDateKey } from "../../utils/dateKey";
import { RightSidebarContext } from "../../context/RightSidebarContext";
import { useUndoRedo } from "../shared/UndoRedo";

import type { TaskNode } from "../../types/taskTree";
import { ScheduleTasksContent } from "./ScheduleTasksContent";

export type ScheduleTab = "calendar" | "dayflow" | "tasks";

const CALENDAR_PROGRESS_TABS: readonly TabItem<DayFlowFilterTab>[] = [
  { id: "all", labelKey: "dayFlow.filterAll" },
  { id: "routine", labelKey: "dayFlow.filterRoutine" },
  { id: "tasks", labelKey: "dayFlow.filterTasks" },
  { id: "others", labelKey: "dayFlow.filterOthers" },
  { id: "daily", labelKey: "calendar.filterDaily" },
  { id: "notes", labelKey: "calendar.filterNotes" },
];

const SCHEDULE_TABS: readonly TabItem<ScheduleTab>[] = [
  { id: "calendar", labelKey: "tabs.calendar" },
  { id: "dayflow", labelKey: "tabs.dayflow" },
  { id: "tasks", labelKey: "tabs.tasks" },
];

interface ScheduleSectionProps {
  activeTab?: ScheduleTab;
  onTabChange?: (tab: ScheduleTab) => void;
  selectedTaskId?: string | null;
  onSelectTask?: (id: string) => void;
  filterFolderId?: string | null;
  onFilterChange?: (id: string | null) => void;
  onPlayTask?: (node: TaskNode) => void;
  onCalendarSelectTask: (taskId: string, e: React.MouseEvent) => void;
  onCreateTask?: (
    title: string,
    parentId: string | null,
    schedule: {
      scheduledAt: string;
      scheduledEndAt?: string;
      isAllDay?: boolean;
    },
  ) => void;
  onSelectMemo?: (date: string) => void;
  onSelectNote?: (noteId: string) => void;
  onCreateNote?: (title: string) => void;
}

export function ScheduleSection({
  activeTab: externalActiveTab,
  onTabChange: externalOnTabChange,
  selectedTaskId,
  onSelectTask,
  filterFolderId,
  onFilterChange,
  onPlayTask,
  onCalendarSelectTask,
  onCreateTask,
  onSelectMemo,
  onSelectNote,
  onCreateNote,
}: ScheduleSectionProps) {
  const { t } = useTranslation();
  const [internalActiveTab, setInternalActiveTab] =
    useState<ScheduleTab>("calendar");
  const activeTab = externalActiveTab ?? internalActiveTab;
  const setActiveTab = externalOnTabChange ?? setInternalActiveTab;
  const [dayFlowDate, setDayFlowDate] = useState<Date>(() => new Date());
  const [showRoutineManagement, setShowRoutineManagement] = useState(false);
  const [dayFlowFilterTab, setDayFlowFilterTab] =
    useState<DayFlowFilterTab>("all");
  const [isDualColumn, setIsDualColumn] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_KEYS.DAYFLOW_DUAL_COLUMN) === "true";
  });

  const toggleDualColumn = useCallback(() => {
    setIsDualColumn((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEYS.DAYFLOW_DUAL_COLUMN, String(next));
      return next;
    });
  }, []);

  // Calendar filter state (managed here for sidebar)
  const [calendarFilter] = useState<"incomplete" | "completed">("incomplete");
  const [calendarFilterFolderId, setCalendarFilterFolderId] = useState<
    string | null
  >(null);
  const [calendarContentFilter, setCalendarContentFilter] =
    useState<CalendarContentFilter>("all");

  // Calendar progress date state
  const [calendarProgressDate, setCalendarProgressDate] = useState<Date>(
    () => new Date(),
  );
  const [calendarProgressFilter, setCalendarProgressFilter] =
    useState<DayFlowFilterTab>("all");

  const { nodes, getTaskColor, getFolderTagForTask, updateNode, softDelete } =
    useTaskTreeContext();
  const { push: pushUndo } = useUndoRedo();
  const { memos } = useMemoContext();
  const { notes } = useNoteContext();

  const { tasksByDate } = useCalendar(
    nodes,
    dayFlowDate.getFullYear(),
    dayFlowDate.getMonth(),
    "incomplete",
    dayFlowDate,
  );

  const allTasksByDate = useMemo(() => {
    const map = new Map<string, typeof nodes>();
    for (const task of nodes) {
      if (task.type !== "task" || !task.scheduledAt || task.isDeleted) continue;
      const key = formatDateKey(new Date(task.scheduledAt));
      const existing = map.get(key);
      if (existing) existing.push(task);
      else map.set(key, [task]);
    }
    return map;
  }, [nodes]);

  const goToPrev = useCallback(() => {
    setDayFlowDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 1);
      return d;
    });
  }, []);

  const goToNext = useCallback(() => {
    setDayFlowDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 1);
      return d;
    });
  }, []);

  const goToToday = useCallback(() => {
    setDayFlowDate(new Date());
  }, []);

  const {
    routines,
    routineStats,
    scheduleItems,
    loadItemsForDate,
    refreshRoutineStats,
  } = useScheduleContext();

  // Load routine stats immediately when Schedule section is active
  useEffect(() => {
    if (routines.length > 0) {
      refreshRoutineStats(routines);
    }
  }, [routines, refreshRoutineStats]);

  const { portalTarget: rightSidebarTarget, requestOpen } =
    useContext(RightSidebarContext);

  // Always open right sidebar for both tabs
  useEffect(() => {
    requestOpen();
  }, [activeTab, requestOpen]);

  // DayFlow category progress calculation
  const dateKey = formatDateKey(dayFlowDate);
  const categoryProgress = useMemo((): Record<
    DayFlowFilterTab,
    CategoryProgress
  > => {
    const routineItems = scheduleItems.filter((i) => i.routineId !== null);
    const otherItems = scheduleItems.filter((i) => i.routineId === null);
    const dayTasks = tasksByDate.get(dateKey) ?? [];
    const allDayTasks = allTasksByDate.get(dateKey) ?? [];
    const taskIdSet = new Set<string>();
    const taskItems: TaskNode[] = [];
    for (const t of [...dayTasks, ...allDayTasks]) {
      if (!taskIdSet.has(t.id)) {
        taskIdSet.add(t.id);
        taskItems.push(t);
      }
    }
    const completedTasks = taskItems.filter((t) => t.status === "DONE").length;

    const routineCompleted = routineItems.filter((i) => i.completed).length;
    const otherCompleted = otherItems.filter((i) => i.completed).length;

    const allTotal = routineItems.length + otherItems.length + taskItems.length;
    const allCompleted = routineCompleted + otherCompleted + completedTasks;

    return {
      all: { completed: allCompleted, total: allTotal },
      tasks: { completed: completedTasks, total: taskItems.length },
      routine: { completed: routineCompleted, total: routineItems.length },
      others: { completed: otherCompleted, total: otherItems.length },
      daily: { completed: 0, total: 0 },
      notes: { completed: 0, total: 0 },
    };
  }, [scheduleItems, tasksByDate, allTasksByDate, dateKey]);

  // Calendar progress: load items for calendarProgressDate and compute progress
  const calendarProgressDateKey = formatDateKey(calendarProgressDate);

  // Calendar progress uses its own date for tasks lookup
  const { tasksByDate: calendarTasksByDate } = useCalendar(
    nodes,
    calendarProgressDate.getFullYear(),
    calendarProgressDate.getMonth(),
    "incomplete",
    calendarProgressDate,
  );

  // Load schedule items for calendar progress date (only when calendar tab active)
  useEffect(() => {
    if (activeTab === "calendar") {
      loadItemsForDate(calendarProgressDateKey);
    }
  }, [activeTab, calendarProgressDateKey, loadItemsForDate]);

  const calendarCategoryProgress = useMemo((): Record<
    DayFlowFilterTab,
    CategoryProgress
  > => {
    const routineItems = scheduleItems.filter((i) => i.routineId !== null);
    const otherItems = scheduleItems.filter((i) => i.routineId === null);
    const dayTasks = calendarTasksByDate.get(calendarProgressDateKey) ?? [];
    const allDayTasks = allTasksByDate.get(calendarProgressDateKey) ?? [];
    const taskIdSet = new Set<string>();
    const taskItems: TaskNode[] = [];
    for (const t of [...dayTasks, ...allDayTasks]) {
      if (!taskIdSet.has(t.id)) {
        taskIdSet.add(t.id);
        taskItems.push(t);
      }
    }
    const completedTasks = taskItems.filter((t) => t.status === "DONE").length;

    const routineCompleted = routineItems.filter((i) => i.completed).length;
    const otherCompleted = otherItems.filter((i) => i.completed).length;

    // Daily: memo exists for this date → 1/1, otherwise 0/0
    const hasDailyMemo = memos.some(
      (m) => m.date === calendarProgressDateKey && !m.isDeleted,
    );
    const dailyTotal = hasDailyMemo ? 1 : 0;
    const dailyCompleted = dailyTotal;

    // Notes: count non-deleted notes created on this date
    const notesForDate = notes.filter(
      (n) =>
        !n.isDeleted &&
        formatDateKey(new Date(n.createdAt)) === calendarProgressDateKey,
    );
    const notesTotal = notesForDate.length;
    const notesCompleted = notesTotal;

    const allTotal =
      routineItems.length +
      otherItems.length +
      taskItems.length +
      dailyTotal +
      notesTotal;
    const allCompleted =
      routineCompleted +
      otherCompleted +
      completedTasks +
      dailyCompleted +
      notesCompleted;

    return {
      all: { completed: allCompleted, total: allTotal },
      tasks: { completed: completedTasks, total: taskItems.length },
      routine: { completed: routineCompleted, total: routineItems.length },
      others: { completed: otherCompleted, total: otherItems.length },
      daily: { completed: dailyCompleted, total: dailyTotal },
      notes: { completed: notesCompleted, total: notesTotal },
    };
  }, [
    scheduleItems,
    calendarTasksByDate,
    allTasksByDate,
    calendarProgressDateKey,
    memos,
    notes,
  ]);

  // Handle date selection from CalendarView
  const handleCalendarDateSelect = useCallback((date: Date) => {
    setCalendarProgressDate(date);
  }, []);

  const handleUpdateTaskTime = useCallback(
    (taskId: string, scheduledAt: string, scheduledEndAt: string) => {
      updateNode(taskId, { scheduledAt, scheduledEndAt });
    },
    [updateNode],
  );

  const handleToggleTaskStatus = useCallback(
    (taskId: string) => {
      const task = nodes.find((n) => n.id === taskId);
      if (!task || task.type !== "task") return;

      // 3-state cycle: NOT_STARTED → IN_PROGRESS → DONE → NOT_STARTED
      const statusCycle: Record<string, string> = {
        NOT_STARTED: "IN_PROGRESS",
        IN_PROGRESS: "DONE",
        DONE: "NOT_STARTED",
      };
      const currentStatus = task.status ?? "NOT_STARTED";
      const newStatus = statusCycle[currentStatus] ?? "NOT_STARTED";
      const newCompletedAt =
        newStatus === "DONE" ? new Date().toISOString() : undefined;
      const origStatus = task.status;
      const origCompletedAt = task.completedAt;

      updateNode(taskId, { status: newStatus, completedAt: newCompletedAt });
      pushUndo("scheduleItem", {
        label: "toggleTaskStatus",
        undo: () =>
          updateNode(taskId, {
            status: origStatus,
            completedAt: origCompletedAt,
          }),
        redo: () =>
          updateNode(taskId, {
            status: newStatus,
            completedAt: newCompletedAt,
          }),
      });
    },
    [nodes, updateNode, pushUndo],
  );

  const handleDeleteTask = useCallback(
    (taskId: string) => {
      softDelete(taskId);
    },
    [softDelete],
  );

  const handleUpdateTaskTitle = useCallback(
    (taskId: string, title: string) => {
      updateNode(taskId, { title });
    },
    [updateNode],
  );

  const handleStartTimer = useCallback(
    (task: TaskNode) => {
      onPlayTask?.(task);
    },
    [onPlayTask],
  );

  const handleNavigateTask = useCallback(
    (taskId: string) => {
      onCalendarSelectTask(taskId, {} as React.MouseEvent);
    },
    [onCalendarSelectTask],
  );

  const handleUnscheduleTask = useCallback(
    (taskId: string) => {
      const task = nodes.find((n) => n.id === taskId);
      if (!task) return;
      const origScheduledAt = task.scheduledAt;
      const origScheduledEndAt = task.scheduledEndAt;
      updateNode(taskId, { scheduledAt: null, scheduledEndAt: null });
      pushUndo("scheduleItem", {
        label: "unscheduleTask",
        undo: () => {
          updateNode(taskId, {
            scheduledAt: origScheduledAt,
            scheduledEndAt: origScheduledEndAt,
          });
        },
        redo: () => {
          updateNode(taskId, { scheduledAt: null, scheduledEndAt: null });
        },
      });
    },
    [nodes, updateNode, pushUndo],
  );

  return (
    <div
      className={`h-full flex flex-col ${LAYOUT.CONTENT_PX} ${LAYOUT.CONTENT_PT} ${LAYOUT.CONTENT_PB}`}
    >
      <SectionHeader
        title={t("sidebar.schedule")}
        tabs={SCHEDULE_TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {rightSidebarTarget &&
        createPortal(
          <ScheduleSidebarContent
            routineStats={routineStats}
            showManagement={showRoutineManagement}
            onShowManagementChange={setShowRoutineManagement}
            activeDate={
              activeTab === "dayflow"
                ? dayFlowDate
                : activeTab === "calendar"
                  ? calendarProgressDate
                  : undefined
            }
            onSelectTask={(taskId) => {
              onSelectTask?.(taskId);
              setActiveTab("tasks");
            }}
          >
            {activeTab === "dayflow" && (
              <DayFlowSidebarContent
                date={dayFlowDate}
                activeFilter={dayFlowFilterTab}
                onFilterChange={setDayFlowFilterTab}
                categoryProgress={categoryProgress}
              />
            )}
            {activeTab === "calendar" && (
              <DayFlowSidebarContent
                date={calendarProgressDate}
                categoryProgress={calendarCategoryProgress}
                activeFilter={calendarProgressFilter}
                onFilterChange={(tab) => {
                  setCalendarProgressFilter(tab);
                  const mapping: Record<
                    DayFlowFilterTab,
                    CalendarContentFilter
                  > = {
                    all: "all",
                    tasks: "tasks",
                    routine: "routine",
                    others: "others",
                    daily: "daily",
                    notes: "notes",
                  };
                  setCalendarContentFilter(mapping[tab]);
                }}
                tabs={CALENDAR_PROGRESS_TABS}
              />
            )}
          </ScheduleSidebarContent>,
          rightSidebarTarget,
        )}

      <div className="flex-1 min-h-0">
        {activeTab === "calendar" ? (
          <CalendarView
            onSelectTask={(taskId) =>
              onCalendarSelectTask(taskId, {} as React.MouseEvent)
            }
            onCreateTask={onCreateTask}
            onSelectMemo={onSelectMemo}
            onSelectNote={onSelectNote}
            onCreateNote={onCreateNote}
            filter={calendarFilter}
            filterFolderId={calendarFilterFolderId}
            onFilterFolderChange={setCalendarFilterFolderId}
            contentFilter={calendarContentFilter}
            onDateSelect={handleCalendarDateSelect}
            onOpenRoutineManagement={() => setShowRoutineManagement(true)}
          />
        ) : activeTab === "tasks" ? (
          <ScheduleTasksContent
            selectedTaskId={selectedTaskId ?? null}
            onSelectTask={onSelectTask ?? (() => {})}
            filterFolderId={filterFolderId ?? null}
            onFilterChange={onFilterChange ?? (() => {})}
            onPlayTask={onPlayTask}
          />
        ) : isDualColumn ? (
          <DualDayFlowLayout
            getTaskColor={getTaskColor}
            getFolderTag={getFolderTagForTask}
            onUpdateTaskTime={handleUpdateTaskTime}
            onToggleTaskStatus={handleToggleTaskStatus}
            onUnscheduleTask={handleUnscheduleTask}
            onNavigateTask={handleNavigateTask}
            onDeleteTask={handleDeleteTask}
            onUpdateTaskTitle={handleUpdateTaskTitle}
            onStartTimer={handleStartTimer}
            onToggleDualColumn={toggleDualColumn}
          />
        ) : (
          <OneDaySchedule
            date={dayFlowDate}
            tasksByDate={tasksByDate}
            allTasksByDate={allTasksByDate}
            getTaskColor={getTaskColor}
            getFolderTag={getFolderTagForTask}
            onUpdateTaskTime={handleUpdateTaskTime}
            onPrevDate={goToPrev}
            onNextDate={goToNext}
            onToday={goToToday}
            filterTab={dayFlowFilterTab}
            onFilterTabChange={setDayFlowFilterTab}
            onToggleTaskStatus={handleToggleTaskStatus}
            onUnscheduleTask={handleUnscheduleTask}
            onNavigateTask={handleNavigateTask}
            onDeleteTask={handleDeleteTask}
            onUpdateTaskTitle={handleUpdateTaskTitle}
            onStartTimer={handleStartTimer}
            isDualColumn={isDualColumn}
            onToggleDualColumn={toggleDualColumn}
          />
        )}
      </div>
    </div>
  );
}
