import { useState, useMemo, useEffect, useRef } from "react";
import { Check, Repeat } from "lucide-react";
import type { TaskNode } from "../../../../types/taskTree";
import { useTaskTreeContext } from "../../../../hooks/useTaskTreeContext";
import { useCalendarContext } from "../../../../hooks/useCalendarContext";
import { useMemoContext } from "../../../../hooks/useMemoContext";
import { useNoteContext } from "../../../../hooks/useNoteContext";
import { useCalendar } from "../../../../hooks/useCalendar";
import {
  getDescendantTasks,
  collectDescendantIds,
} from "../../../../utils/getDescendantTasks";
import { formatDateKey } from "../../../../utils/dateKey";
import type { CalendarItem } from "../../../../types/calendarItem";
import type { CalendarContentFilter } from "../../../../types/calendarItem";
import { CalendarHeader } from "./CalendarHeader";
import { TaskSchedulePanel } from "../../../shared/TaskSchedulePanel";
import { NoteCreatePopover } from "./NoteCreatePopover";
import { CreateItemPopover } from "./CreateItemPopover";
import { EventCreatePopover } from "./EventCreatePopover";
import { TaskPreviewPopup } from "./TaskPreviewPopup";
import { MemoPreviewPopup } from "./MemoPreviewPopup";
import { ScheduleItemPreviewPopup } from "../DayFlow/ScheduleItemPreviewPopup";
import { MonthlyView } from "./MonthlyView";
import { WeeklyTimeGrid } from "./WeeklyTimeGrid";
import { useScheduleContext } from "../../../../hooks/useScheduleContext";
import type { ScheduleItem } from "../../../../types/schedule";
import type { RoutineGroup } from "../../../../types/routineGroup";
import { useClickOutside } from "../../../../hooks/useClickOutside";

