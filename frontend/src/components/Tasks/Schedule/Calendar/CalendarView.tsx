import { useState, useMemo, useEffect } from "react";
import { useTaskTreeContext } from "../../../../hooks/useTaskTreeContext";
import { useCalendarContext } from "../../../../hooks/useCalendarContext";
import { useCalendar } from "../../../../hooks/useCalendar";
import {
  getDescendantTasks,
  collectDescendantIds,
} from "../../../../utils/getDescendantTasks";
import { CalendarHeader } from "./CalendarHeader";
import { TaskCreatePopover } from "./TaskCreatePopover";
import { TaskPreviewPopup } from "./TaskPreviewPopup";
import { MonthlyView } from "./MonthlyView";
import { WeeklyTimeGrid } from "./WeeklyTimeGrid";
import { useScheduleContext } from "../../../../hooks/useScheduleContext";

interface CalendarViewProps {
  onSelectTask: (taskId: string) => void;
  onCreateTask?: (
    title: string,
    parentId: string | null,
    schedule: {
      scheduledAt: string;
      scheduledEndAt?: string;
      isAllDay?: boolean;
    },
  ) => void;
  onStartTimer?: (taskId: string) => void;
  filter: "incomplete" | "completed";
  filterFolderId: string | null;
}

function getInitialWeekStart(): Date {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

export function CalendarView({
  onSelectTask,
  onCreateTask,
  onStartTimer,
  filter,
  filterFolderId,
}: CalendarViewProps) {
  const { nodes, getTaskColor, getFolderTagForTask, softDelete, updateNode } =
    useTaskTreeContext();
  const { activeCalendar } = useCalendarContext();
  const { loadRoutineItemsForMonth, getRoutineCompletionByDate } =
    useScheduleContext();

  // Filter nodes by active calendar's folder subtree
  const filteredNodes = useMemo(() => {
    if (!activeCalendar) return nodes;
    return getDescendantTasks(activeCalendar.folderId, nodes);
  }, [activeCalendar, nodes]);

  // Folder list for task creation popover
  const folders = useMemo(() => {
    return nodes.filter((n) => n.type === "folder" && !n.isDeleted);
  }, [nodes]);

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [weekStartDate, setWeekStartDate] = useState<Date>(getInitialWeekStart);
  const [createPopover, setCreatePopover] = useState<{
    date: Date;
    position: { x: number; y: number };
  } | null>(null);
  const [previewPopup, setPreviewPopup] = useState<{
    taskId: string;
    position: { x: number; y: number };
  } | null>(null);

  // Load routine items for the current month
  useEffect(() => {
    loadRoutineItemsForMonth(year, month);
  }, [year, month, loadRoutineItemsForMonth]);

  const { tasksByDate, calendarDays, weekDays } = useCalendar(
    filteredNodes,
    year,
    month,
    filter,
    weekStartDate,
  );

  /* eslint-disable react-hooks/exhaustive-deps -- React Compiler auto-memoizes */
  const handlePrev = () => {
    if (viewMode === "week") {
      setWeekStartDate((prev) => {
        const d = new Date(prev);
        d.setDate(d.getDate() - 7);
        return d;
      });
    } else {
      if (month === 0) {
        setMonth(11);
        setYear((y) => y - 1);
      } else setMonth((m) => m - 1);
    }
  };

  const handleNext = () => {
    if (viewMode === "week") {
      setWeekStartDate((prev) => {
        const d = new Date(prev);
        d.setDate(d.getDate() + 7);
        return d;
      });
    } else {
      if (month === 11) {
        setMonth(0);
        setYear((y) => y + 1);
      } else setMonth((m) => m + 1);
    }
  };

  const handleToday = () => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setWeekStartDate(getInitialWeekStart());
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const el = e.target as Element | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (el?.getAttribute("contenteditable") === "true") return;
      if (el?.closest?.('[contenteditable="true"]')) return;

      if (e.key === "j") {
        e.preventDefault();
        handleNext();
        return;
      }
      if (e.key === "k") {
        e.preventDefault();
        handlePrev();
        return;
      }
      if (e.key === "t") {
        e.preventDefault();
        handleToday();
        return;
      }
      if (e.key === "m") {
        e.preventDefault();
        setViewMode((v) => (v === "month" ? "week" : "month"));
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handlePrev, handleToday]);
  /* eslint-enable react-hooks/exhaustive-deps */

  // Filter tasksByDate by folder
  const filteredTasksByDate = useMemo(() => {
    if (!filterFolderId) return tasksByDate;
    const descendantIds = collectDescendantIds(filterFolderId, nodes);
    const map = new Map<string, typeof nodes>();
    for (const [date, tasks] of tasksByDate) {
      const matching = tasks.filter((task) => descendantIds.has(task.id));
      if (matching.length > 0) map.set(date, matching);
    }
    return map;
  }, [tasksByDate, filterFolderId, nodes]);

  const handleRequestCreate = (date: Date, e: React.MouseEvent) => {
    setPreviewPopup(null);
    setCreatePopover({ date, position: { x: e.clientX, y: e.clientY } });
  };

  const handleTaskClick = (taskId: string, e: React.MouseEvent) => {
    setCreatePopover(null);
    setPreviewPopup({ taskId, position: { x: e.clientX, y: e.clientY } });
  };

  const previewTask = previewPopup
    ? (filteredNodes.find((n) => n.id === previewPopup.taskId) ??
      nodes.find((n) => n.id === previewPopup.taskId))
    : null;

  return (
    <div className="h-full flex flex-col overflow-auto">
      <div className="max-w-5xl mx-auto w-full flex-1">
        <CalendarHeader
          year={year}
          month={month}
          viewMode={viewMode}
          weekStartDate={weekStartDate}
          onPrev={handlePrev}
          onNext={handleNext}
          onToday={handleToday}
          onViewModeChange={setViewMode}
        />

        {viewMode === "month" ? (
          <MonthlyView
            days={calendarDays}
            tasksByDate={filteredTasksByDate}
            onSelectTask={handleTaskClick}
            onCreateTask={onCreateTask ? handleRequestCreate : undefined}
            getTaskColor={getTaskColor}
            getFolderTag={getFolderTagForTask}
            getRoutineCompletion={getRoutineCompletionByDate}
          />
        ) : (
          <WeeklyTimeGrid
            days={weekDays}
            tasksByDate={filteredTasksByDate}
            onSelectTask={handleTaskClick}
            onCreateTask={onCreateTask ? handleRequestCreate : undefined}
            getTaskColor={getTaskColor}
            getFolderTag={getFolderTagForTask}
          />
        )}
      </div>

      {createPopover && (
        <TaskCreatePopover
          position={createPopover.position}
          date={createPopover.date}
          onSubmitTask={(title, parentId, schedule) => {
            onCreateTask?.(title, parentId, schedule);
            setCreatePopover(null);
          }}
          folders={folders}
          onClose={() => setCreatePopover(null)}
        />
      )}

      {previewPopup && previewTask && (
        <TaskPreviewPopup
          task={previewTask}
          position={previewPopup.position}
          color={getTaskColor(previewTask.id)}
          folderTag={getFolderTagForTask(previewTask.id)}
          onOpenDetail={() => {
            onSelectTask(previewTask.id);
            setPreviewPopup(null);
          }}
          onStartTimer={() => {
            onStartTimer?.(previewTask.id);
            setPreviewPopup(null);
          }}
          onDelete={() => {
            softDelete(previewTask.id);
            setPreviewPopup(null);
          }}
          onClearSchedule={() => {
            updateNode(previewTask.id, {
              scheduledAt: undefined,
              scheduledEndAt: undefined,
              isAllDay: undefined,
            });
            setPreviewPopup(null);
          }}
          onClose={() => setPreviewPopup(null)}
        />
      )}
    </div>
  );
}
