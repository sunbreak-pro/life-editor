import { useState, useMemo, useEffect } from "react";
import { Filter, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTaskTreeContext } from "../../hooks/useTaskTreeContext";
import { useMemoContext } from "../../hooks/useMemoContext";
import { useCalendarContext } from "../../hooks/useCalendarContext";
import { useCalendar } from "../../hooks/useCalendar";
import { useRoutineContext } from "../../hooks/useRoutineContext";
import {
  getDescendantTasks,
  collectDescendantIds,
} from "../../utils/getDescendantTasks";
import { CalendarHeader } from "./CalendarHeader";
import { TaskCreatePopover } from "./TaskCreatePopover";
import { TaskPreviewPopup } from "./TaskPreviewPopup";
import { MemoPreviewPopup } from "./MemoPreviewPopup";
import { MonthlyView } from "./MonthlyView";
import { WeeklyTimeGrid } from "./WeeklyTimeGrid";
import { FolderDropdown } from "../shared/FolderDropdown";
import { useNoteContext } from "../../hooks/useNoteContext";
import type { MemoNode } from "../../types/memo";
import type { NoteNode } from "../../types/note";

interface CalendarViewProps {
  calendarMode?: "tasks" | "memo";
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
  onCreateNote?: (title: string) => void;
  onSelectMemo?: (date: string) => void;
  onSelectNote?: (noteId: string) => void;
  onStartTimer?: (taskId: string) => void;
}