function GroupPreviewPopup({
  group,
  scheduleItems,
  position,
  onSelectItem,
  onClose,
}: {
  group: RoutineGroup;
  scheduleItems: ScheduleItem[];
  position: { x: number; y: number };
  onSelectItem: (item: ScheduleItem) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, onClose);
  const left = Math.min(position.x, window.innerWidth - 240 - 16);
  const top = Math.min(position.y, window.innerHeight - 200 - 16);

  return (
    <div
      ref={ref}
      className="fixed z-50 w-60 bg-notion-bg border border-notion-border rounded-lg shadow-xl"
      style={{ left, top }}
    >
      <div className="px-3 py-2 border-b border-notion-border flex items-center gap-2">
        <span
          className="w-3 h-3 rounded shrink-0"
          style={{ backgroundColor: group.color }}
        />
        <span className="text-sm font-medium text-notion-text truncate">
          {group.name}
        </span>
        <span className="text-[10px] text-notion-text-secondary ml-auto">
          {scheduleItems.length}
        </span>
      </div>
      <div className="p-1 max-h-48 overflow-y-auto">
        {scheduleItems.map((si) => (
          <button
            key={si.id}
            onClick={() => onSelectItem(si)}
            className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2 hover:bg-notion-hover transition-colors ${
              si.completed
                ? "text-notion-text-secondary line-through"
                : "text-notion-text"
            }`}
          >
            {si.completed ? (
              <Check size={10} className="text-green-500 shrink-0" />
            ) : (
              <Repeat size={10} className="text-emerald-500 shrink-0" />
            )}
            <span className="truncate">{si.title}</span>
            <span className="ml-auto text-[10px] text-notion-text-secondary shrink-0">
              {si.startTime}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

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
  onSelectMemo?: (date: string) => void;
  onSelectNote?: (noteId: string) => void;
  onCreateNote?: (title: string) => void;
  filter: "incomplete" | "completed";
  filterFolderId: string | null;
  onFilterFolderChange?: (folderId: string | null) => void;
  contentFilter?: CalendarContentFilter;
  onDateSelect?: (date: Date) => void;
  onOpenRoutineManagement?: () => void;
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
  onSelectMemo,
  onSelectNote,
  onCreateNote,
  filter,
  filterFolderId,
  onFilterFolderChange,
  contentFilter,
  onDateSelect,
  onOpenRoutineManagement,
}: CalendarViewProps) {
  const { nodes, getTaskColor, getFolderTagForTask, softDelete, updateNode } =
    useTaskTreeContext();
  const { activeCalendar } = useCalendarContext();
  const { memos, upsertMemo } = useMemoContext();
  const {
    notes,
    createNote: createNoteFromContext,
    updateNote,
    softDeleteNote,
  } = useNoteContext();
  const {
    loadScheduleItemsForMonth,
    getRoutineCompletionByDate,
    createScheduleItem,
    updateScheduleItem,
    deleteScheduleItem,
    toggleComplete,
    calendarTags,
    setTagsForScheduleItem,
    monthlyScheduleItems,
    groupForRoutine,
  } = useScheduleContext();

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
  const [noteCreatePopover, setNoteCreatePopover] = useState<{
    date: Date;
    position: { x: number; y: number };
  } | null>(null);
  const [createMenuPopover, setCreateMenuPopover] = useState<{
    date: Date;
    position: { x: number; y: number };
  } | null>(null);
  const [eventCreatePopover, setEventCreatePopover] = useState<{
    date: Date;
    position: { x: number; y: number };
  } | null>(null);
  const [previewPopup, setPreviewPopup] = useState<{
    taskId: string;
    position: { x: number; y: number };
  } | null>(null);
  const [memoPreview, setMemoPreview] = useState<{
    kind: "daily" | "note";
    title: string;
    content: string;
    position: { x: number; y: number };
    onOpenDetail: () => void;
    noteId?: string;
  } | null>(null);
  const [scheduleItemPreview, setScheduleItemPreview] = useState<{
    item: ScheduleItem;
    position: { x: number; y: number };
  } | null>(null);
  const [groupPreview, setGroupPreview] = useState<{
    item: CalendarItem;
    position: { x: number; y: number };
  } | null>(null);

  // Load schedule items for the current month
  useEffect(() => {
    loadScheduleItemsForMonth(year, month);
  }, [year, month, loadScheduleItemsForMonth]);

  const { tasksByDate, itemsByDate, calendarDays, weekDays } = useCalendar(
    filteredNodes,
    year,
    month,
    filter,
    weekStartDate,
    memos,
    notes,
    contentFilter,
    monthlyScheduleItems,
    groupForRoutine,
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

  // Pre-compute descendant IDs once for folder filtering
  const folderDescendantIds = useMemo(() => {
    if (!filterFolderId) return null;
    return collectDescendantIds(filterFolderId, nodes);
  }, [filterFolderId, nodes]);

  // Filter itemsByDate by folder (only affects task items)
  const filteredItemsByDate = useMemo(() => {
    if (!folderDescendantIds) return itemsByDate;
    const map = new Map<string, CalendarItem[]>();
    for (const [date, items] of itemsByDate) {
      const matching = items.filter(
        (item) => item.type !== "task" || folderDescendantIds.has(item.id),
      );
      if (matching.length > 0) map.set(date, matching);
    }
    return map;
  }, [itemsByDate, folderDescendantIds]);

  // Also keep filteredTasksByDate for WeeklyTimeGrid (which still uses TaskNode[])
  // When contentFilter is "routine", hide all tasks from time grid
  const filteredTasksByDate = useMemo(() => {
    if (contentFilter === "routine") return new Map<string, TaskNode[]>();
    if (!folderDescendantIds) return tasksByDate;
    const map = new Map<string, typeof nodes>();
    for (const [date, tasks] of tasksByDate) {
      const matching = tasks.filter((task) => folderDescendantIds.has(task.id));
      if (matching.length > 0) map.set(date, matching);
    }
    return map;
  }, [tasksByDate, folderDescendantIds]);

  const handleOpenCreateMenu = (date: Date, e: React.MouseEvent) => {
    setPreviewPopup(null);
    setMemoPreview(null);
    setCreatePopover(null);
    setNoteCreatePopover(null);
    setEventCreatePopover(null);
    setCreateMenuPopover({ date, position: { x: e.clientX, y: e.clientY } });
  };

  const handleRequestCreate = (date: Date, e: React.MouseEvent) => {
    setPreviewPopup(null);
    setMemoPreview(null);
    setNoteCreatePopover(null);
    setCreateMenuPopover(null);
    setCreatePopover({ date, position: { x: e.clientX, y: e.clientY } });
  };

  const handleRequestCreateNote = (date: Date, e: React.MouseEvent) => {
    setPreviewPopup(null);
    setMemoPreview(null);
    setCreatePopover(null);
    setCreateMenuPopover(null);
    setNoteCreatePopover({ date, position: { x: e.clientX, y: e.clientY } });
  };

  const handleRequestCreateEvent = (
    date: Date,
    position: { x: number; y: number },
  ) => {
    setPreviewPopup(null);
    setMemoPreview(null);
    setCreatePopover(null);
    setNoteCreatePopover(null);
    setCreateMenuPopover(null);
    setEventCreatePopover({ date, position });
  };

  const handleItemClick = (item: CalendarItem, e: React.MouseEvent) => {
    setCreatePopover(null);
    setNoteCreatePopover(null);
    setGroupPreview(null);

    if (item.type === "task") {
      setMemoPreview(null);
      setScheduleItemPreview(null);
      setPreviewPopup({
        taskId: item.id,
        position: { x: e.clientX, y: e.clientY },
      });
    } else if (item.type === "daily" && item.memo) {
      setPreviewPopup(null);
      setScheduleItemPreview(null);
      const memo = item.memo;
      setMemoPreview({
        kind: "daily",
        title: memo.date,
        content: memo.content,
        position: { x: e.clientX, y: e.clientY },
        onOpenDetail: () => {
          onSelectMemo?.(memo.date);
          setMemoPreview(null);
        },
      });
    } else if (item.type === "note" && item.note) {
      setPreviewPopup(null);
      setScheduleItemPreview(null);
      const note = item.note;
      setMemoPreview({
        kind: "note",
        title: note.title || "Untitled",
        content: note.content,
        position: { x: e.clientX, y: e.clientY },
        onOpenDetail: () => {
          onSelectNote?.(note.id);
          setMemoPreview(null);
        },
        noteId: note.id,
      });
    } else if (item.type === "routineGroup") {
      setPreviewPopup(null);
      setMemoPreview(null);
      setScheduleItemPreview(null);
      setGroupPreview({
        item,
        position: { x: e.clientX, y: e.clientY },
      });
    } else if (item.type === "event" && item.scheduleItem) {
      setPreviewPopup(null);
      setMemoPreview(null);
      setScheduleItemPreview({
        item: item.scheduleItem,
        position: { x: e.clientX, y: e.clientY },
      });
    }
  };

  const previewTask = previewPopup
    ? (filteredNodes.find((n) => n.id === previewPopup.taskId) ??
      nodes.find((n) => n.id === previewPopup.taskId))
    : null;

  // Check if a daily exists for the note-create date
  const noteCreateDateHasDaily = noteCreatePopover
    ? memos.some((m) => {
        const dateKey = formatDateKey(noteCreatePopover.date);
        return m.date === dateKey && !m.isDeleted;
      })
    : false;

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
          filterFolderId={filterFolderId}
          onFilterFolderChange={onFilterFolderChange}
        />

        {viewMode === "month" ? (
          <MonthlyView
            days={calendarDays}
            itemsByDate={filteredItemsByDate}
            onSelectItem={handleItemClick}
            onOpenRoutineManagement={onOpenRoutineManagement}
            onOpenCreateMenu={handleOpenCreateMenu}
            getTaskColor={getTaskColor}
            getRoutineCompletion={getRoutineCompletionByDate}
            onDateSelect={onDateSelect}
          />
        ) : (
          <WeeklyTimeGrid
            days={weekDays}
            tasksByDate={filteredTasksByDate}
            onSelectTask={(taskId, e) =>
              handleItemClick(
                {
                  id: taskId,
                  type: "task",
                  title: "",
                  color: "",
                  task: nodes.find((n) => n.id === taskId),
                },
                e,
              )
            }
            onCreateTask={onCreateTask ? handleRequestCreate : undefined}
            getTaskColor={getTaskColor}
            getFolderTag={getFolderTagForTask}
          />
        )}
      </div>

      {createPopover && (
        <TaskSchedulePanel
          position={createPopover.position}
          date={createPopover.date}
          existingTaskIds={
            new Set(
              (
                filteredTasksByDate.get(formatDateKey(createPopover.date)) ?? []
              ).map((t) => t.id),
            )
          }
          onSelectExistingTask={(task, schedule) => {
            updateNode(task.id, {
              scheduledAt: schedule.scheduledAt,
              scheduledEndAt: schedule.scheduledEndAt,
              isAllDay: schedule.isAllDay,
            });
            setCreatePopover(null);
          }}
          onCreateNewTask={(title, parentId, schedule) => {
            onCreateTask?.(title, parentId, schedule);
            setCreatePopover(null);
          }}
          folders={folders}
          onClose={() => setCreatePopover(null)}
        />
      )}

      {noteCreatePopover && (
        <NoteCreatePopover
          position={noteCreatePopover.position}
          date={noteCreatePopover.date}
          existingDailyDate={noteCreateDateHasDaily}
          onCreateNote={(title) => {
            if (onCreateNote) {
              onCreateNote(title);
            } else {
              createNoteFromContext(title);
            }
            setNoteCreatePopover(null);
          }}
          onCreateDaily={(dateKey) => {
            upsertMemo(dateKey, "");
            setNoteCreatePopover(null);
          }}
          onOpenExistingDaily={() => {
            const dateKey = formatDateKey(noteCreatePopover.date);
            onSelectMemo?.(dateKey);
            setNoteCreatePopover(null);
          }}
          onClose={() => setNoteCreatePopover(null)}
        />
      )}

      {createMenuPopover && (
        <CreateItemPopover
          position={createMenuPopover.position}
          onSelectTask={() => {
            const { date, position } = createMenuPopover;
            setCreateMenuPopover(null);
            handleRequestCreate(date, {
              clientX: position.x,
              clientY: position.y,
              stopPropagation: () => {},
            } as React.MouseEvent);
          }}
          onSelectNote={() => {
            const { date, position } = createMenuPopover;
            setCreateMenuPopover(null);
            handleRequestCreateNote(date, {
              clientX: position.x,
              clientY: position.y,
              stopPropagation: () => {},
            } as React.MouseEvent);
          }}
          onSelectDaily={() => {
            const dateKey = formatDateKey(createMenuPopover.date);
            const hasDaily = memos.some(
              (m) => m.date === dateKey && !m.isDeleted,
            );
            if (hasDaily) {
              onSelectMemo?.(dateKey);
            } else {
              upsertMemo(dateKey, "");
            }
            setCreateMenuPopover(null);
          }}
          onSelectEvent={() => {
            const { date, position } = createMenuPopover;
            setCreateMenuPopover(null);
            handleRequestCreateEvent(date, position);
          }}
          onClose={() => setCreateMenuPopover(null)}
        />
      )}

      {eventCreatePopover && (
        <EventCreatePopover
          position={eventCreatePopover.position}
          date={eventCreatePopover.date}
          calendarTags={calendarTags}
          onCreateEvent={(
            title,
            startTime,
            endTime,
            memo,
            tagIds,
            isAllDay,
          ) => {
            const dateKey = formatDateKey(eventCreatePopover.date);
            const id = createScheduleItem(
              dateKey,
              title,
              startTime,
              endTime,
              undefined,
              undefined,
              undefined,
              isAllDay,
            );
            if (memo) {
              updateScheduleItem(id, { memo });
            }
            if (tagIds.length > 0) {
              setTagsForScheduleItem(id, tagIds);
            }
            // Refresh monthly schedule items so the calendar displays the new event
            loadScheduleItemsForMonth(year, month);
            setEventCreatePopover(null);
          }}
          onClose={() => setEventCreatePopover(null)}
        />
      )}

      {scheduleItemPreview && (
        <ScheduleItemPreviewPopup
          item={scheduleItemPreview.item}
          position={scheduleItemPreview.position}
          onToggleComplete={() => {
            toggleComplete(scheduleItemPreview.item.id);
            loadScheduleItemsForMonth(year, month);
            setScheduleItemPreview(null);
          }}
          onUpdateMemo={(memo) => {
            updateScheduleItem(scheduleItemPreview.item.id, { memo });
            loadScheduleItemsForMonth(year, month);
          }}
          onUpdateTime={(startTime, endTime) => {
            updateScheduleItem(scheduleItemPreview.item.id, {
              startTime,
              endTime,
            });
            loadScheduleItemsForMonth(year, month);
          }}
          onDelete={() => {
            deleteScheduleItem(scheduleItemPreview.item.id);
            loadScheduleItemsForMonth(year, month);
            setScheduleItemPreview(null);
          }}
          onClose={() => setScheduleItemPreview(null)}
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
          onUpdateTitle={(title) => updateNode(previewTask.id, { title })}
          onUpdateSchedule={(scheduledAt, scheduledEndAt) => {
            updateNode(previewTask.id, {
              scheduledAt,
              scheduledEndAt,
              isAllDay: false,
            });
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

      {memoPreview && (
        <MemoPreviewPopup
          kind={memoPreview.kind}
          title={memoPreview.title}
          content={memoPreview.content}
          position={memoPreview.position}
          onOpenDetail={memoPreview.onOpenDetail}
          onClose={() => setMemoPreview(null)}
          onUpdateTitle={
            memoPreview.noteId
              ? (title) => updateNote(memoPreview.noteId!, { title })
              : undefined
          }
          onDelete={
            memoPreview.noteId
              ? () => {
                  softDeleteNote(memoPreview.noteId!);
                  setMemoPreview(null);
                }
              : undefined
          }
        />
      )}

      {groupPreview && groupPreview.item.routineGroup && (
        <GroupPreviewPopup
          group={groupPreview.item.routineGroup}
          scheduleItems={groupPreview.item.groupScheduleItems ?? []}
          position={groupPreview.position}
          onSelectItem={(si) => {
            setGroupPreview(null);
            setScheduleItemPreview({
              item: si,
              position: groupPreview.position,
            });
          }}
          onClose={() => setGroupPreview(null)}
        />
      )}
    </div>
  );
}