function getInitialWeekStart(): Date {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

export function CalendarView({
  calendarMode,
  onSelectTask,
  onCreateTask,
  onCreateNote,
  onSelectMemo,
  onSelectNote,
  onStartTimer,
}: CalendarViewProps) {
  const { t } = useTranslation();
  const { nodes, getTaskColor, getFolderTagForTask, softDelete, updateNode } =
    useTaskTreeContext();
  const { memos } = useMemoContext();
  const { activeCalendar } = useCalendarContext();
  const { getRoutineCompletionForDate } = useRoutineContext();
  const { notes } = useNoteContext();

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
  const [viewMode, setViewMode] = useState<"month" | "week" | "3day">("month");
  const [filter, setFilter] = useState<"incomplete" | "completed">(
    "incomplete",
  );
  const [weekStartDate, setWeekStartDate] = useState<Date>(getInitialWeekStart);
  const [filterFolderId, setFilterFolderId] = useState<string | null>(null);

  const selectedFolderName = useMemo(() => {
    if (!filterFolderId) return null;
    return nodes.find((n) => n.id === filterFolderId)?.title ?? null;
  }, [filterFolderId, nodes]);
  const [createPopover, setCreatePopover] = useState<{
    date: Date;
    position: { x: number; y: number };
  } | null>(null);
  const [previewPopup, setPreviewPopup] = useState<{
    taskId: string;
    position: { x: number; y: number };
  } | null>(null);
  const [memoPreview, setMemoPreview] = useState<
    | { kind: "daily"; date: string; position: { x: number; y: number } }
    | { kind: "note"; noteId: string; position: { x: number; y: number } }
    | null
  >(null);

  const { tasksByDate, calendarDays, weekDays, threeDays } = useCalendar(
    filteredNodes,
    year,
    month,
    filter,
    weekStartDate,
  );

  // Build memos lookup by date
  const memosByDate = useMemo(() => {
    const map = new Map<string, MemoNode>();
    for (const memo of memos) {
      map.set(memo.date, memo);
    }
    return map;
  }, [memos]);

  // Build notes lookup by date (for memo mode)
  const notesByDate = useMemo(() => {
    if (calendarMode !== "memo") return new Map<string, NoteNode[]>();
    const map = new Map<string, NoteNode[]>();
    for (const note of notes) {
      if (note.isDeleted) continue;
      const dateKey = note.createdAt.substring(0, 10);
      const existing = map.get(dateKey);
      if (existing) existing.push(note);
      else map.set(dateKey, [note]);
    }
    return map;
  }, [notes, calendarMode]);

  const effectiveViewMode = calendarMode === "memo" ? "month" : viewMode;

  /* eslint-disable react-hooks/exhaustive-deps -- React Compiler auto-memoizes */
  const handlePrev = () => {
    if (viewMode === "week") {
      setWeekStartDate((prev) => {
        const d = new Date(prev);
        d.setDate(d.getDate() - 7);
        return d;
      });
    } else if (viewMode === "3day") {
      setWeekStartDate((prev) => {
        const d = new Date(prev);
        d.setDate(d.getDate() - 3);
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
    } else if (viewMode === "3day") {
      setWeekStartDate((prev) => {
        const d = new Date(prev);
        d.setDate(d.getDate() + 3);
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
    if (viewMode === "3day") {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      setWeekStartDate(d);
    } else {
      setWeekStartDate(getInitialWeekStart());
    }
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
      if (e.key === "m" && calendarMode !== "memo") {
        e.preventDefault();
        setViewMode((v) =>
          v === "month" ? "week" : v === "week" ? "3day" : "month",
        );
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

  // Filter memosByDate by folder
  const filteredMemosByDate = useMemo(() => {
    if (!filterFolderId) return memosByDate;
    return new Map<string, MemoNode>(); // フォルダ選択時はメモ非表示
  }, [filterFolderId, memosByDate]);

  const handleRequestCreate = (date: Date, e: React.MouseEvent) => {
    setPreviewPopup(null);
    setMemoPreview(null);
    setCreatePopover({ date, position: { x: e.clientX, y: e.clientY } });
  };

  const handleTaskClick = (taskId: string, e: React.MouseEvent) => {
    setCreatePopover(null);
    setMemoPreview(null);
    setPreviewPopup({ taskId, position: { x: e.clientX, y: e.clientY } });
  };

  const handleMemoChipClick = (date: string, e: React.MouseEvent) => {
    setCreatePopover(null);
    setPreviewPopup(null);
    setMemoPreview({
      kind: "daily",
      date,
      position: { x: e.clientX, y: e.clientY },
    });
  };

  const handleNoteChipClick = (noteId: string, e: React.MouseEvent) => {
    setCreatePopover(null);
    setPreviewPopup(null);
    setMemoPreview({
      kind: "note",
      noteId,
      position: { x: e.clientX, y: e.clientY },
    });
  };

  const previewTask = previewPopup
    ? (filteredNodes.find((n) => n.id === previewPopup.taskId) ??
      nodes.find((n) => n.id === previewPopup.taskId))
    : null;

  const memoPreviewData = useMemo(() => {
    if (!memoPreview) return null;
    if (memoPreview.kind === "daily") {
      const memo = memosByDate.get(memoPreview.date);
      if (!memo) return null;
      return {
        kind: "daily" as const,
        title: "Daily",
        content: memo.content || "",
        position: memoPreview.position,
      };
    }
    const note = notes.find((n) => n.id === memoPreview.noteId);
    if (!note) return null;
    return {
      kind: "note" as const,
      title: note.title || "Untitled",
      content: note.content || "",
      position: memoPreview.position,
    };
  }, [memoPreview, memosByDate, notes]);

  return (
    <div className="h-full flex flex-col overflow-auto">
      <div className="max-w-5xl mx-auto w-full pt-8 pb-4 py-4 flex-1">
        <CalendarHeader
          year={year}
          month={month}
          viewMode={effectiveViewMode}
          weekStartDate={weekStartDate}
          onPrev={handlePrev}
          onNext={handleNext}
          onToday={handleToday}
          onViewModeChange={setViewMode}
          calendarMode={calendarMode}
        />

        {/* Filter tabs + tag filter (tasks mode only) */}
        {calendarMode !== "memo" && (
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setFilter("incomplete")}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                filter === "incomplete"
                  ? "bg-notion-accent/10 text-notion-accent"
                  : "text-notion-text-secondary hover:bg-notion-hover"
              }`}
            >
              {t("calendar.incomplete")}
            </button>
            <button
              onClick={() => setFilter("completed")}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                filter === "completed"
                  ? "bg-notion-accent/10 text-notion-accent"
                  : "text-notion-text-secondary hover:bg-notion-hover"
              }`}
            >
              {t("calendar.completed")}
            </button>
            <div className="w-px h-4 bg-notion-border" />
            <FolderDropdown
              selectedId={filterFolderId}
              onSelect={setFilterFolderId}
              rootLabel={t("calendar.all")}
              panelMinWidth="min-w-44"
              trigger={
                <button
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-colors ${
                    filterFolderId
                      ? "bg-notion-accent/10 text-notion-accent"
                      : "text-notion-text-secondary hover:bg-notion-hover"
                  }`}
                >
                  <Filter size={13} />
                  <span>
                    {filterFolderId && selectedFolderName
                      ? selectedFolderName
                      : t("calendar.all")}
                  </span>
                  <ChevronDown size={12} />
                </button>
              }
            />
          </div>
        )}

        {effectiveViewMode === "month" ? (
          <MonthlyView
            days={calendarDays}
            tasksByDate={filteredTasksByDate}
            onSelectTask={handleTaskClick}
            onCreateTask={
              calendarMode !== "memo" && onCreateTask
                ? handleRequestCreate
                : undefined
            }
            getTaskColor={getTaskColor}
            getFolderTag={getFolderTagForTask}
            memosByDate={filteredMemosByDate}
            getRoutineCompletion={getRoutineCompletionForDate}
            calendarMode={calendarMode}
            notesByDate={notesByDate}
            onMemoChipClick={handleMemoChipClick}
            onNoteChipClick={handleNoteChipClick}
          />
        ) : (
          <WeeklyTimeGrid
            days={effectiveViewMode === "3day" ? threeDays : weekDays}
            tasksByDate={filteredTasksByDate}
            onSelectTask={handleTaskClick}
            onCreateTask={onCreateTask ? handleRequestCreate : undefined}
            getTaskColor={getTaskColor}
            getFolderTag={getFolderTagForTask}
            memosByDate={filteredMemosByDate}
            onSelectMemo={onSelectMemo}
            getRoutineCompletion={getRoutineCompletionForDate}
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
          onSubmitNote={
            calendarMode !== "tasks" && onCreateNote
              ? (title) => {
                  onCreateNote(title);
                  setCreatePopover(null);
                }
              : undefined
          }
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

      {memoPreview && memoPreviewData && (
        <MemoPreviewPopup
          kind={memoPreviewData.kind}
          title={memoPreviewData.title}
          content={memoPreviewData.content}
          position={memoPreviewData.position}
          onOpenDetail={() => {
            if (memoPreview.kind === "daily") {
              onSelectMemo?.(memoPreview.date);
            } else {
              onSelectNote?.(memoPreview.noteId);
            }
            setMemoPreview(null);
          }}
          onClose={() => setMemoPreview(null)}
        />
      )}
    </div>
  );
}
